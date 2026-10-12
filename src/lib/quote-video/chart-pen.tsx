import { QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import type { chartPaths } from "./motion";
import {
  along, arrow, braceDown, BREAK_EVEN_WORD, lastPaying, noteProgress, penBeats, ring, STEADY_WORD, STOP_WORD,
  type PenBeat, type Stroke,
} from "./pen";
import type { QuoteVideoFacts } from "./script";
import { PEN_FACE } from "./table-pen";

/**
 * The Motion Graphic style's pen notes (owner, 2026-10-13): the value-table card's marks, drawn
 * on the line chart instead of a table — a brace under the years paid, the knee of the premium
 * line ringed, a blue arrow up the cash line before the break-even, the break-even dot ringed and
 * a red arrow on past it. Each is written as the voice reaches it (pen.ts beatCues).
 *
 * Laid out for the portrait chart (900×520) and scaled by `k` for the square and landscape ones.
 */

const PEN = C.motionPen;
const BLUE = C.motionBluePen;
const WHITE = C.paper;
/** the Motion words on the chart; the blue ones say what the card's three lines do, in two */
const GROWTH_LINES = ["เงินโตทุกปี", "เวนคืนเมื่อฉุกเฉิน"];
const GAIN_LINES = ["เบี้ยไม่ทิ้งเปล่า", "เก็บเป็นเงินสดหลังเกษียณได้"];
/** how long each note takes to write, in seconds (motion.tsx times them from the voice) */
export const CHART_WRITE: Record<PenBeat, number> = { steady: 1.3, stop: 1.4, growth: 1.6, breakEven: 1.4, gain: 1.6 };

/** room the notes take above the chart (the gain words) and below its axis (ages, brace, its word), at k = 1 */
export const NOTES_ABOVE = 150;
export const NOTES_BELOW = 165;

type Chart = ReturnType<typeof chartPaths>;
interface Note { beat: PenBeat; strokes: { s: Stroke; ink: string }[]; words: { text: string; left?: number; right?: number; top: number; ink: string; center?: true }[] }

function notes(f: QuoteVideoFacts, g: Chart, k: number): Note[] {
  const rows = f.rows ?? [];
  const n = rows.length;
  const be = f.breakEven?.index ?? -1;
  const out: Note[] = [];
  for (const beat of penBeats(f)) {
    if (beat === "steady") {
      let last = 0;
      while (last + 1 < n && rows[last + 1].due === rows[0].due) last += 1;
      const x0 = g.x(0);
      const x1 = g.x(last);
      out.push({
        beat,
        strokes: [{ s: braceDown(x0, g.h + 62 * k, Math.max(20, x1 - x0), 26 * k), ink: PEN }],
        words: [{ text: STEADY_WORD, left: (x0 + x1) / 2, top: g.h + 92 * k, ink: PEN, center: true }],
      });
    }
    if (beat === "stop") {
      const last = lastPaying(f);
      const kx = g.x(last);
      const ky = g.y(g.paidAt[last]);
      const left = Math.max(0, kx - 300 * k);
      const top = Math.max(-40 * k, ky - 190 * k);
      out.push({
        beat,
        strokes: [{ s: ring(kx, ky, 40 * k, 34 * k), ink: PEN }, ...arrow([left + 160 * k, top + 66 * k], [left + 200 * k, top + 90 * k], [kx - 30 * k, ky - 28 * k], 24 * k).map((s) => ({ s, ink: PEN }))],
        words: [{ text: `${STOP_WORD} อายุ ${f.lastPayAge ?? rows[last].age}`, left, top, ink: PEN }],
      });
    }
    if (beat === "growth") {
      const from = Math.floor(be * 0.35);
      const pts = Array.from({ length: Math.max(2, be - 1 - from) }, (_, j) => from + j).map((i) => [g.x(i) + 4 * k, g.y(g.cashAt[i]) + 44 * k] as [number, number]);
      const lineH = 56 * k;
      const top = Math.min(g.y(g.cashAt[be]) + 100 * k, g.h - lineH * 2 - 16 * k);
      out.push({
        beat,
        strokes: along(pts, 24 * k).map((s) => ({ s, ink: BLUE })),
        words: GROWTH_LINES.map((text, i) => ({ text, left: g.x(be) - 40 * k, top: top + i * lineH, ink: BLUE })),
      });
    }
    if (beat === "breakEven") {
      const bx = g.x(be);
      const by = g.y(g.cashAt[be]);
      out.push({ beat, strokes: [{ s: ring(bx, by, 52 * k, 44 * k), ink: WHITE }], words: [{ text: BREAK_EVEN_WORD, left: bx + 50 * k, top: by + 16 * k, ink: WHITE }] });
    }
    if (beat === "gain") {
      const pts = Array.from({ length: Math.max(2, n - 5 - (be + 2)) }, (_, j) => be + 2 + j).map((i) => [g.x(i) - 6 * k, g.y(g.cashAt[i]) - 40 * k] as [number, number]);
      out.push({
        beat,
        strokes: along(pts, 24 * k).map((s) => ({ s, ink: PEN })),
        words: GAIN_LINES.map((text, i) => ({ text, right: 0, top: -NOTES_ABOVE * k + i * 58 * k, ink: PEN })),
      });
    }
  }
  return out;
}

/** a few ages under the axis: the first year, the last one paid, the break-even, the last */
function ages(f: QuoteVideoFacts, g: Chart, k: number): { x: number; age: number }[] {
  const rows = f.rows ?? [];
  const at = [0, lastPaying(f), f.breakEven?.index ?? -1, rows.length - 1].filter((i) => i >= 0 && i < rows.length);
  const out: { x: number; age: number }[] = [];
  for (const i of [...new Set(at)].sort((p, q) => p - q)) {
    const x = g.x(i);
    if (out.length && x - out[out.length - 1].x < 80 * k) continue;
    out.push({ x, age: rows[i].age });
  }
  return out;
}

/**
 * The notes over a chart whose (0, 0) is this element's top-left, each as far along as `at` says
 * (motion.tsx's look at `pen_<beat>`; `ages` for the ages under the axis).
 */
export function chartNotes(f: QuoteVideoFacts, g: Chart, k: number, at: (name: string) => { p: number; opacity: number }) {
  const pad = 400 * k;
  const all = notes(f, g, k);
  const size = Math.round(44 * k);
  return (
    <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: g.w, height: g.h }}>
      <svg width={g.w + pad * 2} height={g.h + pad * 2} viewBox={`${-pad} ${-pad} ${g.w + pad * 2} ${g.h + pad * 2}`} style={{ position: "absolute", left: -pad, top: -pad }}>
        {all.flatMap((note) => {
          const p = at(`pen_${note.beat}`).p;
          if (p <= 0) return [];
          const prog = noteProgress(note.strokes.map((x) => x.s), p);
          return note.strokes.map((x, i) => prog.strokes[i] > 0 && (
            <path
              key={`${note.beat}${i}`} d={x.s.d} fill="none" stroke={x.ink} strokeWidth={Math.max(3, Math.round(6 * k))} strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={`${x.s.len} ${x.s.len}`} strokeDashoffset={Math.round(x.s.len * (1 - prog.strokes[i]))}
            />
          ));
        })}
      </svg>
      {ages(f, g, k).map((x) => (
        <div key={x.age} style={{ display: "flex", position: "absolute", left: x.x - 60 * k, width: 120 * k, top: g.h + 12 * k, justifyContent: "center", fontSize: Math.round(32 * k), color: WHITE, opacity: 0.75 * at("ages").opacity }}>{String(x.age)}</div>
      ))}
      {all.flatMap((note) => {
        const p = at(`pen_${note.beat}`).p;
        const o = noteProgress(note.strokes.map((x) => x.s), p).words;
        if (o <= 0) return [];
        return note.words.map((w) => (
          <div
            key={`${note.beat}${w.text}`}
            style={{
              display: "flex", position: "absolute", top: w.top, whiteSpace: "nowrap", opacity: o,
              ...(w.right !== undefined ? { right: w.right } : w.center ? { left: (w.left ?? 0) - 300 * k, width: 600 * k, justifyContent: "center" } : { left: w.left }),
              fontFamily: PEN_FACE, fontSize: size, lineHeight: 1.5, color: w.ink, transform: `rotate(${w.center ? -3 : -4}deg)`,
            }}
          >
            {w.text}
          </div>
        ));
      })}
    </div>
  );
}
