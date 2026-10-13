import { BLUE_PEN, CARD_PALETTE as P, QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import { loopUri } from "@/lib/highlighter";
import { PENSION_COLUMNS, pensionCells, pensionPenNotes, pensionRings, type PensionColumn } from "@/lib/pension-pen-notes";
import type { QuoteVideoFacts } from "./script";
import { ROW_H, TABLE, type Rect } from "./table-geo";
import { PEN_FACE } from "./table-pen";
import { LEAD, wordTimes, type TablePlan } from "./timeline";

/**
 * บำนาญ 95's yearly table in the classic clip's value scene (owner, 2026-10-13): the /bumnan95
 * table with the same pen notes (src/lib/pension-pen-notes.ts — เบี้ยคงที่, หยุดส่งเบี้ย, เริ่มรับ
 * บำนาญ, the fifteen guaranteed years in blue, each step up), drawn into the picture, and the
 * picture walked down the window as the voice goes: from the premiums to the first pension and
 * its guarantee, then to 95.
 *
 * The window is the other plans' (table-geo.ts), 960 wide, so the page's eight columns are cut to
 * the six a phone can read at the clip's size: the policy year and the death benefit are left out.
 * The notes never write in either.
 */

/** each column's width in the clip; nought for a column it leaves out */
const WIDTHS: Record<PensionColumn, number> = {
  // the premium column wide enough for the เบี้ยคงที่ brace and its words beside the figures, as on the page
  อายุ: 66, ปีที่: 0, เบี้ย: 230, เบี้ยสะสม: 168, มูลค่าเวนคืน: 160, บำนาญ: 156, บำนาญสะสม: 180, คุ้มครองชีวิต: 0,
};
const HEAD: Partial<Record<PensionColumn, string>> = {
  อายุ: "อายุ", เบี้ย: "เบี้ย/ปี", เบี้ยสะสม: "เบี้ยสะสม", มูลค่าเวนคืน: "เวนคืนได้", บำนาญ: "บำนาญ/ปี", บำนาญสะสม: "บำนาญสะสม",
};
/** the columns the clip shows, left to right, with their header words */
export const PENSION_VIDEO_COLUMNS = PENSION_COLUMNS.filter((c) => WIDTHS[c] > 0).map((c) => ({ name: c, width: WIDTHS[c], head: HEAD[c] ?? c }));

const CELL_PAD = 14;
/** the room a ring takes beside its figure */
const RING = 15;
/** how far a ring in the first column reaches left of its figure: short of the table's edge */
const LEFT_RING = CELL_PAD - 3;
const FONT = 26;
/** the hand's size: larger than the page's 24, for the clip's 26px figures */
const PEN = 30;
const INK = 4;
/** a figure's width in the table's 26px Plex, near enough to aim a pen at (table-pen.tsx's 28px estimate, scaled) */
const fig = (s: string) => [...s].reduce((w, c) => w + (c === "," ? 7.1 : 15), 0);

/** The whole table as one tall picture, its notes drawn in; the header is on the scene's base (draw.tsx). */
export function pensionTableImage(f: QuoteVideoFacts) {
  const p = f.pension;
  const rows = p?.years ?? [];
  const height = Math.max(ROW_H, rows.length * ROW_H);
  const notes = p
    ? pensionPenNotes(rows, p.sumAssured, {
      widths: PENSION_COLUMNS.map((c) => WIDTHS[c]), caption: 0, head: 0, row: ROW_H, cellPad: CELL_PAD, measure: fig, penSize: PEN,
      // the one ring the notes aim at here is the อายุ one, standing past its figure by the rest of its padding
      ringOver: 2 * RING - LEFT_RING,
    }, RING / 2)
    : { rings: [], strokes: [], blueStrokes: [], labels: [] };
  // the clip's table has no ปีที่, so the last paying year is ringed at its อายุ
  const rings = pensionRings(rows, "อายุ");
  const ringed = (n: number, c: PensionColumn) => rings.some((g) => g.row === n && g.column === c);
  const el = (
    <div style={{ display: "flex", flexDirection: "column", position: "relative", width: TABLE.w, height, background: C.paper, fontFamily: "Plex", fontSize: FONT, color: P.ink }}>
      {rows.map((y, n) => {
        const cells = pensionCells(y);
        return (
          <div key={y.age} style={{ display: "flex", height: ROW_H, flexShrink: 0, alignItems: "center", background: n % 2 ? "rgba(2,33,98,0.045)" : C.paper }}>
            {PENSION_VIDEO_COLUMNS.map((c, i) => (
              <div
                key={c.name}
                style={{
                  display: "flex", width: c.width, height: ROW_H, alignItems: "center",
                  justifyContent: i === 0 ? "flex-start" : "flex-end", paddingLeft: CELL_PAD, paddingRight: CELL_PAD,
                }}
              >
                {ringed(n, c.name) ? (
                  // pulled back by its own padding, so the ringed figure stays in line with the column
                  <div style={{ display: "flex", position: "relative", padding: `4px ${RING}px`, ...(i === 0 ? { marginLeft: -LEFT_RING } : { marginRight: -RING }) }}>
                    <div style={{ position: "absolute", top: -4, bottom: -4, left: 0, right: 0, backgroundImage: loopUri(P.pen), backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" }} />
                    {cells[c.name]}
                  </div>
                ) : cells[c.name]}
              </div>
            ))}
          </div>
        );
      })}
      <svg width={TABLE.w} height={height} viewBox={`0 0 ${TABLE.w} ${height}`} style={{ position: "absolute", left: 0, top: 0 }}>
        {notes.strokes.map((d, i) => <path key={`r${i}`} d={d} fill="none" stroke={P.pen} strokeWidth={INK} strokeLinecap="round" strokeLinejoin="round" />)}
        {notes.blueStrokes.map((d, i) => <path key={`b${i}`} d={d} fill="none" stroke={BLUE_PEN} strokeWidth={INK} strokeLinecap="round" strokeLinejoin="round" />)}
      </svg>
      {notes.labels.map((l, i) => (
        <div
          key={`${i}:${l.text}`}
          style={{
            display: "flex", position: "absolute", top: l.top, whiteSpace: "nowrap",
            ...(l.left !== undefined ? { left: l.left } : { right: l.right }),
            fontFamily: PEN_FACE, fontSize: l.size, lineHeight: 1.5,
            color: l.ink === "blue" ? BLUE_PEN : P.pen, transform: `rotate(${l.tilt}deg)`,
          }}
        >
          {l.text}
        </div>
      ))}
    </div>
  );
  return { el, width: TABLE.w, height };
}

/**
 * Where the table stands as the value line is said: still on the premiums at first, then down to
 * the last premiums, the first pension and its guarantee when the voice says "15", then to 95
 * when it says "รวม". The notes are in the picture already, so nothing is written in the overlay.
 */
export function pensionTablePlan(f: QuoteVideoFacts, voice: string, voiceSec: number, win: Rect = TABLE): { plan: TablePlan; notes: [] } {
  const rows = f.pension?.years ?? [];
  const max = Math.max(0, rows.length * ROW_H - win.h);
  const clamp = (y: number) => Math.round(Math.max(0, Math.min(max, y)));
  const words = wordTimes(voice, voiceSec);
  const cue = (re: RegExp, share: number) => words.find((w) => re.test(w.word))?.from ?? LEAD + share * voiceSec;
  const start = rows.findIndex((r) => r.pension > 0);
  const moves: TablePlan["moves"] = [];
  let pos = 0;
  let free = 0.6;
  const go = (at: number, to: number) => {
    const y = clamp(to);
    if (Math.abs(y - pos) <= 4) return;
    const begin = Math.max(at, free);
    const dur = Math.max(0.8, Math.min(2.6, 0.5 + Math.abs(y - pos) / 700));
    moves.push({ at: begin, dur, to: y });
    pos = y;
    free = begin + dur + 0.3;
  };
  if (start >= 0) go(cue(/^15$|รับประกัน/, 0.1), (start - 3) * ROW_H);
  go(cue(/^รวม/, 0.7), max);
  return { plan: { moves, draws: [] }, notes: [] };
}
