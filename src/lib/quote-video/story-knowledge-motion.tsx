import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { CHILDREN } from "@/lib/story/faces";
import { topicOf } from "@/lib/story/topics";
import type React from "react";
import { a, abs, box, El, look, stroke, type Anim } from "./motion";
import type { StoryVideoInput } from "./story";
import { familyFaces } from "./story-family";
import { knowEpisode, partnerFace, type Kin, type KnowEpisode, type KnowSceneKey, type KnowShow, type NoteLine, type PicIcon } from "./story-knowledge";
import { Contact, contactSpec, Img, type StoryContext } from "./story-motion";
import { SIZES, type VideoSize } from "./timeline";

/**
 * ความรู้ประกัน 1 นาที's scenes on paper (story-knowledge.ts says what each shows), as the owner
 * approved them in the mockup (2026-10-15): a question with the one who wonders, a belief stamped
 * and struck out, money flowing out or in, notes, lists with ticks or crosses, bars of real
 * premiums, a family, a gift, and the line to remember. Titles in the handwriting face (Mali).
 *
 * เรื่องครอบครัว (mockup https://claude.ai/artifact/CeobBBQKLvtnZuDw1ETLtM) adds a row of the
 * family — with the bills on stickers, a note, a bag of money coming down to them, or question
 * marks; one of them fading to a dashed outline — a line of the years ahead, and a sum on a card.
 *
 * หลังการขาย (mockup https://claude.ai/artifact/7V5MfG21asotVJm9TCJojc) adds a drawn thing — the
 * policy, a calendar with the day due, a cake, a festival's sign — with a face and a note.
 */

const C = STORY_CLIP_COLORS;
const HAND = "Mali";
const GREEN = C.green;
const STRUCK = C.struck;

type Rect = { x: number; y: number; w: number; h: number };
interface Geo {
  title: number;
  titleSize: number;
  /** the size every note's small line is set in; a big line is 1.4 times it */
  text: number;
  /** the stamp's top, and the line under it */
  stamp: number;
  quote: number;
  quoteSize: number;
  ask: Rect;
  face: Rect;
  note: Rect;
  card: Rect;
  flow: { face: Rect; arrow: Rect; icon: Rect; note: Rect };
  fact: Rect;
  bars: Rect;
  family: Rect;
  gift: Rect;
  mythFace: Rect;
  /** the family's row, and lower with the bag above it; beside or under it the stickers and note */
  kin: { row: Rect; rowBag: Rect; bag: Rect; side: Rect; sideBag: Rect };
  /** the years ahead: the line's first row, the step between rows */
  line: { x: number; y: number; step: number };
  /** a drawn thing with a face and a note; with a note only ("solo"); with a face only ("pair") */
  pic: { icon: Rect; face: Rect; note: Rect; iconSolo: Rect; noteSolo: Rect; iconPair: Rect; facePair: Rect };
}

/** where each layout stands, for each shape of clip */
const GEO: Record<VideoSize, Geo> = {
  portrait: {
    title: 110, titleSize: 104, text: 46, stamp: 120, quote: 330, quoteSize: 112,
    ask: { x: 240, y: 560, w: 600, h: 600 }, face: { x: 340, y: 500, w: 400, h: 400 }, note: { x: 100, y: 1000, w: 880, h: 420 },
    card: { x: 100, y: 470, w: 880, h: 760 },
    flow: { face: { x: 60, y: 520, w: 360, h: 360 }, arrow: { x: 440, y: 650, w: 190, h: 95 }, icon: { x: 660, y: 540, w: 340, h: 300 }, note: { x: 100, y: 1000, w: 880, h: 300 } },
    fact: { x: 100, y: 640, w: 880, h: 500 }, bars: { x: 90, y: 640, w: 900, h: 560 }, family: { x: 70, y: 500, w: 940, h: 420 },
    gift: { x: 340, y: 480, w: 400, h: 400 }, mythFace: { x: 340, y: 870, w: 400, h: 400 },
    kin: { row: { x: 60, y: 480, w: 960, h: 420 }, rowBag: { x: 60, y: 790, w: 960, h: 320 }, bag: { x: 390, y: 410, w: 300, h: 330 }, side: { x: 100, y: 1000, w: 880, h: 420 }, sideBag: { x: 100, y: 1160, w: 880, h: 400 } },
    line: { x: 250, y: 500, step: 190 },
    pic: {
      icon: { x: 390, y: 360, w: 300, h: 300 }, face: { x: 390, y: 690, w: 300, h: 300 }, note: { x: 140, y: 1040, w: 800, h: 380 },
      iconSolo: { x: 390, y: 400, w: 300, h: 300 }, noteSolo: { x: 140, y: 760, w: 800, h: 480 },
      iconPair: { x: 390, y: 380, w: 300, h: 300 }, facePair: { x: 320, y: 720, w: 440, h: 440 },
    },
  },
  square: {
    title: 50, titleSize: 76, text: 32, stamp: 40, quote: 190, quoteSize: 86,
    ask: { x: 330, y: 260, w: 420, h: 420 }, face: { x: 70, y: 300, w: 320, h: 320 }, note: { x: 420, y: 290, w: 600, h: 480 },
    card: { x: 150, y: 230, w: 780, h: 560 },
    flow: { face: { x: 90, y: 250, w: 280, h: 280 }, arrow: { x: 390, y: 350, w: 150, h: 80 }, icon: { x: 580, y: 250, w: 290, h: 260 }, note: { x: 170, y: 590, w: 740, h: 220 } },
    fact: { x: 170, y: 400, w: 740, h: 400 }, bars: { x: 120, y: 330, w: 840, h: 380 }, family: { x: 60, y: 260, w: 560, h: 360 },
    gift: { x: 90, y: 270, w: 340, h: 340 }, mythFace: { x: 400, y: 480, w: 280, h: 280 },
    kin: { row: { x: 60, y: 210, w: 960, h: 330 }, rowBag: { x: 60, y: 400, w: 960, h: 210 }, bag: { x: 450, y: 190, w: 180, h: 200 }, side: { x: 140, y: 575, w: 800, h: 280 }, sideBag: { x: 140, y: 630, w: 800, h: 230 } },
    line: { x: 330, y: 240, step: 120 },
    pic: {
      icon: { x: 110, y: 220, w: 250, h: 250 }, face: { x: 110, y: 500, w: 250, h: 250 }, note: { x: 420, y: 250, w: 610, h: 480 },
      iconSolo: { x: 110, y: 270, w: 280, h: 280 }, noteSolo: { x: 440, y: 230, w: 590, h: 520 },
      iconPair: { x: 150, y: 260, w: 340, h: 340 }, facePair: { x: 590, y: 260, w: 340, h: 340 },
    },
  },
  landscape: {
    title: 46, titleSize: 80, text: 38, stamp: 40, quote: 190, quoteSize: 96,
    ask: { x: 700, y: 250, w: 520, h: 520 }, face: { x: 260, y: 250, w: 460, h: 460 }, note: { x: 860, y: 280, w: 840, h: 480 },
    card: { x: 460, y: 220, w: 1000, h: 580 },
    flow: { face: { x: 220, y: 260, w: 380, h: 380 }, arrow: { x: 660, y: 400, w: 200, h: 100 }, icon: { x: 920, y: 280, w: 360, h: 330 }, note: { x: 1340, y: 300, w: 480, h: 380 } },
    fact: { x: 460, y: 390, w: 1000, h: 420 }, bars: { x: 360, y: 330, w: 1200, h: 380 }, family: { x: 140, y: 290, w: 980, h: 420 },
    gift: { x: 300, y: 260, w: 440, h: 440 }, mythFace: { x: 790, y: 470, w: 340, h: 340 },
    kin: { row: { x: 100, y: 290, w: 1020, h: 430 }, rowBag: { x: 100, y: 520, w: 1020, h: 300 }, bag: { x: 480, y: 220, w: 260, h: 280 }, side: { x: 1180, y: 320, w: 640, h: 440 }, sideBag: { x: 1180, y: 320, w: 640, h: 440 } },
    line: { x: 760, y: 240, step: 125 },
    pic: {
      icon: { x: 180, y: 250, w: 300, h: 300 }, face: { x: 540, y: 270, w: 340, h: 340 }, note: { x: 980, y: 280, w: 820, h: 480 },
      iconSolo: { x: 320, y: 260, w: 360, h: 360 }, noteSolo: { x: 800, y: 260, w: 900, h: 480 },
      iconPair: { x: 500, y: 250, w: 380, h: 380 }, facePair: { x: 1040, y: 250, w: 380, h: 380 },
    },
  },
};

/** the few things a scene shows, in the order they come in */
function kspec(show: KnowShow): Record<string, Anim> {
  const s: Record<string, Anim> = {};
  switch (show.layout) {
    case "ask": return { title: a(0.2, "up"), face: a(0.5, "pop"), marks: a(1.0, "pop") };
    case "myth": return { stamp: a(0.2, "pop"), quote: a(0.6, "up"), face: a(1.1, "pop") };
    case "fact": return { stamp: a(0.2, "pop"), crossed: a(0.5, "fade"), strike: a(0.9, "stroke", 0.6), note: a(1.5, "pop") };
    case "flow": return { title: a(0.2, "up"), face: a(0.5, "pop"), arrow: a(0.9, "stroke", 0.6), icon: a(1.3, "pop"), note: a(1.8, "pop") };
    case "note": return { title: a(0.2, "up"), face: a(0.5, "pop"), note: a(1.1, "pop") };
    case "list":
      s.title = a(0.2, "up");
      s.card = a(0.5, "pop");
      show.items.forEach((_, i) => { s[`item${i}`] = a(0.9 + i * 0.45, "left"); });
      return s;
    case "recap": return { title: a(0.2, "up"), card: a(0.6, "pop") };
    case "bars":
      s.stamp = a(0.2, "pop");
      s.lead = a(0.5, "up");
      show.rows.forEach((_, i) => { s[`bar${i}`] = a(1.0 + i * 0.5, "grow"); });
      s.source = a(1.0 + show.rows.length * 0.5, "fade");
      return s;
    case "family": return { title: a(0.2, "up"), people: a(0.5, "pop"), note: a(1.3, "pop") };
    case "gift": return { title: a(0.2, "up"), gift: a(0.5, "pop"), note: a(1.2, "pop") };
    case "kin": {
      s.title = a(0.2, "up");
      s.people = a(0.5, "pop");
      let at = 1.0;
      if (show.bag) { s.bag = a(at, "pop"); at += 0.4; }
      (show.tags?.items ?? []).forEach((_, i) => { s[`tag${i}`] = a(at + i * 0.35, "pop"); });
      at += (show.tags?.items.length ?? 0) * 0.35;
      if (show.note) s.note = a(at + 0.2, "pop");
      if (show.marks) s.marks = a(1.1, "pop");
      if (show.people.some((p) => p.state === "gone")) s.gone = a(1.2, "stroke", 1.4);
      if (show.hearts) s.hearts = a(1.1, "up");
      return s;
    }
    case "timeline":
      s.title = a(0.2, "up");
      s.line = a(0.5, "stroke", 0.4 + show.rows.length * 0.35);
      show.rows.forEach((_, i) => { s[`row${i}`] = a(0.6 + i * 0.35, "left"); });
      return s;
    case "card": return { title: a(0.2, "up"), card: a(0.6, "pop") };
    case "pic":
      return {
        title: a(0.2, "up"), icon: a(0.5, "pop"),
        ...(show.face ? { face: a(0.9, "pop") } : {}), ...(show.note ? { note: a(1.3, "pop") } : {}), ...(show.hearts ? { hearts: a(1.3, "up") } : {}),
      };
  }
}

const sceneOf = (e: KnowEpisode, key: KnowSceneKey) => e.scenes.find((s) => s.key === key)!.show;

/** When a knowledge scene's things move, in scene seconds: the card's as กองกลาง's */
export function knowWindows(key: KnowSceneKey | "storyContact", input: StoryVideoInput): [number, number][] {
  const spec = key === "storyContact"
    ? contactSpec()
    : kspec(sceneOf(knowEpisode(input), key));
  return Object.values(spec).map((x) => [x.at, x.at + x.dur]);
}

function Title({ g, w, an, t, text }: { g: Geo; w: number; an?: Anim; t: number; text: [string, string] }) {
  return (
    <El an={an} t={t} style={{ position: "absolute", left: 40, width: w - 80, top: g.title, flexDirection: "column", alignItems: "center", fontFamily: HAND, color: C.ink }}>
      <div style={box({ fontSize: g.titleSize, fontWeight: 600, lineHeight: 1.15 })}>{text[0]}</div>
      {text[1] ? <div style={box({ fontSize: Math.round(g.titleSize * 0.46), marginTop: 6 })}>{text[1]}</div> : null}
    </El>
  );
}

/** a note on paper, taped, its lines one under another (the drawing breaks Thai only at a space) */
export function Note({ g, r, an, t, lines, tilt = -1.2, scale = 1 }: { g: Pick<Geo, "text">; r: Rect; an?: Anim; t: number; lines: NoteLine[]; tilt?: number; scale?: number }) {
  const l = look(an, t);
  return (
    <div style={{ display: "flex", position: "absolute", left: r.x, top: r.y, width: r.w, flexDirection: "column", alignItems: "center", background: C.note, border: `4px solid ${C.ink}`, borderRadius: 16, padding: "26px 28px", opacity: l.opacity, transform: `rotate(${tilt}deg)${l.transform ? ` ${l.transform}` : ""}`, fontFamily: HAND, color: C.ink }}>
      {lines.map((x, i) => (
        <div key={i} style={box({ fontSize: Math.round(g.text * scale * (x.big ? 1.4 : 1)), fontWeight: x.big ? 600 : 500, lineHeight: 1.35, color: x.tone === "red" ? C.red : x.tone === "green" ? GREEN : C.ink, textAlign: "center" })}>{x.text}</div>
      ))}
    </div>
  );
}

/** the hero's face, popping in; grey when the news is bad */
function Face({ c, r, an, t, gray }: { c: StoryContext; r: Rect; an?: Anim; t: number; gray?: boolean }) {
  const l = look(an, t);
  const id = c.input.faces.hero;
  return (
    <div style={{ display: "flex", position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, opacity: l.opacity, ...(l.transform ? { transform: l.transform } : {}) }}>
      <Img src={c.faces[gray ? `${id}-g` : id]} r={{ x: 0, y: 0, w: r.w, h: r.h }} />
    </div>
  );
}

const COINS = (r: Rect) => (
  <svg width={r.w} height={r.h} viewBox="0 0 120 100">
    {[[30, 58], [60, 46], [90, 58], [45, 30], [75, 30]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={15} fill={C.coin} stroke={C.ink} strokeWidth={3} />)}
  </svg>
);
const BAG = (r: Rect) => (
  <svg width={r.w} height={r.h} viewBox="0 0 100 110">
    <path d="M35 18 L65 18 L58 34 Q92 50 88 82 Q84 104 50 104 Q16 104 12 82 Q8 50 42 34 Z" fill={C.jar} stroke={C.ink} strokeWidth={3.4} strokeLinejoin="round" />
  </svg>
);
const GIFT = (r: Rect) => (
  <svg width={r.w} height={r.h} viewBox="0 0 100 100">
    <rect x={14} y={40} width={72} height={50} fill={C.jar} stroke={C.ink} strokeWidth={3.4} />
    <rect x={8} y={28} width={84} height={16} fill={C.jar} stroke={C.ink} strokeWidth={3.4} />
    <path d="M50 28 V90" stroke={C.red} strokeWidth={6} />
    <path d="M50 28 C30 6 20 24 50 28 C80 24 70 6 50 28" fill="none" stroke={C.red} strokeWidth={4} />
  </svg>
);

function Stamp({ g, w, an, t, myth }: { g: Geo; w: number; an?: Anim; t: number; myth: boolean }) {
  const l = look(an, t);
  const color = myth ? C.red : GREEN;
  return (
    <div style={abs({ left: 0, width: w, top: g.stamp, justifyContent: "center", opacity: l.opacity, ...(l.transform ? { transform: l.transform } : {}) })}>
      <div style={box({ border: `8px solid ${color}`, borderRadius: 18, padding: "4px 36px", color, fontFamily: HAND, fontWeight: 700, fontSize: Math.round(g.titleSize * 0.66), transform: "rotate(-6deg)" })}>{myth ? "ความเชื่อ" : "ความจริง"}</div>
    </div>
  );
}

function Scene({ c, t, show }: { c: StoryContext; t: number; show: KnowShow }) {
  const g = GEO[c.size];
  const { w } = SIZES[c.size];
  const s = kspec(show);
  switch (show.layout) {
    case "ask": {
      const m = look(s.marks, t);
      const r = g.ask;
      const mark = (x: number, y: number, size: number, rot: number) => (
        <div style={abs({ left: x, top: y, fontFamily: HAND, fontWeight: 700, fontSize: size, color: C.red, opacity: m.opacity, transform: `rotate(${rot}deg)${m.transform ? ` ${m.transform}` : ""}` })}>?</div>
      );
      return (
        <>
          <Title g={g} w={w} an={s.title} t={t} text={show.title} />
          <Face c={c} r={r} an={s.face} t={t} />
          {mark(r.x + r.w * 0.86, r.y - r.h * 0.06, Math.round(r.w * 0.3), 14)}
          {mark(r.x - r.w * 0.16, r.y + r.h * 0.18, Math.round(r.w * 0.2), -12)}
        </>
      );
    }
    case "myth": {
      return (
        <>
          <Stamp g={g} w={w} an={s.stamp} t={t} myth />
          <El an={s.quote} t={t} style={{ position: "absolute", left: 40, width: w - 80, top: g.quote, flexDirection: "column", alignItems: "center", fontFamily: HAND, fontWeight: 700, fontSize: g.quoteSize, lineHeight: 1.2, color: C.ink }}>
            {show.quote.map((q, i) => <div key={i} style={box({})}>{q}</div>)}
          </El>
          <Face c={c} r={g.mythFace} an={s.face} t={t} />
        </>
      );
    }
    case "fact": {
      const strike = look(s.strike, t).p;
      // the line runs the width of the struck words, about: a Thai letter is ~0.5 of the size wide
      const cw = Math.min(Math.round(w * 0.6), Math.round([...show.crossed].length * g.quoteSize * 0.8 * 0.5) + 60);
      return (
        <>
          <Stamp g={g} w={w} an={s.stamp} t={t} myth={false} />
          <El an={s.crossed} t={t} style={{ position: "absolute", left: 0, width: w, top: g.quote + 20, justifyContent: "center", fontFamily: HAND, fontWeight: 700, fontSize: Math.round(g.quoteSize * 0.8), color: STRUCK }}>{show.crossed}</El>
          <div style={abs({ left: Math.round((w - cw) / 2), top: g.quote + Math.round(g.quoteSize * 0.45), width: cw, height: 40 })}>
            <svg width={cw} height={40} viewBox={`0 0 ${cw} 40`}>{stroke({ d: `M6 30 L${cw - 6} 10`, len: cw, p: strike, color: C.red, width: 12 })}</svg>
          </div>
          <Note g={g} r={g.fact} an={s.note} t={t} lines={show.note} />
        </>
      );
    }
    case "flow": {
      const f = g.flow;
      const il = look(s.icon, t);
      return (
        <>
          <Title g={g} w={w} an={s.title} t={t} text={show.title} />
          {/* the premium leaves the hero for the coins; the sum comes from the bag to the hero */}
          <Face c={c} r={show.dir === "out" ? f.face : { ...f.face, x: f.icon.x }} an={s.face} t={t} />
          <div style={abs({ left: show.dir === "out" ? f.icon.x : f.face.x, top: f.icon.y, width: f.icon.w, height: f.icon.h, opacity: il.opacity, ...(il.transform ? { transform: il.transform } : {}) })}>
            {show.dir === "out" ? COINS({ x: 0, y: 0, w: f.icon.w, h: f.icon.h }) : BAG({ x: 0, y: 0, w: f.icon.w, h: f.icon.h })}
            {show.dir === "in" ? <div style={abs({ left: 0, width: f.icon.w, top: Math.round(f.icon.h * 0.42), justifyContent: "center", fontSize: Math.round(f.icon.h * 0.32), fontWeight: 600, color: C.ink })}>฿</div> : null}
          </div>
          <div style={abs({ left: f.arrow.x, top: f.arrow.y, width: f.arrow.w, height: f.arrow.h })}>
            <svg width={f.arrow.w} height={f.arrow.h} viewBox="0 0 80 40">{stroke({ d: "M4 24 Q36 8 64 20 M52 9 L66 20 L52 31", len: 110, p: look(s.arrow, t).p, color: C.ink, width: 4 })}</svg>
          </div>
          <Note g={g} r={f.note} an={s.note} t={t} lines={show.note} />
        </>
      );
    }
    case "note":
      return (
        <>
          <Title g={g} w={w} an={s.title} t={t} text={show.title} />
          <Face c={c} r={g.face} an={s.face} t={t} gray={show.dim} />
          <Note g={g} r={g.note} an={s.note} t={t} lines={show.note} />
        </>
      );
    case "list": {
      const markWord = { check: "✓", cross: "✗", box: "☐", warn: "!" }[show.mark];
      const markColor = show.mark === "check" ? GREEN : show.mark === "cross" || show.mark === "warn" ? C.red : C.ink;
      const cl = look(s.card, t);
      return (
        <>
          <Title g={g} w={w} an={s.title} t={t} text={show.title} />
          <div style={{ display: "flex", position: "absolute", left: g.card.x, top: g.card.y, width: g.card.w, flexDirection: "column", background: C.note, border: `4px solid ${C.ink}`, borderRadius: 16, padding: "36px 40px", opacity: cl.opacity, transform: `rotate(0.8deg)${cl.transform ? ` ${cl.transform}` : ""}` }}>
            {show.items.map((it, i) => (
              <El key={i} an={s[`item${i}`]} t={t} style={{ alignItems: "center", marginTop: i ? 24 : 0, fontFamily: HAND, fontSize: Math.round(g.text * 1.25), color: C.ink }}>
                <div style={box({ width: Math.round(g.text * 1.5), color: markColor, fontWeight: 700, flexShrink: 0 })}>{markWord}</div>
                <div style={box({})}>{it}</div>
              </El>
            ))}
          </div>
        </>
      );
    }
    case "recap":
      return (
        <>
          <Title g={g} w={w} an={s.title} t={t} text={["จำง่าย ๆ", ""]} />
          <Note g={g} r={{ ...g.card, y: g.card.y + Math.round(g.card.h * 0.08) }} an={s.card} t={t} lines={show.lines} tilt={0.8} scale={1.35} />
        </>
      );
    case "bars": {
      const r = g.bars;
      const max = Math.max(...show.rows.map((x) => x.value));
      const labelW = Math.round(r.w * 0.24);
      const trackW = r.w - labelW - 20;
      return (
        <>
          <Stamp g={g} w={w} an={s.stamp} t={t} myth={false} />
          <El an={s.lead} t={t} style={{ position: "absolute", left: 40, width: w - 80, top: g.quote - 10, flexDirection: "column", alignItems: "center", fontFamily: HAND, fontWeight: 700, fontSize: Math.round(g.quoteSize * 0.7), lineHeight: 1.2, color: C.ink }}>
            <div style={box({})}>{show.lead[0]}</div>
            <div style={box({})}>{show.lead[1]}</div>
          </El>
          <div style={abs({ left: r.x, top: r.y, width: r.w, flexDirection: "column" })}>
            {show.rows.map((row, i) => {
              const p = look(s[`bar${i}`], t).p;
              return (
                <div key={i} style={box({ alignItems: "center", marginTop: i ? Math.round(g.text * 0.9) : 0 })}>
                  <div style={box({ width: labelW, fontSize: g.text, color: C.ink, flexShrink: 0 })}>{row.label}</div>
                  <div style={box({ flexDirection: "column", width: trackW })}>
                    <div style={box({ width: Math.max(8, Math.round(trackW * (row.value / max) * p)), height: Math.round(g.text * 0.9), background: C.coin, border: `4px solid ${C.ink}`, borderRadius: 12 })} />
                    <div style={box({ fontFamily: HAND, fontWeight: 700, fontSize: Math.round(g.text * 1.2), color: C.ink, opacity: p > 0.6 ? 1 : 0 })}>{row.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <El an={s.source} t={t} style={{ position: "absolute", left: 40, width: w - 80, top: r.y + r.h + 10, justifyContent: "center", fontSize: Math.round(g.text * 0.62), color: C.ink, opacity: 0.8 }}>{show.source}</El>
        </>
      );
    }
    case "family": {
      const r = g.family;
      const pl = look(s.people, t);
      const people = [c.input.faces.hero, ...CHILDREN, partnerFace(c.input)];
      const adult = Math.round(r.w * 0.29);
      const child = Math.round(r.w * 0.2);
      const noteR = c.size === "portrait" ? { x: g.note.x, y: g.note.y + 40, w: g.note.w, h: g.note.h } : { x: r.x + r.w + 30, y: r.y + 40, w: SIZES[c.size].w - (r.x + r.w + 30) - 50, h: g.note.h };
      return (
        <>
          <Title g={g} w={w} an={s.title} t={t} text={show.title} />
          <div style={abs({ left: r.x, top: r.y, width: r.w, height: r.h, justifyContent: "center", alignItems: "flex-end", opacity: pl.opacity, ...(pl.transform ? { transform: pl.transform } : {}) })}>
            {people.map((id, i) => {
              const size = i === 0 || i === people.length - 1 ? adult : child;
              return (
                <div key={id} style={box({ width: size, height: size, marginLeft: i ? 8 : 0 })}>
                  <Img src={c.faces[id]} r={{ x: 0, y: 0, w: size, h: size }} />
                </div>
              );
            })}
          </div>
          <Note g={g} r={noteR} an={s.note} t={t} lines={show.note} />
        </>
      );
    }
    case "gift": {
      const gl = look(s.gift, t);
      const noteR = c.size === "portrait" ? g.note : { x: g.gift.x + g.gift.w + 60, y: g.gift.y + 40, w: SIZES[c.size].w - (g.gift.x + g.gift.w + 60) - 60, h: g.note.h };
      return (
        <>
          <Title g={g} w={w} an={s.title} t={t} text={show.title} />
          <div style={abs({ left: g.gift.x, top: g.gift.y, width: g.gift.w, height: g.gift.h, opacity: gl.opacity, ...(gl.transform ? { transform: gl.transform } : {}) })}>{GIFT({ x: 0, y: 0, w: g.gift.w, h: g.gift.h })}</div>
          <Note g={g} r={noteR} an={s.note} t={t} lines={show.note} />
        </>
      );
    }
    case "kin": {
      const k = g.kin;
      const row = show.bag ? k.rowBag : k.row;
      const side = show.bag ? k.sideBag : k.side;
      const pl = look(s.people, t);
      const gone = look(s.gone, t).p;
      const bl = look(s.bag, t);
      const ml = look(s.marks, t);
      const sizes = kinSizes(show.people, row);
      // portrait and square have the stickers and note under the row; landscape beside it
      const under = c.size !== "landscape";
      const mark = (x: number, y: number, size: number, rot: number) => (
        <div style={abs({ left: x, top: y, fontFamily: HAND, fontWeight: 700, fontSize: size, color: C.red, opacity: ml.opacity, transform: `rotate(${rot}deg)${ml.transform ? ` ${ml.transform}` : ""}` })}>?</div>
      );
      return (
        <>
          <Title g={g} w={w} an={s.title} t={t} text={show.title} />
          {show.bag ? (
            <div style={abs({ left: k.bag.x, top: k.bag.y, width: k.bag.w, height: k.bag.h, opacity: bl.opacity, ...(bl.transform ? { transform: bl.transform } : {}) })}>
              {BAG({ x: 0, y: 0, w: k.bag.w, h: k.bag.h })}
              <div style={abs({ left: 0, width: k.bag.w, top: Math.round(k.bag.h * 0.42), justifyContent: "center", fontSize: Math.round(k.bag.h * 0.32), fontWeight: 600, color: C.ink })}>฿</div>
            </div>
          ) : null}
          <div style={abs({ left: row.x, top: row.y, width: row.w, height: row.h, justifyContent: "center", alignItems: "flex-end", opacity: pl.opacity, ...(pl.transform ? { transform: pl.transform } : {}) })}>
            {show.people.map((p, i) => <Person key={`${p.id}${i}`} c={c} p={p} size={sizes[i]} gap={i ? KIN_GAP : 0} gone={gone} />)}
          </div>
          {show.marks ? mark(row.x + Math.round(row.w * 0.78), row.y + Math.round(row.h * 0.05), Math.round(row.h * 0.4), 14) : null}
          {show.marks ? mark(row.x + Math.round(row.w * 0.12), row.y + Math.round(row.h * 0.2), Math.round(row.h * 0.28), -12) : null}
          {show.hearts ? <Hearts an={s.hearts} t={t} x={row.x} y={row.y + row.h + 20} w={row.w} size={Math.round(row.h * 0.16)} /> : null}
          {show.tags ? (
            <div style={abs({ left: side.x, top: side.y, width: side.w, flexWrap: "wrap", justifyContent: "center", ...(under ? {} : { flexDirection: "column", alignItems: "center" }) })}>
              {show.tags.items.map((tag, i) => {
                const tl = look(s[`tag${i}`], t);
                const color = show.tags!.red ? C.red : C.ink;
                return (
                  <div key={i} style={box({ margin: Math.round(g.text * 0.3), background: C.note, border: `4px solid ${color}`, borderRadius: 14, padding: `${Math.round(g.text * 0.2)}px ${Math.round(g.text * 0.55)}px`, fontFamily: HAND, fontWeight: 600, fontSize: Math.round(g.text * 1.15), color, opacity: tl.opacity, transform: `rotate(${i % 2 ? 2 : -2}deg)${tl.transform ? ` ${tl.transform}` : ""}` })}>{tag}</div>
                );
              })}
            </div>
          ) : null}
          {show.note ? <Note g={g} r={side} an={s.note} t={t} lines={show.note} /> : null}
        </>
      );
    }
    case "timeline": {
      const L = g.line;
      const p = look(s.line, t).p;
      const last = show.rows.length - 1;
      const len = last * L.step;
      const ageSize = Math.round(g.text * 1.8);
      const labelSize = Math.round(g.text * 1.25);
      const dot = Math.round(g.text * 0.7);
      // the marks' column as wide as the widest, the whole centred (a Thai letter is ~0.5 of the size wide)
      const markW = Math.max(Math.round(ageSize * 1.5), Math.max(...show.rows.map((r) => [...r.at].length)) * Math.round(ageSize * 0.5) + Math.round(g.text * 0.6));
      const labelW = Math.max(...show.rows.map((r) => [...r.label].length)) * Math.round(labelSize * 0.5);
      const x = Math.min(L.x, Math.max(60, Math.round((w - dot - g.text * 0.7 - markW - labelW) / 2)));
      return (
        <>
          <Title g={g} w={w} an={s.title} t={t} text={show.title} />
          <div style={abs({ left: x - 4, top: L.y + Math.round(ageSize * 0.6), width: 8, height: Math.max(0, Math.round(len * p)), background: C.ink, borderRadius: 4 })} />
          {show.rows.map((r, i) => (
            <El key={i} an={s[`row${i}`]} t={t} style={{ position: "absolute", left: x - Math.round(dot / 2), top: L.y + i * L.step, alignItems: "center", fontFamily: HAND, color: i === last ? GREEN : C.ink }}>
              <div style={box({ width: dot, height: dot, borderRadius: dot, background: C.coin, border: `4px solid ${C.ink}`, flexShrink: 0 })} />
              <div style={box({ marginLeft: Math.round(g.text * 0.7), width: markW, fontSize: ageSize, fontWeight: 700, flexShrink: 0 })}>{r.at}</div>
              <div style={box({ width: w - x - dot - Math.round(g.text * 0.7) - markW - 50, fontSize: labelSize, fontWeight: 600, flexWrap: "wrap" })}>{r.label}</div>
            </El>
          ))}
        </>
      );
    }
    case "card":
      return (
        <>
          <Title g={g} w={w} an={s.title} t={t} text={show.title} />
          <Note g={g} r={{ ...g.card, y: g.card.y + Math.round(g.card.h * 0.1) }} an={s.card} t={t} lines={show.lines} tilt={0.8} scale={1.2} />
        </>
      );
    case "pic": {
      const P = g.pic;
      const icon = show.face && show.note ? P.icon : show.face ? P.iconPair : P.iconSolo;
      const faceR = show.note ? P.face : P.facePair;
      const il = look(s.icon, t);
      const fl = look(s.face, t);
      return (
        <>
          <Title g={g} w={w} an={s.title} t={t} text={show.title} />
          <div style={abs({ left: icon.x, top: icon.y, width: icon.w, height: icon.h, opacity: il.opacity, ...(il.transform ? { transform: il.transform } : {}) })}>
            {ICON[show.icon]({ x: 0, y: 0, w: icon.w, h: icon.h })}
            {show.icon === "bag" ? <div style={abs({ left: 0, width: icon.w, top: Math.round(icon.h * 0.42), justifyContent: "center", fontSize: Math.round(icon.h * 0.32), fontWeight: 600, color: C.ink })}>฿</div> : null}
            {show.icon === "calendar" && show.day ? <div style={abs({ left: 0, width: icon.w, top: Math.round(icon.h * 0.4), justifyContent: "center", fontFamily: HAND, fontSize: Math.round(icon.h * 0.36), fontWeight: 700, color: C.ink })}>{show.day}</div> : null}
          </div>
          {show.face ? (
            <div style={abs({ left: faceR.x, top: faceR.y, width: faceR.w, height: faceR.h, opacity: fl.opacity, ...(fl.transform ? { transform: fl.transform } : {}) })}>
              <Img src={c.faces[show.face]} r={{ x: 0, y: 0, w: faceR.w, h: faceR.h }} />
            </div>
          ) : null}
          {show.hearts && show.face ? <Hearts an={s.hearts} t={t} x={faceR.x - faceR.w / 2} y={faceR.y + faceR.h + 10} w={faceR.w * 2} size={Math.round(faceR.w * 0.16)} /> : null}
          {show.note ? <Note g={g} r={show.face ? P.note : P.noteSolo} an={s.note} t={t} lines={show.note} /> : null}
        </>
      );
    }
  }
}

/** three hearts in a row, rising in */
function Hearts({ an, t, x, y, w, size }: { an?: Anim; t: number; x: number; y: number; w: number; size: number }) {
  const l = look(an, t);
  return (
    <div style={abs({ left: Math.round(x), top: Math.round(y), width: Math.round(w), justifyContent: "center", opacity: l.opacity, ...(l.transform ? { transform: l.transform } : {}) })}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={box({ width: size, height: size, margin: `0 ${Math.round(size * 0.3)}px`, marginTop: i === 1 ? 0 : Math.round(size * 0.3) })}>
          <svg width={size} height={size} viewBox="0 0 100 100"><path d="M50 88 C20 66 6 50 6 32 C6 18 18 8 31 8 C40 8 46 13 50 20 C54 13 60 8 69 8 C82 8 94 18 94 32 C94 50 80 66 50 88 Z" fill={C.red} stroke={C.ink} strokeWidth={4} /></svg>
        </div>
      ))}
    </div>
  );
}

/** the drawn things of หลังการขาย, each in a 100 × 100 box */
const svgBox = (r: Rect, body: React.ReactNode) => <svg width={r.w} height={r.h} viewBox="0 0 100 100">{body}</svg>;
const FLOWER = (r: Rect, petal: string) => svgBox(r, (
  <>
    <path d="M50 58 V96" stroke={C.green} strokeWidth={5} />
    {[0, 72, 144, 216, 288].map((deg) => <ellipse key={deg} cx={50} cy={30} rx={13} ry={20} fill={petal} stroke={C.ink} strokeWidth={3} transform={`rotate(${deg} 50 46)`} />)}
    <circle cx={50} cy={46} r={9} fill={C.coin} stroke={C.ink} strokeWidth={3} />
  </>
));
const ICON: Record<PicIcon, (r: Rect) => React.ReactNode> = {
  policy: (r) => svgBox(r, (
    <>
      <rect x={20} y={6} width={60} height={82} rx={6} fill={C.note} stroke={C.ink} strokeWidth={3.4} />
      <path d="M31 26 H69 M31 39 H69 M31 52 H56" stroke={C.ink} strokeWidth={3} strokeLinecap="round" />
      <circle cx={64} cy={72} r={10} fill={C.red} />
      <path d="M58 79 L54 96 L64 90 L74 96 L70 79" fill={C.red} />
    </>
  )),
  calendar: (r) => svgBox(r, (
    <>
      <rect x={12} y={18} width={76} height={70} rx={8} fill={C.note} stroke={C.ink} strokeWidth={3.4} />
      <path d="M12 30 Q12 18 24 18 H76 Q88 18 88 30 V38 H12 Z" fill={C.red} stroke={C.ink} strokeWidth={3.4} />
      <path d="M30 8 V26 M70 8 V26" stroke={C.ink} strokeWidth={4} strokeLinecap="round" />
    </>
  )),
  cake: (r) => svgBox(r, (
    <>
      <rect x={16} y={52} width={68} height={36} rx={6} fill={C.cake} stroke={C.ink} strokeWidth={3.4} />
      <path d="M16 65 Q33 74 50 65 Q67 74 84 65" fill="none" stroke={C.ink} strokeWidth={3} />
      <rect x={26} y={38} width={48} height={15} rx={4} fill={C.note} stroke={C.ink} strokeWidth={3} />
      <path d="M50 20 V38" stroke={C.ink} strokeWidth={3} />
      <path d="M50 6 Q57 15 50 20 Q43 15 50 6" fill={C.coin} stroke={C.ink} strokeWidth={2} />
    </>
  )),
  fireworks: (r) => svgBox(r, (
    <>
      <path d="M30 34 V12 M30 34 L48 24 M30 34 L48 44 M30 34 L12 24 M30 34 L12 44 M30 34 V56" stroke={C.red} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M70 62 V36 M70 62 L90 50 M70 62 L90 74 M70 62 L50 50 M70 62 L50 74 M70 62 V88" stroke={C.coin} strokeWidth={3.4} strokeLinecap="round" />
      <circle cx={62} cy={14} r={4} fill={C.green} /><circle cx={16} cy={78} r={3.5} fill={C.coin} /><circle cx={92} cy={22} r={3} fill={C.red} />
    </>
  )),
  lantern: (r) => svgBox(r, (
    <>
      <path d="M50 4 V16" stroke={C.ink} strokeWidth={3} />
      <rect x={38} y={14} width={24} height={8} rx={2} fill={C.coin} stroke={C.ink} strokeWidth={3} />
      <ellipse cx={50} cy={50} rx={34} ry={28} fill={C.red} stroke={C.ink} strokeWidth={3.4} />
      <path d="M50 22 Q34 50 50 78 M50 22 Q66 50 50 78" fill="none" stroke={C.ink} strokeWidth={2.4} />
      <rect x={38} y={77} width={24} height={8} rx={2} fill={C.coin} stroke={C.ink} strokeWidth={3} />
      <path d="M44 85 V96 M50 85 V98 M56 85 V96" stroke={C.coin} strokeWidth={3} />
    </>
  )),
  water: (r) => svgBox(r, (
    <>
      <path d="M14 48 H86 Q82 86 50 88 Q18 86 14 48 Z" fill={C.water} stroke={C.ink} strokeWidth={3.4} />
      <path d="M32 36 Q38 26 32 16 M50 36 Q56 26 50 16 M68 36 Q74 26 68 16" stroke={C.waterInk} strokeWidth={3} fill="none" strokeLinecap="round" />
    </>
  )),
  jasmine: (r) => FLOWER(r, C.white),
  canna: (r) => FLOWER(r, C.coin),
  gift: (r) => GIFT(r),
  bag: (r) => BAG(r),
};

const KIN_GAP = 10;
/** how much of an adult's width each of the family takes */
const KIN_WEIGHT: Record<Kin["size"], number> = { hero: 1.25, adult: 1, old: 1, kid: 0.72 };

/** each person's size in the row: as large as the row's width and height allow */
function kinSizes(people: Kin[], row: Rect): number[] {
  const weights = people.map((p) => KIN_WEIGHT[p.size]);
  const unit = Math.min((row.w - KIN_GAP * (people.length - 1)) / weights.reduce((x, y) => x + y, 0), row.h / Math.max(...weights));
  return weights.map((x) => Math.floor(unit * x));
}

/** one of the family: in colour, or grey ("sick"), or a grey dashed outline ("dash"; "gone" fades into one as the scene plays) */
function Person({ c, p, size, gap, gone }: { c: StoryContext; p: Kin; size: number; gap: number; gone: number }) {
  const fade = p.state === "gone" ? gone : p.state === "dash" ? 1 : 0;
  const colour = p.state === "sick" ? 0 : 1 - fade;
  const grey = p.state === "sick" ? 1 : 0.38 * fade;
  const r = { x: 0, y: 0, w: size, h: size };
  return (
    <div style={box({ position: "relative", width: size, height: size, marginLeft: gap, flexShrink: 0 })}>
      {grey > 0 ? <Img src={c.faces[`${p.id}-g`]} r={r} opacity={grey} /> : null}
      {colour > 0 ? <Img src={c.faces[p.id]} r={r} opacity={colour} /> : null}
      {fade > 0 ? (
        <div style={abs({ left: 0, top: 0, width: size, height: size, opacity: fade })}>
          <svg width={size} height={size} viewBox="0 0 100 100"><circle cx={50} cy={50} r={46} fill="none" stroke={C.ink} strokeWidth={2.4} strokeDasharray="7 6" /></svg>
        </div>
      ) : null}
    </div>
  );
}

/** One knowledge scene's frame body at scene time t (story-frames.ts adds the subtitle and footer). */
export function knowBody(key: KnowSceneKey | "storyContact", c: StoryContext, t: number, episode: KnowEpisode) {
  if (key === "storyContact") return <Contact c={c} t={t} />;
  return <Scene c={c} t={t} show={sceneOf(episode, key)} />;
}

/** the faces an episode draws: the hero, the narrator, and the family scene's or the family episode's */
export function knowFaces(input: StoryVideoInput): string[] {
  const shelf = topicOf(input.topic)?.shelf;
  const family = shelf === "family" || shelf === "life" ? familyFaces(input) : [partnerFace(input), ...CHILDREN];
  return [input.faces.hero, input.faces.narrator, ...family];
}
