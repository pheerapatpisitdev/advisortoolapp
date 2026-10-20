import { alertOwner } from "@/lib/line/owner-alert";
import { siteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { REPORT_PAGE, type IndexWeek } from "./parse";
import { readWeeklyReport } from "./read";

/**
 * The weekly Citi Grandmaster RC 5 levels kept in ins_index_levels (migration 20261129), read
 * every morning by /api/index-levels/sync and shown under the Global Savings calculator.
 */

export const INDEX_CODE = "CITI_GRANDMASTER_RC5";

/** how many weeks the page draws at most — a year */
export const WEEKS_SHOWN = 52;

/** mornings in a row the read must fail before the owner hears of it, so one slow night on their site stays quiet */
const FAILS_BEFORE_ALERT = 2;

interface FeedRow {
  report_url: string | null;
  failing_since: string | null;
  fails: number;
  alerted: boolean;
}

/** The alert's words when the read has stopped working. */
export function feedBrokenText(error: string, since: string): string {
  const day = new Date(since).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });
  return [
    "⚠️ อ่านราคาดัชนี Global Savings ไม่ได้",
    `ตั้งแต่ ${day} · หน้าเว็บยังโชว์ตัวเลขล่าสุดที่มี`,
    `เหตุ: ${error}`,
    REPORT_PAGE,
    siteUrl("/global-saving"),
  ].join("\n");
}

/** The alert's words when it works again. */
export function feedBackText(latest: IndexWeek): string {
  return `✅ อ่านราคาดัชนี Global Savings ได้แล้ว\nล่าสุด ${latest.level.toFixed(2)} จุด (${latest.date})`;
}

/**
 * Reads the report and keeps every week in it. A failure is kept on the feed row; the second
 * morning in a row sends the owner one LINE message, and the first good read after that sends one
 * more. Never throws.
 */
export async function syncIndexLevels(now = new Date()): Promise<{ ok: boolean; weeks: number; latest: string | null; error?: string }> {
  const db = supabaseAdmin();
  const { data } = await db.from("ins_index_feed").select("report_url, failing_since, fails, alerted").eq("index_code", INDEX_CODE).maybeSingle();
  const feed = (data ?? null) as FeedRow | null;
  try {
    const { url, weeks } = await readWeeklyReport(feed?.report_url);
    const rows = weeks.map((w) => ({ index_code: INDEX_CODE, price_date: w.date, level: w.level, fx: w.fx, read_at: now.toISOString() }));
    const saved = await db.from("ins_index_levels").upsert(rows, { onConflict: "index_code,price_date" });
    if (saved.error) throw new Error(`บันทึกไม่ได้: ${saved.error.message}`);
    await db.from("ins_index_feed").upsert({
      index_code: INDEX_CODE, report_url: url, last_ok_at: now.toISOString(), last_error: null, failing_since: null, fails: 0, alerted: false,
    });
    const latest = weeks[weeks.length - 1];
    if (feed?.alerted) await alertOwner(feedBackText(latest));
    return { ok: true, weeks: weeks.length, latest: latest.date };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const since = feed?.failing_since ?? now.toISOString();
    const fails = (feed?.fails ?? 0) + 1;
    let alerted = feed?.alerted ?? false;
    if (!alerted && fails >= FAILS_BEFORE_ALERT) alerted = await alertOwner(feedBrokenText(error, since));
    await db.from("ins_index_feed").upsert({ index_code: INDEX_CODE, last_error: error, failing_since: since, fails, alerted });
    console.error("[index-levels] daily read failed:", error);
    return { ok: false, weeks: 0, latest: null, error };
  }
}

/**
 * The weeks the page draws, oldest first, at most a year. Read from the table; while it is empty
 * or cannot be reached, straight from the report (cached six hours), and an empty list when that
 * fails too — the page then leaves the card out.
 */
export async function loadIndexWeeks(): Promise<IndexWeek[]> {
  try {
    const { data, error } = await supabaseAdmin().from("ins_index_levels").select("price_date, level, fx")
      .eq("index_code", INDEX_CODE).order("price_date", { ascending: false }).limit(WEEKS_SHOWN);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { price_date: string; level: number | string; fx: number | string }[];
    if (rows.length) return rows.map((r) => ({ date: r.price_date, level: Number(r.level), fx: Number(r.fx) })).reverse();
  } catch (e) {
    console.warn("[index-levels] table not read, reading the report instead:", e);
  }
  try {
    const { weeks } = await readWeeklyReport(null, { next: { revalidate: 21_600 } } as RequestInit);
    return weeks.slice(-WEEKS_SHOWN);
  } catch (e) {
    console.error("[index-levels] report not read either:", e);
    return [];
  }
}
