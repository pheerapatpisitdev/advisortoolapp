"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { myPages } from "@/lib/auth/pages";
import { COLUMNS, toItem, type ContentItem } from "@/lib/content/store";
import { fullText } from "@/lib/content/output";
import { drawPoster } from "@/lib/content/poster-draw";
import type { PosterSpec } from "@/lib/content/poster";
import { adManageAccounts, adManageToken } from "@/lib/facebook/ads-manage-connection";
import { adAccountToken } from "@/lib/facebook/ads-connection";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { graph } from "@/lib/ads/graph";
import { parseDays } from "@/lib/ads/manager-view";
import { syncAds } from "@/lib/ads/sync";
import { baselineCost } from "@/lib/ads/advice";
import { boardRows, boardTotals, type BoardDaily, type BoardRow } from "@/lib/ads/board";
import { costPer } from "@/lib/ads/results";
import { postPath, type PostPath } from "@/lib/ads/run-path";
import { resumeRun, runPosts, type PostOutcome, type RunDeps, type RunPost, type RunResult } from "@/lib/ads/run";
import * as runStore from "@/lib/ads/run-store";
import type { AdRun } from "@/lib/ads/run-store";
import { controlRun, setAdStatus, type Control, type ControlResult } from "@/lib/ads/run-controls";
import { connection, type Connection } from "./connection";

/**
 * Ads Studio's doors (spec 2026-10-07): the Page's Organic posts, running them as Messenger ads,
 * the results board and its buttons. A run spends the owner's money at once, so every door asks
 * for the owner first, and the page asks again. Whatever breaks underneath is logged and comes
 * back as a short Thai sentence, so the owner is never left not knowing whether an ad was made.
 */

const SOMETHING_BROKE = "ทำรายการไม่สำเร็จ ลองอีกครั้ง ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ";
const PAGE_NOT_CONNECTED = "เพจนี้ยังไม่ได้เชื่อมกับระบบ";
const ACCOUNT_NOT_CONNECTED = "บัญชีโฆษณานี้ยังไม่ได้เชื่อมสำหรับสร้างแอด";
const NOT_THIS_PAGE = "โพสต์นี้ไม่ได้อยู่ในเพจนี้";
const RUNNING = "โพสต์นี้กำลังรันอยู่ — เพิ่มงบหรือยืดเวลาในแท็บผลแอด";
const NOT_FOUND = "ไม่พบรายการยิงนี้";
/** how many of a Page's newest posts the grid offers */
const POSTS_SHOWN = 120;
const TITLE_MAX = 60;

export interface PostCard {
  id: string;
  title: string;
  planHref: string;
  poster: PosterSpec | null;
  path: PostPath;
  createdAt: string;
  /** a run of it has its ad on and has not ended */
  live: boolean;
  /** what a chat cost in its newest run, over the last 30 days; null with no chat or no run */
  lastCostPerChat: number | null;
}

const titleOf = (p: ContentItem) => [...(p.output.hooks[0] ?? "")].slice(0, TITLE_MAX).join("");

/** A run whose ad is on, not paused and not past its end. */
const isLive = (r: AdRun, now = Date.now()) => Boolean(r.adId) && !r.pausedAt && Date.parse(r.endAt) > now;

/** The first Thai day of a window of `days` days ending today (ins_ad_daily dates are Thai days). */
function bangkokSince(days: number, now = Date.now()): string {
  return new Date(now + 7 * 3600000 - (days - 1) * 86400000).toISOString().slice(0, 10);
}

/** The Page's Organic posts, newest first, the ones on the Page too (listContent leaves those to the calendar). */
async function pagePosts(pageId: string): Promise<ContentItem[]> {
  const { data, error } = await supabaseAdmin()
    .from("ins_content")
    .select(COLUMNS)
    .eq("page_id", pageId)
    .eq("format", "post")
    .neq("status", "trashed")
    .order("created_at", { ascending: false })
    .limit(POSTS_SHOWN);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toItem);
}

type DailyRow = BoardDaily & { date: string; fetched_at: string | null };
const DAILY = "ad_id, ad_name, campaign_name, account_id, spend, messaging_started, date, fetched_at";

type Page = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Every daily row a query finds, paging by 1000 (PostgREST's most), in a stable order so no row falls between pages. */
async function allDaily(query: (from: number, to: number) => Page): Promise<DailyRow[]> {
  const out: DailyRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as DailyRow[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

const daily = () => supabaseAdmin().from("ins_ad_daily").select(DAILY);

const dailyOfPage = (pageId: string, since: string) =>
  allDaily((a, z) => daily().eq("page_id", pageId).gte("date", since).order("date", { ascending: true }).order("ad_id", { ascending: true }).range(a, z));

async function dailyOfAds(adIds: string[], since: string): Promise<DailyRow[]> {
  const out: DailyRow[] = [];
  for (let i = 0; i < adIds.length; i += 100) {
    const ids = adIds.slice(i, i + 100);
    out.push(...(await allDaily((a, z) => daily().in("ad_id", ids).gte("date", since).order("date", { ascending: true }).order("ad_id", { ascending: true }).range(a, z))));
  }
  return out;
}

/** The pages the owner can pick, the one shown, and the ad-account connection. */
export async function adsPage(pageId?: string): Promise<{ pages: { pageId: string; pageName: string }[]; pageId: string | null; connection: Connection }> {
  await requireStaff("owner");
  const [mine, conn] = await Promise.all([myPages(), connection()]);
  const pages = mine.map((p) => ({ pageId: p.pageId, pageName: p.pageName }));
  const page = pages.find((p) => p.pageId === pageId) ?? pages[0] ?? null;
  return { pages, pageId: page?.pageId ?? null, connection: conn.connection };
}

export async function postsForAds(pageId: string): Promise<{ ok: true; posts: PostCard[] } | { ok: false; error: string }> {
  await requireStaff("owner");
  try {
    if (!(await myPages()).some((p) => p.pageId === pageId)) return { ok: false, error: PAGE_NOT_CONNECTED };
    const [posts, runs] = await Promise.all([pagePosts(pageId), runStore.listRuns(pageId)]);
    const now = new Date();
    // the newest run of each post that made an ad (runs come newest first)
    const newest = new Map<string, AdRun>();
    for (const r of runs) if (r.contentId && r.adId && !newest.has(r.contentId)) newest.set(r.contentId, r);
    const adIds = [...newest.values()].map((r) => r.adId!);
    const rows = adIds.length > 0 ? await dailyOfAds(adIds, bangkokSince(30)) : [];
    const byAd = new Map<string, { spend: number; chats: number }>();
    for (const d of rows) {
      const s = byAd.get(d.ad_id) ?? { spend: 0, chats: 0 };
      s.spend += Number(d.spend) || 0;
      s.chats += Number(d.messaging_started) || 0;
      byAd.set(d.ad_id, s);
    }
    return {
      ok: true,
      posts: posts.map((p) => {
        const last = newest.get(p.id);
        const sum = last?.adId ? byAd.get(last.adId) : undefined;
        return {
          id: p.id,
          title: titleOf(p),
          planHref: p.planHref,
          poster: p.output.poster ?? null,
          path: postPath(p, now),
          createdAt: p.createdAt,
          live: runs.some((r) => r.contentId === p.id && isLive(r, now.getTime())),
          lastCostPerChat: sum ? costPer(sum.spend, sum.chats) : null,
        };
      }),
    };
  } catch (e) {
    console.error("postsForAds failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

/** Where the run engine gets a post's words and square picture. A picture that cannot be drawn is none. */
function runDeps(startedAt: number, known: Map<string, ContentItem>): RunDeps {
  const pieceOf = async (id: string) => known.get(id) ?? (await supabaseAdmin().from("ins_content").select(COLUMNS).eq("id", id).maybeSingle()
    .then(({ data }) => (data ? toItem(data as Record<string, unknown>) : null)));
  return {
    startedAt,
    store: runStore,
    token: adManageToken,
    poster: async (id) => {
      try {
        const spec = (await pieceOf(id))?.output.poster;
        return spec ? await drawPoster(spec, "square") : null;
      } catch (e) {
        console.error("run poster not drawn:", id, e);
        return null;
      }
    },
    post: async (id) => {
      const p = await pieceOf(id);
      if (!p) return null;
      const path = postPath(p, new Date());
      return { contentId: p.id, path: path.kind === "boost" ? path : { kind: "new" }, headline: p.output.hooks[0] ?? "", text: fullText(p.output) };
    },
  };
}

/**
 * Runs the ticked posts. The Page must be the owner's and the account one connected for making
 * ads (its currency is read here, never taken from the form). Each post must be of this Page and
 * runnable now (postPath), and not running already; one that is not is left out with why. The
 * rest go to the engine (run.ts), which makes them ACTIVE.
 */
export async function runPostsAction(input: { pageId: string; actId: string; contentIds: string[]; dailyBudgetBaht: number; days: number }): Promise<RunResult> {
  const viewer = await requireStaff("owner");
  const startedAt = Date.now();
  let started = false;
  try {
    const [mine, accounts] = await Promise.all([myPages(), adManageAccounts()]);
    const page = mine.find((p) => p.pageId === input.pageId);
    if (!page) return { ok: false, error: PAGE_NOT_CONNECTED };
    const account = accounts.find((a) => a.id === input.actId);
    if (!account) return { ok: false, error: ACCOUNT_NOT_CONNECTED };
    const asked = [...new Set((Array.isArray(input.contentIds) ? input.contentIds : []).filter((x): x is string => typeof x === "string"))];

    const [posts, runs] = await Promise.all([pagePosts(page.pageId), runStore.listRuns(page.pageId)]);
    const byId = new Map(posts.map((p) => [p.id, p]));
    const now = new Date();
    const left: PostOutcome[] = [];
    const going: RunPost[] = [];
    for (const id of asked) {
      const p = byId.get(id);
      const skip = (error: string) => left.push({ contentId: id, runId: null, ok: false, path: null, note: null, error });
      if (!p) { skip(NOT_THIS_PAGE); continue; }
      if (runs.some((r) => r.contentId === id && isLive(r, now.getTime()))) { skip(RUNNING); continue; }
      const path = postPath(p, now);
      if (path.kind === "scheduled") { skip("โพสต์นี้ยังไม่ขึ้นเพจ"); continue; }
      if (path.kind === "none") { skip(path.reason); continue; }
      going.push({ contentId: id, path, headline: p.output.hooks[0] ?? "", text: fullText(p.output) });
    }
    if (going.length === 0) return { ok: true, outcomes: left };

    started = true;
    const result = await runPosts(
      {
        pageId: page.pageId, pageName: page.pageName, actId: account.id, currency: account.currency,
        dailyBudgetBaht: input.dailyBudgetBaht, days: input.days, posts: going, createdBy: viewer.agentId,
      },
      runDeps(startedAt, byId),
    );
    await audit("ads-run", page.pageId, {
      ok: result.ok, error: result.ok ? undefined : result.error, actId: account.id,
      dailyBudgetBaht: input.dailyBudgetBaht, days: input.days, posts: going.length, left: left.length,
      made: result.ok ? result.outcomes.filter((o) => o.ok).length : 0,
    });
    revalidatePath("/studio/ads", "layout");
    // the posts left out keep their place in the order asked
    if (!result.ok) return result;
    const all = new Map([...left, ...result.outcomes].map((o) => [o.contentId, o]));
    return { ok: true, outcomes: asked.flatMap((id) => (all.has(id) ? [all.get(id)!] : [])) };
  } catch (e) {
    console.error("runPostsAction failed:", e);
    // a run that reached the engine may have made something on Meta: the attempt is recorded
    if (started) await audit("ads-run", input.pageId, { ok: false, error: SOMETHING_BROKE, actId: input.actId }).catch(() => {});
    return { ok: false, error: SOMETHING_BROKE };
  }
}

/** Carries one run on from where it stopped (resumeRun). */
export async function retryRunAction(runId: string): Promise<PostOutcome> {
  await requireStaff("owner");
  try {
    const run = await runStore.getRun(runId);
    if (!run || !(await myPages()).some((p) => p.pageId === run.pageId)) {
      return { contentId: "", runId, ok: false, path: null, note: null, error: NOT_FOUND };
    }
    const out = await resumeRun(runId, runDeps(Date.now(), new Map()));
    await audit("ads-run", run.pageId, { ok: out.ok, retry: true, runId, error: out.error ?? undefined });
    revalidatePath("/studio/ads", "layout");
    return out;
  } catch (e) {
    console.error("retryRunAction failed:", e);
    return { contentId: "", runId, ok: false, path: null, note: null, error: SOMETHING_BROKE };
  }
}

/**
 * What Meta says each ad is doing, asked 50 at a time per account with whichever login that
 * account has. A read that fails leaves those ads without a status, never the board without rows.
 */
async function adStatuses(ads: { adId: string; actId: string }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const byAct = new Map<string, string[]>();
  for (const a of ads) if (/^\d+$/.test(a.adId)) byAct.set(a.actId, [...(byAct.get(a.actId) ?? []), a.adId]);
  await Promise.all([...byAct].map(async ([act, ids]) => {
    try {
      const token = (await adManageToken(act).catch(() => null)) ?? (await adAccountToken(act).catch(() => null));
      if (!token) return;
      for (let i = 0; i < ids.length; i += 50) {
        const r = await graph(fetch, token, `?ids=${ids.slice(i, i + 50).join(",")}&fields=effective_status`);
        if (!r.ok) continue;
        for (const [id, v] of Object.entries(r.body)) {
          const s = (v as { effective_status?: unknown } | null)?.effective_status;
          if (typeof s === "string") out.set(id, s);
        }
      }
    } catch (e) {
      console.error("ad statuses unreadable:", act, e);
    }
  }));
  return out;
}

export async function boardAction(pageId: string, days: unknown): Promise<
  | { ok: true; rows: BoardRow[]; totals: ReturnType<typeof boardTotals>; baseline: number; fetchedAt: string | null; controllable: string[] }
  | { ok: false; error: string }
> {
  await requireStaff("owner");
  try {
    if (!(await myPages()).some((p) => p.pageId === pageId)) return { ok: false, error: PAGE_NOT_CONNECTED };
    const since = bangkokSince(parseDays(days));
    const runs = await runStore.listRuns(pageId);
    const runAds = runs.flatMap((r) => (r.adId ? [r.adId] : []));
    const [pageRows, runRows, month] = await Promise.all([
      dailyOfPage(pageId, since),
      runAds.length > 0 ? dailyOfAds(runAds, since) : Promise.resolve([] as DailyRow[]),
      dailyOfPage(pageId, bangkokSince(30)),
    ]);
    // a run's ad is found both ways once the sync has tied it to the Page: each day counts once
    const rowsInRange = [...new Map([...pageRows, ...runRows].map((d) => [`${d.ad_id}|${d.date}`, d])).values()];

    const contentIds = [...new Set(runs.flatMap((r) => (r.contentId ? [r.contentId] : [])))];
    const posts = new Map<string, { title: string; poster: PosterSpec | null }>();
    if (contentIds.length > 0) {
      const { data, error } = await supabaseAdmin().from("ins_content").select(COLUMNS).in("id", contentIds);
      if (error) throw new Error(error.message);
      for (const p of ((data ?? []) as Record<string, unknown>[]).map(toItem)) posts.set(p.id, { title: titleOf(p), poster: p.output.poster ?? null });
    }

    const accountOf = new Map<string, string>();
    for (const d of rowsInRange) accountOf.set(d.ad_id, d.account_id);
    for (const r of runs) if (r.adId) accountOf.set(r.adId, r.actId);
    const ads = [...accountOf].map(([adId, actId]) => ({ adId, actId }));
    const [statuses, managed] = await Promise.all([adStatuses(ads), adManageAccounts().catch(() => [])]);
    const canManage = new Set(managed.map((a) => a.id));

    const rows = boardRows({ daily: rowsInRange, runs, posts, statuses, baseline: baselineCost(month), now: new Date() });
    const fetchedAt = rowsInRange.reduce<string | null>((m, r) => (r.fetched_at && (!m || r.fetched_at > m) ? r.fetched_at : m), null);
    return {
      ok: true,
      rows,
      totals: boardTotals(rows),
      baseline: baselineCost(month),
      fetchedAt,
      controllable: rows.filter((r) => canManage.has(r.actId)).map((r) => r.adId),
    };
  } catch (e) {
    console.error("boardAction failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

/** Reads the last 3 days' figures from Meta now, as the nightly sync does. */
export async function refreshResultsAction(): Promise<{ ok: true; errors: string[] } | { ok: false; error: string }> {
  await requireStaff("owner");
  try {
    const r = await syncAds({ days: 3 });
    revalidatePath("/studio/ads", "layout");
    return { ok: true, errors: r.errors.map((e) => `${e.name}: ${e.message}`) };
  } catch (e) {
    console.error("refreshResultsAction failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

/** หยุด / เปิดต่อ / เพิ่มงบ / ยืดเวลา on a run's ad set (run-controls.ts), recorded whatever came of it. */
export async function controlRunAction(runId: string, control: Control): Promise<ControlResult> {
  await requireStaff("owner");
  try {
    if (!["pause", "resume", "raise", "extend"].includes(control)) return { ok: false, error: SOMETHING_BROKE };
    const run = await runStore.getRun(runId);
    if (!run || !(await myPages()).some((p) => p.pageId === run.pageId)) return { ok: false, error: NOT_FOUND };
    const out = await controlRun(runId, control, { store: runStore, token: adManageToken });
    await audit("ads-run-control", runId, { control, ok: out.ok, error: out.ok ? undefined : out.error, pageId: run.pageId });
    revalidatePath("/studio/ads", "layout");
    return out;
  } catch (e) {
    console.error("controlRunAction failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}

/** หยุด / เปิดต่อ on one ad of an account connected for making ads. */
export async function controlAdAction(adId: string, actId: string, status: "PAUSED" | "ACTIVE"): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff("owner");
  try {
    if (status !== "PAUSED" && status !== "ACTIVE") return { ok: false, error: SOMETHING_BROKE };
    if (!(await adManageAccounts()).some((a) => a.id === actId)) return { ok: false, error: ACCOUNT_NOT_CONNECTED };
    const token = await adManageToken(actId);
    if (!token) return { ok: false, error: ACCOUNT_NOT_CONNECTED };
    const out = await setAdStatus(adId, status, token);
    await audit("ads-ad-control", adId, { status, actId, ok: out.ok, error: out.ok ? undefined : out.error });
    revalidatePath("/studio/ads", "layout");
    return out;
  } catch (e) {
    console.error("controlAdAction failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}
