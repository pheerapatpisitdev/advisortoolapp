import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { Fragment } from "react";
import { a, abs, box, El, look, type Anim } from "./motion";
import type { Dev } from "./story-health-motion";
import { n, SAVE_DEFAULTS, SAVE_WORDS as SW, type SaveShow } from "./story-knowledge";
import { geoOf, Title, type Rect } from "./story-knowledge-motion";
import { Card, fitWrap, handWidth, wrapHand } from "./story-life-motion";
import { line, paper } from "./story-motion";
import type { VideoSize } from "./timeline";

/**
 * ออมเงินและเกษียณ (device round 4, spec 2026-11-15-devices-saving-design.md): the four saving devices' timing, which
 * kspec hands on. savejar fills in four steps, paidgot grows its two bars in turn, pricerise shows the baskets and
 * fades two goods, pensionsteps raises one step for each row and draws the cost-of-living line over them. The drawers
 * of the four in the story looks (paper, warm, line) are below; the info route comes with Task 4.
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
const baht0 = (v: number) => n(v);

/** the note under a saving device's picture: as many lines as it needs (broken at a space) in the largest size that fits two */
function noteGeo(note: string | undefined, room: number, text: number, grow = 1.1) {
  if (!note) return null;
  const cap = Math.round(text * grow);
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


/* ---------- pricerise: เงินเท่าเดิม ซื้อได้น้อยลง ---------- */

/** a basket's own sheet, in its units: 240 wide, 280 tall; the goods stand in the basket (y 64..124), the banknote under it */
export const PRICE = { w: 240, h: 280 };
/** where the five goods stand in a basket (centre x); the last two are the ones that fade out of the later basket */
const GOODS_X = [44, 82, 120, 158, 196];

/** how many of each basket's pieces show at t: today's and later's baskets (0 to 1, as they pop in), and how much of the two extra goods is left in the later one (1 to 0) */
export function priceAt(s: Record<string, Anim>, t: number) {
  return { today: look(s.today, t).p, later: look(s.later, t).p, extra: s.fade ? 1 - look(s.fade, t).p : 1 };
}

/** where the two baskets stand, side by side with their words over them, the red line under both and the note under that */
export function priceGeo(size: VideoSize, show: SaveShow<"pricerise">, place: SavePlace = paperPlace(size)) {
  const r = place.room;
  const text = place.text;
  const note = noteGeo(show.note ?? SAVE_DEFAULTS.pricerise, r.w - 40, text);
  const noteBlock = note ? note.h + Math.round(text * 0.6) : 0;
  const fewer = noteGeo(SW.fewer, r.w - 40, text, 1.3)!;
  const gap = Math.round(text * 0.5);
  const labelSize = Math.round(text * 1.1);
  const labelH = Math.round(labelSize * 1.4);
  const colGap = text;
  const colW = Math.min(Math.floor((r.w - colGap) / 2), 520);
  const avail = r.h - noteBlock - fewer.h - gap;
  const k = Math.min(colW / PRICE.w, (avail - labelH) / PRICE.h);
  const sheet = { w: Math.round(PRICE.w * k), h: Math.round(PRICE.h * k), k };
  const w = Math.min(colW, Math.max(sheet.w, handWidth(SW.later, labelSize) + 8));
  const groupH = labelH + sheet.h;
  const y = r.y + Math.round((avail - groupH) / 2);
  const x0 = r.x + Math.round((r.w - w * 2 - colGap) / 2);
  const cols = [0, 1].map((i) => {
    const x = x0 + i * (w + colGap);
    return {
      key: i === 0 ? "a" : "b", x, y, w, h: groupH, label: i === 0 ? SW.today : SW.later, labelSize, labelH,
      sheet: { ...sheet, x: x + Math.round((w - sheet.w) / 2), y: y + labelH },
    };
  });
  return {
    cols,
    line: { x: r.x, y: y + groupH + gap, w: r.w, ...fewer },
    note: note ? { x: r.x, y: r.y + r.h - note.h, w: r.w, ...note } : null,
  };
}

/** one of the five goods standing at centre x, its foot at y = 124 */
function good(i: number, cx: number) {
  const ink = { stroke: C.ink, strokeWidth: 3.2, strokeLinejoin: "round" as const };
  switch (i) {
    case 0: // an apple
      return <><circle cx={cx} cy={104} r={19} fill={C.red} {...ink} /><path d={`M${cx} 86 Q${cx + 2} 78 ${cx + 6} 75`} stroke={C.ink} strokeWidth={3} fill="none" strokeLinecap="round" /><ellipse cx={cx + 9} cy={80} rx={7} ry={4} fill={C.green} {...ink} strokeWidth={2.4} /></>;
    case 1: // a bottle
      return <><rect x={cx - 12} y={80} width={24} height={44} rx={7} fill={C.water} {...ink} /><rect x={cx - 7} y={64} width={14} height={18} rx={3} fill={C.water} {...ink} /><rect x={cx - 8} y={60} width={16} height={7} rx={2} fill={C.coin} {...ink} strokeWidth={2.4} /></>;
    case 2: // a loaf
      return <><rect x={cx - 19} y={92} width={38} height={32} rx={15} fill={C.kraft} {...ink} /><path d={`M${cx - 8} 98 L${cx - 4} 108 M${cx + 2} 98 L${cx + 6} 108 M${cx + 12} 98 L${cx + 14} 106`} stroke={C.ink} strokeWidth={2.6} fill="none" strokeLinecap="round" /></>;
    case 3: // a can
      return <><rect x={cx - 15} y={78} width={30} height={46} rx={5} fill={C.cake} {...ink} /><path d={`M${cx - 15} 90 H${cx + 15} M${cx - 15} 112 H${cx + 15}`} stroke={C.ink} strokeWidth={2.6} /></>;
    default: // a lettuce
      return <><circle cx={cx} cy={103} r={20} fill={C.green} {...ink} /><path d={`M${cx - 10} 108 Q${cx} 92 ${cx + 10} 108`} stroke={C.white} strokeWidth={3} fill="none" strokeLinecap="round" /></>;
  }
}

/** a basket on its sheet with its goods (those listed in `shown`, each at its opacity) and the banknote under it */
function basketSvg(which: "a" | "b", goods: number[]) {
  return (
    <>
      <path d="M52 108 Q120 -40 188 108" fill="none" stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
      {GOODS_X.map((cx, i) => (goods[i] > 0.01 ? <g key={i} data-good={which} opacity={goods[i].toFixed(3)} transform={`translate(${cx} 124) scale(1.22) translate(${-cx} -124)`}>{good(i, cx)}</g> : null))}
      <path d="M30 112 H210 L194 188 Q192 198 182 198 H58 Q48 198 46 188 Z" fill={C.kraft} stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
      <path d="M40 140 H200 M44 166 H196 M86 114 L82 196 M120 114 V198 M154 114 L158 196" stroke={C.ink} strokeWidth={2.4} opacity={0.45} fill="none" />
      <rect x={24} y={104} width={192} height={14} rx={6} fill={C.kraft} stroke={C.ink} strokeWidth={4} />
      <g data-part="banknote">
        <rect x={50} y={212} width={140} height={60} rx={8} fill={C.green} stroke={C.ink} strokeWidth={4} />
        <rect x={58} y={220} width={124} height={44} rx={4} fill="none" stroke={C.white} strokeWidth={2.5} />
        <circle cx={120} cy={242} r={14} fill={C.coin} stroke={C.ink} strokeWidth={3} />
        <circle cx={68} cy={230} r={4} fill={C.white} />
        <circle cx={172} cy={254} r={4} fill={C.white} />
      </g>
    </>
  );
}

/** เงินเท่าเดิม ซื้อได้น้อยลง: today's basket with five goods and a banknote; later, the same banknote, and two of the goods fade out; the red line under both. No figure. */
function PriceRise({ d, show }: { d: Dev; show: SaveShow<"pricerise"> }) {
  const { c, t, s, g, w, ink } = d;
  const geo = priceGeo(c.size, show);
  const at = priceAt(s, t);
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      {geo.cols.map((col) => {
        const an = col.key === "a" ? s.today : s.later;
        const l = look(an, t);
        const goods = col.key === "a" ? [1, 1, 1, 1, 1] : [1, 1, 1, at.extra, at.extra];
        return (
          <div key={col.key} data-part={col.key === "a" ? "today" : "later"} style={abs({ left: col.x, top: col.y, width: col.w, height: col.h, flexDirection: "column", alignItems: "center", opacity: l.opacity, ...(l.transform ? { transform: l.transform } : {}) })}>
            <div style={box({ height: col.labelH, justifyContent: "center", alignItems: "center", fontFamily: HAND, fontSize: col.labelSize, fontWeight: 700, lineHeight: 1.3, color: ink })}>{col.label}</div>
            <svg width={col.sheet.w} height={col.sheet.h} viewBox={`0 0 ${PRICE.w} ${PRICE.h}`}>{basketSvg(col.key as "a" | "b", goods)}</svg>
          </div>
        );
      })}
      <El an={s.line} t={t} style={{ position: "absolute", left: geo.line.x, top: geo.line.y, width: geo.line.w, height: geo.line.h, flexDirection: "column", alignItems: "center", fontFamily: HAND, color: C.red }}>
        {geo.line.lines.map((x, i) => <div key={i} style={box({ fontSize: geo.line.size, fontWeight: 700, lineHeight: 1.3 })}>{x}</div>)}
      </El>
      <NoteLines n={geo.note} an={s.note} t={t} ink={ink} />
    </>
  );
}

/* ---------- pensionsteps: บำนาญขั้นบันได ---------- */

/** each step's growth (0 to 1), and how far the dashed cost-of-living line is drawn (0 to 1), at t */
export function pensionAt(s: Record<string, Anim>, n: number, t: number) {
  return { steps: Array.from({ length: n }, (_, i) => look(s[`step${i}`], t).p), living: look(s.living, t).p };
}

/**
 * Where the steps stand. Each step is as tall as its baht (from zero, a few px at least), each with its figure above its
 * top and its ages under; the dashed line runs from the left to the right above every figure (its left edge is the
 * lowest it has to clear), with its label above its high end, so nothing of it ever lies on a figure. A figure wider than
 * its step sits at the nearest place and the lowest level (up to two figure heights higher) where it hits no step and no other figure.
 */
export function pensionGeo(size: VideoSize, show: SaveShow<"pensionsteps">, place: SavePlace = paperPlace(size)) {
  const r = place.room;
  const text = place.text;
  const rows = show.rows;
  const n = rows.length;
  const note = noteGeo(show.note ?? SAVE_DEFAULTS.pensionsteps, r.w - 40, text);
  const noteBlock = note ? note.h + Math.round(text * 0.6) : 0;
  const gapBelow = 6;
  const ageTexts = rows.map((x) => `${x.from}–${x.to}`);
  const ageCap = Math.round(text * 0.95);
  const ageH = Math.round(ageCap * 1.35);
  // an age's size: the largest up to its cap that fits the widest "a–b" in a step's width
  const ageFit = (colW: number) => { let size = ageCap; while (size > 14 && Math.max(...ageTexts.map((x) => figWidth(x, size))) * 1.12 > colW - 4) size -= 1; return size; };
  let capSize = Math.round(text * 0.9);
  while (capSize > 8 && handWidth(SW.perYear, capSize) > r.w - 40) capSize -= 1;
  const capH = Math.round(capSize * 1.4);
  let labelSize = Math.round(text * 0.95);
  while (labelSize > 8 && handWidth(SW.living, labelSize) > r.w * 0.6) labelSize -= 1;
  const labelH = Math.round(labelSize * 1.35);
  const chartH = r.h - noteBlock - gapBelow - ageH - Math.round(text * 0.2) - capH;
  const base = r.y + chartH;
  const figs = rows.map((x) => baht0(x.annual));
  const G = 10;

  type Box = { x: number; y: number; w: number; h: number };
  type Plan = { figSize: number; Hs: number; ageSize: number; colW: number; x0: number; hs: number[]; boxes: Box[]; a: number; s: number };
  const maxAnnual = Math.max(...rows.map((x) => x.annual), 1);
  const hit = (p: Box, q: Box, m = 0) => p.x < q.x + q.w + m && q.x < p.x + p.w + m && p.y < q.y + q.h + m && q.y < p.y + p.h + m;
  const plan = (figSize: number, Hs: number): Plan | null => {
    const figH = Math.round(figSize * 1.3);
    const colW = Math.min(300, Math.floor((r.w - 16) / n));
    const ageSize = ageFit(colW);
    if (colW < 60 || ageSize < Math.round(text * 0.55)) return null;
    const chartW = colW * n;
    const x0 = r.x + 8 + Math.floor((r.w - 16 - chartW) / 2);
    const colL = (i: number) => x0 + i * colW;
    // each step's height is to its baht (from zero), a few px at least
    const hs = rows.map((x) => Math.max(6, Math.round((Hs * x.annual) / maxAnnual)));
    const bars: Box[] = hs.map((h, i) => ({ x: colL(i), y: base - h, w: colW, h }));
    // each figure over its own step, at the lowest level (0 to 2 figure heights up) and nearest place where it hits no step and no other figure
    const boxes: Box[] = [];
    for (let i = 0; i < n; i++) {
      const fw = figWidth(figs[i], figSize);
      const xs = [colL(i) + Math.round((colW - fw) / 2), colL(i) + colW - fw - 2, colL(i) + 2].map((x) => Math.min(Math.max(x, r.x + 4), r.x + r.w - 4 - fw));
      let put: Box | null = null;
      for (let lv = 0; lv < 3 && !put; lv++) {
        for (const x of xs) {
          const box = { x, w: fw, h: figH, y: base - hs[i] - G - figH - lv * (figH + 4) };
          if (!bars.some((q) => hit(box, q)) && !boxes.some((q) => hit(box, q, 2))) { put = box; break; }
        }
      }
      if (!put) return null;
      boxes.push(put);
    }
    // the line is above every figure and every step at the left edge of each
    const sl = Hs * 0.35;
    let a = 0;
    for (let i = 0; i < n; i++) {
      const left = Math.min(boxes[i].x, colL(i));
      a = Math.max(a, base - boxes[i].y + G - (sl * (left - x0)) / chartW);
    }
    return a + sl + 6 + labelH <= chartH ? { figSize, Hs, ageSize, colW, x0, hs, boxes, a, s: sl } : null;
  };
  let best: Plan | null = null;
  const minHs = Math.max(90, Math.round(chartH * 0.35));
  for (let figSize = Math.round(text * 1.3); figSize >= 10 && !best; figSize -= 1) {
    for (let Hs = chartH; Hs >= minHs && !best; Hs -= 4) best = plan(figSize, Hs);
  }
  const fallback = (): Plan => {
    const colW = Math.min(300, Math.floor((r.w - 16) / n));
    return { figSize: 10, Hs: minHs, ageSize: 14, colW, x0: r.x + 8, hs: rows.map(() => 20), boxes: rows.map((_, i) => ({ x: r.x + 8 + i * colW, y: base - 40, w: colW, h: 13 })), a: minHs, s: minHs * 0.35 };
  };
  const p = best ?? fallback();
  const { colW, x0 } = p;
  const chartW = colW * n;
  const colL = (i: number) => x0 + i * colW;
  const barGap = Math.min(10, Math.round(colW * 0.06));
  const bars = rows.map((row, i) => {
    const h = p.hs[i];
    return {
      x: colL(i) + Math.round(barGap / 2), w: colW - barGap, h, y: base - h,
      fig: { text: figs[i], ...p.boxes[i] },
      age: { text: ageTexts[i], x: colL(i), w: colW, y: base + gapBelow, h: ageH },
      row,
    };
  });
  const lineEnd = { x1: x0, y1: Math.round(base - p.a), x2: x0 + chartW, y2: Math.round(base - p.a - p.s) };
  const lw = Math.ceil(handWidth(SW.living, labelSize)) + 8;
  return {
    bars, figSize: p.figSize, ageSize: p.ageSize, base, chart: { x: x0, w: chartW, h: chartH },
    line: lineEnd,
    label: { text: SW.living, x: lineEnd.x2 - lw, w: lw, size: labelSize, h: labelH, y: lineEnd.y2 - 6 - labelH },
    caption: { x: r.x, w: r.w, size: capSize, h: capH, y: base + gapBelow + ageH + Math.round(text * 0.2) },
    note: note ? { x: r.x, y: r.y + r.h - note.h, w: r.w, ...note } : null,
  };
}

/** บำนาญขั้นบันได: the green steps rise one by one with their baht a year above and their ages under; a red dashed line labelled ค่าครองชีพ is drawn over them; the caption under */
function PensionSteps({ d, show }: { d: Dev; show: SaveShow<"pensionsteps"> }) {
  const { c, t, s, g, w, ink } = d;
  const geo = pensionGeo(c.size, show);
  const at = pensionAt(s, show.rows.length, t);
  const { line: ln } = geo;
  const lx = ln.x1 + (ln.x2 - ln.x1) * at.living;
  const ly = ln.y1 + (ln.y2 - ln.y1) * at.living;
  const pad = 12;
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      {geo.bars.map((b, i) => {
        const p = at.steps[i];
        const h = Math.round(b.h * p);
        return (
          <Fragment key={i}>
            <div data-part="step" style={abs({ left: b.x, top: geo.base - h, width: b.w, height: h, background: GREEN, border: `4px solid ${C.ink}`, borderBottom: "none", borderRadius: "10px 10px 0 0", opacity: p > 0 ? 1 : 0 })} />
            <div data-part="fig" style={abs({ left: b.fig.x, top: b.fig.y + (b.h - h), width: b.fig.w, height: b.fig.h, justifyContent: "center", alignItems: "center", fontFamily: HAND, fontSize: geo.figSize, fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap", color: GREEN, opacity: p > 0 ? 1 : 0 })}>{b.fig.text}</div>
            <div data-part="age" style={abs({ left: b.age.x, top: b.age.y, width: b.age.w, height: b.age.h, justifyContent: "center", fontFamily: HAND, fontSize: geo.ageSize, fontWeight: 600, lineHeight: 1.3, whiteSpace: "nowrap", color: ink, opacity: p > 0 ? 1 : 0 })}>{b.age.text}</div>
          </Fragment>
        );
      })}
      <div style={abs({ left: geo.chart.x - 12, top: geo.base - 3, width: geo.chart.w + 24, height: 6, background: ink, borderRadius: 3 })} />
      {at.living > 0 ? (
        <div data-part="living" style={abs({ left: ln.x1 - pad, top: Math.min(ln.y1, ln.y2) - pad, width: ln.x2 - ln.x1 + pad * 2, height: Math.abs(ln.y1 - ln.y2) + pad * 2 })}>
          <svg width={ln.x2 - ln.x1 + pad * 2} height={Math.abs(ln.y1 - ln.y2) + pad * 2} viewBox={`0 0 ${ln.x2 - ln.x1 + pad * 2} ${Math.abs(ln.y1 - ln.y2) + pad * 2}`}>
            <line x1={pad} y1={ln.y1 - Math.min(ln.y1, ln.y2) + pad} x2={lx - ln.x1 + pad} y2={ly - Math.min(ln.y1, ln.y2) + pad} stroke={C.red} strokeWidth={6} strokeLinecap="round" strokeDasharray="16 12" />
          </svg>
        </div>
      ) : null}
      <div data-part="living-label" style={abs({ left: geo.label.x, top: geo.label.y, width: geo.label.w, height: geo.label.h, justifyContent: "flex-end", alignItems: "center", fontFamily: HAND, fontSize: geo.label.size, fontWeight: 700, lineHeight: 1.3, color: C.red, opacity: Math.min(1, at.living * 2) })}>{geo.label.text}</div>
      <El an={s.caption} t={t} style={{ position: "absolute", left: geo.caption.x, top: geo.caption.y, width: geo.caption.w, justifyContent: "center", fontFamily: HAND, fontSize: geo.caption.size, fontWeight: 600, lineHeight: 1.3, color: ink }}>{SW.perYear}</El>
      <NoteLines n={geo.note} an={s.note} t={t} ink={ink} />
    </>
  );
}

/** a saving device's frame body at scene time t (showBody hands it the frame, the movements, where things stand, the ink) */
export function saveBody(show: SaveShow, d: Dev) {
  switch (show.layout) {
    case "savejar": return <SaveJar d={d} show={show} />;
    case "paidgot": return <PaidGot d={d} show={show} />;
    case "pricerise": return <PriceRise d={d} show={show} />;
    case "pensionsteps": return <PensionSteps d={d} show={show} />;
  }
}
