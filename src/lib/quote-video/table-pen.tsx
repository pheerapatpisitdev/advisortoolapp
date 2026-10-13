import { penTextWidth } from "@/app/api/card/table/pen-notes";
import { BLUE_PEN, CARD_PALETTE as P } from "@/lib/card-theme";
import {
  arrow, beatCues, braceLeft, BREAK_EVEN_WORD, GAIN_WORDS, GROWTH_WORDS, lastPaying, noteProgress, penBeats, ring,
  STEADY_WORD, STOP_WORD, type PenBeat, type Stroke,
} from "./pen";
import type { QuoteVideoFacts } from "./script";
import { CELL_PAD, colX, ROW_H, TABLE, type Rect } from "./table-geo";
import { PEN_HANDOVER, type TablePlan } from "./timeline";

/**
 * The classic clip's pen notes (owner, 2026-10-13): the value-table card's red and blue marks,
 * placed on the clip's own table — its columns (table-geo.ts) — in the table's own pixels.
 *
 * The table moves and stops; at each stop one note is written (timeline.ts draws it out in the
 * overlay frames), and from then on it is a layer of its own that job.ts moves with the table.
 */

export const PEN_FACE = "Sriracha";
const SIZE = 36;
const LINE = 54;
const INK = 4;
const RED = P.pen;
const BLUE = BLUE_PEN;
/** how long each note takes to write, in seconds */
const WRITE: Record<PenBeat, number> = { steady: 1.3, stop: 1.4, growth: 1.6, breakEven: 1.6, gain: 1.4 };

interface Label {
  text: string;
  /** the label's left edge, or its right edge for one set against something on its right */
  x: number;
  anchor: "start" | "end";
  /** the label's top */
  y: number;
  tilt: number;
  ink: string;
  /** the yellow "จุดคุ้มทุน >" tag the card puts in the running-total column */
  chip?: true;
}

export interface TableNote {
  beat: PenBeat;
  strokes: { s: Stroke; ink: string; width: number }[];
  labels: Label[];
  /** how far down the table should stand while this note is written */
  to: number;
}

/** a figure's width in the table's 28px Plex, near enough to aim a pen at */
const fig = (s: string) => [...s].reduce((w, c) => w + (c === "," ? 7.6 : 16.1), 0);
const top = (n: number) => n * ROW_H;
const mid = (n: number) => n * ROW_H + ROW_H / 2;
/** an empty premium cell: the term is over (draw.tsx leaves "—" blank, as the card does) */
const blankPremium = (r: NonNullable<QuoteVideoFacts["rows"]>[number]) => r.due === "—" && r.paid === null;

/** Every note this table earns, placed — a note with no clear room for its words is left out, as on the card. */
/** `win`: the window the table is seen through — where each note wants the table to stand depends on its height */
export function tableNotes(f: QuoteVideoFacts, win: Rect = TABLE): TableNote[] {
  const rows = f.rows ?? [];
  const be = f.breakEven?.index ?? -1;
  const notes: TableNote[] = [];
  const red = (s: Stroke, width = INK) => ({ s, ink: RED, width });

  for (const beat of penBeats(f)) {
    if (beat === "steady") {
      let last = 0;
      while (last + 1 < rows.length && rows[last + 1].due === rows[0].due) last += 1;
      const right = colX(3) - CELL_PAD - fig(rows[0].due) - 14;
      const left = right - 22;
      const y = top(0) + 5;
      const h = top(last + 1) - 10;
      notes.push({
        beat, to: 0,
        strokes: [red(braceLeft(left, y, h))],
        labels: [{ text: STEADY_WORD, x: left - 10, anchor: "end", y: y + h / 2 - LINE / 2, tilt: -6, ink: RED }],
      });
    }
    if (beat === "stop") {
      const last = lastPaying(f);
      const at = Math.min(last + 3, rows.length - 1);
      const w = fig(String(rows[last].year));
      const cx = CELL_PAD + w / 2;
      const rx = w / 2 + 16;
      const ry = 22;
      const lx = colX(2) - 14;
      notes.push({
        beat, to: mid(last) - win.h * 0.45,
        strokes: [red(ring(cx, mid(last), rx, ry)), ...arrow([lx - 6, mid(at)], [100, mid(at) - 10], [cx + rx * 0.75, mid(last) + ry * 0.8]).map((s) => red(s))],
        labels: [{ text: STOP_WORD, x: lx, anchor: "start", y: mid(at) - LINE / 2, tilt: -4, ink: RED }],
      });
    }
    if (beat === "growth") {
      const widest = Math.max(...rows.slice(0, be).map((r) => fig(r.cash ?? "")));
      const left = colX(5) - CELL_PAD - widest - 22 - 22;
      const y = top(0) + 4;
      const h = top(be) - 4 - y;
      // the words go down to the years the running total has stopped, its cells empty; with no
      // such years (a plan paid to the end) the brace is drawn alone
      const stopped = rows.findIndex((r, i) => i < be && r.paid === null);
      const room = stopped < 0 ? 0 : top(be) - top(stopped);
      const words = GROWTH_WORDS.length * LINE;
      const wordsTop = room >= words ? top(stopped) + (room - words) / 2 : undefined;
      const fits = wordsTop !== undefined && Math.max(...GROWTH_WORDS.map((t) => penTextWidth(t, SIZE))) <= left - 10 - colX(3);
      notes.push({
        beat, to: fits ? wordsTop + words / 2 - win.h / 2 : top(be) - win.h * 0.6,
        strokes: [{ s: braceLeft(left, y, h), ink: BLUE, width: INK }],
        labels: fits ? GROWTH_WORDS.map((text, i) => ({ text, x: left - 10, anchor: "end" as const, y: wordsTop + i * LINE, tilt: -4, ink: BLUE })) : [],
      });
    }
    if (beat === "breakEven") {
      const cash = rows[be].cash ?? "";
      const cw = fig(cash);
      const cx = colX(5) - CELL_PAD - cw / 2;
      const ringLeft = cx - cw / 2 - 18;
      const strokes = [red(ring(cx, mid(be), cw / 2 + 18, 25), 5)];
      const labels: Label[] = [];
      // the tag and its arrow only where the running total has stopped, as on the card
      if (rows[be].paid === null) {
        const from = colX(4) - CELL_PAD - 75;
        strokes.unshift(...arrow([from, top(be) + 4], [(from + ringLeft) / 2 + 10, top(be) - ROW_H * 1.9], [ringLeft - 14, mid(be) - 8]).map((s) => red(s)));
        labels.push({ text: `${BREAK_EVEN_WORD} >`, x: colX(4) - CELL_PAD, anchor: "end", y: top(be) + 9, tilt: -2, ink: RED, chip: true });
      }
      notes.push({ beat, to: top(be) - win.h * 0.3, strokes, labels });
    }
    if (beat === "gain") {
      const after = be + 1;
      const span = Math.min(9, rows.length - after);
      const y = top(after) + 4;
      const h = top(after + span) - 4 - y;
      const words = GAIN_WORDS.length * LINE;
      const wordsTop = y + h / 2 - words / 2;
      const first = Math.max(0, Math.floor(wordsTop / ROW_H));
      const last = Math.min(rows.length - 1, Math.floor((wordsTop + words) / ROW_H));
      if (!rows.slice(first, last + 1).every(blankPremium)) continue;
      const widest = Math.max(...rows.slice(after, after + span).map((r) => fig(r.cash ?? "")));
      const left = colX(5) - CELL_PAD - widest - 22 - 22;
      notes.push({
        beat, to: y + h + 10 - win.h,
        strokes: [red(braceLeft(left, y, h))],
        labels: GAIN_WORDS.map((text, i) => ({ text, x: left - 10, anchor: "end" as const, y: wordsTop + i * LINE, tilt: -4, ink: RED })),
      });
    }
  }
  return notes;
}

/** how far the table can move: its foot at the window's foot */
const maxMove = (f: QuoteVideoFacts, win: Rect) => Math.max(0, (f.rows?.length ?? 0) * ROW_H - win.h);

/**
 * When the table moves and each note is written, from the value line's words. Each note waits for
 * its cue in the voice and for the note before it; the table moves first if the note is not in
 * view, then stands while the note is written. `at` on each note: where the table stood.
 */
export function tablePlan(f: QuoteVideoFacts, voice: string, voiceSec: number, win: Rect = TABLE): { plan: TablePlan; notes: (TableNote & { at: number })[] } {
  const notes = tableNotes(f, win);
  const max = maxMove(f, win);
  const clamp = (y: number) => Math.round(Math.max(0, Math.min(max, y)));
  const moves: TablePlan["moves"] = [];
  const draws: TablePlan["draws"] = [];
  const placed: (TableNote & { at: number })[] = [];
  let pos = 0;
  let free = 0;
  const cues = beatCues(notes.map((n) => n.beat), voice, voiceSec);
  notes.forEach((n, i) => {
    let start = Math.max(cues[i].at, free);
    // the gain brace comes into view below the break-even, never by moving back up
    const to = n.beat === "gain" ? Math.max(pos, clamp(n.to)) : clamp(n.to);
    if (Math.abs(to - pos) > 4) {
      const dur = Math.max(0.6, Math.min(2.6, 0.5 + Math.abs(to - pos) / 900));
      moves.push({ at: start, dur, to });
      start += dur + 0.1;
      pos = to;
    }
    draws.push({ at: start, dur: WRITE[n.beat] });
    placed.push({ ...n, at: pos });
    free = start + WRITE[n.beat] + PEN_HANDOVER + 0.05;
  });
  // a table with no notes still walks down to where the break-even (or its end) shows
  if (!notes.length) {
    const be = f.breakEven?.index;
    const to = clamp(be === undefined ? max : top(be) - win.h * 0.3);
    if (to > 0) moves.push({ at: 1.2, dur: Math.max(2, Math.min(6, voiceSec * 0.4)), to });
  }
  return { plan: { moves, draws }, notes: placed };
}

/**
 * One note on the table, `p` of the way written (1: finished), seen from `from` pixels down the
 * table for `height`: the whole table for a table layer, the window's view for an overlay frame
 * (a drawing the window's size rather than the table's: far quicker to draw, frame after frame).
 */
export function noteDrawing(n: TableNote, height: number, p = 1, from = 0) {
  const prog = noteProgress(n.strokes.map((x) => x.s), p);
  return (
    <div style={{ display: "flex", position: "relative", width: TABLE.w, height, overflow: "hidden" }}>
      <svg width={TABLE.w} height={height} viewBox={`0 ${from} ${TABLE.w} ${height}`} style={{ position: "absolute", left: 0, top: 0 }}>
        {n.strokes.map((x, i) => prog.strokes[i] > 0 && (
          <path
            key={i} d={x.s.d} fill="none" stroke={x.ink} strokeWidth={x.width} strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={`${x.s.len} ${x.s.len}`} strokeDashoffset={Math.round(x.s.len * (1 - prog.strokes[i]))}
          />
        ))}
      </svg>
      {prog.words > 0 && n.labels.map((l) => (
        <div
          key={l.text}
          style={{
            display: "flex", position: "absolute", top: l.y - from, whiteSpace: "nowrap", opacity: prog.words,
            ...(l.anchor === "start" ? { left: l.x } : { right: TABLE.w - l.x }),
            transform: `rotate(${l.tilt}deg)`,
            ...(l.chip
              ? { height: 34, padding: "0 12px", alignItems: "center", borderRadius: 6, background: P.highlighter, fontFamily: "Plex", fontWeight: 600, fontSize: 26, color: P.ink }
              : { fontFamily: PEN_FACE, fontSize: SIZE, lineHeight: 1.5, color: l.ink }),
          }}
        >
          {l.text}
        </div>
      ))}
    </div>
  );
}

/** a note being written, inside the table's window, the table standing `at` pixels down */
export function noteInWindow(n: TableNote & { at: number }, p: number, win: Rect = TABLE) {
  return (
    <div style={{ display: "flex", position: "absolute", left: win.x, top: win.y, width: win.w, height: win.h }}>
      {noteDrawing(n, win.h, p, n.at)}
    </div>
  );
}
