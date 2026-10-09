import { currentScope, maySeePiece, pieceFilter } from "@/lib/auth/scope";
import { admits, monthSpend, release, reserve, spendSince, sweepHolds, type SpendLine } from "@/lib/ai/ledger";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inWalletRound } from "@/lib/wallet/round";
import { walletChargedThb } from "@/lib/wallet/store";
import type { ContentWord, WordHit, WordKind } from "./check";
import { removeClipsOf } from "./clip-store";
import { isHookCategory, pickHookMenu, type HookCategory, type HookTemplate } from "./hooks";
import { readLook, type Look } from "./looks";
import { ON_PAGE_STATES, POSTING_STALE_MS } from "./publish-label";
import type { PolicyFinding } from "./policy";
import type { Fix } from "./proofread";
import type { AngleId, Length, PieceFormat } from "./prompt";
import type { ContentOutput } from "./output";

/**
 * Where generated pieces and the owner's word list are kept: ins_content, ins_content_words.
 * Both are service_role only; the public page reaches them through its server actions.
 */

export interface Flags {
  /** amounts in the piece that were not in the brief */
  numbers: string[];
  /** words from the owner's list */
  words: WordHit[];
  /** Facebook's advertising rules; absent on pieces written before the rules were checked */
  policy?: PolicyFinding[];
  /** the proofreader's suggestions; null until it has run */
  fixes: Fix[] | null;
}

export interface ContentItem {
  id: string;
  createdAt: string;
  planHref: string;
  format: PieceFormat;
  angle: AngleId;
  length: Length | null;
  output: ContentOutput;
  flags: Flags;
  model: string | null;
  costThb: number;
  status: ContentStatus;
  hookTemplateId: string | null;
  /** posted to a Facebook Page from here, or held there for later; null when never sent */
  publish: Publish | null;
  /** the UnitOS agent who wrote it; null before 2026-09-27, when every piece was the owner's */
  agentId: string | null;
  /** the Page whose project it is (owner, 2026-09-30): written there, posted only there; null for an agent with no Pages */
  pageId: string | null;
  /** the day an agent with no Page planned it for, and when they said it was posted (owner, 2026-09-30); null when not planned */
  plan: { day: string; doneAt: string | null } | null;
  /** the Ads Studio campaign an ad piece is filed under (owner, 2026-10-04); null for every other piece */
  campaignId: string | null;
}

export const PUBLISH_STATES = ["posting", "scheduled", "published", "failed", "cancelled"] as const;
export type PublishState = (typeof PUBLISH_STATES)[number];

export interface Publish {
  state: PublishState;
  pageId: string | null;
  /** Facebook's id for it: "<page>_<post>" when it gave one, the photo id otherwise */
  postId: string | null;
  /** when it went up, or when Facebook will put it up */
  at: string | null;
  error: string | null;
}

/**
 * รอตรวจ, ใช้จริง and ถังขยะ — the star this replaced meant ใช้จริง.
 *
 * The owner took the bin out on 2026-09-23 (ลบ deleted outright) and asked for it back on
 * 2026-09-26: ทิ้ง moves a piece here, and only ลบถาวร from the bin deletes it. Rows thrown
 * away before the bin went out show up in it again.
 */
export const CONTENT_STATUSES = ["draft", "used", "trashed"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export const isContentStatus = (v: unknown): v is ContentStatus =>
  typeof v === "string" && (CONTENT_STATUSES as readonly string[]).includes(v);

/**
 * What content may spend in a month, on its own.
 *
 * The monthly budget is one pot, and the Messenger bot answering paid advertisements draws on
 * it too. When the pot runs dry the bot goes quiet — so this page stops well before that, at
 * a ceiling of its own, and a busy afternoon of writing posts cannot cost a lead their answer.
 * The owner sets the ceiling on /admin/ai (since 2026-09-24); this is it until they do.
 */
export const DEFAULT_CONTENT_CAP_THB = 30;

/**
 * The ceiling, or the default when the owner never set one. A read that failed is not an
 * unset ceiling: it throws, so the caller refuses to spend rather than spending against ฿30
 * it made up.
 */
export async function contentCap(): Promise<number> {
  // a round the agent pays for from their wallet is not the owner's money (owner, 2026-09-30):
  // it is bounded by the wallet's hold instead (src/lib/wallet/round.ts)
  if (inWalletRound()) return Infinity;
  const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("content_budget_thb").maybeSingle();
  if (error) {
    console.error("content cap unreadable:", error.message);
    throw new Error(`อ่านงบคอนเทนต์ไม่ได้: ${error.message}`);
  }
  const set = data?.content_budget_thb;
  return set === null || set === undefined ? DEFAULT_CONTENT_CAP_THB : Number(set);
}

/** what the content tasks have cost in these ledger lines */
export function contentBaht(lines: SpendLine[]): number {
  return lines.filter((l) => l.task?.startsWith("content")).reduce((s, l) => s + l.baht, 0);
}

/**
 * What content has spent this month, with the money running rounds have set aside — the one
 * reader that counts holds. Dead requests' holds are swept first so they do not count. What
 * agents paid for from their wallets is taken off: the ceiling guards the owner's money.
 */
export async function contentSpentThisMonth(): Promise<number> {
  await sweepHolds();
  const since = await spendSince();
  const [spend, paidByAgents] = await Promise.all([monthSpend(since, { holds: true }), walletChargedThb(since)]);
  return Math.max(0, contentBaht(spend.lines) - paidByAgents);
}

/**
 * the ledger task a clip's delivered render or preview is written under (src/lib/video/jobs.ts):
 * content-*, so the ceiling counts it — and a wallet round's charge, taken off the same figure,
 * nets it out, so only what the owner paid stays on the ceiling
 */
export const CONTENT_EDIT_TASK = "content-edit";

/** the ledger task a content reservation is written under; content-*, so the ceiling counts it */
export const CONTENT_RESERVE_TASK = "content-reserve";

/**
 * Sets `thb` aside against the content ceiling before a call spends it, and reads the
 * ledger again with it in. Goes ahead (with the reservation's id, to release when the work
 * is over — the real costs are in the ledger by then) only when everything spent and held,
 * this included, fits under `cap`; otherwise gives it back and says how much was left.
 */
export async function holdContentBudget(thb: number, cap: number): Promise<{ ok: true; id: string } | { ok: false; left: number }> {
  const id = await reserve(CONTENT_RESERVE_TASK, thb);
  let total: number;
  try {
    total = await contentSpentThisMonth();
  } catch (e) {
    await release(id);
    throw e;
  }
  if (admits(total, cap)) return { ok: true, id };
  await release(id);
  return { ok: false, left: Math.max(0, cap - (total - thb)) };
}

export { release as releaseContentBudget };

// one literal: supabase-js reads the column list's type from the string, and a joined one is opaque to it
export const COLUMNS = "id, agent_id, created_at, plan_href, format, angle, length, output, flags, model, cost_thb, status, hook_template_id, fb_page_id, fb_post_id, publish_state, publish_at, publish_error, page_id, plan_day, planned_done_at, campaign_id";

function toPublish(r: Record<string, unknown>): Publish | null {
  const state = r.publish_state;
  if (typeof state !== "string" || !(PUBLISH_STATES as readonly string[]).includes(state)) return null;
  return {
    state: state as PublishState,
    pageId: (r.fb_page_id as string | null) ?? null,
    postId: (r.fb_post_id as string | null) ?? null,
    at: (r.publish_at as string | null) ?? null,
    error: (r.publish_error as string | null) ?? null,
  };
}

export function toItem(r: Record<string, unknown>): ContentItem {
  const flags = (r.flags ?? {}) as Partial<Flags>;
  return {
    id: String(r.id),
    createdAt: String(r.created_at),
    planHref: String(r.plan_href),
    format: r.format as PieceFormat,
    angle: (r.angle ?? "") as AngleId,
    length: (r.length ?? null) as Length | null,
    output: r.output as ContentOutput,
    flags: { numbers: flags.numbers ?? [], words: flags.words ?? [], policy: flags.policy ?? [], fixes: flags.fixes ?? null },
    model: (r.model as string | null) ?? null,
    costThb: Number(r.cost_thb ?? 0),
    status: isContentStatus(r.status) ? r.status : "draft",
    hookTemplateId: (r.hook_template_id as string | null) ?? null,
    publish: toPublish(r),
    agentId: (r.agent_id as string | null) ?? null,
    pageId: (r.page_id as string | null) ?? null,
    plan: r.plan_day ? { day: String(r.plan_day), doneAt: (r.planned_done_at as string | null) ?? null } : null,
    campaignId: (r.campaign_id as string | null) ?? null,
  };
}

export async function saveContent(row: {
  planHref: string; format: PieceFormat; angle: AngleId; length: Length | null;
  output: ContentOutput; flags: Flags; rateVersion: string | null; model: string; costThb: number;
  hookTemplateId: string | null;
  /** the Page whose project the piece goes into (projectPage settled it); null for an agent with no Pages */
  pageId: string | null;
  /** the Ads Studio campaign an ad piece is filed under; absent for every other piece */
  campaignId?: string | null;
}): Promise<ContentItem> {
  const owner = (await currentScope()).owner;
  const { data, error } = await supabaseAdmin().from("ins_content").insert({
    agent_id: owner?.agentId ?? null, tenant_id: owner?.tenantId ?? null,
    plan_href: row.planHref, format: row.format, angle: row.angle || null, length: row.length,
    output: row.output, flags: row.flags, rate_version: row.rateVersion, model: row.model, cost_thb: row.costThb,
    hook_template_id: row.hookTemplateId, page_id: row.pageId, campaign_id: row.campaignId ?? null,
  }).select(COLUMNS).single();
  if (error) throw new Error(`บันทึกคอนเทนต์ไม่สำเร็จ: ${error.message}`);
  return toItem(data as Record<string, unknown>);
}

/** A piece by its id — or null when it is not the asker's to see (src/lib/auth/scope.ts: its Page's, or its writer's). */
export async function getContent(id: string): Promise<ContentItem | null> {
  const [{ data, error }, scope] = await Promise.all([
    supabaseAdmin().from("ins_content").select(COLUMNS).eq("id", id).maybeSingle(),
    currentScope(),
  ]);
  if (error) throw new Error(error.message);
  const item = data ? toItem(data as Record<string, unknown>) : null;
  return item && maySeePiece(scope, item) ? item : null;
}

/**
 * The asker's pieces only, as a filter — null for after() work, which sees everything. Read
 * before a query is built: a PostgREST query is a thenable, and handing one through an async
 * function runs it.
 */
async function ownersFilter(): Promise<string | null> {
  return pieceFilter(await currentScope());
}

/**
 * A claim older than this is a request that died: its row may be claimed again, and the
 * lists show it as failed. Quoted for PostgREST, since a timestamp holds its reserved "." and ":".
 */
const staleClaim = (now = new Date()) =>
  `and(publish_state.eq.posting,or(publish_at.is.null,publish_at.lt."${new Date(now.getTime() - POSTING_STALE_MS).toISOString()}"))`;

/** the studio's lists: a piece on the Page is the calendar's to show (see onPage); a stuck send is not */
const offPage = () => `publish_state.is.null,publish_state.not.in.(${ON_PAGE_STATES.join(",")}),${staleClaim()}`;

/** `offset`: the pieces already shown, for โหลดเพิ่ม — newest first, so the next page is older. `pageId`: one Page's project */
/**
 * A piece by its id, whoever is asking — for work no person asked for: a render service's
 * callback, a job collected after the answer went back (src/lib/video/jobs.ts). Never answer a
 * person's request with it; getContent is the one that checks the piece is theirs.
 */
export async function getContentUnscoped(id: string): Promise<ContentItem | null> {
  const { data, error } = await supabaseAdmin().from("ins_content").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toItem(data as Record<string, unknown>) : null;
}

/** `includeAds`: Organic Studio shows no ad piece, so its callers omit it; Ads Studio reads its ads through listCampaignPieces, and nothing passes this today (kept for a reader that wants both) */
export async function listContent(filter: { status?: ContentStatus; planHref?: string; pageId?: string; includeAds?: boolean } = {}, limit = 40, offset = 0): Promise<ContentItem[]> {
  const only = await ownersFilter();
  let q = supabaseAdmin().from("ins_content").select(COLUMNS).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.planHref) q = q.eq("plan_href", filter.planHref);
  if (filter.pageId) q = q.eq("page_id", filter.pageId);
  if (!filter.includeAds) q = q.neq("format", "ad");
  if (only) q = q.or(only);
  const { data, error } = await q.or(offPage());
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toItem);
}

/** How many pieces sit under each tab. Three head-only counts; the table is small. */
export async function countByStatus(planHref?: string, pageId?: string): Promise<Record<ContentStatus, number>> {
  const only = await ownersFilter();
  const counts = await Promise.all(CONTENT_STATUSES.map(async (status) => {
    let q = supabaseAdmin().from("ins_content").select("id", { count: "exact", head: true }).eq("status", status).neq("format", "ad");
    if (planHref) q = q.eq("plan_href", planHref);
    if (pageId) q = q.eq("page_id", pageId);
    if (only) q = q.or(only);
    const { count, error } = await q.or(offPage());
    if (error) throw new Error(error.message);
    return [status, count ?? 0] as const;
  }));
  return Object.fromEntries(counts) as Record<ContentStatus, number>;
}

/** How many drafts each Page's project holds, for the cards on /studio (owner, 2026-09-30). */
export async function countDraftsByPage(): Promise<Map<string, number>> {
  const only = await ownersFilter();
  let q = supabaseAdmin().from("ins_content").select("page_id").eq("status", "draft").neq("format", "ad").not("page_id", "is", null);
  if (only) q = q.or(only);
  const { data, error } = await q.or(offPage());
  if (error) throw new Error(error.message);
  const out = new Map<string, number>();
  for (const r of (data ?? []) as { page_id: string }[]) out.set(r.page_id, (out.get(r.page_id) ?? 0) + 1);
  return out;
}

export async function setStatus(id: string, status: ContentStatus): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_content").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** a new mark for the output's every write; see ContentOutput.rev */
const nextRev = () => crypto.randomUUID();

/**
 * The owner's edits, with the checks run again over what they now say. Without `flags` only
 * the output is written — for a change the checks do not read (a photograph), so flags
 * written meanwhile by another request are not put back to an older copy.
 */
export async function saveOutput(id: string, output: ContentOutput, flags?: Flags): Promise<ContentItem> {
  const next = { ...output, rev: nextRev() };
  const { data, error } = await supabaseAdmin().from("ins_content")
    .update(flags ? { output: next, flags } : { output: next }).eq("id", id).select(COLUMNS).single();
  if (error) throw new Error(error.message);
  return toItem(data as Record<string, unknown>);
}

/**
 * saveOutput, only if the output is still the one read — its `rev` unchanged (null: a piece
 * written before revisions, never written since). Null when another write came first: an
 * edit saved while a picture was drawing, a picture that landed while an edit was saved. The
 * caller reads the piece again and builds on that, rather than writing its older copy back.
 * `publishAsRead`: also only while its publish is still the one read (state and time) — a send
 * claims a piece without touching its output, so a write that must not land under a send that
 * started meanwhile (letting a Reel's take go) is held to this too.
 */
export async function saveOutputIf(
  id: string, output: ContentOutput, flags: Flags | undefined, rev: string | null, publishAsRead?: Publish | null,
): Promise<ContentItem | null> {
  const next = { ...output, rev: nextRev() };
  let q = supabaseAdmin().from("ins_content").update(flags ? { output: next, flags } : { output: next }).eq("id", id);
  q = rev === null ? q.is("output->>rev", null) : q.eq("output->>rev", rev);
  if (publishAsRead === null) q = q.is("publish_state", null);
  else if (publishAsRead) {
    q = q.eq("publish_state", publishAsRead.state);
    q = publishAsRead.at === null ? q.is("publish_at", null) : q.eq("publish_at", publishAsRead.at);
  }
  const { data, error } = await q.select(COLUMNS);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.length === 1 ? toItem(rows[0]) : null;
}

/**
 * The looks of a Page's latest pictures, newest first (looks.ts) — what the look picker is told
 * not to repeat. None for an agent with no Page: their pieces have no one Page to vary within.
 */
export async function recentLooks(pageId: string | null, limit = 5): Promise<Look[]> {
  if (!pageId) return [];
  const { data, error } = await supabaseAdmin().from("ins_content").select("output")
    .eq("page_id", pageId).not("output->look", "is", null).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { output: ContentOutput }[]).flatMap((r) => {
    const look = readLook(r.output?.look);
    return look ? [look] : [];
  });
}

/**
 * The hooks of the asker's used pieces, newest first — what the planner is told not to repeat.
 *
 * Only the pieces the asker may see (ownersFilter): it read every tenant's, so one agent's
 * opening lines — a รีวิวเคลม's among them, which can carry a customer's story — went into every
 * other agent's planner prompt (review, 2026-10-01). The rule it serves, "don't repeat
 * yourself", is about the asker's own posts anyway.
 */
export async function usedHooks(limit = 40): Promise<string[]> {
  const only = await ownersFilter();
  let q = supabaseAdmin().from("ins_content").select("output")
    .eq("status", "used").order("created_at", { ascending: false }).limit(limit);
  if (only) q = q.or(only);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as { output: ContentOutput }[]).map((r) => r.output?.hooks?.[0] ?? "").filter(Boolean);
}

/**
 * The opening lines of the asker's latest pieces of one kind on one Page, newest first — what
 * every Organic tool's round is told not to repeat (owner, 2026-10-09: three คำคม rounds opened
 * alike). Every piece made counts, not only ใช้จริง: a draft left in รอตรวจ is still on the
 * agent's screen, and one thrown away was most often thrown for being the same again. Fails soft:
 * a round with no list is a round with nothing to avoid, not a round refused.
 */
export async function recentHooks(planHref: string, pageId: string | null, limit = 30): Promise<string[]> {
  const only = await ownersFilter();
  let q = supabaseAdmin().from("ins_content").select("output")
    .eq("plan_href", planHref).neq("format", "ad").order("created_at", { ascending: false }).limit(limit);
  q = pageId ? q.eq("page_id", pageId) : q.is("page_id", null);
  if (only) q = q.or(only);
  const { data, error } = await q;
  if (error) {
    console.error("อ่านประโยคเปิดเดิมไม่ได้:", error.message);
    return [];
  }
  return ((data ?? []) as { output: ContentOutput }[]).map((r) => r.output?.hooks?.[0] ?? "").filter(Boolean);
}

export async function setFixes(item: ContentItem, fixes: Fix[]): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_content")
    .update({ flags: { ...item.flags, fixes } }).eq("id", item.id);
  if (error) throw new Error(error.message);
}

/** The owner's word list. Fails soft: a check with no list is a check that finds nothing. */
export async function listWords(): Promise<ContentWord[]> {
  const { data, error } = await supabaseAdmin().from("ins_content_words").select("word, kind, fix").order("created_at");
  if (error) {
    console.error("อ่านรายการคำไม่ได้:", error.message);
    return [];
  }
  return ((data ?? []) as { word: string; kind: WordKind; fix: string | null }[]);
}

export async function addWord(word: string, kind: WordKind, fix: string | null): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_content_words").upsert({ word, kind, fix });
  if (error) throw new Error(error.message);
}

export async function deleteWord(word: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_content_words").delete().eq("word", word);
  if (error) throw new Error(error.message);
}

/* ---------------------------- hook formulas ---------------------------- */

const HOOK_COLUMNS = "id, category, template, example_hook, source_content_id, use_count, seed, created_at";

function toTemplate(r: Record<string, unknown>, shown: Set<string>): HookTemplate {
  return {
    id: String(r.id),
    category: (isHookCategory(r.category) ? r.category : "CLAIM") as HookCategory,
    template: String(r.template),
    exampleHook: r.example_hook && shown.has(String(r.source_content_id)) ? String(r.example_hook) : null,
    useCount: Number(r.use_count ?? 0),
    seed: Boolean(r.seed),
    createdAt: String(r.created_at),
  };
}

/** source pieces asked about per request: a hundred ids keep the query string well inside PostgREST's */
const SOURCES_PER_ASK = 100;

/**
 * The pieces, among the formulas' sources, whose hook the asker may read — the ones they may
 * see themselves (maySeePiece: their own, or their Page's).
 *
 * The library is one for everybody: a formula is [slots] and no one's words, and every agent
 * may write with any of them. The example under it is somebody's actual opening line, and it
 * was shown to everyone — every tenant read every agent's hooks, a รีวิวเคลม's too (review,
 * 2026-10-01). So the formula stays shared and its example is shown only to whoever could
 * open the piece it came from. A formula whose piece is gone (source_content_id set null when
 * it was deleted) has nobody left to show its example to. A lookup that fails shows no
 * examples rather than everyone's.
 */
async function examplesShown(rows: Record<string, unknown>[]): Promise<Set<string>> {
  const sources = [...new Set(rows.filter((r) => r.example_hook && r.source_content_id).map((r) => String(r.source_content_id)))];
  if (sources.length === 0) return new Set();
  try {
    const scope = await currentScope();
    const chunks = Array.from({ length: Math.ceil(sources.length / SOURCES_PER_ASK) }, (_, i) => sources.slice(i * SOURCES_PER_ASK, (i + 1) * SOURCES_PER_ASK));
    const pieces = await Promise.all(chunks.map(async (ids) => {
      const { data, error } = await supabaseAdmin().from("ins_content").select("id, agent_id, page_id").in("id", ids);
      if (error) throw new Error(error.message);
      return (data ?? []) as { id: string; agent_id: string | null; page_id: string | null }[];
    }));
    return new Set(pieces.flat().filter((p) => maySeePiece(scope, { agentId: p.agent_id, pageId: p.page_id })).map((p) => p.id));
  } catch (e) {
    console.error("hook examples not shown:", e);
    return new Set();
  }
}

export async function listHookTemplates(): Promise<HookTemplate[]> {
  const { data, error } = await supabaseAdmin().from("ins_hook_templates").select(HOOK_COLUMNS)
    .order("use_count", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const shown = await examplesShown(rows);
  return rows.map((r) => toTemplate(r, shown));
}

/**
 * How many pieces written to each formula went up, or are held to go up, on a Page. The
 * library's use_count goes up for every piece written, trashed ones too — this is what the
 * formula earned, not what it was tried on.
 */
export async function hookPostCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin().from("ins_content").select("hook_template_id")
    .not("hook_template_id", "is", null).in("publish_state", ["scheduled", "published"]).limit(5000);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const r of (data ?? []) as { hook_template_id: string }[]) counts[r.hook_template_id] = (counts[r.hook_template_id] ?? 0) + 1;
  return counts;
}

/**
 * The formulas offered to the planner when the owner chose none: a few that already went up on
 * a Page and a draw of the rest, a category at a time (pickHookMenu). A library that cannot be
 * read gives no menu, and the planner writes its own hooks as it did before.
 */
export async function hookMenu(): Promise<HookTemplate[]> {
  try {
    const [{ data, error }, posted] = await Promise.all([
      supabaseAdmin().from("ins_hook_templates").select(HOOK_COLUMNS),
      hookPostCounts(),
    ]);
    if (error) throw new Error(error.message);
    // no example lines: the menu shows formulas only, and those are nobody's words
    return pickHookMenu((data ?? []).map((r) => toTemplate(r as Record<string, unknown>, new Set())), posted);
  } catch (e) {
    console.error("hook menu not read:", e);
    return [];
  }
}

export async function getHookTemplate(id: string): Promise<HookTemplate | null> {
  const { data, error } = await supabaseAdmin().from("ins_hook_templates").select(HOOK_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return toTemplate(row, await examplesShown([row]));
}

/** read-then-write, which can lose a count to a race; one owner clicking one button cannot race */
export async function countHookUse(t: { id: string; useCount: number }, by: number): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_hook_templates").update({ use_count: t.useCount + by }).eq("id", t.id);
  if (error) throw new Error(error.message);
}

/**
 * A new formula, unless the library already has it (same words, any case or spacing). The
 * hook it was drawn from is kept as its example, with the piece it came from: the example is
 * shown only to whoever may see that piece (examplesShown).
 */
export async function addHookTemplate(t: { template: string; category: HookCategory; exampleHook: string; sourceId: string }): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_hook_templates").insert({
    template: t.template, category: t.category, example_hook: t.exampleHook, source_content_id: t.sourceId,
  });
  // 23505 is the unique index on the formula's text: the library has it already, which is fine
  if (error && error.code !== "23505") throw new Error(error.message);
}

/**
 * A piece gone for good, with the pictures drawn for it. Formulas drawn from it keep their
 * text, but not its hook: with the piece gone nobody may be shown that example any more
 * (examplesShown), so it is not kept either. Best effort — an example left behind is still
 * shown to nobody.
 */
export async function deleteContent(id: string): Promise<void> {
  const db = supabaseAdmin();
  const { error: example } = await db.from("ins_hook_templates").update({ example_hook: null }).eq("source_content_id", id);
  if (example) console.error("hook example not cleared:", example.message);
  const { data: files } = await db.storage.from("content-media").list(id);
  if (files?.length) {
    const { error } = await db.storage.from("content-media").remove(files.map((f) => `${id}/${f.name}`));
    if (error) throw new Error(`ลบรูปไม่สำเร็จ: ${error.message}`);
  }
  await removeClipsOf(id);
  const { error } = await db.from("ins_content").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ------------------------------ pictures ------------------------------ */

const MEDIA = "content-media";
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Keeps a drawn picture under its piece; the path is what a poster's background names. */
export async function saveBackground(pieceId: string, bytes: Buffer, mimeType: string): Promise<string> {
  const path = `${pieceId}/${crypto.randomUUID()}.${EXT[mimeType] ?? "png"}`;
  const { error } = await supabaseAdmin().storage.from(MEDIA).upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`เก็บรูปไม่สำเร็จ: ${error.message}`);
  return path;
}

/**
 * A picture nobody shows any more, removed — only one filed under the piece it came from.
 * Best effort: a leftover file costs a little storage; a save that failed over it costs the
 * owner their edit.
 */
export async function removeBackground(pieceId: string, path: string | undefined | null): Promise<void> {
  if (!path || !path.startsWith(`${pieceId}/`) || path.includes("..")) return;
  try {
    const { error } = await supabaseAdmin().storage.from(MEDIA).remove([path]);
    if (error) console.error("old picture not removed:", error.message);
  } catch (e) {
    console.error("old picture not removed:", e);
  }
}

/** A background as a data URI for the drawing library, or null when it has gone. */
export async function backgroundDataUri(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin().storage.from(MEDIA).download(path);
  if (error || !data) return null;
  return `data:${data.type || "image/png"};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
}

/* ------------------------------ publishing ------------------------------ */

/**
 * Takes a piece for one request to post, or says someone has it. A single conditional update,
 * so two taps a moment apart cannot both reach Facebook and post it twice: the second finds
 * the row already claimed, scheduled or posted.
 *
 * The claim's time goes in publish_at (nothing reads publish_at of a posting row otherwise),
 * so a claim whose request died — between claiming and recording what Facebook said — can be
 * told from one still running, and taken again after POSTING_STALE_MS instead of never.
 */
export async function claimPublish(id: string, now = new Date()): Promise<boolean> {
  const { data, error } = await supabaseAdmin().from("ins_content")
    .update({ publish_state: "posting", publish_error: null, publish_at: now.toISOString() })
    .eq("id", id)
    .or(`publish_state.is.null,publish_state.eq.failed,publish_state.eq.cancelled,${staleClaim(now)}`)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length === 1;
}

/**
 * A claim (claimPublish) given back before anything reached Facebook: the row as it was before
 * it, only while it still holds this claim (posting, at the claim's own time). A row that was
 * never sent goes back to never sent, so nothing shows a failure that did not happen.
 */
export async function releasePublish(id: string, claimAt: string, before: Publish | null): Promise<boolean> {
  const { data, error } = await supabaseAdmin().from("ins_content").update({
    publish_state: before?.state ?? null, publish_at: before?.at ?? null, publish_error: before?.error ?? null,
  }).eq("id", id).eq("publish_state", "posting").eq("publish_at", claimAt).select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length === 1;
}

/** What Facebook answered, kept: the post and its time, or why it refused. */
export async function recordPublish(id: string, p: {
  state: Exclude<PublishState, "posting">; pageId?: string | null; postId?: string | null; at?: string | null; error?: string | null;
}): Promise<ContentItem> {
  const { data, error } = await supabaseAdmin().from("ins_content").update({
    publish_state: p.state,
    ...(p.pageId !== undefined ? { fb_page_id: p.pageId } : {}),
    ...(p.postId !== undefined ? { fb_post_id: p.postId } : {}),
    ...(p.at !== undefined ? { publish_at: p.at } : {}),
    publish_error: p.error ?? null,
  }).eq("id", id).select(COLUMNS).single();
  if (error) throw new Error(error.message);
  return toItem(data as Record<string, unknown>);
}

/**
 * recordPublish, only if the row is still as the caller left it: in `from.state`, and with
 * `from.postId` / `from.at` when given (a claim's time is its identity). Null when it is not —
 * another request moved, cancelled or re-claimed it meanwhile, and this one must not write
 * over what that one did. `posting` is allowed here, for a claim that changes hands.
 */
export async function recordPublishIf(
  id: string,
  from: { state: PublishState; postId?: string | null; at?: string },
  p: { state: PublishState; pageId?: string | null; postId?: string | null; at?: string | null; error?: string | null },
): Promise<ContentItem | null> {
  let q = supabaseAdmin().from("ins_content").update({
    publish_state: p.state,
    ...(p.pageId !== undefined ? { fb_page_id: p.pageId } : {}),
    ...(p.postId !== undefined ? { fb_post_id: p.postId } : {}),
    ...(p.at !== undefined ? { publish_at: p.at } : {}),
    publish_error: p.error ?? null,
  }).eq("id", id).eq("publish_state", from.state);
  if (from.postId !== undefined) q = from.postId === null ? q.is("fb_post_id", null) : q.eq("fb_post_id", from.postId);
  if (from.at !== undefined) q = q.eq("publish_at", from.at);
  const { data, error } = await q.select(COLUMNS);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.length === 1 ? toItem(rows[0]) : null;
}

/** A piece on no Page yet takes the one it is posted to (owner, 2026-09-30): from then on it is that Page's. */
export async function adoptPage(id: string, pageId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_content").update({ page_id: pageId }).eq("id", id).is("page_id", null);
  if (error) throw new Error(error.message);
}

/** the planning calendar keeps to pieces still in use: a piece thrown away leaves the plan with it */
const PLANNABLE = ["draft", "used"];

/** The asker's pieces planned between two days, inclusive (owner, 2026-09-30). */
export async function listPlanned(from: string, to: string): Promise<ContentItem[]> {
  const only = await ownersFilter();
  let q = supabaseAdmin().from("ins_content").select(COLUMNS)
    .gte("plan_day", from).lte("plan_day", to).in("status", PLANNABLE).neq("format", "ad");
  if (only) q = q.or(only);
  // a piece on a Facebook Page is the Page calendar's, not a plan's (final review, 2026-09-30)
  const { data, error } = await q.or(offPage()).order("plan_day", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toItem);
}

/** The asker's pieces with no day yet, newest first — the planning calendar's rail. */
export async function listUnplanned(limit = 60): Promise<ContentItem[]> {
  const only = await ownersFilter();
  let q = supabaseAdmin().from("ins_content").select(COLUMNS).is("plan_day", null).in("status", PLANNABLE).neq("format", "ad");
  if (only) q = q.or(only);
  const { data, error } = await q.or(offPage()).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toItem);
}

/** A piece put on a day, moved, or taken off (null); either way it is not posted yet. The caller checks the piece is theirs. */
export async function setPlan(id: string, day: string | null): Promise<ContentItem> {
  const { data, error } = await supabaseAdmin().from("ins_content")
    .update({ plan_day: day, planned_done_at: null }).eq("id", id).select(COLUMNS).single();
  if (error) throw new Error(error.message);
  return toItem(data as Record<string, unknown>);
}

/** The agent says a planned piece went up (or takes that back). The caller checks the piece is theirs and planned. */
export async function setPlanDone(id: string, done: boolean): Promise<ContentItem> {
  const { data, error } = await supabaseAdmin().from("ins_content")
    .update({ planned_done_at: done ? new Date().toISOString() : null }).eq("id", id).select(COLUMNS).single();
  if (error) throw new Error(error.message);
  return toItem(data as Record<string, unknown>);
}

/** Pieces posted or held between two moments, oldest first — the calendar's week. */
/** Held, up, or on its way this minute — a send in flight was in neither this nor the rail. */
export async function listPublished(from: Date, to: Date): Promise<ContentItem[]> {
  const { data, error } = await supabaseAdmin().from("ins_content").select(COLUMNS)
    .in("publish_state", ["scheduled", "published", "posting"])
    .gte("publish_at", from.toISOString()).lt("publish_at", to.toISOString())
    .order("publish_at", { ascending: true }).limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toItem);
}

/**
 * The pieces whose picture has this person from the library in it, and how many of those are on
 * a Page or held for one. Deleting the person removes their reference photos only: what was
 * drawn with their face stays in those pieces, so the owner is told before they delete.
 */
export async function piecesWithPerson(personId: string): Promise<{ total: number; onPage: number }> {
  // the asker's pieces only (review, 2026-10-01): it counted every tenant's, for any id asked
  // about; the route checks the person is the asker's too (getPerson)
  const only = await ownersFilter();
  let q = supabaseAdmin().from("ins_content")
    .select("publish_state").eq("output->person->>id", personId).limit(1000);
  if (only) q = q.or(only);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { publish_state: string | null }[];
  return {
    total: rows.length,
    onPage: rows.filter((r) => r.publish_state === "scheduled" || r.publish_state === "published" || r.publish_state === "posting").length,
  };
}

/**
 * Every piece ever sent to a Page, cut down to where it stands — the ออโต้โพสต์ screen counts
 * them per Page. Newest first, so a cap drops the oldest history rather than today's.
 */
export async function listPublishRows(limit = 1000): Promise<Pick<Publish, "pageId" | "state" | "at" | "error">[]> {
  const { data, error } = await supabaseAdmin().from("ins_content")
    .select("fb_page_id, publish_state, publish_at, publish_error")
    .not("publish_state", "is", null)
    .order("publish_at", { ascending: false, nullsFirst: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    pageId: (r.fb_page_id as string | null) ?? null,
    state: r.publish_state as PublishState,
    at: (r.publish_at as string | null) ?? null,
    error: (r.publish_error as string | null) ?? null,
  }));
}

/** Held posts whose time came between two moments, oldest first — the ones to ask Facebook about. */
export async function listDue(from: Date, to: Date, limit = 50): Promise<ContentItem[]> {
  const { data, error } = await supabaseAdmin().from("ins_content").select(COLUMNS)
    .eq("publish_state", "scheduled")
    .gte("publish_at", from.toISOString()).lt("publish_at", to.toISOString())
    .order("publish_at", { ascending: true }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toItem);
}

/**
 * Posts and Reels that could go on the calendar: never sent, taken back, refused, or stuck
 * sending — newest first. รอตรวจ and ใช้จริง both, since posting is itself the decision to use a
 * piece. A Reel is any piece with a clip whose file is still kept (a clip piece, or a script
 * with its clip attached); one the sweep let go cannot be sent, so it does not wait here.
 */
export async function listWaiting(pageId?: string, limit = 50): Promise<ContentItem[]> {
  // the staff's pieces: the rail is what the staff may put on their Page — its own project's (2026-09-30)
  const only = await ownersFilter();
  let q = supabaseAdmin().from("ins_content").select(COLUMNS)
    .or("format.eq.post,and(output->video->>path.not.is.null,output->video->>expired.is.null)")
    .in("status", ["draft", "used"])
    .or(`publish_state.is.null,publish_state.eq.cancelled,publish_state.eq.failed,${staleClaim()}`);
  if (pageId) q = q.eq("page_id", pageId);
  if (only) q = q.or(only);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toItem);
}
