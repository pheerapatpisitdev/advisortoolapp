import { CARD_PALETTE as P, QUOTE_VIDEO_COLORS, STORY_CLIP_COLORS } from "@/lib/card-theme";
import { CROWD_HERO, FACE_PAPER } from "@/lib/story/faces";
import { blend, Figure, GROUNDS, lookFromId, POSES, type Drawn, type Pose, type PoseName } from "@/lib/story/figure";
import { topicOf } from "@/lib/story/topics";
import { a, abs, box, El, look, stroke, type Anim } from "./motion";
import { heroName, planName, storyEvent, termShort, type StorySceneKey, type StoryVideoInput } from "./story";
import { AFTER_CLOSE, type AfterTopic } from "./story-after";
import type { KnowSceneKey } from "./story-knowledge";
import { captionShown, wordAt } from "./caption";
import { LEAD, SIZES, wordTimes, type VideoSize } from "./timeline";
import { VIDEO_WORDS } from "./video-words";

/**
 * คลิปเล่าเรื่อง's six scenes (story.ts), drawn on paper with the owner's cartoon faces, as the
 * owner approved them in the mockup (2026-10-15): the crowd of 48 popping in, a coin on every
 * face and the jar filling, the one it happens to ringed in red, the jar paying out, everyone
 * coloured in, and the agent's card.
 *
 * Each frame is transparent over the paper (storyBackground), drawn at scene time t; the
 * Motion Graphic world's helpers (motion.tsx) time the movements. Titles are in a handwriting
 * face (Mali) when it can be had, in Plex when not.
 */

const C = STORY_CLIP_COLORS;
const INK = C.ink;
const RED = C.red;
const COIN = C.coin;
const NOTE = C.note;
const HAND = "Mali";

type Rect = { x: number; y: number; w: number; h: number };
interface Geo {
  cols: number;
  rows: number;
  title: number;
  titleSize: number;
  crowd: Rect;
  pool: { crowd: Rect; jar: Rect };
  help: { jar: Rect; arrow: Rect; hero: Rect; name: Rect; note: Rect };
  /** the agent's card, as วิดีโอนำเสนอ draws it (draw.tsx and classic-wide.tsx ContactScene) */
  contact: { side: number; top: number; face: number; px: (portrait: number, square: number, landscape: number) => number };
  sub: number;
}

/** where everything stands, for each shape of clip */
const GEO: Record<VideoSize, Geo> = {
  portrait: {
    cols: 6, rows: 8, title: 110, titleSize: 104,
    crowd: { x: 110, y: 380, w: 860, h: 1140 },
    pool: { crowd: { x: 170, y: 360, w: 740, h: 880 }, jar: { x: 390, y: 1270, w: 300, h: 330 } },
    help: { jar: { x: 80, y: 560, w: 340, h: 380 }, arrow: { x: 430, y: 690, w: 190, h: 95 }, hero: { x: 630, y: 520, w: 380, h: 380 }, name: { x: 600, y: 920, w: 440, h: 80 }, note: { x: 140, y: 1100, w: 800, h: 330 } },
    contact: { side: 70, top: 220, face: 220, px: (v) => v },
    sub: 96,
  },
  square: {
    cols: 8, rows: 6, title: 50, titleSize: 76,
    crowd: { x: 130, y: 225, w: 820, h: 560 },
    pool: { crowd: { x: 70, y: 230, w: 620, h: 520 }, jar: { x: 730, y: 330, w: 280, h: 310 } },
    help: { jar: { x: 90, y: 250, w: 250, h: 280 }, arrow: { x: 350, y: 350, w: 150, h: 80 }, hero: { x: 540, y: 215, w: 280, h: 280 }, name: { x: 490, y: 500, w: 380, h: 64 }, note: { x: 230, y: 590, w: 620, h: 170 } },
    contact: { side: 56, top: 90, face: 170, px: (_, v) => v },
    sub: 60,
  },
  landscape: {
    cols: 12, rows: 4, title: 46, titleSize: 80,
    crowd: { x: 220, y: 230, w: 1480, h: 500 },
    pool: { crowd: { x: 110, y: 230, w: 1200, h: 470 }, jar: { x: 1420, y: 250, w: 360, h: 400 } },
    help: { jar: { x: 200, y: 260, w: 340, h: 380 }, arrow: { x: 580, y: 400, w: 200, h: 100 }, hero: { x: 830, y: 220, w: 400, h: 400 }, name: { x: 810, y: 630, w: 440, h: 80 }, note: { x: 1320, y: 300, w: 520, h: 300 } },
    contact: { side: 90, top: 130, face: 220, px: (_, __, v) => v },
    sub: 60,
  },
};

/** กองกลาง 48 คน's scenes (an episode of ความรู้ประกัน 1 นาที has its own, story-knowledge.ts) */
export type PoolSceneKey = Exclude<StorySceneKey, KnowSceneKey | "freeScene">;

const rowsOf = (size: VideoSize) => GEO[size].rows;

/** When each element of a scene moves, in scene seconds. */
export function storySpec(key: PoolSceneKey, input: StoryVideoInput, size: VideoSize): Record<string, Anim> {
  const rows = rowsOf(size);
  const s: Record<string, Anim> = { title: a(0.2, "up") };
  switch (key) {
    case "storyHook":
      for (let r = 0; r < rows; r++) s[`row${r}`] = a(0.45 + r * 0.12, "pop", 0.45);
      return s;
    case "storyPool":
      s.jar = a(0.4, "pop");
      for (let r = 0; r < rows; r++) s[`coin${r}`] = a(0.9 + r * 0.15, "pop", 0.4);
      s.fill = a(0.9, "grow", rows * 0.15 + 0.5);
      return s;
    case "storyHit":
      return { ...s, dim: a(0.5, "fade", 0.6), hero: a(1.0, "pop"), ring: a(1.3, "stroke", 0.9) };
    case "storyHelp":
      return { ...s, jar: a(0.4, "pop"), arrow: a(0.9, "stroke", 0.7), hero: a(1.4, "pop"), color: a(1.9, "fade", 0.8), name: a(1.9, "fade"), ...(input.figure ? { note: a(2.6, "pop") } : {}) };
    case "storyAll":
      for (let r = 0; r < rows; r++) s[`row${r}`] = a(0.5 + r * 0.22, input.palette === "color" ? "pop" : "fade", 0.7);
      return s;
    case "storyContact":
      return contactSpec();
  }
}

/** the agent's card, every story's last scene: its heading, the card, and the small print */
export const contactSpec = (): Record<string, Anim> => ({ head: a(0.2, "up"), card: a(0.7, "up"), legal: a(1.4, "fade") });

export const storyWindows = (key: PoolSceneKey, input: StoryVideoInput, size: VideoSize): [number, number][] =>
  Object.values(storySpec(key, input, size)).map((x) => [x.at, x.at + x.dur]);

export interface StoryContext {
  input: StoryVideoInput;
  size: VideoSize;
  /** the hero's name as told, "" for a clip without one */
  customer: string;
  narrator: "F" | "M";
  contact: { name: string; phone: string; line?: string; more?: string; photo?: string };
  /** the 48, the hero at CROWD_HERO (lib/story/faces.ts crowdOf) */
  crowd: string[];
  /** face id → data URI; `${id}-g` the grey one (story-faces.ts) */
  faces: Record<string, string>;
  words: string[];
  voiceSec: number;
}

/** the big title and the line under it, scene by scene: drawn, and the handwriting face is cut to them */
export function storyTitles(input: StoryVideoInput, customer: string): Record<Exclude<PoolSceneKey, "storyContact">, [string, string]> {
  const ev = storyEvent(input.figure);
  const name = heroName(customer);
  return {
    storyHook: ["48 คน", `ถ้ามีคนหนึ่ง${ev.shown} จะเป็นใคร?`],
    storyPool: ["หยอดคนละนิด", "ลงโหลใบเดียวกัน"],
    storyHit: ["วันหนึ่ง…", name ? `คนนั้นคือ ${name}` : `คนหนึ่ง${ev.shown}`],
    storyHelp: ["เงินกองกลาง", `${ev.paid}${name || "คนนั้น"}`],
    storyAll: ["นี่แหละ", "คือประกัน"],
  };
}

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const sumWord = (v: number) => (v >= 1_000_000 && v % 100_000 === 0 ? `${(v / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้าน` : n(v));

/** the scene's jar note: the figure, when the clip shows one */
export function noteLines(input: StoryVideoInput): [string, string, string] | null {
  const f = input.figure;
  if (!f) return null;
  return [`${f.sex === "F" ? "หญิง" : "ชาย"} ${f.age} ปี · ทุน ${sumWord(f.sumAssured)}`, `หยอดปีละ ${n(f.annual)} บาท`, `ตัวอย่างจาก ${planName(f.plan)} ${termShort(f)}`];
}

/** every letter a clip's titles and note use, for the handwriting face */
export function storyHandText(input: StoryVideoInput, customer: string): string {
  return [...Object.values(storyTitles(input, customer)).flat(), ...(noteLines(input) ?? []), "0123456789,"].join("");
}

function Title({ c, an, t, text }: { c: StoryContext; an?: Anim; t: number; text: [string, string] }) {
  const g = GEO[c.size];
  const { w } = SIZES[c.size];
  return (
    <El an={an} t={t} style={{ position: "absolute", left: 40, width: w - 80, top: g.title, flexDirection: "column", alignItems: "center", fontFamily: HAND, color: paperInk(c.input) }}>
      <div style={box({ fontSize: g.titleSize, fontWeight: 600, lineHeight: 1.15 })}>{text[0]}</div>
      <div style={box({ fontSize: Math.round(g.titleSize * 0.46), marginTop: 6, textAlign: "center" })}>{text[1]}</div>
    </El>
  );
}

/** the crowd's cells: each face's box inside `area`, centred, `cols` across */
function cells(area: Rect, cols: number, rows: number): Rect[] {
  const cell = Math.floor(Math.min(area.w / cols, area.h / rows));
  const face = Math.round(cell * 0.92);
  const left = area.x + Math.round((area.w - cell * cols) / 2);
  const top = area.y + Math.round((area.h - cell * rows) / 2);
  return Array.from({ length: cols * rows }, (_, i) => ({
    x: left + (i % cols) * cell + Math.round((cell - face) / 2), y: top + Math.floor(i / cols) * cell + Math.round((cell - face) / 2), w: face, h: face,
  }));
}

// eslint-disable-next-line @next/next/no-img-element
export const Img = ({ src, r, opacity = 1 }: { src?: string; r: Rect; opacity?: number }) => (src ? <img src={src} width={r.w} height={r.h} style={{ position: "absolute", left: r.x, top: r.y, opacity }} alt="" /> : null);

/** มินิมอล (lib/story/figure.tsx): whole people in place of the faces, on the ground the agent picked */
export const minimal = (input: StoryVideoInput) => input.art === "minimal";
export const groundOf = (input: StoryVideoInput) => GROUNDS[input.ground ?? "lav"];
/** the colour of words written straight on the ground: light on the dark one */
export const paperInk = (input: StoryVideoInput) => (minimal(input) ? groundOf(input).ink : INK);

/** how someone is drawn: the hero and the agent as the agent dressed them, anyone else from their id */
export function lookFor(id: string, input: StoryVideoInput): Drawn {
  const cast = input.cast;
  if (cast && id === input.faces.hero) return { ...cast.hero, age: "adult" };
  if (cast && id === input.faces.narrator) return { ...cast.narrator, age: "adult" };
  return lookFromId(id);
}

/**
 * Someone in the box `r`: their face, or (มินิมอล) their whole self in `pose`, moving at scene time t.
 * `gray`: the grey face, or drawn grey; `dash`: only a dashed outline (มินิมอล; a face scene draws its own ring).
 */
export function Pic({ c, id, r, opacity = 1, gray, dash, pose = "stand", t = 0, dir }: {
  c: StoryContext; id: string; r: Rect; opacity?: number; gray?: boolean; dash?: boolean; pose?: PoseName | Pose; t?: number; dir?: 1 | -1;
}) {
  if (!minimal(c.input)) return <Img src={c.faces[gray ? `${id}-g` : id]} r={r} opacity={opacity} />;
  const p = typeof pose === "string" ? POSES[pose](t) : pose;
  return (
    <div style={abs({ left: r.x, top: r.y, width: r.w, height: r.h, opacity })}>
      <Figure look={lookFor(id, c.input)} pose={p} w={r.w} h={r.h} g={groundOf(c.input)} gray={gray} dash={dash} dir={dir} />
    </div>
  );
}

/**
 * The 48. `color`: how coloured each row is, 0 grey to 1 colour (a "color" palette is always 1);
 * `rowAn`: each row's entrance; `opacity`: each face's own, the hero's apart.
 */
function Crowd({ c, area, t, rowAn, color, opacity, coins, pose }: {
  c: StoryContext; area: Rect; t: number; rowAn?: (r: number) => Anim | undefined;
  color: (r: number) => number; opacity?: (i: number) => number; coins?: (r: number) => Anim | undefined;
  /** มินิมอล: how the people stand, row by row */
  pose?: (r: number) => PoseName;
}) {
  const g = GEO[c.size];
  const rects = cells(area, g.cols, g.rows);
  return (
    <>
      {c.crowd.map((id, i) => {
        const r = rects[i];
        const row = Math.floor(i / g.cols);
        const l = look(rowAn?.(row), t);
        const p = c.input.palette === "color" ? 1 : color(row);
        const o = (opacity?.(i) ?? 1) * l.opacity;
        const coin = coins?.(row);
        const tall = minimal(c.input) ? { x: 0, y: -Math.round(r.h * 0.5), w: r.w, h: Math.round(r.h * 1.5) } : { x: 0, y: 0, w: r.w, h: r.h };
        const cl = coin ? look(coin, t) : null;
        return (
          <div key={i} style={{ display: "flex", position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, opacity: o, ...(l.transform ? { transform: l.transform } : {}) }}>
            {/* each a little out of step with the next, so the crowd does not breathe as one; มินิมอล's people stand
                taller than their cell, each row a little in front of the one behind */}
            {p < 1 ? <Pic c={c} id={id} r={tall} gray pose={pose?.(row)} t={t + i * 0.37} /> : null}
            {p > 0 ? <Pic c={c} id={id} r={tall} opacity={p} pose={pose?.(row)} t={t + i * 0.37} /> : null}
            {cl && cl.opacity > 0 ? (
              <div style={abs({ right: -Math.round(r.w * 0.06), bottom: -Math.round(r.w * 0.04), width: Math.round(r.w * 0.34), height: Math.round(r.w * 0.34), borderRadius: 999, background: COIN, border: `${Math.max(3, Math.round(r.w * 0.035))}px solid ${INK}`, opacity: cl.opacity, ...(cl.transform ? { transform: cl.transform } : {}) })} />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

const COINS: [number, number][] = [[44, 98], [64, 104], [82, 96], [52, 84], [72, 82], [36, 80], [90, 80], [60, 66], [44, 64], [78, 64], [62, 50], [48, 50]];

/** the jar, `p` of its coins in, drawn in the box `r` */
function jar(r: Rect, p: number) {
  const shown = Math.round(COINS.length * Math.max(0, Math.min(1, p)));
  return (
    <div style={abs({ left: r.x, top: r.y, width: r.w, height: r.h })}>
      <svg width={r.w} height={r.h} viewBox="0 0 120 130">
        <path d="M30 14 Q60 8 90 14 L92 28 Q108 40 106 74 Q104 118 60 122 Q16 118 14 74 Q12 40 28 28 Z" fill={C.jar} stroke={INK} strokeWidth={3.4} strokeLinejoin="round" />
        <path d="M27 28 Q60 34 93 28" fill="none" stroke={INK} strokeWidth={2.6} />
        {COINS.slice(0, shown).map(([x, y], i) => <circle key={i} cx={x} cy={y} r={8.5} fill={COIN} stroke={INK} strokeWidth={2.4} />)}
      </svg>
    </div>
  );
}

function Hook({ c, t }: { c: StoryContext; t: number }) {
  const s = storySpec("storyHook", c.input, c.size);
  return (
    <>
      <Title c={c} an={s.title} t={t} text={storyTitles(c.input, c.customer).storyHook} />
      <Crowd c={c} area={GEO[c.size].crowd} t={t} rowAn={(r) => s[`row${r}`]} color={() => 0} />
    </>
  );
}

function Pool({ c, t }: { c: StoryContext; t: number }) {
  const s = storySpec("storyPool", c.input, c.size);
  const g = GEO[c.size].pool;
  const j = look(s.jar, t);
  return (
    <>
      <Title c={c} an={s.title} t={t} text={storyTitles(c.input, c.customer).storyPool} />
      <Crowd c={c} area={g.crowd} t={t} color={() => 0} coins={(r) => s[`coin${r}`]} />
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: SIZES[c.size].w, height: SIZES[c.size].h, opacity: j.opacity, ...(j.transform ? { transform: j.transform } : {}) }}>
        {jar(g.jar, look(s.fill, t).p)}
      </div>
    </>
  );
}

function Hit({ c, t }: { c: StoryContext; t: number }) {
  const s = storySpec("storyHit", c.input, c.size);
  const g = GEO[c.size];
  const dim = look(s.dim, t).p;
  const hero = cells(g.crowd, g.cols, g.rows)[CROWD_HERO];
  const h = look(s.hero, t);
  // มินิมอล: a whole person is small in a crowd's cell, so the hero comes forward further, and slumps
  const grow = h.p > 0 ? 1 + (minimal(c.input) ? 1.3 : 0.25) * Math.min(1, h.p) : 1;
  const big = { x: Math.round(hero.x - (hero.w * (grow - 1)) / 2), y: Math.round(hero.y - (hero.h * (grow - 1)) / 2), w: Math.round(hero.w * grow), h: Math.round(hero.h * grow) };
  const ring = { x: big.x - Math.round(big.w * 0.22), y: big.y - Math.round(big.h * 0.2), w: Math.round(big.w * 1.44), h: Math.round(big.h * 1.4) };
  const heroId = c.crowd[CROWD_HERO];
  return (
    <>
      <Title c={c} an={s.title} t={t} text={storyTitles(c.input, c.customer).storyHit} />
      <Crowd c={c} area={g.crowd} t={t} color={() => 0} opacity={(i) => (i === CROWD_HERO ? 0 : 1 - 0.72 * dim)} />
      <Pic c={c} id={heroId} r={big} gray={c.input.palette !== "color"} pose={h.p > 0 ? "slump" : "stand"} t={t} />
      <div style={abs({ left: ring.x, top: ring.y, width: ring.w, height: ring.h })}>
        <svg width={ring.w} height={ring.h} viewBox="0 0 100 100">
          {stroke({ d: "M50 6 C80 4 96 26 94 52 C92 80 70 96 46 94 C20 92 4 72 6 46 C8 22 26 8 56 8", len: 300, p: look(s.ring, t).p, color: RED, width: 5 })}
        </svg>
      </div>
    </>
  );
}

function Help({ c, t }: { c: StoryContext; t: number }) {
  const s = storySpec("storyHelp", c.input, c.size);
  const g = GEO[c.size].help;
  const heroId = c.crowd[CROWD_HERO];
  const h = look(s.hero, t);
  const color = c.input.palette === "color" ? 1 : look(s.color, t).p;
  const note = noteLines(c.input);
  const j = look(s.jar, t);
  const nl = look(s.note, t);
  const name = heroName(c.customer);
  const ink = paperInk(c.input);
  // มินิมอล: slumped as the money comes, sitting up as it reaches them
  const up = blend(POSES.slump(t), POSES.sit(t), look(s.color, t).p);
  return (
    <>
      <Title c={c} an={s.title} t={t} text={storyTitles(c.input, c.customer).storyHelp} />
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: SIZES[c.size].w, height: SIZES[c.size].h, opacity: j.opacity }}>{jar(g.jar, 1 - 0.75 * look(s.arrow, t).p)}</div>
      <div style={abs({ left: g.arrow.x, top: g.arrow.y, width: g.arrow.w, height: g.arrow.h })}>
        <svg width={g.arrow.w} height={g.arrow.h} viewBox="0 0 80 40">
          {stroke({ d: "M4 24 Q36 8 64 20 M52 9 L66 20 L52 31", len: 110, p: look(s.arrow, t).p, color: ink, width: 4 })}
        </svg>
      </div>
      <div style={{ display: "flex", position: "absolute", left: g.hero.x, top: g.hero.y, width: g.hero.w, height: g.hero.h, opacity: h.opacity, ...(h.transform ? { transform: h.transform } : {}) }}>
        {color < 1 ? <Pic c={c} id={heroId} r={{ x: 0, y: 0, w: g.hero.w, h: g.hero.h }} gray pose={up} /> : null}
        <Pic c={c} id={heroId} r={{ x: 0, y: 0, w: g.hero.w, h: g.hero.h }} opacity={color} pose={up} />
      </div>
      {name ? (
        <El an={s.name} t={t} style={{ position: "absolute", left: g.name.x, width: g.name.w, top: g.name.y, justifyContent: "center", fontFamily: HAND, fontWeight: 600, fontSize: Math.round(g.name.h * 0.72), color: ink }}>{name}</El>
      ) : null}
      {note ? (
        <div style={{ display: "flex", position: "absolute", left: g.note.x, top: g.note.y, width: g.note.w, flexDirection: "column", alignItems: "center", background: NOTE, border: `4px solid ${INK}`, borderRadius: 14, padding: "22px 26px", opacity: nl.opacity, transform: `rotate(-1.5deg)${nl.transform ? ` ${nl.transform}` : ""}`, fontFamily: HAND, color: INK }}>
          <div style={box({ fontSize: Math.round(g.note.w * 0.05) })}>{note[0]}</div>
          <div style={box({ fontSize: Math.round(g.note.w * 0.078), fontWeight: 600, marginTop: 4 })}>{note[1]}</div>
          <div style={box({ fontSize: Math.round(g.note.w * 0.04), marginTop: 6, fontFamily: "Plex" })}>{note[2]}</div>
        </div>
      ) : null}
    </>
  );
}

function All({ c, t }: { c: StoryContext; t: number }) {
  const s = storySpec("storyAll", c.input, c.size);
  const reveal = c.input.palette !== "color";
  return (
    <>
      <Title c={c} an={s.title} t={t} text={storyTitles(c.input, c.customer).storyAll} />
      <Crowd c={c} area={GEO[c.size].crowd} t={t} rowAn={reveal ? undefined : (r) => s[`row${r}`]} color={(r) => (reveal ? look(s[`row${r}`], t).p : 1)} pose={(r) => (look(s[`row${r}`], t).p > 0.5 ? "cheer" : "stand")} />
    </>
  );
}

/**
 * the agent's card, every story's last scene (owner, 2026-10-16, choice ข, mockup
 * https://claude.ai/artifact/Ba6GTBtTTzGwqsFmqysnd2): วิดีโอนำเสนอ's closing card, the agent's
 * photo or their initial, laid on the story's paper, with the story's own small print under it.
 * An after-sale clip (หลังการขาย) does not offer to look at a plan: its big line is the story's
 * own close, "ด้วยความห่วงใย" and the like, and with no customer named it has no heading over it
 * (owner, 2026-10-16).
 */
export function Contact({ c, t }: { c: StoryContext; t: number }) {
  const s = contactSpec();
  const { w, h } = SIZES[c.size];
  const g = GEO[c.size].contact;
  const k = c.contact;
  const vw = VIDEO_WORDS.th;
  const after = topicOf(c.input.topic)?.shelf === "after";
  const lines = after ? [AFTER_CLOSE[c.input.topic as AfterTopic].cta] : vw.contactLines(c.narrator);
  // "สนใจรายละเอียดเพิ่มเติม" is a sales line: an after-sale clip with no customer goes without one
  const kicker = c.customer ? vw.contactFor(c.customer) : after ? "" : vw.contactMore;
  const initial = [...k.name.trim()][0] ?? "?";
  const more = k.more ? k.more.split("\n").filter(Boolean) : [];
  const portrait = c.size === "portrait";
  const wide = c.size === "landscape";
  const big = g.px(88, 62, 84);
  // on the dark ground the card's navy words would be lost: they take the ground's own ink
  const onDark = minimal(c.input) && c.input.ground === "dark";
  const head = (
    <El an={s.head} t={t} style={{ flexDirection: "column", ...(wide ? { width: 820, flexShrink: 0 } : {}) }}>
      {kicker ? <div style={box({ fontSize: g.px(44, 34, 44), fontWeight: 600, color: onDark ? paperInk(c.input) : P.accent })}>{kicker}</div> : null}
      <div style={box({ flexDirection: "column", fontSize: big, fontWeight: 600, color: onDark ? paperInk(c.input) : P.figure, lineHeight: vw.lineHeight, marginTop: kicker ? (portrait ? 40 : 12) : 0 })}>
        {lines.map((l, i) => <div key={i} style={box({})}>{l}</div>)}
      </div>
    </El>
  );
  return (
    <div style={abs({ left: g.side, width: w - g.side * 2, top: g.top, height: h - g.top - GEO[c.size].sub - 140, flexDirection: wide ? "row" : "column", alignItems: wide ? "center" : "flex-start" })}>
      {head}
      <div style={box({ flexDirection: "column", ...(wide ? { flex: 1 } : { width: w - g.side * 2 }), marginLeft: wide ? 40 : 0, marginTop: g.px(120, 36, 0) })}>
        <El an={s.card} t={t} style={{ background: C.white, border: `3px solid ${P.hair}`, borderRadius: g.px(44, 36, 36), padding: g.px(44, 30, 40), alignItems: "center" }}>
          {k.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={k.photo} width={g.face} height={g.face} style={{ borderRadius: g.face / 2, objectFit: "cover" }} alt="" />
          ) : (
            <div style={box({ width: g.face, height: g.face, borderRadius: g.face / 2, background: QUOTE_VIDEO_COLORS.noPhoto, alignItems: "center", justifyContent: "center", fontSize: g.px(110, 84, 110), fontWeight: 600, color: P.figure })}>{initial}</div>
          )}
          <div style={box({ flexDirection: "column", marginLeft: g.px(44, 34, 34), flexShrink: 1 })}>
            <div style={box({ fontSize: g.px(58, 44, 56), fontWeight: 600, color: P.ink })}>{k.name}</div>
            <div style={box({ fontSize: g.px(46, 34, 44), color: P.mute, marginTop: g.px(10, 6, 6) })}>{`${vw.phone} ${k.phone}`}</div>
            {k.line ? <div style={box({ fontSize: g.px(46, 34, 44), color: P.mute })}>{`LINE ${k.line}`}</div> : null}
          </div>
        </El>
        {more.length > 0 && (
          <El an={s.card} t={t} style={{ flexDirection: "column", fontSize: g.px(44, 34, 44), color: P.ink, lineHeight: 1.45, marginTop: g.px(30, 30, 30) }}>
            {more.map((m, i) => <div key={i} style={box({})}>{m}</div>)}
          </El>
        )}
        <El an={s.legal} t={t} style={{ flexWrap: "wrap", fontSize: g.px(32, 22, 26), color: onDark ? paperInk(c.input) : P.mute, opacity: onDark ? 0.8 : 1, marginTop: g.px(24, 18, 18) }}>
          {/* the drawing breaks Thai only at a space: one where the line may wrap */}
          ผู้ซื้อควรทำความเข้าใจรายละเอียดความคุ้มครอง และเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง
        </El>
      </div>
      {/* มินิมอล, portrait: the agent waves under their card (the mockup's last scene); the wider shapes have no room */}
      {minimal(c.input) && portrait && c.input.faces.narrator ? (
        // in the band between the small print and the subtitle: 1420–1700 of the 1920
        <El an={s.legal} t={t} style={{ position: "absolute", left: Math.round((w - g.side * 2 - 260) / 2), top: 1420 - g.top, width: 260, height: 280 }}>
          <Pic c={c} id={c.input.faces.narrator} r={{ x: 0, y: 0, w: 260, h: 280 }} pose="wave" t={t} />
        </El>
      ) : null}
    </div>
  );
}

/** the words of the line as the voice reaches them, on a dark strip near the foot */
export function Subtitle({ c, t }: { c: StoryContext; t: number }) {
  const { w } = SIZES[c.size];
  const fontSize = c.size === "portrait" ? 41 : 36;
  const maxWidth = c.size === "landscape" ? 1400 : w - 120;
  const times = wordTimes(c.words.join(" "), c.voiceSec);
  // the piece the voice is on (caption.ts), one line of the band at most
  const shown = captionShown(c.words, (maxWidth - 56) / fontSize, wordAt(c.words, t, c.voiceSec, LEAD));
  return (
    <div style={abs({ left: 60, width: w - 120, bottom: GEO[c.size].sub, justifyContent: "center" })}>
      <div style={box({ flexWrap: "wrap", justifyContent: "center", background: "rgba(20,22,26,0.82)", borderRadius: 28, padding: "16px 28px", fontSize, lineHeight: 1.45, maxWidth })}>
        {shown.map((i, k) => {
          const color = t >= times[i].to ? C.white : t >= times[i].from ? C.spoken : "rgba(255,255,255,0.55)";
          return <div key={i} style={box({ color, marginRight: k < shown.length - 1 ? 12 : 0 })}>{c.words[i]}</div>;
        })}
      </div>
    </div>
  );
}

/** One frame of a story scene at scene time t: transparent, over the paper. */
export function storyFrame(key: PoolSceneKey, c: StoryContext, t: number) {
  const { w, h } = SIZES[c.size];
  const body = {
    storyHook: <Hook c={c} t={t} />,
    storyPool: <Pool c={c} t={t} />,
    storyHit: <Hit c={c} t={t} />,
    storyHelp: <Help c={c} t={t} />,
    storyAll: <All c={c} t={t} />,
    storyContact: <Contact c={c} t={t} />,
  }[key];
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, background: "transparent", fontFamily: "Plex", color: paperInk(c.input) }}>
      {body}
      <Subtitle c={c} t={t} />
      <div style={abs({ left: 0, width: w, bottom: c.size === "portrait" ? 34 : 18, justifyContent: "center", fontSize: 26, color: paperInk(c.input), opacity: 0.55 })}>Application by www.advisortool.app</div>
    </div>
  );
}

/** the paper every scene is drawn on: the faces' own colour, so they sit on it with no edge; มินิมอล's ground its own */
export function storyBackground(size: VideoSize, input?: StoryVideoInput) {
  const { w, h } = SIZES[size];
  return <div style={{ display: "flex", width: w, height: h, background: input && minimal(input) ? groundOf(input).bg : FACE_PAPER }} />;
}
