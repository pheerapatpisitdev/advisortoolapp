/**
 * Where the classic clip's value table sits and how its columns are cut, shared by the scene
 * (draw.tsx), its pen notes (table-pen.tsx) and the pan (job.ts).
 */

/** the window the value table pans through */
export const TABLE = { x: 60, y: 820, w: 960, h: 760 } as const;
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
