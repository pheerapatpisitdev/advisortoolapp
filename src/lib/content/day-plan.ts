import { defaultPoster, posterUrl } from "./poster";
import type { ContentItem } from "./store";

/**
 * The planning calendar of an agent with no Page (owner, 2026-09-30): a piece is put on a day,
 * the agent posts it themselves and says so. Days are Bangkok days ("YYYY-MM-DD", todayKey()).
 */

export type PlanState = "planned" | "today" | "overdue" | "done";

export const PLAN_LABEL: Record<PlanState, string> = { planned: "วางไว้", today: "วันนี้", overdue: "ค้าง", done: "โพสต์แล้ว" };

export function planState(day: string, doneAt: string | null, today: string): PlanState {
  if (doneAt) return "done";
  if (day < today) return "overdue";
  return day === today ? "today" : "planned";
}

/** a real day, today or later: a day gone is not planned for */
export function mayPlanOn(day: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day && day >= today;
}

/** what a card on the calendar says: the piece's first opening line */
export function planTitle(item: Pick<ContentItem, "output">): string {
  const first = item.output.hooks[0]?.trim();
  if (!first) return "ชิ้นงาน";
  return first.length > 60 ? `${first.slice(0, 59)}…` : first;
}

/**
 * A planned piece's picture, as the post calendar and the workbench draw it: its poster, or one
 * from its hook for a piece written before posters. A script has none. `productName` is the
 * caller's to find — the product list is kept off this file, which reaches the browser.
 */
export function planPicture(item: Pick<ContentItem, "format" | "output">, productName: string): string | null {
  if (item.format === "script") return null;
  return posterUrl(item.output.poster ?? defaultPoster(item.output.hooks[0] ?? "", productName), "square");
}
