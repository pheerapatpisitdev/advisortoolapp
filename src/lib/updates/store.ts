import { cache } from "react";
import { can, type Viewer } from "@/lib/auth/access";
import { DEMO_ID } from "@/lib/auth/demo";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { bangkokDay, shownFrom, unreadOf, visibleTo, type UpdateInput, type UpdateRow, type UpdateStatus } from "./rules";

/**
 * มีอะไรใหม่'s rows (./rules.ts, supabase/migrations/20261213_whats_new.sql). Server only.
 *
 * ins_updates holds every change told or to be told; ins_update_reads which viewer has read which. The
 * viewer is viewer.agentId for every kind of viewer (a สมาชิกทั่วไป's id is a row of ins_members).
 */

const UPDATES = "ins_updates";
const READS = "ins_update_reads";
const COLUMNS = "id, day, kind, grp, place, title, body, link, audience, status, source, created_at, published_at";

/** the live rows this viewer is shown, from the last 60 days, newest first */
export const liveFor = cache(async (owner: boolean): Promise<UpdateRow[]> => {
  const { data, error } = await supabaseAdmin().from(UPDATES).select(COLUMNS)
    .eq("status", "live").gte("day", shownFrom(new Date()))
    .order("day", { ascending: false }).order("published_at", { ascending: false });
  if (error) throw new Error(`อ่านรายการมีอะไรใหม่ไม่สำเร็จ: ${error.message}`);
  return ((data ?? []) as UpdateRow[]).filter((r) => visibleTo(r, owner));
});

/** which of these rows the viewer has read */
async function readOf(agentId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabaseAdmin().from(READS).select("update_id").eq("agent_id", agentId).in("update_id", ids);
  if (error) throw new Error(`อ่านว่าเปิดอ่านอะไรแล้วไม่สำเร็จ: ${error.message}`);
  return ((data ?? []) as { update_id: string }[]).map((r) => r.update_id);
}

/**
 * What this viewer is shown, with what they have not read yet: the menu's red number, the bar on /home and
 * the dots on /whats-new all come from here, read once a request.
 */
export const updatesFor = cache(async (viewer: Viewer): Promise<{ rows: UpdateRow[]; unread: UpdateRow[] }> => {
  const rows = await liveFor(can(viewer, "owner"));
  const read = await readOf(viewer.agentId, rows.map((r) => r.id));
  return { rows, unread: unreadOf(rows, read) };
});

/** the menu's red number; 0 when it cannot be read, since a decoration must not break a page */
export async function unreadCount(viewer: Viewer | null): Promise<number> {
  if (!viewer || viewer.kind === "super") return 0;
  return updatesFor(viewer).then((u) => u.unread.length).catch((e) => {
    console.error("whats-new: unread not read:", e instanceof Error ? e.message : e);
    return 0;
  });
}

/** these rows read by this viewer (opening /whats-new, or the bar's ×); a row already read stays as it was */
export async function markRead(agentId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabaseAdmin().from(READS)
    .upsert(ids.map((update_id) => ({ agent_id: agentId, update_id })), { onConflict: "agent_id,update_id", ignoreDuplicates: true });
  if (error) throw new Error(`บันทึกว่าอ่านแล้วไม่สำเร็จ: ${error.message}`);
}

// ---- the back office (/admin/updates) ----

/** every row, drafts first, then the newest */
export async function allUpdates(): Promise<UpdateRow[]> {
  const { data, error } = await supabaseAdmin().from(UPDATES).select(COLUMNS)
    .order("day", { ascending: false }).order("created_at", { ascending: false }).limit(300);
  if (error) throw new Error(`อ่านรายการมีอะไรใหม่ไม่สำเร็จ: ${error.message}`);
  const rows = (data ?? []) as UpdateRow[];
  return [...rows.filter((r) => r.status === "draft"), ...rows.filter((r) => r.status !== "draft")];
}

/** how many people have read each row; the shared demo account is not counted (customers, not agents) */
export async function readCounts(ids: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (ids.length === 0) return counts;
  const db = supabaseAdmin();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(READS).select("update_id").in("update_id", ids).neq("agent_id", DEMO_ID)
      .order("update_id", { ascending: true }).order("agent_id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(`อ่านจำนวนคนอ่านไม่สำเร็จ: ${error.message}`);
    const rows = (data ?? []) as { update_id: string }[];
    for (const r of rows) counts[r.update_id] = (counts[r.update_id] ?? 0) + 1;
    if (rows.length < PAGE) return counts;
  }
}

/**
 * Published now. The row keeps its day: the day the change reached the app (the push a draft was written
 * from), not the day it was published, so drafts written for the last 60 days (owner, 2026-11-14) sit under
 * their own dates.
 */
const goingLive = (now: Date) => ({ status: "live" as const, published_at: now.toISOString() });

/** a new row, as a draft or straight out */
export async function createUpdate(input: UpdateInput, status: UpdateStatus): Promise<string> {
  const now = new Date();
  const row: UpdateInput & { status: UpdateStatus; day: string; published_at: string | null } =
    { ...input, day: bangkokDay(now), ...(status === "live" ? goingLive(now) : { status, published_at: null }) };
  const { data, error } = await supabaseAdmin().from(UPDATES).insert(row).select("id").single();
  if (error) throw new Error(`บันทึกไม่สำเร็จ: ${error.message}`);
  return (data as { id: string }).id;
}

/**
 * A row's words and its status. Going live for the first time stamps published_at; the day never moves. A
 * row already live whose words are mended is not told twice (the reads stay).
 */
export async function saveUpdate(id: string, input: UpdateInput, status: UpdateStatus): Promise<void> {
  const db = supabaseAdmin();
  const { data: was, error: readError } = await db.from(UPDATES).select("status, published_at").eq("id", id).maybeSingle();
  if (readError) throw new Error(`อ่านรายการเดิมไม่สำเร็จ: ${readError.message}`);
  if (!was) throw new Error("ไม่พบรายการนี้ อาจถูกลบไปแล้ว");
  const first = status === "live" && !(was as { published_at: string | null }).published_at;
  const patch = { ...input, status, ...(first ? goingLive(new Date()) : {}) };
  const { error } = await db.from(UPDATES).update(patch).eq("id", id);
  if (error) throw new Error(`บันทึกไม่สำเร็จ: ${error.message}`);
}
