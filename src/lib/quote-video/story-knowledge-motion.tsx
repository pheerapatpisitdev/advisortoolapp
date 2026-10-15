import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { CHILDREN } from "@/lib/story/faces";
import { a, abs, box, El, look, stroke, type Anim } from "./motion";
import type { StoryVideoInput } from "./story";
import { knowEpisode, partnerFace, type KnowEpisode, type KnowSceneKey, type KnowShow, type NoteLine } from "./story-knowledge";
import { Contact, Img, type StoryContext } from "./story-motion";
import { SIZES, type VideoSize } from "./timeline";

/**
 * ความรู้ประกัน 1 นาที's scenes on paper (story-knowledge.ts says what each shows), as the owner
 * approved them in the mockup (2026-10-15): a question with the one who wonders, a belief stamped
 * and struck out, money flowing out or in, notes, lists with ticks or crosses, bars of real
 * premiums, a family, a gift, and the line to remember. Titles in the handwriting face (Mali).
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
  },
  square: {
    title: 50, titleSize: 76, text: 32, stamp: 40, quote: 190, quoteSize: 86,
    ask: { x: 330, y: 260, w: 420, h: 420 }, face: { x: 70, y: 300, w: 320, h: 320 }, note: { x: 420, y: 290, w: 600, h: 480 },
    card: { x: 150, y: 230, w: 780, h: 560 },
    flow: { face: { x: 90, y: 250, w: 280, h: 280 }, arrow: { x: 390, y: 350, w: 150, h: 80 }, icon: { x: 580, y: 250, w: 290, h: 260 }, note: { x: 170, y: 590, w: 740, h: 220 } },
    fact: { x: 170, y: 400, w: 740, h: 400 }, bars: { x: 120, y: 330, w: 840, h: 380 }, family: { x: 60, y: 260, w: 560, h: 360 },
    gift: { x: 90, y: 270, w: 340, h: 340 }, mythFace: { x: 400, y: 480, w: 280, h: 280 },
  },
  landscape: {
    title: 46, titleSize: 80, text: 38, stamp: 40, quote: 190, quoteSize: 96,
    ask: { x: 700, y: 250, w: 520, h: 520 }, face: { x: 260, y: 250, w: 460, h: 460 }, note: { x: 860, y: 280, w: 840, h: 480 },
    card: { x: 460, y: 220, w: 1000, h: 580 },
    flow: { face: { x: 220, y: 260, w: 380, h: 380 }, arrow: { x: 660, y: 400, w: 200, h: 100 }, icon: { x: 920, y: 280, w: 360, h: 330 }, note: { x: 1340, y: 300, w: 480, h: 380 } },
    fact: { x: 460, y: 390, w: 1000, h: 420 }, bars: { x: 360, y: 330, w: 1200, h: 380 }, family: { x: 140, y: 290, w: 980, h: 420 },
    gift: { x: 300, y: 260, w: 440, h: 440 }, mythFace: { x: 790, y: 470, w: 340, h: 340 },
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
  }
}

const sceneOf = (e: KnowEpisode, key: KnowSceneKey) => e.scenes.find((s) => s.key === key)!.show;

/** When a knowledge scene's things move, in scene seconds: the card's as กองกลาง's */
export function knowWindows(key: KnowSceneKey | "storyContact", input: StoryVideoInput): [number, number][] {
  const spec = key === "storyContact"
    ? { face: a(0.2, "pop"), name: a(0.6, "up"), cta: a(1.1, "up"), legal: a(1.6, "fade") }
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
function Note({ g, r, an, t, lines, tilt = -1.2, scale = 1 }: { g: Geo; r: Rect; an?: Anim; t: number; lines: NoteLine[]; tilt?: number; scale?: number }) {
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
      const markWord = { check: "✓", cross: "✗", box: "☐" }[show.mark];
      const markColor = show.mark === "check" ? GREEN : show.mark === "cross" ? C.red : C.ink;
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
  }
}

/** One knowledge scene's frame body at scene time t (story-frames.ts adds the subtitle and footer). */
export function knowBody(key: KnowSceneKey | "storyContact", c: StoryContext, t: number, episode: KnowEpisode) {
  if (key === "storyContact") return <Contact c={c} t={t} cta={episode.cta} />;
  return <Scene c={c} t={t} show={sceneOf(episode, key)} />;
}

/** the faces an episode draws: the hero, the narrator, and the family scene's */
export function knowFaces(input: StoryVideoInput): string[] {
  return [input.faces.hero, input.faces.narrator, partnerFace(input), ...CHILDREN];
}
