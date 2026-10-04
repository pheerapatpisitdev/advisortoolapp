import type { LaunchRow, LaunchStep as StoreLaunchStep, StepPatch } from "./launch-store";
import { checkDailyBudget, checkLink, maxDailyBudgetThb } from "./launch-limits";
import { isExpiredToken } from "./insights";
import { EXPIRED } from "./sync";

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
 * - Ad set: targeting stays countries only. v23.0 enrols new ad sets in Advantage+ audience by
 *   default and only demands targeting_automation.advantage_audience when age or gender are
 *   customised, which this launch does not do; location is never relaxed by it.
 *   https://developers.facebook.com/docs/graph-api/changelog/version23.0/
 * - Image: POST /adimages answers {images: {<name>: {hash, ...}}}, not a top-level id, so the
 *   hash is read from the first entry of `images`.
 *   https://developers.facebook.com/docs/marketing-api/reference/ad-account/adimages/
 * - Creative and ad: the planned fields match; link_data.link must equal the button's link,
 *   so both are the same checked URL.
 *   https://developers.facebook.com/docs/marketing-api/reference/ad-creative-link-data/
 */

const GRAPH = "https://graph.facebook.com/v23.0";

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
}

export type LaunchResult =
  | { ok: true; launch: LaunchRow }
  | { ok: false; step: LaunchStep | "check"; error: string; launch?: LaunchRow };

const NO_TOKEN = "ยังไม่ได้เชื่อมบัญชีโฆษณาสำหรับสร้างแอด กดเชื่อมบัญชีก่อน";
const NO_POSTER = "ชิ้นนี้ยังไม่มีโปสเตอร์ สร้างโปสเตอร์ก่อนยิงแอด";
const BUSY = "กำลังสร้างแอดนี้อยู่ รอสักครู่แล้วลองใหม่";
const NO_ID = "Facebook ตอบกลับมาแต่ไม่มีไอดี";
/** How long one request to Meta may take; a function that waits on a hung one is cut off with nothing saved. */
const REQUEST_TIMEOUT_MS = 30_000;
/**
 * A request that timed out or dropped may still have been carried out by Meta: the answer is
 * what is missing, not the work. Retrying blind could make a second campaign or ad set.
 */
const RESULT_UNKNOWN = "ไม่รู้ว่าขั้นนี้สำเร็จหรือไม่ ตรวจใน Ads Manager หรือโหลดหน้านี้ใหม่ก่อนลองอีกครั้ง";

type Graph = { ok: true; body: Record<string, unknown> } | { ok: false; error: string };

/**
 * One Graph request. The token goes in the header, never the URL, so it stays out of logs.
 * Every request has a 30 s timeout; a timeout or a dropped connection is a failure whose result
 * is unknown (RESULT_UNKNOWN), handled like any other failure: the step stops and the error is saved.
 * A failure is HTTP not ok or an `error` in the body (Meta sometimes answers 200 with one);
 * error 190 becomes the same reconnect message the figures sync shows.
 */
async function graph(fetchFn: typeof fetch, token: string, path: string, params?: Record<string, string>): Promise<Graph> {
  let res: Response;
  let body: Record<string, unknown>;
  try {
    res = await fetchFn(
      `${GRAPH}/${path}`,
      params
        ? {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(params).toString(),
            cache: "no-store",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          }
        : { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );
    body = ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    const why = timedOut ? "Facebook ไม่ตอบกลับภายใน 30 วินาที" : `ติดต่อ Facebook ไม่ได้ — ${e instanceof Error ? e.message : String(e)}`;
    return { ok: false, error: `${why} ${RESULT_UNKNOWN}` };
  }
  const err = body.error as { code?: number; message?: string; error_user_msg?: string } | undefined;
  if (!res.ok || err) {
    if (isExpiredToken(err)) return { ok: false, error: EXPIRED };
    // Meta's own words are the diagnosis; the Thai prefix says whose words they are
    return { ok: false, error: `Facebook ไม่รับ — ${err?.error_user_msg ?? err?.message ?? `HTTP ${res.status}`}` };
  }
  return { ok: true, body };
}

/** The id a create returned, or null — a 200 without one has made nothing we can build on. */
function idOf(body: Record<string, unknown>): string | null {
  return typeof body.id === "string" && body.id ? body.id : null;
}

/** POST /adimages answers {images: {<name>: {hash}}}; the one image sent is the first entry. */
function hashOf(body: Record<string, unknown>): string | null {
  const first = Object.values((body.images ?? {}) as Record<string, { hash?: unknown }>)[0];
  return typeof first?.hash === "string" && first.hash ? first.hash : null;
}

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

/** The calendar day in Bangkok, so an ad made at 6am Thai time is not named after yesterday. */
function bangkokDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
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
      const r = await graph(fetchFn, token, `${act}/campaigns`, {
        name,
        objective: "OUTCOME_TRAFFIC",
        status: "PAUSED",
        special_ad_categories: "[]",
        is_adset_budget_sharing_enabled: "false",
      });
      if (!r.ok) return stop("campaign", r.error);
      const id = idOf(r.body);
      if (!id) return stop("campaign", NO_ID);
      await save({ campaignId: id, step: "campaign" });
    }

    if (row.step === "campaign") {
      const r = await graph(fetchFn, token, `${act}/adsets`, {
        name,
        campaign_id: row.campaignId!,
        daily_budget: String(row.dailyBudgetMinor),
        billing_event: "IMPRESSIONS",
        optimization_goal: "LINK_CLICKS",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        destination_type: "WEBSITE",
        targeting: JSON.stringify({ geo_locations: { countries: ["TH"] } }),
        status: "PAUSED",
      });
      if (!r.ok) return stop("adset", r.error);
      const id = idOf(r.body);
      if (!id) return stop("adset", NO_ID);
      await save({ adsetId: id, step: "adset" });
    }

    if (row.step === "adset") {
      // the upload is saved on its own: a retry after a creative failure reuses the image
      if (!row.imageHash) {
        const r = await graph(fetchFn, token, `${act}/adimages`, { bytes: poster.toString("base64") });
        if (!r.ok) return stop("creative", r.error);
        const hash = hashOf(r.body);
        if (!hash) return stop("creative", "Facebook รับรูปแต่ไม่ส่งรหัสรูปกลับมา");
        await save({ imageHash: hash });
      }
      const r = await graph(fetchFn, token, `${act}/adcreatives`, {
        name,
        object_story_spec: JSON.stringify({
          page_id: row.pageId,
          link_data: {
            image_hash: row.imageHash,
            link: row.link,
            message: row.primaryText ?? "",
            name: row.headline ?? "",
            description: row.description ?? "",
            call_to_action: { type: "LEARN_MORE", value: { link: row.link } },
          },
        }),
      });
      if (!r.ok) return stop("creative", r.error);
      const id = idOf(r.body);
      if (!id) return stop("creative", NO_ID);
      await save({ creativeId: id, step: "creative" });
    }

    if (row.step === "creative") {
      const r = await graph(fetchFn, token, `${act}/ads`, {
        name,
        adset_id: row.adsetId!,
        creative: JSON.stringify({ creative_id: row.creativeId }),
        status: "PAUSED",
      });
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

/** What Meta made of the ad (ACTIVE, PAUSED, DISAPPROVED, ...), or null when it would not say. */
export async function adEffectiveStatus(adId: string, token: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  // the id becomes a Graph path; a stray "/" or "?" would ask Meta about something else
  if (!/^\w+$/.test(adId)) return null;
  const r = await graph(fetchFn, token, `${adId}?fields=effective_status`);
  if (!r.ok) return null;
  return typeof r.body.effective_status === "string" ? r.body.effective_status : null;
}
