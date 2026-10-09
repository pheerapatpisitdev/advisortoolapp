import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentWho } from "./who";

/**
 * What the models have cost since a moment, summed in the database.
 *
 * It used to be summed here, from rows, and the client library returns at most a thousand rows
 * of any select without saying so. On 2026-09-22 the spend card read exactly 1,000 calls at
 * ฿29.68 against a table holding 1,180 at ฿34.54 — and the budget guard, reading the same way,
 * was comparing the owner's ceiling to a figure that had stopped rising. Past a thousand
 * calls a month, which this system reached in three weeks, the budget protected nothing.
 *
 * So the sum is asked for as a sum. One line per model and task is enough for every reader:
 * the guard wants the total, the card wants who was paid and for what.
 */

/** one model, one task, everything it cost since the moment asked about */
export interface SpendLine {
  model: string | null;
  task: string | null;
  calls: number;
  baht: number;
}

export interface MonthSpend {
  calls: number;
  baht: number;
  lines: SpendLine[];
}

/** Thailand keeps UTC+7 all year; the same constant as src/lib/content/calendar.ts */
const BKK_MS = 7 * 60 * 60_000;

/**
 * The first instant of the current calendar month in Thailand.
 *
 * It was the server's clock, and the server runs in UTC: from 00:00 to 07:00 on the 1st the
 * owner's new month was still the old one here, and the ceilings they set by the Thai month
 * reset seven hours late.
 */
export function monthStart(now = new Date()): Date {
  const bkk = new Date(now.getTime() + BKK_MS);
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), 1) - BKK_MS);
}

/**
 * Where "this month's spend" starts counting: the first of the month, or the moment the owner
 * pressed รีเซ็ตยอด on /admin/ai, whichever is later. Nothing is deleted — the ledger keeps every
 * call — so a reset only moves the line the card and the budget guards count from, and a new
 * month moves it past any reset. A settings row that cannot be read means the plain month start:
 * the guard counts more, never less.
 */
export async function spendSince(now = new Date()): Promise<Date> {
  const start = monthStart(now);
  try {
    const { data } = await supabaseAdmin().from("ins_ai_settings").select("spend_reset_at").maybeSingle();
    const at = (data as { spend_reset_at: string | null } | null)?.spend_reset_at;
    const reset = at ? new Date(at) : null;
    return reset && !Number.isNaN(reset.getTime()) && reset > start ? reset : start;
  } catch (e) {
    console.error("spend_reset_at not read; counting from the month start:", e);
    return start;
  }
}

/**
 * One line of what was spent, in the ledger every reader sums: the AI client writes one per call
 * as it returns, and a clip's render service one per job it delivered (src/lib/video/jobs.ts).
 * Only counts and money, never anyone's words. A line that could not be written is logged, not
 * thrown: the work it is for is done, and its answer still goes out.
 */
export async function recordUsage(model: string, task: string, inTok: number, outTok: number, costThb: number): Promise<void> {
  // whose question or round this call was for (src/lib/ai/who.ts); a customer bot's is no one's
  const who = currentWho();
  const line = { model, task, input_tokens: inTok, output_tokens: outTok, cost_thb: Number(costThb.toFixed(6)) };
  const ledger = () => supabaseAdmin().from("ins_usage_ledger");
  const named: Record<string, unknown> = who ? { ...line, agent_id: who.agentId, ask_id: who.askId } : line;
  let r = await ledger().insert(named);
  // the columns come by a migration and this code by a deploy: until both are in, the cost is
  // still written, only without the name — the owner's budget reads it either way
  if (who && r?.error?.code === COLUMN_MISSING) r = await ledger().insert(line);
  if (r?.error) console.error(`usage of ${task} not recorded:`, r.error.message);
}

/** PostgREST's code for a column it does not know */
const COLUMN_MISSING = "PGRST204";

/* ------------------------------ reservations ------------------------------ */

/**
 * Money set aside in the ledger before a call spends it.
 *
 * The content ceiling was read, then spent against: ten rounds started in the same second
 * all read the same "฿2 left" and all went ahead. A reservation is a ledger row written
 * first, at the estimated price, under a task the ceiling counts — so the second request
 * reads the first one's money as gone. The real rows are written by the AI client as each
 * call returns; the reservation is deleted once the work is over, whether it went well or not.
 *
 * A reservation whose request died never gets deleted by it, so every new one sweeps those
 * older than RESERVATION_TTL_MS first: a stale hold may block the ceiling for minutes, never
 * for the month.
 */
export const RESERVATION_MODEL = "reservation";
export const RESERVATION_TTL_MS = 15 * 60_000;

/**
 * Whether a request may go ahead, read after its own reservation is in the ledger: `total`
 * counts every reservation, this one included, and all of it must fit under the ceiling.
 * Requests running at once see each other's holds, so together they cannot pass it by more
 * than the estimates were wrong.
 */
export function admits(total: number, cap: number): boolean {
  return total <= cap + 1e-9;
}

/**
 * Deletes reservations older than RESERVATION_TTL_MS: the requests that wrote them are gone.
 * Run by reserve() and before the ceiling is read, so a dead request's hold does not count.
 * Never throws — a hold left one more read is fifteen minutes of a slightly lower ceiling.
 */
export async function sweepHolds(now = new Date()): Promise<void> {
  try {
    const { error } = await supabaseAdmin().from("ins_usage_ledger").delete()
      .eq("model", RESERVATION_MODEL).lt("created_at", new Date(now.getTime() - RESERVATION_TTL_MS).toISOString());
    if (error) console.error("stale reservations not swept:", error.message);
  } catch (e) {
    console.error("stale reservations not swept:", e);
  }
}

/** Sets `thb` aside under `task`; returns the row's id, for release. */
export async function reserve(task: string, thb: number, now = new Date()): Promise<string> {
  const db = supabaseAdmin();
  await sweepHolds(now);
  const { data, error } = await db.from("ins_usage_ledger")
    .insert({ model: RESERVATION_MODEL, task, input_tokens: 0, output_tokens: 0, cost_thb: Number(Math.max(0, thb).toFixed(6)) })
    .select("id").single();
  if (error || !data) throw new Error(`กันงบไม่สำเร็จ: ${error?.message ?? "no row"}`);
  return String((data as { id: string }).id);
}

/** Gives a reservation back. Never throws: the sweep catches what this misses. */
export async function release(id: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin().from("ins_usage_ledger").delete().eq("id", id).eq("model", RESERVATION_MODEL);
    if (error) console.error("reservation not released:", error.message);
  } catch (e) {
    console.error("reservation not released:", e);
  }
}

/** PostgREST's code for a function it cannot find; the one error worth reading past */
const FUNCTION_MISSING = "PGRST202";

/** rows per page when paging; well under the library's own cap so a page is never clipped */
const PAGE = 500;

/**
 * `holds`: count money set aside by reservations (see below) as spent. Only the content
 * ceiling wants that; every other reader — the assistant's budget guard, the admin cards —
 * wants what was paid, so by default reservation rows are left out. They are one model name,
 * so they arrive from the sum as lines of their own and are dropped here.
 */
export async function monthSpend(since: Date, opts: { holds?: boolean } = {}): Promise<MonthSpend> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.rpc("ins_month_spend", { p_since: since.toISOString() });
  if (error && error.code === FUNCTION_MISSING) {
    console.error("ins_month_spend is not in the database yet; paging the ledger instead");
    return total(await paged(since), opts.holds);
  }
  if (error) throw new Error(`อ่านค่าใช้จ่าย AI ไม่ได้: ${error.message}`);
  const rows = (data ?? []) as { model: string | null; task: string | null; calls: number | string; cost_thb: number | string | null }[];
  return total(rows.map((r) => ({ model: r.model, task: r.task, calls: Number(r.calls), baht: Number(r.cost_thb ?? 0) })), opts.holds);
}

function total(all: SpendLine[], holds = false): MonthSpend {
  const lines = holds ? all : all.filter((l) => l.model !== RESERVATION_MODEL);
  return {
    calls: lines.reduce((n, l) => n + l.calls, 0),
    baht: lines.reduce((s, l) => s + l.baht, 0),
    lines,
  };
}

/**
 * The same figures without the function: every row, a page at a time, summed here.
 *
 * The function arrives by a migration and this code by a deploy, and nothing orders the two.
 * Slower, and exact, which is the only property that matters for a budget.
 */
async function paged(since: Date): Promise<SpendLine[]> {
  const supabase = supabaseAdmin();
  const acc = new Map<string, SpendLine>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("ins_usage_ledger")
      .select("model, task, cost_thb")
      .gte("created_at", since.toISOString())
      .order("created_at")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`อ่านค่าใช้จ่าย AI ไม่ได้: ${error.message}`);
    const rows = (data ?? []) as { model: string | null; task: string | null; cost_thb: number | null }[];
    for (const r of rows) {
      const key = `${r.model ?? ""}${r.task ?? ""}`;
      const line = acc.get(key) ?? { model: r.model, task: r.task, calls: 0, baht: 0 };
      line.calls += 1;
      line.baht += Number(r.cost_thb ?? 0);
      acc.set(key, line);
    }
    if (rows.length < PAGE) break;
  }
  return [...acc.values()];
}
