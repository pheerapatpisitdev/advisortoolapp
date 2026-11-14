import type { LibraryItem } from "./catalog";
import type { MarkKind, Toggled } from "./marks";

/**
 * คลังแอนิเมชัน's ★ and อยากได้ as the board holds them (browser-safe; marks.ts is the server's side).
 * A vote only means something on a piece not built yet, so a want row for a ready piece — one the
 * catalogue has since made — is dropped everywhere: the card, ของฉัน's count, the owner's list.
 */
export interface Marks { saved: string[]; wanted: string[]; counts: Record<string, number> }

/** the line when a mark was not saved: the call itself failed (signed out, the network gone), or the
 * server could not write it (marks.ts uses this same line) */
export const MARK_FAILED = "บันทึกไม่สำเร็จ ลองกดอีกครั้งนะครับ";

export function cleanMarks(items: readonly LibraryItem[], m: Marks): Marks {
  const known = new Set(items.map((i) => i.id));
  const unbuilt = new Set(items.filter((i) => !i.ready).map((i) => i.id));
  const counts: Record<string, number> = {};
  for (const [id, n] of Object.entries(m.counts)) if (unbuilt.has(id) && n > 0) counts[id] = n;
  return { saved: m.saved.filter((id) => known.has(id)), wanted: m.wanted.filter((id) => unbuilt.has(id)), counts };
}

export const hasMark = (m: Marks, kind: MarkKind, id: string): boolean => (kind === "save" ? m.saved : m.wanted).includes(id);

/**
 * the viewer's mark on or off; their own vote moves the piece's count with it, unless their votes are not
 * counted (`counted: false`, the shared demo account, whose votes the server leaves out of every count)
 */
export function withMark(m: Marks, kind: MarkKind, id: string, on: boolean, counted = true): Marks {
  if (hasMark(m, kind, id) === on) return m;
  if (kind === "save") return { ...m, saved: on ? [...m.saved, id] : m.saved.filter((x) => x !== id) };
  if (!counted) return { ...m, wanted: on ? [...m.wanted, id] : m.wanted.filter((x) => x !== id) };
  const n = Math.max(0, (m.counts[id] ?? 0) + (on ? 1 : -1));
  const counts = { ...m.counts };
  if (n) counts[id] = n;
  else delete counts[id];
  return { ...m, wanted: on ? [...m.wanted, id] : m.wanted.filter((x) => x !== id), counts };
}

/**
 * One press: the mark changes at once, then follows the server's answer; a refusal or a call that
 * throws puts it back and returns the line to show (null when it held).
 */
export async function pressMark(
  toggle: (item: string, kind: MarkKind) => Promise<Toggled>,
  id: string,
  kind: MarkKind,
  now: Marks,
  apply: (kind: MarkKind, id: string, on: boolean) => void,
): Promise<string | null> {
  const before = hasMark(now, kind, id);
  apply(kind, id, !before);
  let r: Toggled;
  try {
    r = await toggle(id, kind);
  } catch {
    r = { ok: false, error: MARK_FAILED };
  }
  if (!r.ok) {
    apply(kind, id, before);
    return r.error;
  }
  apply(kind, id, r.on);
  return null;
}
