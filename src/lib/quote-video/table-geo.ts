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
/** a cell's side padding */
export const CELL_PAD = 14;
/** the left edge of column i; colX(COLS.length) is the table's width */
export const colX = (i: number) => COLS.slice(0, i).reduce((s, w) => s + w, 0);
