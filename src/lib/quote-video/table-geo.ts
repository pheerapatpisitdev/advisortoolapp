/**
 * Where the classic clip's value table sits and how its columns are cut, shared by the scene
 * (draw.tsx), its pen notes (table-pen.tsx) and the pan (job.ts).
 */

export interface Rect { x: number; y: number; w: number; h: number }

/** the window the value table pans through */
export const TABLE: Rect = { x: 60, y: 820, w: 960, h: 760 };
/** the family photo's box on the opening, zoomed slowly by ffmpeg (draw.tsx) */
export const PHOTO: Rect = { x: 190, y: 330, w: 700, h: 540 };

/**
 * The classic clip's photo box and table window for each shape (owner, 2026-10-13: every clip in
 * every shape). The table is always 960 wide, so its picture and pen notes are the portrait ones;
 * only where the window stands and how tall it is change.
 */
export const CLASSIC_BOXES: Record<"portrait" | "square" | "landscape", { photo: Rect; table: Rect }> = {
  portrait: { photo: PHOTO, table: TABLE },
  square: { photo: { x: 56, y: 150, w: 460, h: 560 }, table: { x: 60, y: 330, w: 960, h: 520 } },
  landscape: { photo: { x: 90, y: 170, w: 760, h: 620 }, table: { x: 900, y: 250, w: 960, h: 572 } },
};
export const ROW_H = 52;
/**
 * the value table's columns: ปีที่ อายุ เบี้ย/ปี เบี้ยสะสม เวนคืนได้ คุ้มครอง — the premium
 * column wide enough for the "เบี้ยคงที่" brace and its word beside the figures (owner, 2026-10-13)
 */
export const COLS = [80, 80, 250, 180, 180, 190] as const;
/**
 * the same with the riders' premium in a column of its own after the plan's, as the Life Protect
 * page has it (owner, 2026-10-17, 1ก): the year and age narrower, the premium column kept for its brace
 */
export const RIDER_COLS = [64, 66, 250, 130, 140, 150, 160] as const;
const HEADS = ["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"];
const RIDER_HEADS = ["ปีที่", "อายุ", "เบี้ย/ปี", "สัญญาเพิ่มเติม", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"];

/** whether a table was quoted with riders: its rows carry their premium */
export const hasRiderColumn = (f: { rows?: { rider?: string }[] }) => Boolean(f.rows?.some((r) => r.rider !== undefined));
/** the columns a table is cut into */
export const colsOf = (f: { rows?: { rider?: string }[] }): readonly number[] => (hasRiderColumn(f) ? RIDER_COLS : COLS);
/** the left edge of column i of these columns */
export const edgeOf = (cols: readonly number[], i: number) => cols.slice(0, i).reduce((s, w) => s + w, 0);
/** the header over the value table: each column's name, width, and whether it sits left; the riders' name in two lines to fit */
export function valueHeads(f: { rows?: { rider?: string }[] }): { h: string; w: number; left: boolean; lines?: string[] }[] {
  const rider = hasRiderColumn(f);
  const cols = colsOf(f);
  return (rider ? RIDER_HEADS : HEADS).map((h, i) => ({ h, w: cols[i], left: i < 2, ...(rider && i === 3 ? { lines: ["สัญญา", "เพิ่มเติม"] } : {}) }));
}

/** a cell's side padding */
export const CELL_PAD = 14;
/** the left edge of column i; colX(COLS.length) is the table's width */
export const colX = (i: number) => COLS.slice(0, i).reduce((s, w) => s + w, 0);
