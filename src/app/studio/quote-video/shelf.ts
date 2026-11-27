import type { Board } from "@/lib/quote-video/board";
import type { VideoStatus } from "@/lib/quote-video/make";

/**
 * The clip shelf's rules (owner, 2026-11-27, chose 1ก ข, mockup
 * https://claude.ai/artifact/FAb63v7iQ89tcGQpMiztcW): three tabs (ทั้งหมด taken out), the one it
 * opens on, the day buttons, and how many clips each board asks for.
 */

export type Tab = "making" | "done" | "failed";
export const TABS: { id: Tab; label: string }[] = [
  { id: "making", label: "กำลังสร้าง" },
  { id: "done", label: "เสร็จ" },
  { id: "failed", label: "ไม่สำเร็จ" },
];
export const tabOf = (status: VideoStatus): Tab => (status === "done" ? "done" : status === "failed" ? "failed" : "making");

/** 1ก: a clip being made opens กำลังสร้าง; with none, เสร็จ */
export const firstTab = (list: { status: VideoStatus }[] | null): Tab =>
  list?.some((v) => tabOf(v.status) === "making") ? "making" : "done";

export type Days = "today" | "7" | "30" | "all";
export const DAYS: { id: Days; label: string }[] = [
  { id: "today", label: "วันนี้" },
  { id: "7", label: "7 วัน" },
  { id: "30", label: "30 วัน" },
  { id: "all", label: "ทุกวัน" },
];
const BANGKOK_MS = 7 * 3600_000;
const DAY_MS = 24 * 3600_000;
/** the earliest moment a day button keeps: วันนี้ from Bangkok's midnight, 7 and 30 วัน counted back from now */
export function daysFrom(days: Days, now: number): number {
  if (days === "all") return -Infinity;
  if (days === "today") return Math.floor((now + BANGKOK_MS) / DAY_MS) * DAY_MS - BANGKOK_MS;
  return now - Number(days) * DAY_MS;
}

/**
 * What the tabs and day buttons count: every clip the board holds (its days), each as the list
 * now has it where the list has it, the ones the list has and the days do not yet (just made)
 * added, and the ones deleted here left out.
 */
export function shelfRows<T extends { id: string; status: VideoStatus; createdAt: string }>(
  days: { id: string; status: VideoStatus; createdAt: string }[] | null, items: T[] | null, gone: ReadonlySet<string>,
): { id: string; status: VideoStatus; createdAt: string }[] {
  const listed = new Map((items ?? []).map((v) => [v.id, v]));
  const out: { id: string; status: VideoStatus; createdAt: string }[] = [];
  const seen = new Set<string>();
  for (const v of items ?? []) { if (!gone.has(v.id)) { out.push(v); seen.add(v.id); } }
  for (const d of days ?? []) {
    if (seen.has(d.id) || gone.has(d.id)) continue;
    out.push(listed.get(d.id) ?? d);
  }
  return out;
}

/** a clip's words that the search box looks in: its title (plan, sex and age, the customer's name) */
export const matches = (title: string, query: string): boolean => {
  const q = query.trim().toLowerCase();
  return !q || q.split(/\s+/).every((w) => title.toLowerCase().includes(w));
};

/** how many clips a board lists at first, and how many more แสดงเพิ่ม brings (the server keeps the same step) */
export const SHELF_STEP = 30;
const size: Partial<Record<Board, number>> = {};
/** how many clips this board is showing now: every reload of the list asks for as many again */
export const shelfSize = (board: Board): number => size[board] ?? SHELF_STEP;
export const growShelf = (board: Board): number => (size[board] = shelfSize(board) + SHELF_STEP);

/** การ์ด or รายการ, remembered in this browser */
export type View = "cards" | "rows";
const VIEW_KEY = "studio-clip-view";
export function readView(): View {
  try { return localStorage.getItem(VIEW_KEY) === "rows" ? "rows" : "cards"; } catch { return "cards"; }
}
export function keepView(v: View): void {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* not remembered: next visit opens on การ์ด */ }
}
