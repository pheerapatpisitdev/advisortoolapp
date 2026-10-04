"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { myPages } from "@/lib/auth/pages";
import { getContent, listContent, type ContentItem } from "@/lib/content/store";
import { drawPoster } from "@/lib/content/poster-draw";
import {
  adManageAccounts, adManageToken, clearPendingAdsManage, readPendingAdsManage, saveAdManageAccount,
} from "@/lib/facebook/ads-manage-connection";
import { adsManageMissingEnv, adsManageOauthIsConfigured, listAdAccounts, tokenExpiry, type TokenExpiry } from "@/lib/facebook/oauth";
import * as launchStore from "@/lib/ads/launch-store";
import type { LaunchRow, LaunchStep as RowStep } from "@/lib/ads/launch-store";
import { activateLaunch, adEffectiveStatus, runLaunch, type LaunchResult } from "@/lib/ads/launch";
import { maxDailyBudgetThb } from "@/lib/ads/launch-limits";

/**
 * The doors /studio/ads calls. Creating an ad spends the owner's money once it is switched on,
 * so every one of these starts by asking for the owner, and the page asks again.
 *
 * Whatever breaks underneath (the database, Meta, drawing the poster) is logged here and comes
 * back as a short Thai sentence: a server action that throws reaches the browser as a bare
 * "an error occurred", and the owner would be left not knowing whether an ad was made.
 */

const SOMETHING_BROKE = "ทำรายการไม่สำเร็จ ลองอีกครั้ง ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ";
/** newest ad pieces the page offers; older ones are one search away in Studio */
const PIECES_SHOWN = 30;

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

export interface AdsLaunchSetup {
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
  pages: { pageId: string; pageName: string }[];
  pieces: {
    id: string;
    headline: string;
    primaryText: string;
    description: string;
    hasPoster: boolean;
    /** the newest live launch of the piece in any account */
    launch: LaunchView | null;
    /** every live launch of the piece, one per ad account */
    launches: LaunchView[];
  }[];
  maxDailyBudgetThb: number;
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

/** An ad piece keeps its Ads Manager fields in the piece's own: headline in hooks[0], text in body, description in closing. */
const adPiece = (p: ContentItem) => p.format === "ad" && p.status !== "trashed";

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

export async function adsLaunchSetup(): Promise<AdsLaunchSetup> {
  await requireStaff("owner");
  const [accounts, choices, pages, listed] = await Promise.all([
    adManageAccounts(),
    pendingChoices(),
    myPages(),
    listContent({ includeAds: true }, 200),
  ]);
  const missing = adsManageMissingEnv();
  // the expiry is asked with the app's own id and secret; a server without them (a laptop
  // without the secret) would only log an error per account, so it does not ask
  const canAskMeta = !missing.includes("FB_APP_ID") && !missing.includes("FB_APP_SECRET");
  const expiry = canAskMeta ? await expiries(accounts.map((a) => a.id)) : new Map<string, TokenExpiry>();
  const pieces = listed.filter(adPiece).slice(0, PIECES_SHOWN);

  // one live launch per piece and account; a table that cannot be read (before its migration, or
  // the database for a moment) leaves the pieces showing no launch rather than stopping the page
  const tokens = new Map<string, Promise<string | null>>();
  const tokenFor = (act: string) => tokens.get(act) ?? tokens.set(act, adManageToken(act).catch(() => null)).get(act)!;
  const withLaunches = await Promise.all(pieces.map(async (p) => {
    const rows = (await Promise.all(accounts.map((a) =>
      launchStore.findLaunch(p.id, a.id).catch((e) => { console.error("ad launch unreadable:", e); return null; }),
    ))).filter((r): r is LaunchRow => r !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const launches = await Promise.all(rows.map(async (r) => {
      const token = r.adId ? await tokenFor(r.actId) : null;
      // a failing Meta read is a missing label, not a missing page
      const status = r.adId && token ? await adEffectiveStatus(r.adId, token).catch(() => null) : null;
      return view(r, status);
    }));
    return {
      id: p.id,
      headline: p.output.hooks[0] ?? "",
      primaryText: p.output.body ?? "",
      description: p.output.closing ?? "",
      hasPoster: Boolean(p.output.poster),
      launch: launches[0] ?? null,
      launches,
    };
  }));

  return {
    configured: adsManageOauthIsConfigured(),
    missing,
    accounts: accounts.map((a) => {
      const e = expiry.get(a.id);
      // the earlier of the token's own end and the end of the person's data access, as /admin/ads says it
      const ends = e ? [e.expiresAt, e.dataAccessExpiresAt].filter((d): d is string => Boolean(d)).sort()[0] ?? null : null;
      return { id: a.id, name: a.name, currency: a.currency, expiresAt: ends, tokenValid: e ? e.valid : null };
    }),
    choices,
    pages: pages.map((p) => ({ pageId: p.pageId, pageName: p.pageName })),
    pieces: withLaunches,
    maxDailyBudgetThb: maxDailyBudgetThb(),
  };
}

export interface LaunchInput {
  pieceId: string;
  actId: string;
  pageId: string;
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
 * has not connected is not one to build an ad on.
 */
export async function launchAd(input: LaunchInput): Promise<LaunchResult> {
  const viewer = await requireStaff("owner");
  try {
    const piece = await getContent(input.pieceId);
    if (!piece || piece.status === "trashed" || piece.format !== "ad") return refused("ไม่พบชิ้นโฆษณานี้");
    const spec = piece.output.poster;
    if (!spec) return refused("ชิ้นนี้ยังไม่มีโปสเตอร์ สร้างโปสเตอร์ก่อนยิงแอด");

    const [accounts, pages] = await Promise.all([adManageAccounts(), myPages()]);
    const account = accounts.find((a) => a.id === input.actId);
    if (!account) return refused("บัญชีโฆษณานี้ยังไม่ได้เชื่อมสำหรับสร้างแอด");
    if (!pages.some((p) => p.pageId === input.pageId)) return refused("เพจนี้ยังไม่ได้เชื่อมกับระบบ");

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
        pageId: input.pageId,
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
      pageId: input.pageId,
      dailyBudgetBaht: input.dailyBudgetBaht,
      recreate: Boolean(input.recreate),
    });
    revalidatePath("/studio/ads");
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
    revalidatePath("/studio/ads");
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
    if (result.ok) revalidatePath("/studio/ads");
    return result;
  } catch (e) {
    console.error("activateAd failed:", e);
    await record(false, SOMETHING_BROKE).catch(() => {});
    return { ok: false, error: SOMETHING_BROKE };
  }
}
