import type { Dimensions } from "@/lib/ads/campaign-store";

/**
 * The four dimensions as the wizard and the room edit them (Ads Studio, 2026-10-04): every row
 * kept on screen with a tick, so one ticked off can be ticked back, and what is ticked read back
 * the way the server cleans it (dimensions.ts's cleanDimensions) — trimmed, cut to length, the
 * same text once, held to the most each dimension takes. Reading it back here the same way means
 * the count of combinations the page shows is the count the queue will walk.
 *
 * Pure and import-free (but a type), so the browser can use it without the writer's prompts.
 */

export const DIMENSION_KEYS = ["hooks", "personas", "angles", "styles"] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export const DIMENSION_TEXT_MAX = 80;
export const DIMENSION_NOTE_MAX = 120;
/** the most of each a campaign keeps: the AI proposes hooks 8–12 and 3–5 of the others */
export const DIMENSION_MAX: Record<DimensionKey, number> = { hooks: 12, personas: 5, angles: 5, styles: 5 };

export const DIMENSION_LABEL: Record<DimensionKey, string> = {
  hooks: "ฮุก", personas: "กลุ่มคน", angles: "มุมขาย", styles: "สไตล์ภาพ",
};

/** One row on screen. `id` is only for React; `on` is the tick. */
export interface EditRow {
  id: number;
  text: string;
  note: string;
  on: boolean;
}

export type EditDims = Record<DimensionKey, EditRow[]>;

const cut = (s: string, max: number) => Array.from(s).slice(0, max).join("");

/** Saved dimensions as rows, every one ticked. */
export function toEdit(d: Dimensions): EditDims {
  let id = 0;
  const rows = (list: Dimensions[DimensionKey]) => list.map((x) => ({ id: id++, text: x.text, note: x.note, on: true }));
  return { hooks: rows(d.hooks), personas: rows(d.personas), angles: rows(d.angles), styles: rows(d.styles) };
}

/** The ticked rows of one dimension, as the server will keep them. */
function kept(rows: EditRow[], max: number): Dimensions[DimensionKey] {
  const out: Dimensions[DimensionKey] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.on) continue;
    const text = cut(r.text.trim(), DIMENSION_TEXT_MAX).trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push({ text, note: cut(r.note.trim(), DIMENSION_NOTE_MAX).trim() });
    if (out.length === max) break;
  }
  return out;
}

/** What is ticked, cleaned as the server cleans it. A dimension may come back empty: see `shortOf`. */
export function fromEdit(e: EditDims): Dimensions {
  return {
    hooks: kept(e.hooks, DIMENSION_MAX.hooks),
    personas: kept(e.personas, DIMENSION_MAX.personas),
    angles: kept(e.angles, DIMENSION_MAX.angles),
    styles: kept(e.styles, DIMENSION_MAX.styles),
  };
}

/** The dimensions left with nothing ticked (or only blank rows): each must keep at least one. */
export function shortOf(e: EditDims): DimensionKey[] {
  const d = fromEdit(e);
  return DIMENSION_KEYS.filter((k) => d[k].length === 0);
}

/** How many rows of a dimension are ticked; ticking another stops at its most. */
export const tickedCount = (rows: EditRow[]) => rows.filter((r) => r.on).length;

export function canTick(e: EditDims, key: DimensionKey): boolean {
  return tickedCount(e[key]) < DIMENSION_MAX[key];
}

/** A new, ticked, empty row at the end of a dimension (ticked off when the dimension is full). */
export function addRow(e: EditDims, key: DimensionKey): EditDims {
  const next = Math.max(-1, ...DIMENSION_KEYS.flatMap((k) => e[k].map((r) => r.id))) + 1;
  return { ...e, [key]: [...e[key], { id: next, text: "", note: "", on: canTick(e, key) }] };
}

export function editRow(e: EditDims, key: DimensionKey, id: number, patch: Partial<Omit<EditRow, "id">>): EditDims {
  return { ...e, [key]: e[key].map((r) => (r.id === id ? { ...r, ...patch } : r)) };
}

/** "10 × 4 × 4 × 4 = 640 แบบ" */
export function comboLine(d: Dimensions): string {
  const sizes = DIMENSION_KEYS.map((k) => d[k].length);
  const total = sizes.reduce((a, b) => a * b, 1);
  return `${sizes.join(" × ")} = ${total.toLocaleString("en-US")} แบบ`;
}

export function sameDimensions(a: Dimensions, b: Dimensions | null): boolean {
  if (!b) return false;
  return DIMENSION_KEYS.every((k) => a[k].length === b[k].length && a[k].every((x, i) => x.text === b[k][i].text && x.note === b[k][i].note));
}

/**
 * What the picture is drawn from for a piece written to a style: the style and its note
 * ("ภาพถ่ายครอบครัว — ภาพถ่ายครอบครัวไทยอบอุ่น…"). A style since edited away is drawn from its
 * name alone.
 */
export function styleRequest(d: Dimensions | null, style: string): string {
  const found = d?.styles.find((s) => s.text === style);
  return found?.note ? `${found.text} — ${found.note}` : style;
}
