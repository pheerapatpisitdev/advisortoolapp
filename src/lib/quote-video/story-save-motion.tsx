import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { Fragment } from "react";
import { a, abs, box, El, look, type Anim } from "./motion";
import type { Dev } from "./story-health-motion";
import { n, SAVE_WORDS as SW, type SaveShow } from "./story-knowledge";
import { geoOf, Title, type Rect } from "./story-knowledge-motion";
import { Card, fitWrap, handWidth, wrapHand } from "./story-life-motion";
import { line, paper } from "./story-motion";
import type { VideoSize } from "./timeline";

/**
 * ออมเงินและเกษียณ (device round 4, spec 2026-11-15-devices-saving-design.md): the four saving devices' timing, which
 * kspec hands on. savejar fills in four steps, paidgot grows its two bars in turn, pricerise shows the baskets and
 * fades two goods, pensionsteps raises one step for each row and draws the cost-of-living line over them. The drawers
 * of savejar and paidgot in the story looks (paper, warm, line) are below; pricerise and pensionsteps come with Task 3,
 * the info route with Task 4.
 */
export function saveSpec(show: SaveShow): Record<string, Anim> {
  const s: Record<string, Anim> = { title: a(0.2, "up") };
  switch (show.layout) {
    case "savejar":
      // the jar; it fills in four steps, each marked with its year; the card under it
      s.set = a(0.5, "pop");
      for (let i = 0; i < 4; i++) s[`fill${i}`] = a(1.0 + i * 0.5, "grow", 0.45);
      s.card = a(3.1, "pop");
      break;
    case "paidgot":
      // two bars to one scale, in turn: what was paid, then what comes back
      s.paid = a(0.6, "grow", 0.9);
      s.got = a(1.7, "grow", 0.9);
      s.foot = a(2.8, "fade");
      break;
    case "pricerise":
      // today's basket, the same banknote later, two goods fade out, the red line
      s.today = a(0.5, "pop");
      s.later = a(1.2, "pop");
      s.fade = a(2.0, "fade", 0.8);
      s.line = a(2.9, "pop");
      break;
    case "pensionsteps":
      // one step at a time, then the line for the cost of living drawn over them
      s.set = a(0.4, "fade", 0.3);
      show.rows.forEach((_, i) => { s[`step${i}`] = a(0.6 + i * 0.45, "grow", 0.4); });
      s.living = a(0.9 + show.rows.length * 0.45, "stroke", 1.0);
      s.caption = a(1.0 + show.rows.length * 0.45, "fade");
      break;
  }
  const end = Math.max(...Object.values(s).map((x) => x.at + x.dur));
  s.note = a(end + 0.2, "fade");
  return s;
}

const C = STORY_CLIP_COLORS;
const HAND = "Mali";
/** the blue of what was paid, the green of the pension that comes back (the bars, the figures over them, the card's amount) */
const BLUE = C.plotPen;
const GREEN = C.green;

/**
 * Where a saving device stands in the frame: the device's room and the frame's text size (the story looks'), or the
 * info route's room under its own title (Task 4).
 */
export interface SavePlace { room: Rect; text: number }
const paperPlace = (size: VideoSize): SavePlace => ({ room: geoOf(size).dev, text: geoOf(size).text });

/** Thai marks set above or below a letter: they take no width of their own */
const MARK = /[ัิ-ฺ็-๎]/;
/**
 * a figure's width in the handwriting face at `size`, a little over: 0.6 em a digit, comma or dash, 0.3 a space,
 * 0.7 a Thai letter that takes width (its marks none)
 */
export const figWidth = (text: string, size: number) => Math.ceil([...text].reduce((w, ch) => w + size * (/[0-9,–-]/.test(ch) ? 0.6 : ch === " " ? 0.3 : MARK.test(ch) ? 0 : 0.7), 0));
/** the largest size up to `cap` at which `text` is no wider than `room` */
export function fitFig(text: string, room: number, cap: number): number {
  for (let size = Math.floor(cap); size > 8; size -= 1) if (figWidth(text, size) <= room) return size;
  return 8;
}
const baht = (v: number) => `${n(v)} บาท`;

/** the note under a saving device's picture: as many lines as it needs (broken at a space) in the largest size that fits two */
function noteGeo(note: string | undefined, room: number, text: number) {
  if (!note) return null;
  const cap = Math.round(text * 1.1);
  const size = fitWrap([note], room, Math.round(cap * 1.3 * 2) + 1, cap);
  const lines = wrapHand(note, size, room);
  return { size, lines, h: Math.round(lines.length * size * 1.3) };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (x: number) => clamp(x, 0, 1);

/* ---------- savejar: กระปุกโตทุกปี ---------- */

/** the jar's own sheet, in its units: 240 wide, 300 tall; its inside runs from y = 104 (full) to y = 284 (empty) */
export const JAR = { w: 240, h: 300, top: 104, floor: 284, left: 44, right: 196 };
/** the sheet's y of the mark for step `i` (0..3): the level the jar stands at when that step is done */
export const jarTick = (i: number) => JAR.floor - ((i + 1) / 4) * (JAR.floor - JAR.top);

/**
 * ปีที่ N for each of the four steps, N = round(years × k / 4); the text is "" when years is absent. A plan so short
 * that a step would say 0 or repeat the year before leaves that step's mark without a number.
 */
export function jarMarks(years?: number): { k: number; text: string }[] {
  let last = 0;
  return [1, 2, 3, 4].map((k) => {
    if (years === undefined) return { k, text: "" };
    const year = Math.max(1, Math.round((years * k) / 4));
    if (year === last) return { k, text: "" };
    last = year;
    return { k, text: `${SW.year} ${year}` };
  });
}

/** how full the jar is at t (0 to 1, in four steps) and which steps' marks have begun */
export function jarAt(s: Record<string, Anim>, t: number) {
  const p = [0, 1, 2, 3].map((i) => look(s[`fill${i}`], t).p);
  return { level: p.reduce((x, y) => x + y, 0) / 4, p, marks: p.map((x) => x > 0) };
}

/** where a jar stands: the jar, its marks' words beside it, the card of what was sent, and the note under */
export function jarGeo(size: VideoSize, show: SaveShow<"savejar">, place: SavePlace = paperPlace(size)) {
  const r = place.room;
  const text = place.text;
  const note = noteGeo(show.note, r.w - 40, text);
  const noteBlock = note ? note.h + Math.round(text * 0.6) : 0;
  const body = { x: r.x, y: r.y, w: r.w, h: r.h - noteBlock };
  const side = size !== "portrait";
  const pad = Math.round(text * 0.55);
  const cardW = side ? clamp(Math.round(body.w * 0.42), 380, 560) : Math.min(Math.round(body.w * 0.8), 720);
  const inner = cardW - pad * 2 - 8;
  // the card: the years (blue amount under it); without paid only the years; without both, the plan's one habit
  const lines: { text: string; size: number; color: string }[] = [];
  if (show.years !== undefined) lines.push({ text: `${SW.sent} ${show.years} ${SW.years}`, size: fitFig(`${SW.sent} ${show.years} ${SW.years}`, inner, Math.round(text * 1.3)), color: C.ink });
  else if (show.paid !== undefined) lines.push({ text: SW.sent, size: Math.round(text * 1.3), color: C.ink });
  if (show.paid !== undefined) lines.push({ text: baht(show.paid), size: fitFig(baht(show.paid), inner, Math.round(text * 2)), color: BLUE });
  if (!lines.length) lines.push({ text: SW.each, size: fitFig(SW.each, inner, Math.round(text * 1.6)), color: C.ink });
  const cardH = Math.round(lines.reduce((h, l) => h + l.size * 1.3, 0)) + pad * 2 + 8;
  // the marks' words
  const marks = jarMarks(show.years);
  const labelSize = Math.round(text * 0.95);
  const labelW = show.years === undefined ? 0 : Math.ceil(Math.max(...marks.map((m) => handWidth(m.text, labelSize))));
  const extra = labelW ? labelW + 8 : 0;
  const gap = side ? text : Math.round(text * 0.6);
  let k: number;
  let jarX: number;
  let jarY: number;
  let card: Rect;
  if (!side) {
    const pic = { x: body.x, y: body.y, w: body.w, h: body.h - cardH - gap };
    k = Math.min((pic.w - extra) / JAR.w, pic.h / JAR.h);
    jarX = pic.x + Math.round((pic.w - JAR.w * k - extra) / 2);
    jarY = pic.y + Math.round((pic.h - JAR.h * k) / 2);
    card = { x: body.x + Math.round((body.w - cardW) / 2), y: body.y + body.h - cardH, w: cardW, h: cardH };
  } else {
    k = Math.min(body.h / JAR.h, (body.w - cardW - gap - extra) / JAR.w);
    const groupW = Math.round(JAR.w * k) + extra;
    const x0 = body.x + Math.round((body.w - groupW - gap - cardW) / 2);
    jarX = x0;
    jarY = body.y + Math.round((body.h - JAR.h * k) / 2);
    card = { x: x0 + groupW + gap, y: body.y + Math.round((body.h - cardH) / 2), w: cardW, h: cardH };
  }
  const jar = { x: jarX, y: jarY, w: Math.round(JAR.w * k), h: Math.round(JAR.h * k), k };
  const labels = labelW ? { x: jar.x + jar.w + 8, w: labelW, size: labelSize, ys: [0, 1, 2, 3].map((i) => Math.round(jar.y + jarTick(i) * k)), texts: marks.map((m) => m.text) } : null;
  return {
    jar, labels, marks,
    card: { ...card, pad, inner, lines },
    note: note ? { x: r.x, y: r.y + r.h - note.h, w: r.w, ...note } : null,
  };
}

/** the jar and its gold lid on its sheet, filled to `level` (0 to 1), a mark at each step reached */
function jarSvg(level: number, marks: boolean[]) {
  const yTop = JAR.floor - level * (JAR.floor - JAR.top);
  const body = `M40 100 Q40 76 64 76 H176 Q200 76 200 100 V256 Q200 288 168 288 H72 Q40 288 40 256 Z`;
  const h = JAR.floor - yTop;
  const filled = level <= 0.001 ? null : yTop <= 258
    ? <path d={`M${JAR.left} ${yTop.toFixed(1)} H${JAR.right} V258 Q${JAR.right} ${JAR.floor} 168 ${JAR.floor} H72 Q${JAR.left} ${JAR.floor} ${JAR.left} 258 Z`} fill={C.blanket} />
    : <rect x={JAR.left} y={yTop.toFixed(1)} width={JAR.right - JAR.left} height={h.toFixed(1)} rx={Math.min(14, h / 2).toFixed(1)} fill={C.blanket} />;
  // three coins resting on the surface
  const coins = level > 0.05 && yTop < 270 ? [[78, 0], [118, 5], [158, -3]].map(([x, dy]) => <ellipse key={x} cx={x} cy={(yTop + 4 + dy).toFixed(1)} rx={17} ry={6.5} fill={C.coin} stroke={C.ink} strokeWidth={2.4} />) : null;
  return (
    <>
      <path d={body} fill={C.jar} stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
      {filled}
      {coins}
      <path d={body} fill="none" stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
      <rect x={66} y={54} width={108} height={24} fill={C.jar} stroke={C.ink} strokeWidth={4} />
      <rect x={56} y={22} width={128} height={34} rx={9} fill={C.coin} stroke={C.ink} strokeWidth={4} />
      <path d="M70 32 H128" stroke={C.white} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
      <path d="M54 110 V180" stroke={C.white} strokeWidth={5} strokeLinecap="round" opacity={0.7} />
      {marks.map((on, i) => (on ? <path key={i} d={`M206 ${jarTick(i)} H234`} stroke={C.ink} strokeWidth={4} strokeLinecap="round" /> : null))}
    </>
  );
}

/** กระปุกโตทุกปี: the jar with its gold lid fills in four steps, each marked with its year; the card of what was sent under or beside it */
function SaveJar({ d, show }: { d: Dev; show: SaveShow<"savejar"> }) {
  const { c, t, s, g, w, ink } = d;
  const geo = jarGeo(c.size, show);
  const { level, marks } = jarAt(s, t);
  const set = look(s.set, t);
  const j = geo.jar;
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      <div data-part="jar" style={abs({ left: j.x, top: j.y, width: j.w, height: j.h, opacity: set.opacity, ...(set.transform ? { transform: set.transform } : {}) })}>
        <svg width={j.w} height={j.h} viewBox={`0 0 ${JAR.w} ${JAR.h}`}>{jarSvg(level, marks)}</svg>
      </div>
      {geo.labels ? geo.labels.texts.map((text, i) => {
        const l = geo.labels!;
        const p = look(s[`fill${i}`], t).p;
        return text ? (
          <div key={i} data-part="mark" style={abs({ left: l.x, top: l.ys[i] - Math.round(l.size * 0.65), width: l.w, fontFamily: HAND, fontSize: l.size, fontWeight: 600, lineHeight: 1.3, color: ink, opacity: clamp01(p * 3) })}>{text}</div>
        ) : null;
      }) : null}
      <div data-part="card" style={abs({ left: geo.card.x, top: geo.card.y, width: geo.card.w, height: geo.card.h, flexDirection: "column", justifyContent: "center" })}>
        <Card an={s.card} t={t} tilt={-0.8} pad={geo.card.pad} w={geo.card.w}>
          <div style={box({ flexDirection: "column", alignItems: "center" })}>
            {geo.card.lines.map((l, i) => <div key={i} style={box({ fontSize: l.size, fontWeight: i === 0 && geo.card.lines.length > 1 ? 600 : 700, lineHeight: 1.3, color: l.color })}>{l.text}</div>)}
          </div>
        </Card>
      </div>
      <NoteLines n={geo.note} an={s.note} t={t} ink={ink} />
    </>
  );
}

/** the note under a saving device, as plain lines of hand, fading in last */
function NoteLines({ n: note, an, t, ink }: { n: { x: number; y: number; w: number; h: number; size: number; lines: string[] } | null; an?: Anim; t: number; ink: string }) {
  if (!note) return null;
  return (
    <El an={an} t={t} style={{ position: "absolute", left: note.x, top: note.y, width: note.w, height: note.h, flexDirection: "column", alignItems: "center", fontFamily: HAND, color: ink }}>
      {note.lines.map((x, i) => <div key={i} style={box({ fontSize: note.size, fontWeight: 600, lineHeight: 1.3 })}>{x}</div>)}
    </El>
  );
}

/* ---------- paidgot: ส่งเท่าไร ได้คืนเท่าไร ---------- */

/** a bar's "อายุ a–b": only when both of its ages are given */
const ageText = (from?: number, to?: number) => (from !== undefined && to !== undefined ? `${SW.age} ${from}–${to}` : undefined);

/** where paidgot's two columns stand: each bar to one scale, its amount above, its label and ages under, the line under both */
export function paidGeo(size: VideoSize, show: SaveShow<"paidgot">, place: SavePlace = paperPlace(size)) {
  const r = place.room;
  const text = place.text;
  const note = noteGeo(show.note, r.w - 40, text);
  const noteBlock = note ? note.h + Math.round(text * 0.6) : 0;
  let footSize = Math.round(text * 0.85);
  while (footSize > 8 && handWidth(SW.foot, footSize) > r.w - 40) footSize -= 1;
  const footH = Math.round(footSize * 1.4);
  const gapC = 16;
  const slot = Math.min(Math.floor((r.w - gapC) / 2), 520);
  const x0 = r.x + Math.round((r.w - slot * 2 - gapC) / 2);
  const barW = Math.min(Math.round(slot * 0.5), 240);
  const figs = [baht(show.paid), baht(show.got)];
  const figSize = Math.min(...figs.map((f) => fitFig(f, slot - 4, Math.round(text * 1.6))));
  const labelSize = Math.round(text * 1.05);
  const ageSize = Math.round(text * 0.85);
  const ages = [ageText(show.payFrom, show.payTo), ageText(show.getFrom, show.getTo)];
  const headH = Math.round(figSize * 1.35);
  const labelH = Math.round(labelSize * 1.35) + (ages.some(Boolean) ? Math.round(ageSize * 1.35) : 0);
  const gap = Math.round(text * 0.5);
  const maxBarH = r.h - noteBlock - footH - Math.round(gap * 2.5) - labelH - headH;
  const base = r.y + headH + maxBarH;
  const more = Math.max(show.paid, show.got, 1);
  const labels = [SW.sent, SW.got];
  const colors = [BLUE, GREEN];
  const bars = [show.paid, show.got].map((v, i) => ({
    key: i === 0 ? "paid" : "got",
    x: x0 + i * (slot + gapC) + Math.round((slot - barW) / 2),
    w: barW,
    h: Math.max(8, Math.round((maxBarH * v) / more)),
    col: { x: x0 + i * (slot + gapC), w: slot },
    fig: figs[i], label: labels[i], age: ages[i], color: colors[i],
  }));
  const foot = { x: r.x, y: base + labelH + Math.round(gap * 1.5), w: r.w };
  return {
    bars, maxBarH, figSize, labelSize, ageSize, footSize, headH, base, foot,
    top: r.y, bottom: foot.y + footH,
    note: note ? { x: r.x, y: r.y + r.h - note.h, w: r.w, ...note } : null,
  };
}

/** ส่งเท่าไร ได้คืนเท่าไร: the two bars to one scale grow in turn, each with its baht above, its name and ages under */
function PaidGot({ d, show }: { d: Dev; show: SaveShow<"paidgot"> }) {
  const { c, t, s, g, w, ink } = d;
  const geo = paidGeo(c.size, show);
  const first = geo.bars[0].col.x;
  const last = geo.bars[1].col.x + geo.bars[1].col.w;
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      {geo.bars.map((b) => {
        const p = look(s[b.key], t).p;
        const h = Math.round(b.h * p);
        return (
          <Fragment key={b.key}>
            <div style={abs({ left: b.col.x, top: geo.base - h - geo.headH, width: b.col.w, height: geo.headH, justifyContent: "center", alignItems: "flex-end", fontFamily: HAND, fontSize: geo.figSize, fontWeight: 700, lineHeight: 1.2, color: b.color, opacity: p > 0 ? 1 : 0 })}>{b.fig}</div>
            <div style={abs({ left: b.x, top: geo.base - h, width: b.w, height: h, background: b.color, border: `4px solid ${C.ink}`, borderBottom: "none", borderRadius: "10px 10px 0 0", opacity: p > 0 ? 1 : 0 })} />
            <div style={abs({ left: b.col.x, top: geo.base + Math.round(geo.labelSize * 0.2), width: b.col.w, justifyContent: "center", fontFamily: HAND, fontSize: geo.labelSize, fontWeight: 700, lineHeight: 1.2, color: b.color, opacity: p > 0 ? 1 : 0 })}>{b.label}</div>
            {b.age ? <div style={abs({ left: b.col.x, top: geo.base + Math.round(geo.labelSize * 1.5), width: b.col.w, justifyContent: "center", fontFamily: HAND, fontSize: geo.ageSize, fontWeight: 600, lineHeight: 1.2, color: ink, opacity: p > 0 ? 0.9 : 0 })}>{b.age}</div> : null}
          </Fragment>
        );
      })}
      <div style={abs({ left: first - 16, top: geo.base - 3, width: last - first + 32, height: 6, background: ink, borderRadius: 3 })} />
      <El an={s.foot} t={t} style={{ position: "absolute", left: geo.foot.x, top: geo.foot.y, width: geo.foot.w, justifyContent: "center", fontFamily: HAND, fontSize: geo.footSize, fontWeight: 600, lineHeight: 1.3, color: ink }}>{SW.foot}</El>
      <NoteLines n={geo.note} an={s.note} t={t} ink={ink} />
    </>
  );
}

/** a saving device's frame body at scene time t (showBody hands it the frame, the movements, where things stand, the ink); pricerise and pensionsteps draw nothing yet (Task 3) */
export function saveBody(show: SaveShow, d: Dev) {
  switch (show.layout) {
    case "savejar": return <SaveJar d={d} show={show} />;
    case "paidgot": return <PaidGot d={d} show={show} />;
    default: return null;
  }
}
