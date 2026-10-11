import type { PensionYear } from "@/calc/pension/engine";
import {
  arrow, brace, figureWidth, head, penTextWidth, type PenGeometry, type PenLabel, type PenNotes,
} from "@/app/api/card/table/pen-notes";

/**
 * The pen notes on บำนาญ สมาร์ท 95's yearly table (/bumnan95), as the owner approved them on a
 * mockup (2026-10-11) — the same hand as the other plans' value tables, saying what this
 * contract's own milestones are:
 *
 *   - a red brace down the premiums while they are paid and never move, "เบี้ยคงที่"
 *   - the last premium ringed, an arrow from "หยุดส่งเบี้ย"
 *   - the first pension ringed, an arrow from "เริ่มรับบำนาญ อายุ N"
 *   - in blue, a brace down the fifteen guaranteed pensions, "รับประกันจ่าย 15 ปีแรก …"
 *   - each step up in the pension ringed, "บำนาญเพิ่มเป็น N% ของทุน"
 *   - the first year the pension received passes every premium paid ringed, "จุดคุ้มทุน …"
 *
 * Each is drawn only where its fact holds. The words are written in the cells the table
 * leaves empty — premium, running total and surrender value once a pension is being paid —
 * each in rows no other note has taken, so a different age or pension age moves them rather
 * than piling them up.
 */

/** the yearly table's columns, left to right */
export const PENSION_COLUMNS = [
  // the cover last: the owner moved it there (2026-10-11), the pension beside what it pays out of
  "อายุ", "ปีที่", "เบี้ย", "เบี้ยสะสม", "มูลค่าเวนคืน", "บำนาญ", "บำนาญสะสม", "คุ้มครองชีวิต",
] as const;
export type PensionColumn = (typeof PENSION_COLUMNS)[number];

/** page pixels per picture unit: the table's 14px figures over the picture's 22px */
export const PENSION_PEN_SCALE = 14 / 22;
/** a cell's side padding on the page (px-[5px]) */
export const PENSION_CELL_PAD = 5;
/** the room a ring takes either side of its figure on the page (Circled's px-2.5) */
const RING_PX = 10;

/** dropped, not rounded — the rule every premium in this app is shown by */
export const pensionFigure = (n: number) => Math.floor(n).toLocaleString("en-US");

/** What each cell shows: a figure, or nothing where the year has none (as the other tables leave them blank). */
export function pensionCells(y: PensionYear): Record<PensionColumn, string> {
  const fig = (n: number) => (n ? pensionFigure(n) : "");
  return {
    อายุ: String(y.age),
    ปีที่: String(y.policyYear),
    เบี้ย: fig(y.premium),
    // only while premiums are still being paid; after that it is one number repeated
    เบี้ยสะสม: y.premium ? pensionFigure(y.cumPremium) : "",
    มูลค่าเวนคืน: fig(y.cashValue),
    บำนาญ: fig(y.pension),
    บำนาญสะสม: fig(y.cumPension),
    คุ้มครองชีวิต: fig(y.deathBenefit),
  };
}

/** The rows the notes are about, by index into the table; -1 where the table has no such row. */
export interface PensionMarks {
  /** the last year a premium is paid, when the table runs on past it */
  lastPaid: number;
  /** the first year a pension is paid */
  start: number;
  /** the last of the fifteen guaranteed pensions */
  guaranteeEnd: number;
  /** the years the pension steps up to a higher share of the sum */
  steps: number[];
  /** the first year the pension received passes every premium paid */
  breakEven: number;
  /** whether every premium is the same, over at least two years */
  steady: boolean;
}

export const GUARANTEED_YEARS = 15;

export function pensionMarks(rows: PensionYear[]): PensionMarks {
  const paying = rows.flatMap((r, i) => (r.premium > 0 ? [i] : []));
  const last = paying.length ? paying[paying.length - 1] : -1;
  const start = rows.findIndex((r) => r.pension > 0);
  const totalPremium = Math.max(0, ...rows.map((r) => r.cumPremium));
  return {
    lastPaid: last >= 0 && last < rows.length - 1 ? last : -1,
    start,
    guaranteeEnd: start < 0 ? -1 : Math.min(start + GUARANTEED_YEARS - 1, rows.length - 1),
    steps: start < 0 ? [] : rows.flatMap((r, i) => (i > start && r.pension > rows[i - 1].pension ? [i] : [])),
    breakEven: totalPremium > 0 ? rows.findIndex((r) => r.pension > 0 && r.cumPension >= totalPremium) : -1,
    steady: paying.length >= 2 && paying.every((i) => rows[i].premium === rows[paying[0]].premium),
  };
}

/** The cells the notes ring, which the table draws itself (Circled). */
export function pensionRings(rows: PensionYear[]): { row: number; column: PensionColumn }[] {
  const m = pensionMarks(rows);
  return [
    ...(m.lastPaid >= 0 ? [{ row: m.lastPaid, column: "เบี้ย" as const }] : []),
    ...(m.start >= 0 ? [{ row: m.start, column: "บำนาญ" as const }] : []),
    ...m.steps.map((row) => ({ row, column: "บำนาญ" as const })),
    ...(m.breakEven >= 0 ? [{ row: m.breakEven, column: "บำนาญสะสม" as const }] : []),
  ];
}

/** the hand's size for every word, in picture units, and its line */
const SIZE = 24;
const LINE = SIZE * 1.5;
const BRACE_WORDS = ["เบี้ย", "คงที่"];
const STOP_WORD = "หยุดส่งเบี้ย";
const GUARANTEE_WORDS = (from: number, to: number) => [
  `รับประกันจ่าย ${GUARANTEED_YEARS} ปีแรก`, `(อายุ ${from}–${to})`, "เสียชีวิตก่อน ครอบครัว", "ได้รับส่วนที่เหลือ",
];
const BREAK_EVEN_WORDS = ["จุดคุ้มทุน", "บำนาญรวม", "เกินเบี้ย", "ที่ส่งแล้ว"];
/** every letter the notes can write, for cutting the picture's pen face down to them */
export const PENSION_PEN_TEXT = [
  ...BRACE_WORDS, STOP_WORD, "เริ่มรับบำนาญ อายุ", "บำนาญเพิ่มเป็น ของทุน",
  ...GUARANTEE_WORDS(0, 0), ...BREAK_EVEN_WORDS, "0123456789%()–",
].join("");

/** a year's pension as a share of the sum assured, as the contract states its bands */
const percentOf = (pension: number, sumAssured: number) => `${Math.round((pension / sumAssured) * 100)}%`;

/** Whether the premium column needs room made for the brace and its word beside the figures. */
export const pensionBraceRoom = (rows: PensionYear[]) => pensionMarks(rows).steady;

/**
 * `ring` is how far a ring reaches left of its figure, either side of it, in picture units: the
 * page's Circled pads both sides and pushes the figure over; the picture's ring stands out
 * beside a figure that stays put, so it passes half its RING_PAD.
 */
export function pensionPenNotes(rows: PensionYear[], sumAssured: number, g: PenGeometry, ring = RING_PX / PENSION_PEN_SCALE): PenNotes {
  const notes: PenNotes = { rings: [], strokes: [], blueStrokes: [], labels: [] };
  if (!rows.length) return notes;
  const m = pensionMarks(rows);
  const col = (c: PensionColumn) => PENSION_COLUMNS.indexOf(c);
  const x = (i: number) => g.widths.slice(0, i).reduce((s, w) => s + w, 0);
  const end = (i: number) => x(i) + g.widths[i];
  const total = end(g.widths.length - 1);
  const top = (n: number) => g.caption + g.head + n * g.row;
  const mid = (n: number) => top(n) + g.row / 2;
  const widthOf = g.measure ?? figureWidth;
  const cells = rows.map(pensionCells);
  /** the left edge of a figure as the table sets it, right-aligned, ringed or not */
  const figureLeft = (n: number, c: PensionColumn, ringed = false) =>
    end(col(c)) - g.cellPad - widthOf(cells[n][c]) - (ringed ? 2 * ring : 0);
  const ringMid = (n: number, c: PensionColumn) => (figureLeft(n, c, true) + end(col(c)) - g.cellPad) / 2;
  notes.rings = pensionRings(rows);

  /**
   * The empty cells a pension year leaves — premium, running total, surrender value — taken a
   * row at a time, so no two notes write over each other. A note asks for the rows it would
   * like, in order, and gets the first that are free; none free, it is not written.
   */
  const taken = new Set<number>();
  const free = (n: number) => n >= 0 && n < rows.length && !taken.has(n)
    && !cells[n]["เบี้ย"] && !cells[n]["เบี้ยสะสม"];
  const take = (want: number[], lines: number, wide: boolean): number | undefined => {
    const span = Math.max(1, Math.ceil((lines * LINE) / g.row));
    for (const n of want) {
      const rowsHere = Array.from({ length: span }, (_, i) => n + i);
      if (rowsHere.every((r) => free(r) && (!wide || !cells[r]["มูลค่าเวนคืน"]))) {
        rowsHere.forEach((r) => taken.add(r));
        return n;
      }
    }
    return undefined;
  };
  const write = (lines: string[], left: number, firstTop: number, ink?: "blue", tilt = -3): number => {
    lines.forEach((text, i) => {
      const label: PenLabel = { text, left, top: firstTop + i * LINE, size: SIZE, tilt, ...(ink ? { ink } : {}) };
      notes.labels.push(label);
    });
    return Math.max(...lines.map((t) => penTextWidth(t, SIZE)));
  };
  /** where a block of `lines` sits in its rows, centred on them */
  const blockTop = (n: number, lines: number) => {
    const span = Math.max(1, Math.ceil((lines * LINE) / g.row));
    return top(n) + (span * g.row - lines * LINE) / 2;
  };
  const writeFrom = x(col("เบี้ย")) + g.cellPad + 6;

  // ── เบี้ยคงที่: a brace down the premiums that never move, its word to the left in the room made for it
  if (m.steady) {
    const paying = rows.flatMap((r, i) => (r.premium > 0 ? [i] : []));
    const first = paying[0];
    const last = paying[paying.length - 1];
    // aimed at the plain figures; the last one's ring sits under the brace's end, so the
    // brace stops just above it rather than the column being widened for one row
    const right = Math.min(...paying.map((n) => figureLeft(n, "เบี้ย"))) - 4;
    const left = right - 20;
    const y = top(first) + 5;
    const h = (last === m.lastPaid ? top(last) + 2 : top(last) + g.row - 5) - y;
    notes.strokes.push(brace(left, y, h));
    BRACE_WORDS.forEach((text, i) => {
      notes.labels.push({ text, right: total - (left - 2), top: y + h / 2 - LINE + i * LINE, size: SIZE, tilt: -5 });
    });
  }

  // ── หยุดส่งเบี้ย: the last premium ringed, the word under it in the column it has emptied
  if (m.lastPaid >= 0) {
    const n = take([m.lastPaid + 1, m.lastPaid + 2, m.lastPaid + 3], 1, false);
    if (n !== undefined) {
      const labelTop = blockTop(n, 1);
      const w = write([STOP_WORD], writeFrom, labelTop, undefined, -4);
      // from just past the word's end, curling up and back into the ring above it
      const fromX = writeFrom + w + 8;
      const fromY = labelTop + LINE / 2;
      const toX = Math.min(ringMid(m.lastPaid, "เบี้ย") + 20, end(col("เบี้ย")) - g.cellPad - 6);
      const toY = mid(m.lastPaid) + g.row * 0.42;
      notes.strokes.push(...arrow(fromX, fromY, Math.max(fromX, toX) + 40, fromY + 6, toX, toY));
    }
  }

  /**
   * An arrow from a word in the empty cells over to a mark further right. Where columns that
   * still hold figures lie between, it runs along the line between two rows while it crosses
   * them, so it never strikes a figure through as a correction would, and bends into the mark
   * at the end; with nothing between, it is a plain curve.
   */
  const lastEmpty = col("มูลค่าเวนคืน");
  const reach = (fx: number, fy: number, tx: number, ty: number, laneY: number, target: number): string[] => {
    const crossFrom = lastEmpty + 1;
    const crossTo = target - 1;
    if (crossTo < crossFrom) return arrow(fx, fy, (fx + tx) / 2, Math.min(fy, ty) - g.row * 0.3, tx, ty);
    const a = x(crossFrom) - 4;
    const b = Math.min(end(crossTo) + 4, tx - 6);
    const cx = b + (tx - b) * 0.6;
    const f = (n: number) => n.toFixed(1);
    return [
      `M${f(fx)} ${f(fy)} Q${f((fx + a) / 2)} ${f(fy)} ${f(a)} ${f(laneY)} L${f(b)} ${f(laneY)} Q${f(cx)} ${f(laneY)} ${f(tx)} ${f(ty)}`,
      head(tx, ty, cx, laneY),
    ];
  };

  /** a word written left of its row's ringed pension figure, with an arrow over to the ring */
  const pointAt = (lines: string[], target: number, c: PensionColumn, want: number[]) => {
    const n = take(want, lines.length, false);
    if (n === undefined) return;
    const labelTop = blockTop(n, lines.length);
    const w = write(lines, writeFrom, labelTop, undefined, -2);
    const fromX = writeFrom + w + 8;
    const fromY = labelTop + (lines.length * LINE) / 2;
    const toX = figureLeft(target, c, true) - 2;
    const toY = mid(target);
    // the line between the word's row and the ring's, or the ring row's top when they share one
    const laneY = top(n > target ? target + 1 : target);
    notes.strokes.push(...reach(fromX, fromY, toX, toY, laneY, col(c)));
  };

  // ── เริ่มรับบำนาญ: the first pension
  if (m.start >= 0) {
    pointAt([`เริ่มรับบำนาญ อายุ ${rows[m.start].age}`], m.start, "บำนาญ", [m.start, m.start + 1, m.start + 2]);
  }

  // ── บำนาญเพิ่มขึ้น: each step up to a bigger share of the sum
  for (const n of m.steps) {
    pointAt([`บำนาญเพิ่มเป็น ${percentOf(rows[n].pension, sumAssured)} ของทุน`], n, "บำนาญ", [n, n + 1, n - 1]);
  }

  // ── จุดคุ้มทุน: in the empty cells to the left, under the break-even row, an arrow along the
  // line below that row over to the ringed running total
  if (m.breakEven >= 0) {
    const be = m.breakEven;
    const n = take([be + 1, be + 2, be + 3, be + 4], BREAK_EVEN_WORDS.length, false);
    if (n !== undefined) {
      const labelTop = blockTop(n, BREAK_EVEN_WORDS.length);
      const w = write(BREAK_EVEN_WORDS, writeFrom, labelTop);
      notes.labels[notes.labels.length - BREAK_EVEN_WORDS.length].mark = true;
      const fromX = writeFrom + w + 8;
      const toX = figureLeft(be, "บำนาญสะสม", true) - 2;
      notes.strokes.push(...reach(fromX, labelTop + LINE, toX, mid(be) + g.row * 0.25, top(be + 1), col("บำนาญสะสม")));
    }
  }

  // ── รับประกันจ่าย 15 ปีแรก: in blue, a brace down the guaranteed pensions, clear of their
  // rings, the words in whatever empty rows the guarantee still has, an arrow over to the brace
  if (m.start >= 0) {
    const from = m.start;
    const to = m.guaranteeEnd;
    const ringed = new Set(notes.rings.filter((r) => r.column === "บำนาญ").map((r) => r.row));
    const right = Math.min(...rows.slice(from, to + 1).map((_, i) => figureLeft(from + i, "บำนาญ", ringed.has(from + i)))) - 6;
    const left = right - 20;
    const y = top(from) + 4;
    const h = top(to) + g.row - 4 - y;
    notes.blueStrokes.push(brace(left, y, h));
    const words = GUARANTEE_WORDS(rows[from].age, rows[to].age);
    const span = Math.ceil((words.length * LINE) / g.row);
    const centre = Math.round((from + to) / 2 - span / 2);
    // nearest the middle of the guarantee first, then outwards, never past its last year
    const want = Array.from({ length: to - from + 1 }, (_, i) => from + i)
      .filter((n) => n + span - 1 <= to)
      .sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre));
    const n = take(want, words.length, true);
    if (n !== undefined) {
      const labelTop = blockTop(n, words.length);
      const w = write(words, writeFrom, labelTop, "blue");
      const fromX = writeFrom + w + 8;
      const fromY = labelTop + (words.length * LINE) / 2;
      const tipY = y + h / 2;
      // to the brace's point; across any figures on the line between two rows
      const laneY = top(Math.round((tipY - top(0)) / g.row));
      notes.blueStrokes.push(...reach(fromX, fromY, left - 3, tipY, laneY, col("บำนาญ")));
    }
  }

  return notes;
}
