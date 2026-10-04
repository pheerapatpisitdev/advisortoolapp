"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { myPages } from "@/lib/auth/pages";
import { cleanContact, getPageContact, savePageContact, type PageContact } from "@/lib/ads/page-contact";
import {
  getContent, type ContentItem,
} from "@/lib/content/store";
import { drawPoster } from "@/lib/content/poster-draw";
import {
  adManageAccounts, adManageToken, clearPendingAdsManage, readPendingAdsManage, saveAdManageAccount,
} from "@/lib/facebook/ads-manage-connection";
import { adsManageMissingEnv, adsManageOauthIsConfigured, listAdAccounts, tokenExpiry, type TokenExpiry } from "@/lib/facebook/oauth";
import * as launchStore from "@/lib/ads/launch-store";
import type { LaunchRow, LaunchStep as RowStep } from "@/lib/ads/launch-store";
import { adEffectiveStatus, thVerifiedIdentity } from "@/lib/ads/launch";
import { maxDailyBudgetThb } from "@/lib/ads/launch-limits";
import {
  createCampaign, deleteCampaign, getCampaign, listCampaignPieces, listCampaigns, updateCampaign, type AdCampaign,
} from "@/lib/ads/campaign-store";
import { adTab, tabCounts, type AdTab, type AdTabKey } from "@/lib/ads/campaign-view";
import * as sendStore from "@/lib/ads/send-store";
import {
  getSend, listSends, sentPieceIds, type AdSend, type AdSendItem, type SendObjective, type SendStep,
} from "@/lib/ads/send-store";
import {
  activateSend, pauseSend, resumeSend, runSend, SEND_CLAIM_STALE_MS, type SendDeps, type SendResult, type Skipped, type SwitchResult,
} from "@/lib/ads/send";
import { graph } from "@/lib/ads/graph";
import { listLeadForms, type LeadForms } from "@/lib/ads/lead-forms";
import { briefPick, painterPick, personPick, writerPick } from "@/lib/ads/picture-picks";
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
/** the brand's voice in the owner's words (controller, 2026-10-04): held like the hint */
const VOICE_MAX = 120;
const NO_PLAN = "ไม่พบแบบประกันนี้";
const PAGE_NOT_CONNECTED = "เพจนี้ยังไม่ได้เชื่อมกับระบบ";
const PAGE_GONE = "เพจนี้ไม่ได้เชื่อมกับระบบแล้ว";
const ACCOUNT_NOT_CONNECTED = "บัญชีโฆษณานี้ยังไม่ได้เชื่อมสำหรับสร้างแอด";
const ADS_NOT_CONNECTED = "ยังไม่ได้เชื่อมบัญชีโฆษณาสำหรับสร้างแอด กดเชื่อมบัญชีก่อน";
const FORM_NOT_ON_PAGE = "ฟอร์มนี้ไม่อยู่ในเพจหรือถูกปิดแล้ว โหลดรายชื่อฟอร์มใหม่แล้วเลือกอีกครั้ง";
const TOS_NOT_ACCEPTED = "เพจนี้ยังไม่ได้ยอมรับเงื่อนไขแอดลีดของ Facebook";

const NO_PIECES = "ยังไม่ได้เลือกแอด";
const IN_BIN = "ชิ้นนี้อยู่ในถังขยะ";
const ALREADY_SENT = "ชิ้นนี้ส่งขึ้น Facebook ไปแล้ว";
/** a piece whose picture is not drawn yet (or failed): sent bare, it would not be the ad the owner saw */
const PICTURE_PENDING = "รูปของชิ้นนี้ยังวาดไม่เสร็จ วาดรูปให้เสร็จก่อนส่ง";

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
  /** the ad accounts a finished Facebook login reached, waiting to be picked; currency so the page can say which can launch */
  choices: { id: string; name: string; currency: string | null }[];
  maxDailyBudgetThb: number;
  /** META_TH_VERIFIED_IDENTITY_ID is set: Meta refuses ad sets reaching Thailand without it */
  thIdentity: boolean;
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
  /**
   * the angle and tone it was written in, as labels (a long ad has no tone), who it was written
   * for, and the age its premium table is priced at (null before the table); null on pieces
   * written before the grid
   */
  ad: { angle: string; tone: string; reader: string; age: number | null } | null;
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

async function pendingChoices(): Promise<Connection["choices"]> {
  try {
    const pending = await readPendingAdsManage();
    if (!pending) return [];
    return (await listAdAccounts(pending.token)).map((a) => ({ id: a.id, name: a.name, currency: a.currency }));
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
      thIdentity: thVerifiedIdentity() !== null,
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
    counts: Record<AdTabKey, number>;
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
      const sent = await sentPieceIds(c.id);
      const tabs = await Promise.all(pieces.map(async (p) => adTab(p, sent.has(p.id) || (await liveRows(p.id, accounts)).length > 0)));
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
  /** no longer chosen by the owner; kept on the row, 1 when not sent */
  angles?: number;
  tones?: number;
  theme?: string | null;
  hint?: string | null;
  brandVoice?: string | null;
  /** ภาพและโมเดล (picture-picks.ts): anything not on the lists is kept as อัตโนมัติ / nobody / none */
  writer?: string | null;
  painter?: string | null;
  person?: PiecePerson | null;
  pictureBrief?: string | null;
}

/** A new campaign under one of the owner's Pages, for a plan Studio writes about. */
export async function createAdCampaign(input: CampaignInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const viewer = await requireStaff("owner");
  try {
    if (!contentProduct(input.planHref)) return { ok: false, error: NO_PLAN };
    const pages = await myPages();
    if (!pages.some((p) => p.pageId === input.pageId)) return { ok: false, error: PAGE_NOT_CONNECTED };
    const made = await createCampaign({
      pageId: input.pageId,
      planHref: input.planHref,
      name: trimmed(input.name, NAME_MAX),
      angles: Number(input.angles ?? 1),
      tones: Number(input.tones ?? 1),
      theme: themeOf(input.theme),
      hint: trimmed(input.hint, HINT_MAX),
      agentId: viewer.agentId,
      brandVoice: trimmed(input.brandVoice, VOICE_MAX),
      writer: writerPick(input.writer),
      painter: painterPick(input.painter),
      person: personPick(input.person),
      pictureBrief: briefPick(input.pictureBrief),
    });
    await audit("create-ad-campaign", made.id, { pageId: made.pageId, planHref: made.planHref });
    revalidatePath("/studio/ads", "layout");
    return { ok: true, id: made.id };
  } catch (e) {
    console.error("createAdCampaign failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

/** One piece's ad in a send, as the sent tab draws it. */
export interface SendItemView {
  id: string;
  pieceId: string | null;
  /** Meta's ad id; null while the ad is not made */
  adId: string | null;
  /** why this piece's ad could not be made; null when it could */
  error: string | null;
  /** what Meta says the ad is doing (ACTIVE, PAUSED, DISAPPROVED, ...); null without an ad or when Meta would not say */
  effectiveStatus: string | null;
  /**
   * The ad was made after the send was last switched on (Meta's created_time later than
   * activatedAt), so it is still paused until the next press. False for a send never switched on
   * or an item with no ad; null when Meta would not say when the ad was made.
   */
  madeAfterActivation: boolean | null;
}

/**
 * One batch send as the sent tab draws it. No token, and no Meta id but the ads': whether the
 * send has a Meta campaign is what the buttons need — Pause is offered whenever it has one,
 * whatever activatedAt says, since a switch-on that broke half-way can leave the campaign on.
 */
export interface SendView {
  id: string;
  createdAt: string;
  actId: string;
  pageId: string;
  link: string;
  currency: string;
  dailyBudgetBaht: number;
  objective: SendObjective;
  step: SendStep;
  error: string | null;
  activatedAt: string | null;
  pausedAt: string | null;
  hasMetaCampaign: boolean;
  hasAdset: boolean;
  /** a request holds the send right now (sending, retrying, switching): the buttons wait */
  running: boolean;
  /** what Meta says the campaign is doing; null without one or when Meta would not say */
  metaStatus: string | null;
  /** how many of its ads were made after it was switched on, and so are still paused */
  madeAfterActivation: number;
  items: SendItemView[];
}

export type AdCampaignRoom =
  | {
    ok: true;
    /** `title` is what to call it (its name, or the plan's); `name` stays the owner's own, null when blank */
    campaign: AdCampaign & { title: string; pageName: string | null; pageConnected: boolean };
    pieces: (LaunchPiece & { tab: AdTab })[];
    counts: Record<AdTabKey, number>;
    /** the campaign's live batch sends, newest first */
    sends: SendView[];
    connection: Connection;
    /** every Page the owner has, so a launch made on another Page (from the page before Ads Studio) is named by its own */
    pages: { pageId: string; pageName: string }[];
  }
  /** no such campaign (a wrong or old id: back to the list), or, with `error`, it could not be read */
  | { ok: false; error?: string };

/** A piece's words as its ad carries them: the first hook is the headline. */
const wordsOf = (p: ContentItem) => ({ headline: p.output.hooks[0] ?? "", primaryText: p.output.body ?? "", description: p.output.closing ?? "" });

/** Fields of one Meta object, or null for anything that goes wrong: a status is a label, never a reason not to open. */
async function metaFields(id: string | null, fields: string, token: string | null): Promise<Record<string, unknown> | null> {
  // the id becomes a Graph path; a stray "/" or "?" would ask Meta about something else
  if (!id || !token || !/^\w+$/.test(id)) return null;
  try {
    const r = await graph(fetch, token, `${id}?fields=${fields}`);
    return r.ok ? r.body : null;
  } catch {
    return null;
  }
}

/** Meta's created_time ("2026-10-04T03:01:00+0000") as milliseconds, or null. */
function metaTime(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(t) ? null : t;
}

/**
 * The campaign's sends with what Meta says of each campaign and ad. Items keep no time of their
 * own, so whether an ad was made after the send was switched on is read from Meta's created_time:
 * activateSend stamps activatedAt only once every ad then made is on, and a resume cannot run
 * while it holds the claim, so an ad made later than that stamp is one that press did not reach.
 */
async function sendViews(list: (AdSend & { items: AdSendItem[] })[]): Promise<SendView[]> {
  const tokens = new Map<string, Promise<string | null>>();
  const tokenFor = (act: string) => tokens.get(act) ?? tokens.set(act, adManageToken(act).catch(() => null)).get(act)!;
  return Promise.all(list.map(async (s) => {
    const token = await tokenFor(s.actId);
    const on = s.activatedAt ? Date.parse(s.activatedAt) : null;
    const [campaignFields, items] = await Promise.all([
      metaFields(s.metaCampaignId, "effective_status", token),
      Promise.all(s.items.map(async (i): Promise<SendItemView> => {
        const f = i.adId ? await metaFields(i.adId, "effective_status,created_time", token) : null;
        const made = metaTime(f?.created_time);
        return {
          id: i.id,
          pieceId: i.pieceId,
          adId: i.adId,
          error: i.error,
          effectiveStatus: typeof f?.effective_status === "string" ? f.effective_status : null,
          madeAfterActivation: on === null || !i.adId ? false : made === null ? null : made > on,
        };
      })),
    ]);
    const claimed = s.claimedAt ? Date.parse(s.claimedAt) : NaN;
    return {
      id: s.id,
      createdAt: s.createdAt,
      actId: s.actId,
      pageId: s.pageId,
      link: s.link,
      currency: s.currency,
      dailyBudgetBaht: s.dailyBudgetMinor / 100,
      objective: s.objective,
      step: s.step,
      error: s.error,
      activatedAt: s.activatedAt,
      pausedAt: s.pausedAt,
      hasMetaCampaign: Boolean(s.metaCampaignId),
      hasAdset: Boolean(s.adsetId),
      running: !Number.isNaN(claimed) && Date.now() - claimed < SEND_CLAIM_STALE_MS,
      metaStatus: typeof campaignFields?.effective_status === "string" ? campaignFields.effective_status : null,
      madeAfterActivation: items.filter((i) => i.madeAfterActivation === true).length,
      items,
    };
  }));
}

/**
 * A campaign's room: every piece in it, in the bin too, with its launches and what Meta says of
 * each ad, and the batch sends. A campaign whose Page has since been disconnected still opens, saying so.
 */
export async function adCampaignRoom(id: string): Promise<AdCampaignRoom> {
  await requireStaff("owner");
  try {
    const campaign = await getCampaign(id);
    if (!campaign) return { ok: false };
    const [pages, { connection: conn, accounts }, items, liveSends] = await Promise.all([
      myPages(), connection(), listCampaignPieces(campaign.id), listSends(campaign.id),
    ]);
    const page = pages.find((p) => p.pageId === campaign.pageId) ?? null;
    const sent = new Set(liveSends.flatMap((s) => s.items.flatMap((i) => (i.pieceId ? [i.pieceId] : []))));
    const [launches, sends] = await Promise.all([launchViews(items, accounts), sendViews(liveSends)]);
    const pieces = items.map((p, i) => ({
      id: p.id,
      createdAt: p.createdAt,
      status: p.status,
      ...wordsOf(p),
      hasPoster: Boolean(p.output.poster),
      poster: p.output.poster ?? null,
      person: p.output.person ?? null,
      ad: p.output.ad
        ? { angle: p.output.ad.angle, tone: p.output.ad.tone, reader: p.output.ad.reader ?? "", age: p.output.ad.age ?? null }
        : null,
      flags: { policy: p.flags?.policy ?? [] },
      launch: launches[i][0] ?? null,
      launches: launches[i],
      tab: adTab(p, sent.has(p.id) || launches[i].length > 0),
    }));
    return {
      ok: true,
      campaign: { ...campaign, title: titleOf(campaign), pageName: page?.pageName ?? null, pageConnected: page !== null },
      pieces,
      counts: tabCounts(pieces.map((p) => p.tab)),
      sends,
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
  brandVoice?: string | null;
  writer?: string | null;
  painter?: string | null;
  person?: PiecePerson | null;
  pictureBrief?: string | null;
}

/** The room's settings. The Page and the plan are set when the campaign is made and stay. */
export async function updateAdCampaign(id: string, patch: CampaignPatch): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff("owner");
  try {
    const campaign = await getCampaign(id);
    if (!campaign) return { ok: false, error: NO_CAMPAIGN };
    const clean: Parameters<typeof updateCampaign>[1] = {};
    if (patch.name !== undefined) clean.name = trimmed(patch.name, NAME_MAX);
    if (patch.angles !== undefined) clean.angles = Number(patch.angles);
    if (patch.tones !== undefined) clean.tones = Number(patch.tones);
    if (patch.theme !== undefined) clean.theme = themeOf(patch.theme);
    if (patch.hint !== undefined) clean.hint = trimmed(patch.hint, HINT_MAX);
    if (patch.brandVoice !== undefined) clean.brandVoice = trimmed(patch.brandVoice, VOICE_MAX);
    if (patch.writer !== undefined) clean.writer = writerPick(patch.writer);
    if (patch.painter !== undefined) clean.painter = painterPick(patch.painter);
    if (patch.person !== undefined) clean.person = personPick(patch.person);
    if (patch.pictureBrief !== undefined) clean.pictureBrief = briefPick(patch.pictureBrief);
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
/** a piece in a send, or with a live launch, is Facebook's now: changing its status or binning it would not match what was sent */
const SENT_LOCKED = "ชิ้นนี้ส่งขึ้น Facebook แล้ว แก้สถานะไม่ได้";

/**
 * Draft, used (kept for pieces approved earlier), or the bin for an ad piece (the bin is how a campaign is
 * tidied; a whole campaign goes with deleteAdCampaign). A piece already sent to Facebook — in a send that was not
 * retired, or with a live launch in any account — keeps its status. A piece whose ad is switched
 * on says to close the ad first. A send or launch table that cannot be read refuses too, rather
 * than changing a piece that may be spending.
 */
export async function setAdStatus(pieceId: string, status: "draft" | "used" | "trashed"): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff("owner");
  try {
    if (status !== "draft" && status !== "used" && status !== "trashed") return { ok: false, error: SOMETHING_BROKE };
    const piece = await getContent(pieceId);
    if (!piece || piece.format !== "ad") return { ok: false, error: "ไม่พบชิ้นโฆษณานี้" };
    if (!piece.campaignId) return { ok: false, error: NOT_IN_CAMPAIGN };
    const accounts = await adManageAccounts();
    const rows = await Promise.all(accounts.map((a) => launchStore.findLaunch(piece.id, a.id)));
    if (status === "trashed" && rows.some((r) => r?.activatedAt)) return { ok: false, error: LIVE_TRASH };
    if (rows.some((r) => r !== null) || (await sentPieceIds(piece.campaignId)).has(piece.id)) return { ok: false, error: SENT_LOCKED };
    const res = await setContentStatus(piece.id, status);
    if (!res.ok) return { ok: false, error: res.error ?? SOMETHING_BROKE };
    revalidatePath("/studio/ads", "layout");
    return { ok: true };
  } catch (e) {
    console.error("setAdStatus failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

/** a campaign with an ad spending stays: deleting it would take away the room's pause button */
const LIVE_DELETE = "แคมเปญนี้มีแอดที่เปิดใช้อยู่ — หยุดแอดก่อนลบแคมเปญ";

/**
 * Deletes a campaign from Ads Studio. Refused while any of its ads is switched on — a send
 * switched on and not paused since, or a piece's launch marked on — since the room is where it
 * would be paused. What was sent stays on Facebook, paused, and its send rows stay as history;
 * the pieces stay too, filed under no campaign (ads never show in Organic Studio). A send or
 * launch table that cannot be read refuses, rather than deleting a campaign that may be spending.
 */
export async function deleteAdCampaign(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff("owner");
  try {
    const campaign = await getCampaign(id);
    if (!campaign) return { ok: false, error: NO_CAMPAIGN };
    const [sends, pieces, accounts] = await Promise.all([listSends(campaign.id), listCampaignPieces(campaign.id), adManageAccounts()]);
    const sendOn = sends.some((s) => s.activatedAt && (!s.pausedAt || Date.parse(s.pausedAt) < Date.parse(s.activatedAt)));
    const rows = await Promise.all(pieces.flatMap((p) => accounts.map((a) => launchStore.findLaunch(p.id, a.id))));
    if (sendOn || rows.some((r) => r?.activatedAt)) return { ok: false, error: LIVE_DELETE };
    await deleteCampaign(campaign.id);
    await audit("ads-campaign-delete", campaign.id, { ok: true, name: titleOf(campaign), pageId: campaign.pageId, sends: sends.length, pieces: pieces.length });
    revalidatePath("/studio/ads", "layout");
    return { ok: true };
  } catch (e) {
    console.error("deleteAdCampaign failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

/**
 * Keeps the ad accounts picked from a finished Facebook login, any number at once (owner,
 * 2026-10-04), each with the login's token. The waiting login is cleared only when every pick
 * was kept: an account that could not be saved is named and can be picked again from the same
 * list, without another Facebook login.
 */
export async function chooseAdManageAccounts(actIds: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff("owner");
  const ids = [...new Set(actIds)];
  if (ids.length === 0) return { ok: false, error: "ยังไม่ได้เลือกบัญชีโฆษณา" };
  try {
    const pending = await readPendingAdsManage();
    if (!pending) return { ok: false, error: "การเชื่อมต่อหมดอายุแล้ว กดเชื่อมบัญชีโฆษณาใหม่อีกครั้ง" };
    const available = await listAdAccounts(pending.token);
    const failed: string[] = [];
    for (const id of ids) {
      const a = available.find((x) => x.id === id);
      if (!a) { failed.push(`${id} (ไม่พบในบัญชีที่เพิ่งเข้าสู่ระบบ)`); continue; }
      try {
        await saveAdManageAccount({ id: a.id, name: a.name, currency: a.currency, token: pending.token, scopes: pending.scopes });
        await audit("connect-ads-manage", a.id, { name: a.name });
      } catch (e) {
        console.error("chooseAdManageAccounts: saving", a.id, "failed:", e);
        failed.push(a.name);
      }
    }
    revalidatePath("/studio/ads", "layout");
    if (failed.length > 0) return { ok: false, error: `เชื่อมไม่สำเร็จ: ${failed.join(", ")} — ลองเลือกใหม่อีกครั้ง` };
    await clearPendingAdsManage();
    return { ok: true };
  } catch (e) {
    console.error("chooseAdManageAccounts failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

const refusedSend = (error: string, skipped?: Skipped[]): SendResult => ({ ok: false, step: "check", error, ...(skipped ? { skipped } : {}) });

/**
 * A piece whose poster has no picture yet (still drawing, or the draw failed) has the plain
 * poster: sent like that, the ad would not be the one the owner saw.
 */
const picturePending = (p: ContentItem) => Boolean(p.output.poster && !p.output.poster.background);

/**
 * Where the send engine gets each piece's poster and words: the pieces already loaded, or the
 * content store. A poster that cannot be drawn is no poster — the engine leaves that piece out
 * with its reason rather than a throw stopping the whole batch.
 */
function sendDeps(startedAt: number, known: Map<string, ContentItem> = new Map()): SendDeps {
  const pieceOf = async (id: string) => known.get(id) ?? (await getContent(id));
  return {
    // the engine's time budget counts from the press, so the reads before it count too
    startedAt,
    store: sendStore,
    token: adManageToken,
    poster: async (id) => {
      try {
        const p = await pieceOf(id);
        const spec = p?.output.poster;
        if (!p || !spec || picturePending(p)) return null;
        return await drawPoster(spec, "square");
      } catch (e) {
        console.error("send poster not drawn:", id, e);
        return null;
      }
    },
    piece: async (id) => {
      const p = await pieceOf(id);
      return p && p.format === "ad" ? wordsOf(p) : null;
    },
  };
}

export interface SendApprovedInput {
  campaignId: string;
  actId: string;
  link: string;
  dailyBudgetBaht: number;
  /** the pieces the owner kept in the send dialog */
  pieceIds: string[];
  /** traffic when left out; messages needs no link, form or button (the ads open the Page's chat) */
  objective?: SendObjective;
  /** for leads: the Page's form the ads open, checked against Meta's list before anything is made */
  leadFormId?: string;
  /** for leads: the button, one of LEAD_CTAS */
  cta?: string;
}

/**
 * The campaign Page's lead forms, for the send dialog: read with the token of the ad account
 * the owner picked, since that login is the one that can see the Page's forms.
 */
export async function leadForms(campaignId: string, actId: string): Promise<LeadForms> {
  await requireStaff("owner");
  try {
    const campaign = await getCampaign(campaignId);
    if (!campaign) return { ok: false, error: NO_CAMPAIGN };
    const [accounts, pages] = await Promise.all([adManageAccounts(), myPages()]);
    if (!accounts.some((a) => a.id === actId)) return { ok: false, error: ACCOUNT_NOT_CONNECTED };
    if (!pages.some((p) => p.pageId === campaign.pageId)) return { ok: false, error: PAGE_GONE };
    const token = await adManageToken(actId);
    if (!token) return { ok: false, error: ADS_NOT_CONNECTED };
    return await listLeadForms(campaign.pageId, token);
  } catch (e) {
    console.error("leadForms failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

/**
 * Sends the campaign's ticked ads as one paused Meta campaign and ad set (send.ts). Nothing
 * here switches anything on.
 *
 * The Page is the campaign's and the currency the account's, looked up here, never taken from
 * the form. Each piece asked for is checked first: it must be in this campaign, a draft (or an ad approved
 * before approval went: status used), not in the bin, not in a live send, without a launch from before sends, and with its picture drawn.
 * One that is not is left out with its reason, joined to the engine's own (no poster, sent
 * meanwhile) in `skipped`; with none left, the engine is not called. The send and launch tables
 * are read strictly: one that cannot be read refuses the send rather than risk a second ad.
 */
export async function sendApproved(input: SendApprovedInput): Promise<SendResult> {
  const viewer = await requireStaff("owner");
  const startedAt = Date.now();
  let started = false;
  try {
    const campaign = await getCampaign(input.campaignId);
    if (!campaign) return refusedSend(NO_CAMPAIGN);
    const [accounts, pages] = await Promise.all([adManageAccounts(), myPages()]);
    const account = accounts.find((a) => a.id === input.actId);
    if (!account) return refusedSend(ACCOUNT_NOT_CONNECTED);
    if (!pages.some((p) => p.pageId === campaign.pageId)) return refusedSend(PAGE_GONE);
    const asked = [...new Set((Array.isArray(input.pieceIds) ? input.pieceIds : []).filter((x): x is string => typeof x === "string"))];
    if (asked.length === 0) return refusedSend(NO_PIECES);
    const objective: SendObjective = input.objective === "leads" || input.objective === "messages" ? input.objective : "traffic";
    if (objective === "leads") {
      // the form must still be an active form of this campaign's Page: the dialog may be stale
      const token = await adManageToken(account.id);
      if (!token) return refusedSend(ADS_NOT_CONNECTED);
      const listed = await listLeadForms(campaign.pageId, token);
      if (!listed.ok) return refusedSend(listed.error);
      if (!listed.tosAccepted) return refusedSend(TOS_NOT_ACCEPTED);
      if (!listed.forms.some((f) => f.id === input.leadFormId)) return refusedSend(FORM_NOT_ON_PAGE);
    }

    const [items, sent] = await Promise.all([listCampaignPieces(campaign.id), sentPieceIds(campaign.id)]);
    const byId = new Map(items.map((p) => [p.id, p]));
    const skipped: Skipped[] = [];
    const going: ContentItem[] = [];
    for (const id of asked) {
      const p = byId.get(id);
      const reason = !p || p.format !== "ad" ? NOT_IN_CAMPAIGN
        : p.status === "trashed" ? IN_BIN
          : sent.has(id) ? ALREADY_SENT
            : picturePending(p) ? PICTURE_PENDING
              : null;
      if (reason) skipped.push({ pieceId: id, reason });
      else going.push(p!);
    }
    // a launch from before sends, in any connected account, is that piece's ad already
    const launched = await Promise.all(going.map(async (p) =>
      (await Promise.all(accounts.map((a) => launchStore.findLaunch(p.id, a.id)))).some((r) => r !== null)));
    const fresh: ContentItem[] = [];
    going.forEach((p, i) => (launched[i] ? skipped.push({ pieceId: p.id, reason: ALREADY_SENT }) : fresh.push(p)));
    if (fresh.length === 0) {
      return refusedSend(`ไม่มีแอดที่ส่งได้ — ${[...new Set(skipped.map((s) => s.reason))].join(" / ")}`, skipped);
    }

    started = true;
    const result = await runSend(
      {
        campaignId: campaign.id,
        actId: account.id,
        currency: account.currency,
        pageId: campaign.pageId,
        link: input.link,
        dailyBudgetBaht: input.dailyBudgetBaht,
        pieces: fresh.map((p) => ({ id: p.id, ...wordsOf(p) })),
        createdBy: viewer.agentId,
        objective,
        ...(objective === "leads" ? { leadFormId: input.leadFormId, cta: input.cta } : {}),
      },
      sendDeps(startedAt, byId),
    );
    const all = [...skipped, ...(result.skipped ?? [])];
    await audit("ads-send", result.send?.id ?? campaign.id, {
      ok: result.ok,
      step: result.ok ? "ads" : result.step,
      error: result.ok ? undefined : result.error,
      campaignId: campaign.id,
      actId: account.id,
      pageId: campaign.pageId,
      dailyBudgetBaht: input.dailyBudgetBaht,
      objective,
      pieces: fresh.length,
      skipped: all.length,
    });
    revalidatePath("/studio/ads", "layout");
    return { ...result, skipped: all };
  } catch (e) {
    console.error("sendApproved failed:", e);
    // a send that reached the engine may have made something on Meta: the attempt is recorded
    if (started) await audit("ads-send", input.campaignId, { ok: false, error: SOMETHING_BROKE, actId: input.actId }).catch(() => {});
    return refusedSend(SOMETHING_BROKE);
  }
}

/**
 * Carries a send on from where it stopped (resumeSend): only what is missing is made, with the
 * account, Page, link and budget it started with.
 */
export async function retrySend(sendId: string): Promise<SendResult> {
  await requireStaff("owner");
  const startedAt = Date.now();
  const record = (ok: boolean, detail: Record<string, unknown>) => audit("ads-send", sendId, { ok, retry: true, ...detail });
  try {
    const result = await resumeSend(sendId, sendDeps(startedAt));
    await record(result.ok, { step: result.ok ? "ads" : result.step, error: result.ok ? undefined : result.error });
    revalidatePath("/studio/ads", "layout");
    return result;
  } catch (e) {
    console.error("retrySend failed:", e);
    await record(false, { error: SOMETHING_BROKE }).catch(() => {});
    return refusedSend(SOMETHING_BROKE);
  }
}

/**
 * Switch a whole send on, or pause it: the press the page confirms first, recorded whatever came
 * of it. Not a door itself: both actions that call it ask who is calling first.
 */
async function switchAction(sendId: string, action: "ads-send-activate" | "ads-send-pause"): Promise<SwitchResult> {
  let send: AdSend | null = null;
  const record = (ok: boolean, error?: string) => audit(action, sendId, {
    ok, error, campaignId: send?.campaignId, actId: send?.actId, pageId: send?.pageId, dailyBudgetMinor: send?.dailyBudgetMinor,
  });
  try {
    send = await getSend(sendId);
    const deps = { store: sendStore, token: adManageToken };
    const result = action === "ads-send-activate" ? await activateSend(sendId, deps) : await pauseSend(sendId, deps);
    await record(result.ok, result.ok ? undefined : result.error);
    revalidatePath("/studio/ads", "layout");
    return result;
  } catch (e) {
    console.error(`${action} failed:`, e);
    await record(false, SOMETHING_BROKE).catch(() => {});
    return { ok: false, error: SOMETHING_BROKE };
  }
}

/** The press that can spend: campaign, ad set and every ad made go on (activateSend). */
export async function activateSendAction(sendId: string): Promise<SwitchResult> {
  await requireStaff("owner");
  return switchAction(sendId, "ads-send-activate");
}

/** Pauses the send's Meta campaign, which stops its ad set and ads (pauseSend). */
export async function pauseSendAction(sendId: string): Promise<SwitchResult> {
  await requireStaff("owner");
  return switchAction(sendId, "ads-send-pause");
}

/** The contacts kept for one of the owner's connected Pages, for the settings fold. */
export async function pageContact(
  pageId: string,
): Promise<{ ok: true; contact: PageContact | null } | { ok: false; error: string }> {
  await requireStaff("owner");
  try {
    if (!(await myPages()).some((p) => p.pageId === pageId)) return { ok: false, error: PAGE_NOT_CONNECTED };
    return { ok: true, contact: await getPageContact(pageId) };
  } catch (e) {
    console.error("pageContact failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

/** Saves what the owner typed as the Page's contacts; an empty form clears them. */
export async function updatePageContact(
  pageId: string,
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff("owner");
  try {
    if (!(await myPages()).some((p) => p.pageId === pageId)) return { ok: false, error: PAGE_NOT_CONNECTED };
    const clean = cleanContact(input);
    if ("error" in clean) return { ok: false, error: clean.error };
    await savePageContact(pageId, clean);
    await audit("ads-page-contact", pageId, { ...clean });
    return { ok: true };
  } catch (e) {
    console.error("updatePageContact failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}
