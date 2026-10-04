import type { LaunchRow, LaunchStep as StoreLaunchStep, StepPatch } from "./launch-store";
import { checkDailyBudget, checkLink, maxDailyBudgetThb } from "./launch-limits";
import { EXPIRED } from "./sync";
import {
  adParams,
  adsetParams,
  bangkokDay,
  campaignParams,
  creativeParams,
  graph,
  hashOf,
  idOf,
  imageParams,
  NO_HASH,
  NO_ID,
} from "./graph";

export { REQUEST_TIMEOUT_MS } from "./graph";

/**
 * Puts one image ad on Facebook in four steps — campaign, ad set, creative (image upload, then
 * the creative itself), ad — every one created PAUSED. Nothing here can switch an ad on except
 * activateLaunch, which is a separate press; saving a launch never spends money.
 *
 * Each Meta id is written to the launch row the moment Meta returns it, so a step that breaks
 * stops the run there and a retry resumes at that step with the ids already made, instead of
 * making a second campaign. The row is claimed before any request to Meta: two clicks get the
 * same row from createLaunch, and only the one holding the claim may go on.
 *
 * Every check that can fail without Meta (budget, currency, link, token, poster) runs before
 * the first request, so a refused launch leaves nothing half-made on the ad account.
 *
 * Recreating over a launch that made a campaign first pauses that campaign (POST /{id}
 * status=PAUSED, success required), switched on by this app or not. A retired row is no longer
 * found, so an ad left running under it would keep spending beside the new one and double the
 * daily cap. If the pause fails, the old row is not retired and nothing new is made. A row
 * with no campaign id made nothing on Meta, so nothing is paused.
 *
 * Fields checked against Marketing API v23.0 before writing; differences from the plan:
 * - Campaign: also sends is_adset_budget_sharing_enabled=false. The budget sits on the ad set,
 *   and Meta refuses such a campaign on some accounts (code 100, subcode 4834011, "You must
 *   specify True or False in the field is_adset_budget_sharing_enabled if you are not using
 *   campaign budget"); v24.0 makes it required for everyone. false keeps the owner's daily
 *   figure exact — with one ad set there is nothing to share with anyway.
 *   https://developers.facebook.com/docs/graph-api/changelog/version24.0/
 *   https://developers.facebook.com/docs/marketing-api/reference/ad-account/campaigns/
 * - Ad set: Thailand, aged 20 and up, Advantage+ audience on. Meta refused the first live
 *   launch (2026-10-04) with countries only: an audience that can reach people under 20 in
 *   Thailand (the age of majority there) or under 18 anywhere is not allowed for this kind of
 *   ad. With an age set, v23.0 wants targeting_automation.advantage_audience stated; 1 keeps
 *   the default it enrols new ad sets in, and location is never relaxed by it.
 *   https://developers.facebook.com/docs/graph-api/changelog/version23.0/
 *   It also names the verified advertiser and payer Meta requires for Thailand
 *   (regional_regulated_categories THAILAND_UNIVERSAL, universal_beneficiary/universal_payer);
 *   the second live try was refused without them.
 *   https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/
 * - Image: POST /adimages answers {images: {<name>: {hash, ...}}}, not a top-level id, so the
 *   hash is read from the first entry of `images`.
 *   https://developers.facebook.com/docs/marketing-api/reference/ad-account/adimages/
 * - Creative and ad: the planned fields match; link_data.link must equal the button's link,
 *   so both are the same checked URL.
 *   https://developers.facebook.com/docs/marketing-api/reference/ad-creative-link-data/
 *
 * The request code and the field builders live in graph.ts, shared with the batch send (send.ts),
 * so both make their objects with the very same fields.
 */

/** A step that makes something on Meta. The store's "none" is where a launch starts, not a step. */
export type LaunchStep = Exclude<StoreLaunchStep, "none">;

export interface LaunchInput {
  pieceId: string;
  actId: string;
  currency: string | null;
  pageId: string;
  link: string;
  dailyBudgetBaht: number;
  headline: string;
  primaryText: string;
  description: string;
  createdBy: string;
  /** retire the live launch for this piece and account and make a new set */
  recreate?: boolean;
}

export interface LaunchDeps {
  store: typeof import("./launch-store");
  /** the ads_management token for the account, or null when it is not connected */
  token(actId: string): Promise<string | null>;
  /** the piece's rendered poster, or null when it has none */
  poster(pieceId: string): Promise<Buffer | null>;
  fetchFn?: typeof fetch;
  now?: () => Date;
  /** the verified advertiser identity Meta requires on ad sets reaching Thailand; defaults to the env */
  thIdentity?: () => string | null;
}

/**
 * The verified identity (Business settings → การอนุญาตและการตรวจสอบยืนยัน) every ad set
 * reaching Thailand must name as advertiser and payer. Ad sets made through the API do not take
 * the ad account's default, and Meta has no public API to look the id up, so the owner sets it.
 */
export function thVerifiedIdentity(env: Record<string, string | undefined> = process.env): string | null {
  const id = (env.META_TH_VERIFIED_IDENTITY_ID ?? "").trim();
  return /^\d+$/.test(id) ? id : null;
}

export type LaunchResult =
  | { ok: true; launch: LaunchRow }
  | { ok: false; step: LaunchStep | "check"; error: string; launch?: LaunchRow };

const NO_TOKEN = "ยังไม่ได้เชื่อมบัญชีโฆษณาสำหรับสร้างแอด กดเชื่อมบัญชีก่อน";
const NO_POSTER = "ชิ้นนี้ยังไม่มีโปสเตอร์ สร้างโปสเตอร์ก่อนยิงแอด";
const BUSY = "กำลังสร้างแอดนี้อยู่ รอสักครู่แล้วลองใหม่";
const NO_TH_IDENTITY = "ยังไม่ได้ตั้งค่า META_TH_VERIFIED_IDENTITY_ID — Meta บังคับให้แอดที่แสดงในไทยระบุผู้ลงโฆษณาที่ยืนยันตัวตนแล้ว (ขั้นตอนอยู่ใน docs/ads-manage-permission.md)";
/**
 * Pauses the campaign of a launch that is being replaced. Pausing the campaign stops its
 * ad set and ad with it. Only Meta's {success: true} counts as paused.
 */
async function pauseCampaign(fetchFn: typeof fetch, token: string, campaignId: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const failed = "ปิดแอดเดิมไม่สำเร็จ ลองใหม่อีกครั้ง";
  // the id becomes a Graph path, as in adEffectiveStatus
  if (!campaignId || !/^\w+$/.test(campaignId)) return { ok: false, error: failed };
  const r = await graph(fetchFn, token, campaignId, { status: "PAUSED" });
  if (!r.ok) return { ok: false, error: r.error === EXPIRED ? EXPIRED : `${failed} — ${r.error}` };
  if (r.body.success !== true) return { ok: false, error: failed };
  return { ok: true };
}

export async function runLaunch(input: LaunchInput, deps: LaunchDeps): Promise<LaunchResult> {
  const { store } = deps;
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? (() => new Date());

  const budget = checkDailyBudget(input.dailyBudgetBaht, input.currency, maxDailyBudgetThb());
  if (!budget.ok) return { ok: false, step: "check", error: budget.error };
  const link = checkLink(input.link);
  if (!link.ok) return { ok: false, step: "check", error: link.error };
  // ids go into Graph paths; anything else would let a bad value pick a different endpoint
  if (!/^act_\d+$/.test(input.actId) || !/^\d+$/.test(input.pageId)) {
    return { ok: false, step: "check", error: "บัญชีโฆษณาหรือเพจไม่ถูกต้อง" };
  }
  // every ad set reaches Thailand, and Meta refuses one that names no verified advertiser
  const identity = (deps.thIdentity ?? thVerifiedIdentity)();
  if (!identity) return { ok: false, step: "check", error: NO_TH_IDENTITY };
  const token = await deps.token(input.actId);
  if (!token) return { ok: false, step: "check", error: NO_TOKEN };
  // fetched before anything is retired or recorded, so a piece without one changes nothing
  const poster = await deps.poster(input.pieceId);
  if (!poster) return { ok: false, step: "check", error: NO_POSTER };

  if (input.recreate) {
    const old = await store.findLaunch(input.pieceId, input.actId);
    if (old) {
      // Whatever the row says about activation, a campaign it made is on Meta and a retired row
      // is no longer found: if it was switched on, or someone switched it on in Ads Manager, it
      // would keep spending beside the new one and the daily cap would be passed twice over.
      // A row with no campaign made nothing, so there is nothing to pause.
      if (old.campaignId) {
        const paused = await pauseCampaign(fetchFn, token, old.campaignId);
        if (!paused.ok) return { ok: false, step: "check", error: paused.error };
      }
      await store.supersede(old.id);
    }
  }

  const { row: started } = await store.createLaunch({
    pieceId: input.pieceId,
    actId: input.actId,
    pageId: input.pageId,
    link: link.url,
    currency: "THB",
    dailyBudgetMinor: budget.minor,
    headline: input.headline,
    primaryText: input.primaryText,
    description: input.description,
    createdBy: input.createdBy,
  });
  if (started.step === "ad") return { ok: true, launch: started };

  if (!(await store.claimLaunch(started.id))) return { ok: false, step: "check", error: BUSY, launch: started };
  try {
    // another run may have moved the row on since createLaunch read it; resume from what it wrote
    let row = (await store.getLaunch(started.id)) ?? started;
    if (row.step === "ad") return { ok: true, launch: row };

    // a resumed launch uses what it was started with, not this request's values
    const act = row.actId;
    const name = `Studio · ${row.headline ?? ""} · ${bangkokDay(now())}`;
    const save = async (patch: StepPatch) => {
      await store.saveStep(row.id, patch);
      row = { ...row, ...patch, error: null };
    };
    const stop = async (step: LaunchStep, error: string): Promise<LaunchResult> => {
      await store.saveError(row.id, error);
      row = { ...row, error };
      return { ok: false, step, error, launch: row };
    };

    if (row.step === "none") {
      const r = await graph(fetchFn, token, `${act}/campaigns`, campaignParams(name));
      if (!r.ok) return stop("campaign", r.error);
      const id = idOf(r.body);
      if (!id) return stop("campaign", NO_ID);
      await save({ campaignId: id, step: "campaign" });
    }

    if (row.step === "campaign") {
      const r = await graph(
        fetchFn,
        token,
        `${act}/adsets`,
        adsetParams({ name, campaignId: row.campaignId!, dailyBudgetMinor: row.dailyBudgetMinor, identity }),
      );
      if (!r.ok) return stop("adset", r.error);
      const id = idOf(r.body);
      if (!id) return stop("adset", NO_ID);
      await save({ adsetId: id, step: "adset" });
    }

    if (row.step === "adset") {
      // the upload is saved on its own: a retry after a creative failure reuses the image
      if (!row.imageHash) {
        const r = await graph(fetchFn, token, `${act}/adimages`, imageParams(poster));
        if (!r.ok) return stop("creative", r.error);
        const hash = hashOf(r.body);
        if (!hash) return stop("creative", NO_HASH);
        await save({ imageHash: hash });
      }
      const r = await graph(
        fetchFn,
        token,
        `${act}/adcreatives`,
        creativeParams({
          name,
          pageId: row.pageId,
          imageHash: row.imageHash,
          link: row.link,
          primaryText: row.primaryText,
          headline: row.headline,
          description: row.description,
        }),
      );
      if (!r.ok) return stop("creative", r.error);
      const id = idOf(r.body);
      if (!id) return stop("creative", NO_ID);
      await save({ creativeId: id, step: "creative" });
    }

    if (row.step === "creative") {
      const r = await graph(fetchFn, token, `${act}/ads`, adParams({ name, adsetId: row.adsetId!, creativeId: row.creativeId }));
      if (!r.ok) return stop("ad", r.error);
      const id = idOf(r.body);
      if (!id) return stop("ad", NO_ID);
      await save({ adId: id, step: "ad" });
    }

    return { ok: true, launch: row };
  } finally {
    await store.releaseLaunch(started.id);
  }
}

/** Why a launch may not be switched on, or null when it may. */
function notActivatable(row: LaunchRow | null): string | null {
  if (!row) return "ไม่พบรายการยิงแอดนี้";
  if (row.superseded) return "รายการนี้ถูกแทนที่ด้วยการสร้างใหม่แล้ว";
  if (row.step !== "ad" || !row.campaignId || !row.adsetId || !row.adId) return "แอดยังสร้างไม่ครบทุกขั้น";
  return null;
}

/**
 * The second press: campaign, then ad set, then ad go ACTIVE, parent first so nothing runs
 * under a paused parent. Only when all three are on is the launch marked; a break in the
 * middle is reported and the press can simply be repeated — setting ACTIVE twice is harmless.
 */
export async function activateLaunch(
  launchId: string,
  deps: Pick<LaunchDeps, "store" | "token" | "fetchFn" | "now">,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { store } = deps;
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? (() => new Date());

  const row = await store.getLaunch(launchId);
  const refused = notActivatable(row);
  if (refused) return { ok: false, error: refused };
  if (row!.activatedAt) return { ok: true };
  const token = await deps.token(row!.actId);
  if (!token) return { ok: false, error: NO_TOKEN };

  if (!(await store.claimLaunch(launchId))) return { ok: false, error: BUSY };
  try {
    // re-read under the claim: another press may have finished while this one waited
    const held = await store.getLaunch(launchId);
    const changed = notActivatable(held);
    if (changed) return { ok: false, error: changed };
    if (held!.activatedAt) return { ok: true };

    for (const id of [held!.campaignId!, held!.adsetId!, held!.adId!]) {
      const r = await graph(fetchFn, token, id, { status: "ACTIVE" });
      if (!r.ok) return { ok: false, error: r.error };
      // Meta answers {success: true}; anything else is not proof the object is on
      if (r.body.success !== true) return { ok: false, error: "Facebook ไม่ยืนยันการเปิดใช้" };
    }
    await store.markActivated(launchId, now().toISOString());
    return { ok: true };
  } finally {
    await store.releaseLaunch(launchId);
  }
}

/** Why a launch's ad may not be paused, or null when it may: only an ad that exists can be. */
function notPausable(row: LaunchRow | null): string | null {
  if (!row) return "ไม่พบรายการยิงแอดนี้";
  if (row.superseded) return "รายการนี้ถูกแทนที่ด้วยการสร้างใหม่แล้ว";
  // the id becomes a Graph path, as in adEffectiveStatus
  if (!row.adId || !/^\w+$/.test(row.adId)) return "แอดนี้ยังไม่ได้สร้าง";
  return null;
}

/**
 * The owner's press to stop an ad launched one by one: the ad goes PAUSED — the ad, not its
 * campaign, so the next "เปิดใช้" (which sets campaign, ad set and ad ACTIVE) brings it back.
 * It is sent whatever activatedAt says, since a switch-on that broke after the ad went on can
 * leave it running unmarked. Only Meta's {success: true} counts; then activatedAt is cleared, so
 * activateLaunch goes to Meta again rather than answering that the ad is already on.
 */
export async function pauseLaunch(
  launchId: string,
  deps: Pick<LaunchDeps, "store" | "token" | "fetchFn" | "now">,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { store } = deps;
  const fetchFn = deps.fetchFn ?? fetch;

  const row = await store.getLaunch(launchId);
  const refused = notPausable(row);
  if (refused) return { ok: false, error: refused };
  const token = await deps.token(row!.actId);
  if (!token) return { ok: false, error: NO_TOKEN };

  if (!(await store.claimLaunch(launchId))) return { ok: false, error: BUSY };
  try {
    // re-read under the claim: another press may have changed the launch while this one waited
    const held = await store.getLaunch(launchId);
    const changed = notPausable(held);
    if (changed) return { ok: false, error: changed };

    const r = await graph(fetchFn, token, held!.adId!, { status: "PAUSED" });
    if (!r.ok) return { ok: false, error: r.error };
    if (r.body.success !== true) return { ok: false, error: "Facebook ไม่ยืนยันการหยุด" };
    await store.markLaunchPaused(launchId);
    return { ok: true };
  } finally {
    await store.releaseLaunch(launchId);
  }
}

/** What Meta made of the ad (ACTIVE, PAUSED, DISAPPROVED, ...), or null when it would not say. */
export async function adEffectiveStatus(adId: string, token: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  // the id becomes a Graph path; a stray "/" or "?" would ask Meta about something else
  if (!/^\w+$/.test(adId)) return null;
  const r = await graph(fetchFn, token, `${adId}?fields=effective_status`);
  if (!r.ok) return null;
  return typeof r.body.effective_status === "string" ? r.body.effective_status : null;
}
