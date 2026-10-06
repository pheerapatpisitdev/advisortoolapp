import { checkDailyBudget, maxDailyBudgetThb } from "./launch-limits";
import { thVerifiedIdentity } from "./launch";
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
  pageStoryOf,
  storyCreativeParams,
} from "./graph";
import { endAtOf, isRunDays, storyIdOf } from "./run-path";
import type { AdRun, RunPath } from "./run-store";

/**
 * Runs Organic Studio posts as Click-to-Messenger ads (spec 2026-10-07): each post is one ad set
 * (its own daily budget and end) and one ad, under the Page's standing campaign in that ad account
 * — every one ACTIVE, as the owner chose; the press in the dialog is the confirmation.
 *
 * - The standing campaign is read from ins_ad_standing and checked on Meta; one Meta no longer
 *   has (deleted or archived in Ads Manager), or none yet, is made and stored.
 * - A post on the Page is boosted as it stands (object_story_id). Most were saved under their
 *   photo id, so the post is looked up first (page_story_id). Whether Meta takes an existing post
 *   for a Messenger ad was not tried live (the owner declined the probe), so when Meta refuses the
 *   boost — the look-up, the creative or the ad — the run falls back on its own to a new ad from
 *   the post's words and picture, as a draft gets, and says so (FELL_BACK). Only Meta's refusals
 *   fall back: a lost answer (RESULT_UNKNOWN) or an expired login is saved for a retry instead.
 * - A draft becomes a new ad: the picture uploaded, a creative whose ส่งข้อความ button opens the
 *   Page's chat (creativeParams, messages), the post's text.
 *
 * Every Meta id is saved the moment Meta returns it (run-store.ts), so resumeRun carries a run on
 * from where it stopped and never makes a second ad set or ad. One post that breaks does not stop
 * the others. No new post is started once RUN_TIME_BUDGET_MS has passed since the press; those
 * get no row and are pressed again (OUT_OF_TIME), so a run ends well inside the page's 300 s.
 */

export const RUN_TIME_BUDGET_MS = 120_000;
/** longer than any run can last, so a run still making its ad is never taken over */
export const RUN_CLAIM_STALE_MS = 300_000;
export const OUT_OF_TIME = "ส่งไม่ทันในรอบเดียว กดยิงอีกครั้งเพื่อยิงโพสต์ที่เหลือ";
export const FELL_BACK = "บูสต์ไม่ได้ ทำเป็นแอดใหม่จากโพสต์แทน";
/** the post has a run with no ad yet that was not dropped: the database allows one (ins_ad_run_one_open) */
export const OPEN_RUN = "โพสต์นี้มีรายการค้างอยู่ — กดลองใหม่หรือเลิกในแท็บผลแอดก่อน";

const NO_POSTS = "ยังไม่ได้เลือกโพสต์";
const BAD_DAYS = "เลือกจำนวนวัน 3, 7 หรือ 14 วัน";
const BAD_IDS = "บัญชีโฆษณาหรือเพจไม่ถูกต้อง";
const NO_TOKEN = "ยังไม่ได้เชื่อมบัญชีโฆษณาสำหรับสร้างแอด กดเชื่อมบัญชีก่อน";
const NO_TH_IDENTITY =
  "ยังไม่ได้ตั้งค่า META_TH_VERIFIED_IDENTITY_ID — Meta บังคับให้แอดที่แสดงในไทยระบุผู้ลงโฆษณาที่ยืนยันตัวตนแล้ว (ขั้นตอนอยู่ใน docs/ads-manage-permission.md)";
const NO_POSTER = "โพสต์นี้ยังไม่มีรูป";
const POST_GONE = "โพสต์นี้ถูกลบไปแล้ว";
const BUSY = "กำลังยิงโพสต์นี้อยู่ รอสักครู่แล้วลองใหม่";
const NOT_FOUND = "ไม่พบรายการยิงนี้";
/** what graph() puts before Meta's own words when Meta refuses a request */
const REFUSED = "Facebook ไม่รับ — ";

export interface RunPost {
  contentId: string;
  path: { kind: "boost"; postId: string } | { kind: "new" };
  headline: string;
  /** the post's whole text, a new ad's primary text */
  text: string;
}

export interface RunInput {
  pageId: string;
  pageName: string;
  actId: string;
  currency: string | null;
  dailyBudgetBaht: number;
  days: number;
  posts: RunPost[];
  createdBy: string;
}

export interface RunDeps {
  store: typeof import("./run-store");
  /** the ads_management token for the account, or null when it is not connected */
  token(actId: string): Promise<string | null>;
  /** the post's picture, square, or null when it has none */
  poster(contentId: string): Promise<Buffer | null>;
  /** the post's words, for a resume; null when it is gone */
  post(contentId: string): Promise<RunPost | null>;
  thIdentity?: () => string | null;
  fetchFn?: typeof fetch;
  now?: () => Date;
  /** when the request began (ms); the time budget counts from here */
  startedAt?: number;
}

export interface PostOutcome {
  contentId: string;
  /** null when no row was made for the post */
  runId: string | null;
  ok: boolean;
  path: RunPath | null;
  /** FELL_BACK when a boost became a new ad */
  note: string | null;
  error: string | null;
}

export type RunResult = { ok: true; outcomes: PostOutcome[] } | { ok: false; error: string };

const skipped = (contentId: string, error: string): PostOutcome => ({ contentId, runId: null, ok: false, path: null, note: null, error });

/** Meta said no, as against a lost answer or an expired login. */
const refused = (error: string) => error.startsWith(REFUSED);

interface Sources {
  post(contentId: string): Promise<RunPost | null>;
  poster(contentId: string): Promise<Buffer | null>;
}

export async function runPosts(input: RunInput, deps: RunDeps): Promise<RunResult> {
  const now = deps.now ?? (() => new Date());
  const begun = deps.startedAt ?? now().getTime();
  const posts = [...new Map(input.posts.map((p) => [p.contentId, p])).values()];
  if (posts.length === 0) return { ok: false, error: NO_POSTS };
  const budget = checkDailyBudget(input.dailyBudgetBaht, input.currency, maxDailyBudgetThb());
  if (!budget.ok) return { ok: false, error: budget.error };
  if (!isRunDays(input.days)) return { ok: false, error: BAD_DAYS };
  // ids go into Graph paths; anything else would let a bad value pick a different endpoint
  if (!/^act_\d+$/.test(input.actId) || !/^\d+$/.test(input.pageId)) return { ok: false, error: BAD_IDS };
  const identity = (deps.thIdentity ?? thVerifiedIdentity)();
  if (!identity) return { ok: false, error: NO_TH_IDENTITY };
  const token = await deps.token(input.actId);
  if (!token) return { ok: false, error: NO_TOKEN };

  // a new ad's picture is fetched before anything is made, so a post without one is left out whole
  const posters = new Map<string, Buffer>();
  const early = new Map<string, PostOutcome>();
  for (const p of posts) {
    if (p.path.kind !== "new") continue;
    const poster = await deps.poster(p.contentId);
    if (poster) posters.set(p.contentId, poster);
    else early.set(p.contentId, skipped(p.contentId, NO_POSTER));
  }
  if (early.size === posts.length) return { ok: true, outcomes: posts.map((p) => early.get(p.contentId)!) };

  const fetchFn = deps.fetchFn ?? fetch;
  const campaign = await standingCampaign(input, token, fetchFn, deps.store);
  if (!campaign.ok) return campaign;

  const byId = new Map(posts.map((p) => [p.contentId, p]));
  const sources: Sources = {
    post: async (id) => byId.get(id) ?? deps.post(id),
    poster: async (id) => posters.get(id) ?? deps.poster(id),
  };
  const outcomes: PostOutcome[] = [];
  for (const p of posts) {
    const left = early.get(p.contentId);
    if (left) { outcomes.push(left); continue; }
    if (now().getTime() - begun >= RUN_TIME_BUDGET_MS) { outcomes.push(skipped(p.contentId, OUT_OF_TIME)); continue; }
    const run = await deps.store.createRun({
      pageId: input.pageId,
      actId: input.actId,
      contentId: p.contentId,
      path: p.path.kind,
      storyId: p.path.kind === "boost" ? storyIdOf(input.pageId, p.path.postId) : null,
      dailyBudgetMinor: budget.minor,
      endAt: endAtOf(now(), input.days),
      metaCampaignId: campaign.id,
      createdBy: input.createdBy,
    });
    if (!run) { outcomes.push(skipped(p.contentId, OPEN_RUN)); continue; }
    outcomes.push(await drive(run.id, p.path.kind === "boost" ? p.path.postId : null, token, identity, sources, deps));
  }
  return { ok: true, outcomes };
}

/**
 * Carries one run on from where it stopped: only what is missing is made, with the budget, end
 * and path it was started with. A run whose ad is made is left as it is.
 */
export async function resumeRun(runId: string, deps: RunDeps): Promise<PostOutcome> {
  const run = await deps.store.getRun(runId);
  if (!run) return { contentId: "", runId, ok: false, path: null, note: null, error: NOT_FOUND };
  if (run.adId) return { contentId: run.contentId ?? "", runId, ok: true, path: run.path, note: null, error: null };
  let identity: string | null = null;
  if (!run.adsetId) {
    identity = (deps.thIdentity ?? thVerifiedIdentity)();
    if (!identity) return { contentId: run.contentId ?? "", runId, ok: false, path: run.path, note: null, error: NO_TH_IDENTITY };
  }
  const token = await deps.token(run.actId);
  if (!token) return { contentId: run.contentId ?? "", runId, ok: false, path: run.path, note: null, error: NO_TOKEN };
  const post = run.contentId ? await deps.post(run.contentId) : null;
  const postId = post?.path.kind === "boost" ? post.path.postId : null;
  return drive(runId, postId, token, identity, { post: deps.post, poster: deps.poster }, deps);
}

/**
 * The Page's standing campaign in the account. The stored one is used while Meta has it; one
 * Meta deleted or archived, or refuses to read (gone, or no longer this login's), is replaced by a
 * new one (ACTIVE). One the owner paused in Ads Manager is not used and not switched back on: the
 * owner stopped every ad under it, and a new ad set there would never spend, so the run says so.
 * A check whose answer was lost stops the run rather than make a second campaign.
 */
async function standingCampaign(
  input: RunInput,
  token: string,
  fetchFn: typeof fetch,
  store: RunDeps["store"],
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = `AdvisorTool · ทักแชท · ${input.pageName}`;
  const kept = await store.getStanding(input.pageId, input.actId);
  if (kept && /^\d+$/.test(kept)) {
    const r = await graph(fetchFn, token, `${kept}?fields=effective_status`);
    if (!r.ok && !refused(r.error)) return { ok: false, error: r.error };
    const status = r.ok ? String(r.body.effective_status ?? "") : "";
    if (r.ok && status === "PAUSED") {
      return { ok: false, error: `แคมเปญประจำ “${name}” ถูกหยุดใน Ads Manager — เปิดแคมเปญนั้นก่อนแล้วค่อยยิง` };
    }
    if (r.ok && status !== "DELETED" && status !== "ARCHIVED") return { ok: true, id: kept };
  }
  const r = await graph(fetchFn, token, `${input.actId}/campaigns`, campaignParams(name, "messages", "ACTIVE"));
  if (!r.ok) return { ok: false, error: r.error };
  const id = idOf(r.body);
  if (!id) return { ok: false, error: NO_ID };
  await store.saveStanding(input.pageId, input.actId, id);
  return { ok: true, id };
}

/** One post's ad set, creative and ad, under the run's claim, from whatever is saved already. */
async function drive(
  runId: string,
  /** the saved post id a boost names or looks up; null for a new ad */
  postId: string | null,
  token: string,
  identity: string | null,
  sources: Sources,
  deps: RunDeps,
): Promise<PostOutcome> {
  const { store } = deps;
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? (() => new Date());
  const first = await store.getRun(runId);
  const contentId = first?.contentId ?? "";
  if (!(await store.claimRun(runId, RUN_CLAIM_STALE_MS, now()))) {
    return { contentId, runId, ok: false, path: first?.path ?? null, note: null, error: BUSY };
  }
  try {
    // re-read under the claim: another request may have moved the run on
    const read = await store.getRun(runId);
    if (!read) return { contentId, runId, ok: false, path: null, note: null, error: NOT_FOUND };
    let run: AdRun = read;
    // said only by the run that fell back; a resumed fallback has said it already
    let note: string | null = null;
    const fail = async (error: string): Promise<PostOutcome> => {
      await store.saveRun(runId, { error });
      return { contentId, runId, ok: false, path: run.path, note, error };
    };
    const save = async (patch: Parameters<RunDeps["store"]["saveRun"]>[1]) => {
      await store.saveRun(runId, patch);
      run = { ...run, ...patch };
    };
    const fallBack = async () => {
      await save({ path: "fallback", creativeId: null, error: null });
      note = FELL_BACK;
    };

    const post = run.contentId ? await sources.post(run.contentId) : null;
    const act = run.actId;
    const name = `AdvisorTool · ${[...(post?.headline ?? "")].slice(0, 40).join("")} · ${bangkokDay(now())}`;

    if (!run.adsetId) {
      if (!identity) return fail(NO_TH_IDENTITY);
      const r = await graph(fetchFn, token, `${act}/adsets`, adsetParams({
        name, campaignId: run.metaCampaignId, dailyBudgetMinor: run.dailyBudgetMinor, identity,
        goal: { objective: "messages" }, pageId: run.pageId, endTime: run.endAt, status: "ACTIVE",
      }));
      if (!r.ok) return fail(r.error);
      const id = idOf(r.body);
      if (!id) return fail(NO_ID);
      await save({ adsetId: id, step: "adset", error: null });
    }

    /** the creative, falling back from a refused boost; the error that stopped it, or null */
    const makeCreative = async (): Promise<string | null> => {
      if (run.path === "boost") {
        let storyId = run.storyId;
        if (!storyId && postId && /^\d+$/.test(postId)) {
          const look = await graph(fetchFn, token, `${postId}?fields=page_story_id`);
          if (!look.ok && !refused(look.error)) return look.error;
          storyId = look.ok ? pageStoryOf(look.body) : null;
        }
        if (storyId) {
          const r = await graph(fetchFn, token, `${act}/adcreatives`, storyCreativeParams({ name, storyId }));
          if (r.ok) {
            const id = idOf(r.body);
            if (!id) return NO_ID;
            await save({ creativeId: id, storyId, step: "creative", error: null });
            return null;
          }
          if (!refused(r.error)) return r.error;
        }
        await fallBack();
      }
      if (!post) return POST_GONE;
      let imageHash = run.imageHash;
      if (!imageHash) {
        const poster = await sources.poster(post.contentId);
        if (!poster) return NO_POSTER;
        const r = await graph(fetchFn, token, `${act}/adimages`, imageParams(poster));
        if (!r.ok) return r.error;
        imageHash = hashOf(r.body);
        if (!imageHash) return NO_HASH;
        await save({ imageHash });
      }
      const r = await graph(fetchFn, token, `${act}/adcreatives`, creativeParams({
        name, pageId: run.pageId, imageHash, goal: { objective: "messages" },
        primaryText: post.text, headline: post.headline, description: null,
      }));
      if (!r.ok) return r.error;
      const id = idOf(r.body);
      if (!id) return NO_ID;
      await save({ creativeId: id, step: "creative", error: null });
      return null;
    };

    if (!run.creativeId) {
      const error = await makeCreative();
      if (error) return fail(error);
    }
    const makeAd = () => graph(fetchFn, token, `${act}/ads`, adParams({ name, adsetId: run.adsetId!, creativeId: run.creativeId, status: "ACTIVE" }));
    let ad = await makeAd();
    if (!ad.ok && run.path === "boost" && refused(ad.error)) {
      await fallBack();
      const error = await makeCreative();
      if (error) return fail(error);
      ad = await makeAd();
    }
    if (!ad.ok) return fail(ad.error);
    const adId = idOf(ad.body);
    if (!adId) return fail(NO_ID);
    await save({ adId, step: "ad", error: null });
    return { contentId, runId, ok: true, path: run.path, note, error: null };
  } finally {
    await store.releaseRun(runId);
  }
}
