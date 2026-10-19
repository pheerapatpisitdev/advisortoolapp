/**
 * The red and blue pen notes on Global Savings Plus 15/8's page, as the owner approved them on
 * the mockup (2026-10-20: on the yearly table and the bar chart, ข; the bonus rows underlined
 * twice, ค — a long ring round a whole row looked wrong). Blue says what is guaranteed, red
 * says what is paid and what is not guaranteed:
 *
 *   yearly table
 *   - red: a brace down the eight premiums, the last paying year ringed, "เบี้ยเท่าเดิมทุกปี จ่ายแค่ 8 ปี แล้วหยุด"
 *   - blue: a brace down the yearly 1% payback, "เงินคืน 1% ของทุน ทุกปี … (การันตี)"
 *   - blue: the maturity payout ringed, "ครบสัญญารับ 801% ของทุน … (การันตี)"
 *   - red: the year-10 and maturity bonuses underlined twice, with what each is
 *   bar chart
 *   - blue: a line across the guaranteed level, "การันตี … เท่ากันทุกกรณี"
 *   - red: the strongest scenario's bonus ringed, "ส่วนสีฟ้าบนแท่ง = โบนัสดัชนี (ไม่การันตี)"
 *
 * Worked out from boxes the page measures (px, relative to the layer), so this file draws
 * nothing itself and can be tested with made-up boxes. The words go into cells the table
 * leaves empty: the premium columns after year 8 and the bonus columns outside years 10 and 15.
 */

export interface Box { x: number; y: number; w: number; h: number }
export type Ink = "red" | "blue";
export interface PenStroke { d: string; ink: Ink; width: number }
export interface PenText { lines: string[]; x: number; y: number; ink: Ink; tilt: number; alignRight?: boolean }
export interface PenDrawing { strokes: PenStroke[]; labels: PenText[] }

/** a small steady wobble, the same every draw, so the marks look drawn but do not jump on a re-measure */
export function wobble(seed: number): () => number {
  let n = seed;
  return () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280 - 0.5;
  };
}

const f1 = (n: number) => n.toFixed(1);

/** a loop round a box, started high on the left and carried past where it began, as a pen does */
export function ring(b: Box, jit: () => number, padX = 7, padY = 5): string {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2 + padX, ry = b.h / 2 + padY, n = 34;
  let d = "";
  for (let i = 0; i <= n + 4; i++) {
    const t = -2.2 + (i / n) * Math.PI * 2, k = 1 + jit() * 0.06;
    d += `${i ? "L" : "M"}${f1(cx + Math.cos(t) * rx * k)} ${f1(cy + Math.sin(t) * ry * k)}`;
  }
  return d;
}

/** a curly brace down x from y1 to y2, its point facing left */
export function brace(x: number, y1: number, y2: number): string {
  const m = (y1 + y2) / 2, q = 7;
  return `M${x + q} ${y1} Q${x} ${y1} ${x} ${y1 + 9} L${x} ${m - 7} Q${x} ${m} ${x - q} ${m}`
    + ` Q${x} ${m} ${x} ${m + 7} L${x} ${y2 - 9} Q${x} ${y2} ${x + q} ${y2}`;
}

/** a curved line with an open head at (x2, y2) */
export function arrow(x1: number, y1: number, x2: number, y2: number, bend = 0): string {
  const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2 - Math.abs(bend) * 0.4;
  const ang = Math.atan2(y2 - my, x2 - mx), len = 9;
  const hx = (a: number) => f1(x2 - len * Math.cos(a)), hy = (a: number) => f1(y2 - len * Math.sin(a));
  return `M${f1(x1)} ${f1(y1)} Q${f1(mx)} ${f1(my)} ${f1(x2)} ${f1(y2)}`
    + ` M${hx(ang - 0.45)} ${hy(ang - 0.45)} L${f1(x2)} ${f1(y2)} L${hx(ang + 0.45)} ${hy(ang + 0.45)}`;
}

/** two quick strokes under a run of figures, the second shorter (ค) */
export function underline(x1: number, x2: number, y: number, jit: () => number): string {
  const j = () => jit() * 1.6, m = (x1 + x2) / 2;
  return `M${f1(x1)} ${f1(y + j())} Q${f1(m)} ${f1(y + 2.5)} ${f1(x2)} ${f1(y - 1 + j())}`
    + ` M${f1(x1 + 14)} ${f1(y + 5 + j())} Q${f1(m)} ${f1(y + 7.5)} ${f1(x2 - 22)} ${f1(y + 4 + j())}`;
}

const baht = (n: number) => Math.round(n).toLocaleString("en-US");

/** the yearly table's columns, left to right, as the page draws them */
export const GS_TABLE_COLUMNS = {
  year: 0, age: 1, premium: 2, paid: 3, payback: 4, death: 5, bonusFirst: 6, bonusLast: 10, tax: 11,
} as const;

export interface TableMeasure {
  /** a cell's box, by policy year (1-based) and column */
  cell: (year: number, column: number) => Box;
  /** the figure's own box inside a cell, or null for an empty one */
  text: (year: number, column: number) => Box | null;
}

export interface TableFacts {
  premYears: number;
  term: number;
  /** the yearly payback, 1% of the sum */
  payback: number;
  maturity: number;
  /** policy years the index bonus is paid */
  bonusYears: number[];
}

export function tablePens(m: TableMeasure, f: TableFacts): PenDrawing {
  const C = GS_TABLE_COLUMNS, jit = wobble(7);
  const strokes: PenStroke[] = [], labels: PenText[] = [];
  const red = (d: string, width = 1.7) => strokes.push({ d, ink: "red", width });
  const blue = (d: string, width = 1.7) => strokes.push({ d, ink: "blue", width });
  const PY = f.premYears, T = f.term;

  // red · the premiums, paid the same each year and stopping at the last paying year
  const p1 = m.cell(1, C.premium), pLast = m.cell(PY, C.premium);
  red(brace(p1.x + 9, p1.y + 4, pLast.y + pLast.h - 4));
  const yLast = m.text(PY, C.year) ?? m.cell(PY, C.year);
  red(ring({ x: yLast.x - 2, y: yLast.y, w: Math.max(yLast.w, 10) + 4, h: yLast.h }, jit, 7, 4));
  const after = m.cell(PY + 1, C.premium);
  labels.push({ lines: ["เบี้ยเท่าเดิมทุกปี", `จ่ายแค่ ${PY} ปี แล้วหยุด`], x: after.x + 8, y: after.y + 2, ink: "red", tilt: -3 });
  red(arrow(after.x + 4, after.y + 14, yLast.x + yLast.w + 10, yLast.y + yLast.h + 2, -14));

  // blue · the yearly payback, the same every year to the one before maturity
  const r1 = m.cell(1, C.payback), rEnd = m.cell(T - 1, C.payback);
  blue(brace(r1.x + 9, r1.y + 4, rEnd.y + rEnd.h - 4));
  const mid = (r1.y + 4 + rEnd.y + rEnd.h - 4) / 2;
  const payWords = m.cell(Math.min(PY + 3, T - 3), C.premium);
  const paidCol = m.cell(1, C.paid);
  labels.push({ lines: ["เงินคืน 1% ของทุน ทุกปี", `ปีละ ${baht(f.payback)} บาท (การันตี)`], x: payWords.x + 8, y: payWords.y, ink: "blue", tilt: -2 });
  blue(arrow(paidCol.x + paidCol.w - 14, payWords.y + 6, r1.x - 2, mid + 4, -10));

  // blue · the maturity payout ringed
  const mat = m.text(T, C.payback) ?? m.cell(T, C.payback);
  blue(ring(mat, jit, 9, 5), 2);
  const matWords = m.cell(T - 1, C.premium);
  labels.push({ lines: ["ครบสัญญารับ 801% ของทุน", `${baht(f.maturity)} บาท (การันตี)`], x: matWords.x + 8, y: matWords.y - 6, ink: "blue", tilt: -2 });
  blue(arrow(matWords.x + 150, matWords.y + 30, mat.x - 6, mat.y + mat.h / 2, -8));

  // red · the two bonuses underlined twice, each with what it is, written in the empty rows above
  const notes: Record<number, string[]> = {
    [f.bonusYears[0]]: [`โบนัสดัชนีก้อนแรก สิ้นปีที่ ${f.bonusYears[0]}`, "ไม่การันตี · ดัชนีขึ้นมาก ได้มาก ดัชนีติดลบ ได้ 0"],
    [T]: ["โบนัสก้อนใหญ่ ตอนครบสัญญา (ไม่การันตี)"],
  };
  for (const y of f.bonusYears) {
    const figs: Box[] = [];
    for (let c = C.bonusFirst; c <= C.bonusLast; c++) {
      const t = m.text(y, c);
      if (t) figs.push(t);
    }
    if (!figs.length) continue;
    const row = m.cell(y, C.bonusFirst);
    const x1 = figs[0].x - 4, x2 = figs[figs.length - 1].x + figs[figs.length - 1].w + 4;
    red(underline(x1, x2, row.y + row.h - 6, jit), 1.8);
    const lines = notes[y] ?? [];
    const above = m.cell(y - (lines.length > 1 ? 4 : 3), C.bonusFirst);
    labels.push({ lines, x: above.x + 6, y: above.y + 4, ink: "red", tilt: -2 });
    red(arrow(above.x + 120, above.y + 4 + lines.length * 21, (x1 + x2) / 2, row.y - 4, 12));
  }
  return { strokes, labels };
}

export interface BarMeasure {
  /** the guaranteed part of each bar, weakest index first */
  guaranteed: Box[];
  /** each bar's total figure above it, weakest index first */
  totals: Box[];
  /** the bonus part of the strongest scenario's bar, if it has one */
  topBonus: Box | null;
}

export function barPens(m: BarMeasure, guaranteed: number): PenDrawing {
  const jit = wobble(11);
  const strokes: PenStroke[] = [], labels: PenText[] = [];
  const first = m.guaranteed[0], last = m.guaranteed[m.guaranteed.length - 1];
  strokes.push({ d: `M${f1(first.x + 2)} ${f1(first.y)} L${f1(last.x + last.w - 2)} ${f1(first.y + 1)}`, ink: "blue", width: 2.4 });
  // a phone's bars are too narrow for the words to sit beside the next bar's figure, so there
  // they go above it, and the red note takes two lines to stay clear of them
  const narrow = first.w < 90;
  const over = narrow ? Math.min(m.totals[0].y, m.totals[1]?.y ?? Infinity) : m.totals[0].y;
  labels.push({ lines: [`การันตี ${baht(guaranteed)}`, "เท่ากันทุกกรณี"], x: first.x + (narrow ? 2 : 10), y: Math.max(0, over - 46), ink: "blue", tilt: -3 });
  if (m.topBonus) {
    const t = m.topBonus;
    strokes.push({ d: ring({ x: t.x + 10, y: t.y + 2, w: t.w - 20, h: 20 }, jit, 6, 5), ink: "red", width: 2 });
    labels.push({
      lines: narrow ? ["ส่วนสีฟ้าบนแท่ง", "= โบนัสดัชนี (ไม่การันตี)"] : ["ส่วนสีฟ้าบนแท่ง = โบนัสดัชนี (ไม่การันตี)"],
      x: t.x - 12, y: Math.max(0, t.y - (narrow ? 50 : 34)), ink: "red", tilt: -3, alignRight: true,
    });
    strokes.push({ d: arrow(t.x - 14, Math.max(0, t.y - 14), t.x + 6, t.y + 10, 6), ink: "red", width: 1.7 });
  }
  return { strokes, labels };
}
