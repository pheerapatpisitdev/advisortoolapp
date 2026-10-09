import type { ValueTableCard } from "@/lib/quote-card";

/**
 * The red-pen notes an agent would scribble on the value table before handing it over —
 * drawn from the owner's own markup of a Life Protect table (2026-10-09):
 *
 *   - a brace down the premiums while they are paid, "เบี้ยคงที่"
 *   - the last paying year ringed, an arrow from "หยุดส่งเบี้ย"
 *   - the first year's cover ringed, an arrow from "อนุมัติ คุ้มครองเลย"
 *   - an arrow from the break-even label over to the ringed surrender value
 *   - a brace down the surrender values after break-even, "เบี้ยไม่ทิ้งเปล่า …" (2026-10-10)
 *
 * Each note is drawn only where its fact holds: a plan paid to the end has nothing to stop, a
 * premium that moves year to year is not "คงที่", a year still being paid at break-even has no
 * label to arrow from. The geometry is the table's own — fixed row heights and column widths —
 * so a note lands on its row whatever the plan.
 */

export interface PenGeometry {
  /** the column widths the table is drawn at */
  widths: number[];
  /** the caption band above the table, which the cover note writes into */
  caption: number;
  head: number;
  row: number;
  /** a cell's own side padding */
  cellPad: number;
  /**
   * A figure's width in these units, where the drawing can measure it: the page does, since a
   * phone's digits are wider than the picture's estimate (owner, 2026-10-10). figureWidth otherwise.
   */
  measure?: (s: string) => number;
}

export interface PenLabel {
  text: string;
  /** top-left of the label, or its right edge for a label set against something on its right */
  left?: number;
  right?: number;
  top: number;
  size: number;
  /** a pen is never held quite level */
  tilt: number;
}

export interface PenNotes {
  /** cells to ring, by row index and column name */
  rings: { row: number; column: string }[];
  /** every stroke, as SVG path data in the overlay's own pixels */
  strokes: string[];
  labels: PenLabel[];
}

/** A figure's width at the table's 22px, near enough to aim a pen at. */
export const figureWidth = (s: string) => [...s].reduce((w, c) => w + (c === "," ? 6 : 12.6), 0);

/** the room the ring adds round a figure, either side (see Cell's pen) */
export const RING_PAD = 12;

const BRACE_WORD = "เบี้ยคงที่";
const STOP_WORD = "หยุดส่งเบี้ย";
const COVER_WORD = "อนุมัติ คุ้มครองเลย";
/** written beside the years the policy is worth more than was paid in, one line at a time */
const GAIN_WORDS = ["เบี้ยไม่ทิ้งเปล่า", "สามารถเก็บเป็นเงินสด", "หลังเกษียณได้"];
const GAIN_SIZE = 32;
/** a line of the pen face at GAIN_SIZE, as the labels set it (lineHeight 1.5) */
const GAIN_LINE = GAIN_SIZE * 1.5;
/** the label the break-even row carries in the running-total column (route.tsx) */
const BREAK_EVEN_LABEL_WIDTH = 132;

/** every word the notes can write, for cutting the font down to them */
export const PEN_TEXT = BRACE_WORD + STOP_WORD + COVER_WORD + GAIN_WORDS.join("");

/** the room the brace and its word take, left of the premium figures */
export const BRACE_ROOM = 170;

/** An arrowhead at (x, y), pointing along the line from (fx, fy). */
function head(x: number, y: number, fx: number, fy: number): string {
  const a = Math.atan2(y - fy, x - fx);
  const len = 16;
  const wing = (d: number) => `${(x - len * Math.cos(a + d)).toFixed(1)} ${(y - len * Math.sin(a + d)).toFixed(1)}`;
  return `M${wing(0.45)} L${x.toFixed(1)} ${y.toFixed(1)} L${wing(-0.45)}`;
}

/** A gentle curve from one point to another through a control point, with a head at the end. */
function arrow(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number): string[] {
  return [`M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`, head(x2, y2, cx, cy)];
}

/**
 * A curly brace standing `h` tall at x, its point to the left — drawn round, as a hand writes
 * "{" (the owner's pick of four, 2026-10-10): each half swells out from its tip and draws in
 * to the point, rather than running straight with the curls only at the ends.
 */
function brace(x: number, y: number, h: number, w = 20): string {
  const mid = y + h / 2;
  const r = Math.min(14, h / 8);
  const f = (n: number) => n.toFixed(1);
  return [
    `M${f(x + w)} ${f(y)}`,
    `Q${f(x + w * 0.25)} ${f(y)} ${f(x + w * 0.35)} ${f(y + h / 4)}`,
    `Q${f(x + w * 0.45)} ${f(mid - r)} ${f(x)} ${f(mid)}`,
    `Q${f(x + w * 0.45)} ${f(mid + r)} ${f(x + w * 0.35)} ${f(y + (h * 3) / 4)}`,
    `Q${f(x + w * 0.25)} ${f(y + h)} ${f(x + w)} ${f(y + h)}`,
  ].join(" ");
}

/**
 * Whether the brace will be drawn, asked before the widths are final: a short table's premium
 * column is sized to its figure and nothing else, so the room has to be made for it.
 */
export function needsBraceRoom(card: ValueTableCard): boolean {
  return paidConstantly(card) !== undefined;
}

/** The last year of a premium that never moves, or undefined when there is no such run. */
function paidConstantly(card: ValueTableCard): number | undefined {
  const { rows } = card;
  if (rows.length < 2 || rows[0].due === "—") return undefined;
  let last = 0;
  while (last + 1 < rows.length && rows[last + 1].due !== "—") last += 1;
  if (last < 1) return undefined;
  return rows.slice(0, last + 1).every((r) => r.due === rows[0].due) ? last : undefined;
}

export function penNotes(card: ValueTableCard, g: PenGeometry): PenNotes {
  const { rows, columns } = card;
  const x = (i: number) => g.widths.slice(0, i).reduce((s, w) => s + w, 0);
  const end = (i: number) => x(i) + g.widths[i];
  const total = end(g.widths.length - 1);
  const top = (n: number) => g.caption + g.head + n * g.row;
  const mid = (n: number) => top(n) + g.row / 2;
  const notes: PenNotes = { rings: [], strokes: [], labels: [] };
  const widthOf = g.measure ?? figureWidth;
  const premium = columns.indexOf("เบี้ย/ปี");

  // ── เบี้ยคงที่: a brace down the premiums that never move
  const steady = paidConstantly(card);
  if (steady !== undefined && premium >= 0) {
    const right = end(premium) - g.cellPad - widthOf(rows[0].due) - 12;
    const left = right - 20;
    const y = top(0) + 5;
    const h = top(steady) + g.row - 5 - y;
    notes.strokes.push(brace(left, y, h));
    notes.labels.push({ text: BRACE_WORD, right: total - (left - 8), top: y + h / 2 - 24, size: 30, tilt: -6 });
  }

  // ── หยุดส่งเบี้ย: the last year anything is paid, when the contract runs on past it
  const pays = (n: number) => rows[n].due !== "—" || (rows[n].rider !== undefined && rows[n].rider !== "—");
  if (pays(0)) {
    let last = 0;
    while (last + 1 < rows.length && pays(last + 1)) last += 1;
    if (last < rows.length - 1) {
      notes.rings.push({ row: last, column: "ปีที่" });
      const at = Math.min(last + 3, rows.length - 1);
      const labelLeft = x(Math.max(premium, 2)) + 24;
      const labelMid = mid(at);
      notes.labels.push({ text: STOP_WORD, left: labelLeft, top: labelMid - 22, size: 30, tilt: -4 });
      const ringRight = g.cellPad + widthOf(String(rows[last].year)) + RING_PAD;
      notes.strokes.push(...arrow(labelLeft - 8, labelMid, ringRight + 60, labelMid - 8, ringRight + 2, mid(last) + 12));
    }
  }

  // ── อนุมัติ คุ้มครองเลย: the first year's cover, from the caption band above the table
  const cover = columns.indexOf("คุ้มครอง");
  if (cover >= 0 && rows.length) {
    notes.rings.push({ row: 0, column: "คุ้มครอง" });
    const ringLeft = end(cover) - g.cellPad + RING_PAD - (widthOf(rows[0].cover) + RING_PAD * 2);
    // set well left of the ring, so the arrow comes down clear of the column's heading
    const labelRight = ringLeft - 56;
    // lifted clear of the navy heading bar, which its lower vowels used to dip into
    notes.labels.push({ text: COVER_WORD, right: total - labelRight, top: -8, size: 28, tilt: -3 });
    notes.strokes.push(...arrow(labelRight + 4, g.caption * 0.6, ringLeft - 30, g.caption + g.head * 0.7, ringLeft + 4, top(0) + 8));
  }

  // ── จุดคุ้มทุน: an arrow from the label over to the ringed surrender value
  const paid = columns.indexOf("เบี้ยสะสม");
  const cash = columns.indexOf("เวนคืนได้");
  const be = rows.findIndex((r) => r.breakEven);
  if (be > 0 && paid >= 0 && cash > paid && rows[be].paid === null && rows[be].cash !== undefined) {
    const from = end(paid) - g.cellPad - BREAK_EVEN_LABEL_WIDTH / 2;
    const ringLeft = end(cash) - g.cellPad + RING_PAD - (widthOf(rows[be].cash!) + RING_PAD * 2);
    notes.strokes.push(...arrow(from, top(be) + 2, (from + ringLeft) / 2, top(be) - g.row * 1.9, ringLeft - 2, mid(be) - 6));
  }

  // ── เบี้ยไม่ทิ้งเปล่า: a brace down the surrender values from the year after break-even to the
  // end, the words to its left. They are written over the premium and running-total columns, so
  // only where both have stopped — a dash, not a figure, under the pen.
  const after = be + 1;
  if (be >= 0 && cash >= 0 && rows.length - after >= 4) {
    const y = top(after) + 4;
    const h = top(rows.length) - 4 - y;
    const labelTop = y + h / 2 - (GAIN_WORDS.length * GAIN_LINE) / 2;
    const first = Math.max(0, Math.floor((labelTop - top(0)) / g.row));
    const last = Math.min(rows.length - 1, Math.floor((labelTop + GAIN_WORDS.length * GAIN_LINE - top(0)) / g.row));
    const clear = rows.slice(first, last + 1).every((r) => r.due === "—" && r.paid === null);
    if (clear) {
      const widest = Math.max(...rows.slice(after).map((r) => widthOf(r.cash ?? "")));
      // clear of the widest figure by more than the premium brace is: the owner found it touching (2026-10-10)
      const right = end(cash) - g.cellPad - widest - 22;
      const left = right - 20;
      notes.strokes.push(brace(left, y, h));
      GAIN_WORDS.forEach((text, i) => {
        notes.labels.push({ text, right: total - (left - 10), top: labelTop + i * GAIN_LINE, size: GAIN_SIZE, tilt: -4 });
      });
    }
  }

  return notes;
}

/** The strokes as one picture the size of the overlay. */
export function penSvgUri(strokes: string[], width: number, height: number, color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>`
    + strokes.map((d) => `<path d='${d}' fill='none' stroke='${color}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/>`).join("")
    + `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
