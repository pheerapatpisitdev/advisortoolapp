import { BLUE_PEN, CARD_PALETTE as P, QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import { arrow, brace, ring, underline, wobble } from "@/lib/global-saving-pens";
import { GS_TABLE_RATES, gsMoney, rateLabel } from "./gsaving";
import type { QuoteVideoFacts } from "./script";
import { ROW_H, TABLE, type Rect } from "./table-geo";
import { PEN_FACE } from "./table-pen";
import { LEAD, wordTimes, type TablePlan } from "./timeline";

/**
 * Global Savings 15/8's yearly table in the classic clip's third scene (owner, 2026-10-20, mockup
 * https://claude.ai/artifact/FkimdNb2v5u2mUJhdiQB2R, ก ก): where the other plans' แบบปกติ clips have
 * their value table, this one has the page's table with the index bonus at −1%, +3% and +5% side by
 * side, and on its last line everything received at each. The pen notes are the page's
 * (lib/global-saving-pens.ts): blue for what is guaranteed, red for the premiums and the bonus that
 * is not. They are drawn into the picture, as บำนาญ 95's are (pension-table.tsx), and the picture
 * walks down the window when the voice reaches "ครบ".
 */

/** the columns left to right: their header words and widths, 960 in all (the window's) */
export const GS_VIDEO_COLUMNS: { head: string; lines?: string[]; width: number }[] = [
  { head: "ปีที่", width: 70 },
  { head: "อายุ", width: 70 },
  { head: "เบี้ย/ปี", width: 160 },
  { head: "เงินคืน", width: 140 },
  ...GS_TABLE_RATES.map((r) => ({ head: `โบนัส ${rateLabel(r)}`, lines: ["โบนัส", rateLabel(r)], width: 130 })),
  { head: "คุ้มครอง", width: 130 },
];
const X = GS_VIDEO_COLUMNS.reduce<number[]>((xs, c, i) => [...xs, (xs[i] ?? 0) + c.width], [0]);
const COL = { year: 0, age: 1, premium: 2, payback: 3, bonus: 4, death: 7 } as const;
const CELL_PAD = 14;
const FONT = 26;
const PEN = 30;
const INK = 4;
/** the last line, everything received, a little taller than a year's */
const TOTAL_H = 62;
/** a figure's width in the table's 26px Plex, near enough to aim a pen at (pension-table.tsx's own) */
const fig = (s: string) => [...s].reduce((w, c) => w + (c === "," ? 7.1 : 15), 0);

interface Label { lines: string[]; left: number; top: number; ink: "red" | "blue"; size?: number }

/** the notes, in the picture's own pixels */
function gsNotes(f: QuoteVideoFacts): { red: string[]; blue: string[]; labels: Label[] } {
  const g = f.gsaving;
  if (!g) return { red: [], blue: [], labels: [] };
  const jit = wobble(7);
  const row = (n: number) => n * ROW_H;
  const last = g.rows.length - 1;
  const paidTo = g.payYears - 1;
  const red: string[] = [], blue: string[] = [], labels: Label[] = [];
  // red: the premiums, the same each year, stopping after the eighth
  red.push(brace(X[COL.premium] + 16, row(0) + 8, row(paidTo + 1) - 8));
  labels.push({ lines: ["เบี้ยเท่าเดิม", `จ่ายแค่ ${g.payYears} ปี`], left: X[COL.premium] + 6, top: row(paidTo + 1) + 2, ink: "red" });
  // blue: the yearly payback, to the year before maturity
  const pbTop = row(0) + 8, pbEnd = row(last) - 8;
  blue.push(brace(X[COL.payback] + 18, pbTop, pbEnd));
  const blueAt = row(5) + 6;
  labels.push({ lines: ["คืนทุกปี", `ปีละ ${gsMoney(g.payback)} (การันตี)`], left: X[COL.bonus] + 26, top: blueAt, ink: "blue" });
  blue.push(arrow(X[COL.bonus] + 20, blueAt + 30, X[COL.payback] + 8, (pbTop + pbEnd) / 2 + 4, -8));
  // red: the bonus, three examples, none guaranteed
  labels.push({ lines: [`โบนัส ${GS_TABLE_RATES.length} ตัวอย่าง`, "ไม่การันตี"], left: X[COL.bonus] + 26, top: row(1) + 6, ink: "red" });
  // blue: the maturity payout ringed, the words above it in the empty premium cells
  const mat = gsMoney(g.maturity);
  const mw = fig(mat);
  const mBox = { x: X[COL.payback + 1] - CELL_PAD - mw, y: row(last) + 8, w: mw, h: ROW_H - 16 };
  blue.push(ring(mBox, jit, 12, 6));
  const matAt = row(last - 3) + 4;
  labels.push({ lines: ["ครบสัญญา", "801% การันตี"], left: X[COL.premium] + 4, top: matAt, ink: "blue", size: 26 });
  blue.push(arrow(X[COL.premium] + 100, matAt + 74, mBox.x - 8, mBox.y + mBox.h / 2, -6));
  // red: the two bonus years underlined twice, from the first figure (the −1% column pays nothing)
  g.rows.forEach((r, n) => {
    if (!r.bonus) return;
    const from = r.bonus.findIndex((b) => b > 0);
    if (from < 0) return;
    const right = X[COL.bonus + r.bonus.length] - CELL_PAD;
    const left = X[COL.bonus + from + 1] - CELL_PAD - fig(gsMoney(r.bonus[from])) - 6;
    red.push(underline(left, right + 4, row(n) + ROW_H - 6, jit));
  });
  labels.push({ lines: ["โบนัส", "ไม่การันตี"], left: X[COL.bonus + 1] + 20, top: row(last - 3) + 4, ink: "red" });
  return { red, blue, labels };
}

/** The whole table as one tall picture, its notes drawn in; the header is on the scene's base (draw.tsx). */
export function gsTableImage(f: QuoteVideoFacts) {
  const g = f.gsaving;
  const rows = g?.rows ?? [];
  const height = rows.length * ROW_H + TOTAL_H;
  const notes = gsNotes(f);
  const cell = (i: number, text: string, style: React.CSSProperties = {}) => (
    <div key={i} style={{
      display: "flex", width: GS_VIDEO_COLUMNS[i].width, alignItems: "center",
      justifyContent: i < 2 ? "flex-start" : "flex-end", paddingLeft: CELL_PAD, paddingRight: CELL_PAD, ...style,
    }}>{text}</div>
  );
  const el = (
    <div style={{ display: "flex", flexDirection: "column", position: "relative", width: TABLE.w, height, background: C.paper, fontFamily: "Plex", fontSize: FONT, color: P.ink }}>
      {rows.map((r, n) => (
        <div key={r.year} style={{
          display: "flex", height: ROW_H, flexShrink: 0, alignItems: "stretch",
          background: n % 2 ? "rgba(2,33,98,0.045)" : C.paper,
          ...(r.year === g!.payYears ? { borderBottom: `3px solid ${P.figure}` } : {}),
        }}>
          {cell(0, String(r.year))}
          {cell(1, String(r.age))}
          {cell(2, r.premium ? gsMoney(r.premium) : "")}
          {cell(3, gsMoney(r.payback), r.year === g!.term ? { fontWeight: 600, color: P.figure } : {})}
          {GS_TABLE_RATES.map((_, k) => cell(4 + k, r.bonus ? (r.bonus[k] > 0 ? gsMoney(r.bonus[k]) : "—") : "", { fontWeight: 600, color: P.figure }))}
          {cell(7, gsMoney(r.death))}
        </div>
      ))}
      {g && (
        <div style={{ display: "flex", height: TOTAL_H, flexShrink: 0, alignItems: "stretch", background: P.figure, color: C.paper, fontWeight: 600 }}>
          <div style={{ display: "flex", width: X[COL.payback], alignItems: "center", paddingLeft: CELL_PAD }}>รวมรับทั้งหมด</div>
          {cell(3, gsMoney(g.guaranteed))}
          {g.totals.map((t, k) => cell(4 + k, gsMoney(t)))}
          {cell(7, "")}
        </div>
      )}
      <svg width={TABLE.w} height={height} viewBox={`0 0 ${TABLE.w} ${height}`} style={{ position: "absolute", left: 0, top: 0 }}>
        {notes.red.map((d, i) => <path key={`r${i}`} d={d} fill="none" stroke={P.pen} strokeWidth={INK} strokeLinecap="round" strokeLinejoin="round" />)}
        {notes.blue.map((d, i) => <path key={`b${i}`} d={d} fill="none" stroke={BLUE_PEN} strokeWidth={INK} strokeLinecap="round" strokeLinejoin="round" />)}
      </svg>
      {notes.labels.map((l) => (
        <div key={l.lines.join("|")} style={{
          display: "flex", flexDirection: "column", position: "absolute", left: l.left, top: l.top, whiteSpace: "nowrap",
          fontFamily: PEN_FACE, fontSize: l.size ?? PEN, lineHeight: 1.2, color: l.ink === "blue" ? BLUE_PEN : P.pen, transform: "rotate(-3deg)",
        }}>
          {l.lines.map((x) => <div key={x} style={{ display: "flex" }}>{x}</div>)}
        </div>
      ))}
    </div>
  );
  return { el, width: TABLE.w, height };
}

/**
 * Where the table stands as the third scene's line is said: on the first years at first, then
 * walked down to maturity and everything received when the voice says "ครบ". The notes are in
 * the picture already, so nothing is written in the overlay.
 */
export function gsTablePlan(f: QuoteVideoFacts, voice: string, voiceSec: number, win: Rect = TABLE): { plan: TablePlan; notes: [] } {
  const rows = f.gsaving?.rows ?? [];
  const max = Math.max(0, rows.length * ROW_H + TOTAL_H - win.h);
  const words = wordTimes(voice, voiceSec);
  const at = Math.max(0.8, words.find((w) => /^ครบ/.test(w.word))?.from ?? LEAD + 0.35 * voiceSec);
  const moves: TablePlan["moves"] = max > 4 ? [{ at, dur: Math.max(0.8, Math.min(2.6, 0.5 + max / 700)), to: Math.round(max) }] : [];
  return { plan: { moves, draws: [] }, notes: [] };
}
