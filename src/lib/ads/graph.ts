import { isExpiredToken } from "./insights";
import { EXPIRED } from "./sync";

/**
 * The Graph request code both ad engines share: launch.ts (one ad) and send.ts (a batch). One
 * request function, and one builder per object the engines make, so a send's campaign, ad set,
 * creative and ad carry exactly the fields a single launch does — the reasons for each field
 * are in launch.ts's header, where they were first checked against Marketing API v23.0.
 */

export const GRAPH = "https://graph.facebook.com/v23.0";

/** How long one request to Meta may take; a function that waits on a hung one is cut off with nothing saved. */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * A request that timed out or dropped may still have been carried out by Meta: the answer is
 * what is missing, not the work. Retrying blind could make a second campaign or ad set.
 */
export const RESULT_UNKNOWN = "ไม่รู้ว่าขั้นนี้สำเร็จหรือไม่ ตรวจใน Ads Manager หรือโหลดหน้านี้ใหม่ก่อนลองอีกครั้ง";

/** A create Meta answered without an id: nothing was made that the next step can build on. */
export const NO_ID = "Facebook ตอบกลับมาแต่ไม่มีไอดี";

/** An image upload Meta answered without a hash. */
export const NO_HASH = "Facebook รับรูปแต่ไม่ส่งรหัสรูปกลับมา";

export type Graph = { ok: true; body: Record<string, unknown> } | { ok: false; error: string };

/**
 * One Graph request. The token goes in the header, never the URL, so it stays out of logs.
 * Every request has a 30 s timeout; a timeout or a dropped connection is a failure whose result
 * is unknown (RESULT_UNKNOWN), handled like any other failure: the step stops and the error is saved.
 * A failure is HTTP not ok or an `error` in the body (Meta sometimes answers 200 with one);
 * error 190 becomes the same reconnect message the figures sync shows.
 */
export async function graph(fetchFn: typeof fetch, token: string, path: string, params?: Record<string, string>): Promise<Graph> {
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
export function idOf(body: Record<string, unknown>): string | null {
  return typeof body.id === "string" && body.id ? body.id : null;
}

/** POST /adimages answers {images: {<name>: {hash}}}; the one image sent is the first entry. */
export function hashOf(body: Record<string, unknown>): string | null {
  const first = Object.values((body.images ?? {}) as Record<string, { hash?: unknown }>)[0];
  return typeof first?.hash === "string" && first.hash ? first.hash : null;
}

/** The calendar day in Bangkok, so an ad made at 6am Thai time is not named after yesterday. */
export function bangkokDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

/** POST {act}/campaigns: traffic, paused, budget on the ad set. */
export function campaignParams(name: string): Record<string, string> {
  return {
    name,
    objective: "OUTCOME_TRAFFIC",
    status: "PAUSED",
    special_ad_categories: "[]",
    is_adset_budget_sharing_enabled: "false",
  };
}

/** POST {act}/adsets: Thailand, 20 and up, Advantage+ audience, the verified Thai advertiser and payer, paused. */
export function adsetParams(a: { name: string; campaignId: string; dailyBudgetMinor: number; identity: string }): Record<string, string> {
  return {
    name: a.name,
    campaign_id: a.campaignId,
    daily_budget: String(a.dailyBudgetMinor),
    billing_event: "IMPRESSIONS",
    optimization_goal: "LINK_CLICKS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    destination_type: "WEBSITE",
    targeting: JSON.stringify({ geo_locations: { countries: ["TH"] }, age_min: 20, targeting_automation: { advantage_audience: 1 } }),
    regional_regulated_categories: JSON.stringify(["THAILAND_UNIVERSAL"]),
    regional_regulation_identities: JSON.stringify({ universal_beneficiary: a.identity, universal_payer: a.identity }),
    status: "PAUSED",
  };
}

/** POST {act}/adimages: the poster's bytes. */
export function imageParams(poster: Buffer): Record<string, string> {
  return { bytes: poster.toString("base64") };
}

/** POST {act}/adcreatives: a Click-to-Website image ad; the button opens the same link as the card. */
export function creativeParams(c: {
  name: string;
  pageId: string;
  imageHash: string | null;
  link: string;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
}): Record<string, string> {
  return {
    name: c.name,
    object_story_spec: JSON.stringify({
      page_id: c.pageId,
      link_data: {
        image_hash: c.imageHash,
        link: c.link,
        message: c.primaryText ?? "",
        name: c.headline ?? "",
        description: c.description ?? "",
        call_to_action: { type: "LEARN_MORE", value: { link: c.link } },
      },
    }),
  };
}

/** POST {act}/ads: the creative under the ad set, paused. */
export function adParams(a: { name: string; adsetId: string; creativeId: string | null }): Record<string, string> {
  return {
    name: a.name,
    adset_id: a.adsetId,
    creative: JSON.stringify({ creative_id: a.creativeId }),
    status: "PAUSED",
  };
}
