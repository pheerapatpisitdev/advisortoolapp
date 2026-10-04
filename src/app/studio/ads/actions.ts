"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { myPages } from "@/lib/auth/pages";
import { getContent, type ContentItem } from "@/lib/content/store";
import { drawPoster } from "@/lib/content/poster-draw";
import {
  adManageAccounts, adManageToken, clearPendingAdsManage, readPendingAdsManage, saveAdManageAccount,
} from "@/lib/facebook/ads-manage-connection";
import { adsManageMissingEnv, adsManageOauthIsConfigured, listAdAccounts, tokenExpiry, type TokenExpiry } from "@/lib/facebook/oauth";
import * as launchStore from "@/lib/ads/launch-store";
import type { LaunchRow, LaunchStep as RowStep } from "@/lib/ads/launch-store";
import { activateLaunch, adEffectiveStatus, runLaunch, type LaunchResult } from "@/lib/ads/launch";
import { maxDailyBudgetThb } from "@/lib/ads/launch-limits";
import {
  createCampaign, getCampaign, listCampaignPieces, listCampaigns, updateCampaign, type AdCampaign,
} from "@/lib/ads/campaign-store";
import { adTab, tabCounts, type AdTab } from "@/lib/ads/campaign-view";
import { cardLaunch } from "@/lib/ads/ad-card";
import { contentProduct } from "@/lib/content/products";
import type { PiecePerson } from "@/lib/content/people";
import { THEMES, type PosterSpec } from "@/lib/content/poster";
import type { PolicyFinding } from "@/lib/content/policy";
import type { AdAccount } from "@/lib/facebook/ads-connection";
import { saveContentEdits, setContentStatus, type EditResult } from "@/app/studio/actions";

/**
 * The doors /studio/ads calls. Creating an ad spends the owner's money once it is switched on,
 * so every one of these starts by asking for the owner, and the page asks again.
 *
 * Whatever breaks underneath (the database, Meta, drawing the poster) is logged here and comes
 * back as a short Thai sentence: a server action that throws reaches the browser as a bare
 * "an error occurred", and the owner would be left not knowing whether an ad was made.
 */

const SOMETHING_BROKE = "ทำรายการไม่สำเร็จ ลองอีกครั้ง ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ";
/** a campaign's name and its "สิ่งที่อยากเน้น" (controller, 2026-10-04): generateContent reads the hint to 120 */
const NAME_MAX = 60;
const HINT_MAX = 120;
const NOT_IN_CAMPAIGN = "ชิ้นนี้ไม่ได้อยู่ในแคมเปญ";
const NO_CAMPAIGN = "ไม่พบแคมเปญนี้";

/** One launch as the page draws it. No Meta id but the ad's, and no token. */
export interface LaunchView {
  id: string;
  actId: string;
  pageId: string;
  step: RowStep;
  adId: string | null;
  error: string | null;
  activatedAt: string | null;
  /** what Meta says the ad is doing (ACTIVE, PAUSED, DISAPPROVED, ...); null when it would not say */
  effectiveStatus: string | null;
  /** whole baht a day, as it was saved */
  dailyBudgetBaht: number;
}

/**
 * The ad accounts the owner has connected for creating ads, as the list and the room both show
 * them. Names, currencies and dates only: no token leaves the server.
 */
export interface Connection {
  /** the ads-manage login is set up on this deployment (FB_ADS_MANAGE_CONFIG_ID) */
  configured: boolean;
  /** the names of the settings the login still lacks on this server, empty when configured */
  missing: string[];
  accounts: {
    id: string;
    name: string;
    currency: string | null;
    /** when Meta stops honouring the login; null when Meta would not say */
    expiresAt: string | null;
    /** false once Meta has already stopped honouring it; null when Meta would not say */
    tokenValid: boolean | null;
  }[];
  /** the ad accounts a half-finished login is waiting to choose between */
  choices: { id: string; name: string }[];
  maxDailyBudgetThb: number;
}

/** One ad piece on a campaign's card, with what the card and the edit page need. */
export interface LaunchPiece {
  id: string;
  createdAt: string;
  status: ContentItem["status"];
  headline: string;
  primaryText: string;
  description: string;
  hasPoster: boolean;
  poster: PosterSpec | null;
  /** who the picture was drawn with; null for none. A redraw sends it back, or the server would take the person off */
  person: PiecePerson | null;
  /** the angle and tone it was written in, as labels; null on pieces written before the grid */
  ad: { angle: string; tone: string } | null;
  /** Facebook's advertising rules it trips; empty on pieces written before the rules were checked */
  flags: { policy: PolicyFinding[] };
  /** the newest live launch of the piece in any account */
  launch: LaunchView | null;
  /** every live launch of the piece, one per ad account */
  launches: LaunchView[];
}

const view = (r: LaunchRow, effectiveStatus: string | null): LaunchView => ({
  id: r.id,
  actId: r.actId,
  pageId: r.pageId,
  step: r.step,
  adId: r.adId,
  error: r.error,
  activatedAt: r.activatedAt,
  effectiveStatus,
  dailyBudgetBaht: r.dailyBudgetMinor / 100,
});

/**
 * When each account's login runs out, asked of Meta's token inspector, once per distinct
 * token. Anything that fails is left out: the date is a courtesy, and the page that cannot
 * open because Meta was slow to answer about a date would be the worse page.
 */
async function expiries(ids: string[]): Promise<Map<string, TokenExpiry>> {
  const out = new Map<string, TokenExpiry>();
  const byToken = new Map<string, Promise<TokenExpiry | null>>();
  await Promise.all(ids.map(async (id) => {
    const token = await adManageToken(id).catch(() => null);
    if (!token) return;
    if (!byToken.has(token)) {
      byToken.set(token, tokenExpiry(token).catch((e) => { console.error("ads-manage token expiry unreadable:", e); return null; }));
    }
    const e = await byToken.get(token)!;
    if (e) out.set(id, e);
  }));
  return out;
}

async function pendingChoices(): Promise<{ id: string; name: string }[]> {
  try {
    const pending = await readPendingAdsManage();
    if (!pending) return [];
    return (await listAdAccounts(pending.token)).map((a) => ({ id: a.id, name: a.name }));
  } catch (e) {
    console.error("ads-manage pending accounts unreadable:", e);
    return [];
  }
}

/**
 * The ad-account strip both pages show. `accounts` is handed back as well, for looking up launches.
 */
async function connection(): Promise<{ connection: Connection; accounts: AdAccount[] }> {
  const [accounts, choices] = await Promise.all([adManageAccounts(), pendingChoices()]);
  const missing = adsManageMissingEnv();
  // the expiry is asked with the app's own id and secret; a server without them (a laptop
  // without the secret) would only log an error per account, so it does not ask
  const canAskMeta = !missing.includes("FB_APP_ID") && !missing.includes("FB_APP_SECRET");
  const expiry = canAskMeta ? await expiries(accounts.map((a) => a.id)) : new Map<string, TokenExpiry>();
  return {
    accounts,
    connection: {
      configured: adsManageOauthIsConfigured(),
      missing,
      accounts: accounts.map((a) => {
        const e = expiry.get(a.id);
        // the earlier of the token's own end and the end of the person's data access, as /admin/ads says it
        const ends = e ? [e.expiresAt, e.dataAccessExpiresAt].filter((d): d is string => Boolean(d)).sort()[0] ?? null : null;
        return { id: a.id, name: a.name, currency: a.currency, expiresAt: ends, tokenValid: e ? e.valid : null };
      }),
      choices,
      maxDailyBudgetThb: maxDailyBudgetThb(),
    },
  };
}

/**
 * The live launches of one piece, one per account, newest first. A table that cannot be read
 * (before its migration, or the database for a moment) leaves the piece showing no launch
 * rather than stopping the page.
 */
async function liveRows(pieceId: string, accounts: AdAccount[]): Promise<LaunchRow[]> {
  return (await Promise.all(accounts.map((a) =>
    launchStore.findLaunch(pieceId, a.id).catch((e) => { console.error("ad launch unreadable:", e); return null; }),
  ))).filter((r): r is LaunchRow => r !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Each piece's launches with what Meta says each ad is doing; one token read per account. */
async function launchViews(pieces: ContentItem[], accounts: AdAccount[]): Promise<LaunchView[][]> {
  const tokens = new Map<string, Promise<string | null>>();
  const tokenFor = (act: string) => tokens.get(act) ?? tokens.set(act, adManageToken(act).catch(() => null)).get(act)!;
  return Promise.all(pieces.map(async (p) => {
    const rows = await liveRows(p.id, accounts);
    return Promise.all(rows.map(async (r) => {
      const token = r.adId ? await tokenFor(r.actId) : null;
      // a failing Meta read is a missing label, not a missing page
      const status = r.adId && token ? await adEffectiveStatus(r.adId, token).catch(() => null) : null;
      return view(r, status);
    }));
  }));
}

/** The launch that decides a piece's tab: one switched on in any account, else the newest (the card shows the same one). */
const tabLaunch = cardLaunch;

/** A campaign's name, or its plan's when the owner gave none. */
const titleOf = (c: AdCampaign) => c.name ?? contentProduct(c.planHref)?.name ?? c.planHref;

/** Trimmed and held to `max`; nothing left is no value. */
function trimmed(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  return v.trim().slice(0, max).trim() || null;
}

/** A poster tone Studio can draw, or none (the writer picks). */
const themeOf = (v: unknown): string | null => (typeof v === "string" && (THEMES as readonly string[]).includes(v) ? v : null);

export interface AdsStudioHome {
  pages: { pageId: string; pageName: string }[];
  /** the Page the list is of; null when the owner has no Page connected */
  pageId: string | null;
  campaigns: {
    id: string;
    /** the owner's name for it, or the plan's */
    name: string;
    planHref: string;
    /** the newest piece with a poster, out of the bin, to draw on the card; null when none has one */
    cover: string | null;
    /** that piece's poster, for the card to draw through the poster route */
    coverPoster: PosterSpec | null;
    counts: Record<AdTab, number>;
  }[];
  connection: Connection;
  /** set when the campaigns could not be read, so the page says so rather than showing none */
  error: string | null;
}

/**
 * The list page: one Page's campaigns. A Page the owner does not have, or none, opens the first
 * one. The counts read the launch table but not Meta; the room asks Meta about each ad.
 */
export async function adsStudioHome(pageId?: string): Promise<AdsStudioHome> {
  await requireStaff("owner");
  const [pages, { connection: conn, accounts }] = await Promise.all([myPages(), connection()]);
  const shown = pages.map((p) => ({ pageId: p.pageId, pageName: p.pageName }));
  const page = shown.find((p) => p.pageId === pageId) ?? shown[0] ?? null;
  if (!page) return { pages: shown, pageId: null, campaigns: [], connection: conn, error: null };

  let campaigns: AdCampaign[];
  try {
    campaigns = await listCampaigns(page.pageId);
  } catch (e) {
    console.error("ad campaigns unreadable:", e);
    return { pages: shown, pageId: page.pageId, campaigns: [], connection: conn, error: SOMETHING_BROKE };
  }
  const cards = await Promise.all(campaigns.map(async (c) => {
    try {
      const pieces = await listCampaignPieces(c.id);
      const tabs = await Promise.all(pieces.map(async (p) => adTab(p, tabLaunch(await liveRows(p.id, accounts)))));
      const shown = pieces.find((p) => p.status !== "trashed" && p.output.poster) ?? null;
      return {
        id: c.id, name: titleOf(c), planHref: c.planHref, cover: shown?.id ?? null, coverPoster: shown?.output.poster ?? null, counts: tabCounts(tabs),
      };
    } catch (e) {
      // one campaign that cannot be counted is a card with no numbers, not a list that will not open
      console.error("ad campaign pieces unreadable:", e);
      return { id: c.id, name: titleOf(c), planHref: c.planHref, cover: null, coverPoster: null, counts: tabCounts([]) };
    }
  }));
  return { pages: shown, pageId: page.pageId, campaigns: cards, connection: conn, error: null };
}

export interface CampaignInput {
  pageId: string;
  planHref: string;
  name?: string | null;
  angles: number;
  tones: number;
  theme?: string | null;
  hint?: string | null;
}

/** A new campaign under one of the owner's Pages, for a plan Studio writes about. */
export async function createAdCampaign(input: CampaignInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const viewer = await requireStaff("owner");
  try {
    if (!contentProduct(input.planHref)) return { ok: false, error: "ไม่พบแบบประกันนี้" };
    const pages = await myPages();
    if (!pages.some((p) => p.pageId === input.pageId)) return { ok: false, error: "เพจนี้ยังไม่ได้เชื่อมกับระบบ" };
    const made = await createCampaign({
      pageId: input.pageId,
      planHref: input.planHref,
      name: trimmed(input.name, NAME_MAX),
      angles: Number(input.angles),
      tones: Number(input.tones),
      theme: themeOf(input.theme),
      hint: trimmed(input.hint, HINT_MAX),
      agentId: viewer.agentId,
    });
    await audit("create-ad-campaign", made.id, { pageId: made.pageId, planHref: made.planHref });
    revalidatePath("/studio/ads", "layout");
    return { ok: true, id: made.id };
  } catch (e) {
    console.error("createAdCampaign failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

export type AdCampaignRoom =
  | {
    ok: true;
    /** `title` is what to call it (its name, or the plan's); `name` stays the owner's own, null when blank */
    campaign: AdCampaign & { title: string; pageName: string | null; pageConnected: boolean };
    pieces: (LaunchPiece & { tab: AdTab })[];
    counts: Record<AdTab, number>;
    connection: Connection;
    /** every Page the owner has, so a launch made on another Page (from the page before Ads Studio) is named by its own */
    pages: { pageId: string; pageName: string }[];
  }
  /** no such campaign (a wrong or old id: back to the list), or, with `error`, it could not be read */
  | { ok: false; error?: string };

/**
 * A campaign's room: every piece in it, in the bin too, with its launches and what Meta says of
 * each ad. A campaign whose Page has since been disconnected still opens, saying so.
 */
export async function adCampaignRoom(id: string): Promise<AdCampaignRoom> {
  await requireStaff("owner");
  try {
    const campaign = await getCampaign(id);
    if (!campaign) return { ok: false };
    const [pages, { connection: conn, accounts }, items] = await Promise.all([myPages(), connection(), listCampaignPieces(campaign.id)]);
    const page = pages.find((p) => p.pageId === campaign.pageId) ?? null;
    const launches = await launchViews(items, accounts);
    const pieces = items.map((p, i) => ({
      id: p.id,
      createdAt: p.createdAt,
      status: p.status,
      headline: p.output.hooks[0] ?? "",
      primaryText: p.output.body ?? "",
      description: p.output.closing ?? "",
      hasPoster: Boolean(p.output.poster),
      poster: p.output.poster ?? null,
      person: p.output.person ?? null,
      ad: p.output.ad ?? null,
      flags: { policy: p.flags?.policy ?? [] },
      launch: launches[i][0] ?? null,
      launches: launches[i],
      tab: adTab(p, tabLaunch(launches[i])),
    }));
    return {
      ok: true,
      campaign: { ...campaign, title: titleOf(campaign), pageName: page?.pageName ?? null, pageConnected: page !== null },
      pieces,
      counts: tabCounts(pieces.map((p) => p.tab)),
      connection: conn,
      pages: pages.map((p) => ({ pageId: p.pageId, pageName: p.pageName })),
    };
  } catch (e) {
    console.error("adCampaignRoom failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

export interface CampaignPatch {
  name?: string | null;
  angles?: number;
  tones?: number;
  theme?: string | null;
  hint?: string | null;
}

/** The room's settings. The Page and the plan are set when the campaign is made and stay. */
export async function updateAdCampaign(id: string, patch: CampaignPatch): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff("owner");
  try {
    const campaign = await getCampaign(id);
    if (!campaign) return { ok: false, error: NO_CAMPAIGN };
    const clean: CampaignPatch = {};
    if (patch.name !== undefined) clean.name = trimmed(patch.name, NAME_MAX);
    if (patch.angles !== undefined) clean.angles = Number(patch.angles);
    if (patch.tones !== undefined) clean.tones = Number(patch.tones);
    if (patch.theme !== undefined) clean.theme = themeOf(patch.theme);
    if (patch.hint !== undefined) clean.hint = trimmed(patch.hint, HINT_MAX);
    await updateCampaign(campaign.id, clean);
    revalidatePath("/studio/ads", "layout");
    return { ok: true };
  } catch (e) {
    console.error("updateAdCampaign failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

/**
 * The edit page's save: an ad filed in a campaign, through Studio's own save, which checks the
 * words again and keeps the poster's photograph the server's. What was already launched on
 * Facebook does not change with it.
 */
export async function saveAdCopy(
  pieceId: string,
  edits: Parameters<typeof saveContentEdits>[1],
  opts?: Parameters<typeof saveContentEdits>[2],
): Promise<EditResult> {
  await requireStaff("owner");
  try {
    const piece = await getContent(pieceId);
    if (!piece || piece.format !== "ad") return { ok: false, error: "ไม่พบชิ้นโฆษณานี้" };
    if (!piece.campaignId) return { ok: false, error: NOT_IN_CAMPAIGN };
    const result = await saveContentEdits(pieceId, edits, opts);
    if (result.ok) revalidatePath("/studio/ads", "layout");
    return result;
  } catch (e) {
    console.error("saveAdCopy failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

/** a piece whose ad is switched on stays out of the bin: binning it here would leave the ad spending */
const LIVE_TRASH = "ปิดแอดนี้ก่อนทิ้ง";

/**
 * The bin for an ad piece, and back out of it (the bin is how a campaign is tidied; campaigns
 * are not deleted). A piece whose ad is switched on in any account is refused; one launched
 * and still paused may go. A launch table that cannot be read refuses too, rather than binning
 * a piece that may be spending.
 */
export async function setAdStatus(pieceId: string, status: "draft" | "trashed"): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff("owner");
  try {
    if (status !== "draft" && status !== "trashed") return { ok: false, error: SOMETHING_BROKE };
    const piece = await getContent(pieceId);
    if (!piece || piece.format !== "ad") return { ok: false, error: "ไม่พบชิ้นโฆษณานี้" };
    if (!piece.campaignId) return { ok: false, error: NOT_IN_CAMPAIGN };
    if (status === "trashed") {
      const accounts = await adManageAccounts();
      const rows = await Promise.all(accounts.map((a) => launchStore.findLaunch(piece.id, a.id)));
      if (rows.some((r) => r?.activatedAt)) return { ok: false, error: LIVE_TRASH };
    }
    const res = await setContentStatus(piece.id, status);
    if (!res.ok) return { ok: false, error: res.error ?? SOMETHING_BROKE };
    revalidatePath("/studio/ads", "layout");
    return { ok: true };
  } catch (e) {
    console.error("setAdStatus failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

export interface LaunchInput {
  pieceId: string;
  actId: string;
  link: string;
  dailyBudgetBaht: number;
  headline: string;
  primaryText: string;
  description: string;
  /** retire the live launch for this piece and account and make a new set; the page asks first */
  recreate?: boolean;
}

const refused = (error: string): LaunchResult => ({ ok: false, step: "check", error });

/**
 * Saves the piece as a paused ad. Nothing here switches an ad on.
 *
 * The piece, the ad account and the Page are all looked up here rather than trusted from the
 * form: the account's currency decides how the budget is read, and a Page or account the owner
 * has not connected is not one to build an ad on. The Page is the piece's campaign's; the form
 * does not name one.
 */
export async function launchAd(input: LaunchInput): Promise<LaunchResult> {
  const viewer = await requireStaff("owner");
  try {
    const piece = await getContent(input.pieceId);
    if (!piece || piece.status === "trashed" || piece.format !== "ad") return refused("ไม่พบชิ้นโฆษณานี้");
    const campaign = piece.campaignId ? await getCampaign(piece.campaignId) : null;
    if (!campaign) return refused(NOT_IN_CAMPAIGN);
    const pageId = campaign.pageId;
    const spec = piece.output.poster;
    if (!spec) return refused("ชิ้นนี้ยังไม่มีโปสเตอร์ สร้างโปสเตอร์ก่อนยิงแอด");

    const [accounts, pages] = await Promise.all([adManageAccounts(), myPages()]);
    const account = accounts.find((a) => a.id === input.actId);
    if (!account) return refused("บัญชีโฆษณานี้ยังไม่ได้เชื่อมสำหรับสร้างแอด");
    if (!pages.some((p) => p.pageId === pageId)) return refused("เพจนี้ไม่ได้เชื่อมกับระบบแล้ว");

    if (input.recreate) {
      // a request still running on the old launch would carry on beside the new one
      const old = await launchStore.findLaunch(input.pieceId, input.actId);
      if (old?.claimedAt && Date.now() - new Date(old.claimedAt).getTime() < launchStore.CLAIM_STALE_MS) {
        return refused("กำลังทำงานอยู่ รอสักครู่แล้วลองใหม่");
      }
    }

    const result = await runLaunch(
      {
        pieceId: input.pieceId,
        actId: input.actId,
        currency: account.currency,
        pageId,
        link: input.link,
        dailyBudgetBaht: input.dailyBudgetBaht,
        headline: input.headline,
        primaryText: input.primaryText,
        description: input.description,
        createdBy: viewer.agentId,
        recreate: input.recreate,
      },
      {
        store: launchStore,
        token: adManageToken,
        // the poster the owner approved is the one already loaded, drawn at Facebook's square
        poster: async (id) => (id === piece.id ? drawPoster(spec, "square") : null),
      },
    );
    await audit("launch-ad", result.launch?.adId ?? input.pieceId, {
      ok: result.ok,
      step: result.ok ? "ad" : result.step,
      error: result.ok ? undefined : result.error,
      launchId: result.launch?.id,
      pieceId: input.pieceId,
      actId: input.actId,
      pageId,
      adCampaignId: campaign.id,
      dailyBudgetBaht: input.dailyBudgetBaht,
      recreate: Boolean(input.recreate),
    });
    revalidatePath("/studio/ads", "layout");
    return result;
  } catch (e) {
    console.error("launchAd failed:", e);
    return refused(SOMETHING_BROKE);
  }
}

/** Finishes a login where the person may reach more than one ad account: the one picked is kept. */
export async function chooseAdManageAccount(actId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff("owner");
  try {
    const pending = await readPendingAdsManage();
    if (!pending) return { ok: false, error: "การเชื่อมต่อหมดอายุแล้ว กดเชื่อมบัญชีโฆษณาใหม่อีกครั้ง" };
    const a = (await listAdAccounts(pending.token)).find((x) => x.id === actId);
    if (!a) return { ok: false, error: "ไม่พบบัญชีนี้ในบัญชีที่เพิ่งเข้าสู่ระบบ" };
    await saveAdManageAccount({ id: a.id, name: a.name, currency: a.currency, token: pending.token, scopes: pending.scopes });
    await clearPendingAdsManage();
    await audit("connect-ads-manage", a.id, { name: a.name });
    revalidatePath("/studio/ads", "layout");
    return { ok: true };
  } catch (e) {
    console.error("chooseAdManageAccount failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

/**
 * The second press, the one that can spend. The reason a switch-on failed is not kept on the
 * launch row, so it is handed back here for the page to show.
 */
export async function activateAd(launchId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff("owner");
  let row: LaunchRow | null = null;
  // every press is recorded, success or not: it is the one that can start spending
  const record = (ok: boolean, error?: string) =>
    audit("activate-ad", launchId, { ok, error, adId: row?.adId, actId: row?.actId, pageId: row?.pageId, dailyBudgetMinor: row?.dailyBudgetMinor });
  try {
    row = await launchStore.getLaunch(launchId);
    const result = await activateLaunch(launchId, { store: launchStore, token: adManageToken });
    await record(result.ok, result.ok ? undefined : result.error);
    if (result.ok) revalidatePath("/studio/ads", "layout");
    return result;
  } catch (e) {
    console.error("activateAd failed:", e);
    await record(false, SOMETHING_BROKE).catch(() => {});
    return { ok: false, error: SOMETHING_BROKE };
  }
}
