import { MAX_DIRECTION } from "@/lib/content/background";
import { AUTO, OVERHEAD_THB, PAINTERS, painterFor, WRITERS, writerOf, type Painter } from "@/lib/content/models";
import { POSES, type PiecePerson } from "@/lib/content/people";

/**
 * ภาพและโมเดล for an Ads Studio campaign (owner, 2026-10-05): which model writes its ads, which
 * draws their pictures, who is in them and the brief every picture is drawn to — kept on the
 * campaign, as its poster tone is, so every ad in it is made the same way.
 *
 * What is stored is null for อัตโนมัติ / nobody / no brief. Only ids from the lists are kept: a
 * model name from the browser is never passed on. ไม่วาดภาพ is not offered — an ad written to a
 * picture style is not sent without its picture (room-view picturePending).
 *
 * Browser-safe: nothing here imports the AI client or the database.
 */

/** the painters an ad may be drawn with: every one but ไม่วาดภาพ */
export const AD_PAINTERS: Painter[] = PAINTERS.filter((p) => p.modelId !== null);

/** A writer id as sent, or null for อัตโนมัติ and anything not on the list. */
export function writerPick(v: unknown): string | null {
  return typeof v === "string" && WRITERS.some((w) => w.id === v) ? v : null;
}

/** A painter id as sent, or null for อัตโนมัติ, ไม่วาดภาพ and anything not on the list. */
export function painterPick(v: unknown): string | null {
  return typeof v === "string" && AD_PAINTERS.some((p) => p.id === v) ? v : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Someone from the people library as sent, or null. A pose not on the list is ให้ AI เลือก. Whether
 * they are still in the library is the drawing's to find out: one deleted since is drawn without.
 */
export function personPick(v: unknown): PiecePerson | null {
  if (typeof v !== "object" || v === null) return null;
  const { id, pose } = v as { id?: unknown; pose?: unknown };
  if (typeof id !== "string" || !UUID.test(id)) return null;
  return { id, pose: typeof pose === "string" && POSES.some((p) => p.id === pose) ? pose : "auto" };
}

/** The picture brief as sent, trimmed and held to what the drawing reads; null when empty. */
export function briefPick(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, MAX_DIRECTION).trim();
  return t || null;
}

/** What one picture is drawn to: the campaign's brief, held to what the drawing reads; "" without one. */
export function pictureRequest(brief: string | null): string {
  return (brief ?? "").slice(0, MAX_DIRECTION);
}

/**
 * About what a round of `n` ads costs with the campaign's picks, the picture included. อัตโนมัติ is
 * priced as the month having room (the best writer, มาตรฐาน); a person is drawn by Gemini.
 * `drawn` false: a round with no picture (ตัวเลขชัดๆ ads carry the numbers poster), priced without one.
 */
export function adRoundCost(n: number, picks: { writer: string | null; painter: string | null; person: PiecePerson | null }, drawn = true): string {
  const writes = writerOf(picks.writer ?? AUTO);
  const paints = drawn ? painterFor(picks.painter ?? AUTO, Infinity, Boolean(picks.person)).thb : 0;
  const total = n * (writes.thb + OVERHEAD_THB + paints);
  return `ราว ฿${total.toFixed(1)}`;
}
