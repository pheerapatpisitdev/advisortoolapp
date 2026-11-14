import { DEMO_ID } from "@/lib/auth/demo";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { libraryItem } from "./catalog";

/**
 * คลังแอนิเมชัน's marks (spec 2026-11-14, "Saved pieces and votes"): each viewer's saved pieces (save,
 * any item) and their votes for pieces not built yet (want). One row per (viewer, item, kind) in
 * ins_library_marks; a card's vote count is the number of want rows for its item. The viewer is
 * viewer.agentId for every kind of viewer (a สมาชิกทั่วไป's id is a row of ins_members).
 */

export type MarkKind = "save" | "want";
export type Toggled = { ok: true; on: boolean } | { ok: false; error: string };

const TABLE = "ins_library_marks";
/** Postgres's code for a row the primary key already holds */
const DUPLICATE = "23505";
/** PostgREST answers at most this many rows a request, so the counts read in pages of it */
const PAGE = 1000;

export const NOT_IN_LIBRARY = "ไม่พบรายการนี้ในคลัง";
export const ALREADY_READY = "ชิ้นนี้ใช้ได้แล้ว ไม่ต้องกดอยากได้";
const NOT_SAVED = "บันทึกไม่สำเร็จ ลองกดอีกครั้งนะครับ";

export const isMarkKind = (v: unknown): v is MarkKind => v === "save" || v === "want";

/** what this viewer saved and what they voted for, oldest first */
export async function marksOf(agentId: string): Promise<{ saved: string[]; wanted: string[] }> {
  const { data, error } = await supabaseAdmin().from(TABLE).select("item, kind")
    .eq("agent_id", agentId).order("created_at", { ascending: true });
  if (error) throw new Error(`อ่านรายการที่บันทึกไว้ไม่สำเร็จ: ${error.message}`);
  const rows = (data ?? []) as { item: string; kind: string }[];
  return {
    saved: rows.filter((r) => r.kind === "save").map((r) => r.item),
    wanted: rows.filter((r) => r.kind === "want").map((r) => r.item),
  };
}

/**
 * votes per item, across every viewer: only items someone wants appear. The shared demo account's
 * votes are not counted (controller ruling R2, 2026-11-14): customers trying the system press it, not agents.
 */
export async function wantCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const db = supabaseAdmin();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(TABLE).select("item").eq("kind", "want").neq("agent_id", DEMO_ID)
      // a stable order (the primary key), or a row can fall between two pages
      .order("item", { ascending: true }).order("agent_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`อ่านจำนวนคนอยากได้ไม่สำเร็จ: ${error.message}`);
    const rows = (data ?? []) as { item: string }[];
    for (const r of rows) counts[r.item] = (counts[r.item] ?? 0) + 1;
    if (rows.length < PAGE) return counts;
  }
}

/**
 * Turns a mark on or off. Off first: when the row was there it is taken away (on: false); when it was
 * not, it is written (on: true). A duplicate key on that write means a second press got there first,
 * so the mark is on, never an error.
 */
export async function toggleMark(agentId: string, item: string, kind: MarkKind): Promise<Toggled> {
  const found = typeof item === "string" ? libraryItem(item) : undefined;
  if (!found || !isMarkKind(kind)) return { ok: false, error: NOT_IN_LIBRARY };
  if (kind === "want" && found.ready) return { ok: false, error: ALREADY_READY };

  const db = supabaseAdmin();
  const { data: gone, error: delErr } = await db.from(TABLE).delete()
    .eq("agent_id", agentId).eq("item", item).eq("kind", kind).select("item");
  if (delErr) {
    console.error("library mark not changed:", delErr.message);
    return { ok: false, error: NOT_SAVED };
  }
  if (gone?.length) return { ok: true, on: false };

  const { error } = await db.from(TABLE).insert({ agent_id: agentId, item, kind });
  if (error && error.code !== DUPLICATE) {
    console.error("library mark not saved:", error.message);
    return { ok: false, error: NOT_SAVED };
  }
  return { ok: true, on: true };
}
