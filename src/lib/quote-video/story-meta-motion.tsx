import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { POSES, type Pose, type PoseName } from "@/lib/story/figure";
import { CHILDREN } from "@/lib/story/faces";
import type { ReactNode } from "react";
import { a, abs, type Anim } from "./motion";
import type { Dev } from "./story-health-motion";
import { META_DEFAULTS, partnerFace, type MetaShow } from "./story-knowledge";
import { geoOf, Title, type Rect } from "./story-knowledge-motion";
import { Card, fitWrap, handWidth, Lines, wrapHand } from "./story-life-motion";
import { line, minimal, paper, Pic, type StoryContext } from "./story-motion";
import type { VideoSize } from "./timeline";

/**
 * อุปมาเล่าเรื่อง (device round 3, spec 2026-11-15-devices-metaphor-design.md): the eight metaphors' timing,
 * which kspec hands on, and their drawers in the story looks (paper, warm, line), which showBody hands the frame
 * (as story-life-motion.tsx's). Each plays set -> trouble -> protection -> note; a metaphor carries words only,
 * so there is never a count. Every picture is drawn on a 400 × 300 sheet scaled into the device's room, the note
 * on a card under it (beside it in landscape).
 */

const C = STORY_CLIP_COLORS;

/** the few things a metaphor shows, in the order they come in */
export function metaSpec(show: MetaShow): Record<string, Anim> {
  const s: Record<string, Anim> = { title: a(0.2, "up") };
  switch (show.layout) {
    case "umbrella":
      // the family; the rain starts; the umbrella opens over them
      s.set = a(0.5, "pop");
      s.trouble = a(1.1, "fade", 1.0);
      s.protect = a(1.9, "pop", 0.7);
      break;
    case "housepillar":
      // the house on its pillar; the pillar shakes; a second pillar only when a spare word is given (no spare, the shake alone)
      s.set = a(0.5, "pop");
      s.trouble = a(1.2, "fade", 0.8);
      if (show.spare) s.protect = a(2.1, "left", 0.7);
      break;
    case "lifering":
      // someone in the water; the waves rise; the ring is thrown along its arc and lands round them
      s.set = a(0.5, "pop");
      s.trouble = a(1.1, "fade", 0.8);
      s.protect = a(1.9, "stroke", 0.9);
      break;
    case "safetynet":
      // someone on the high line; they slip; the net is strung below; they fall into it and bounce
      s.set = a(0.5, "pop");
      s.trouble = a(1.2, "fade", 0.5);
      s.protect = a(1.5, "grow", 0.6);
      s.fall = a(1.8, "fade", 1.1);
      break;
    case "seedtree":
      s.set = a(0.5, "pop");
      s.trouble = a(1.1, "grow");
      s.protect = a(1.9, "grow");
      break;
    case "balance":
      s.set = a(0.5, "pop");
      s.trouble = a(1.2, "fade", 0.8);
      s.protect = a(2.0, "pop");
      break;
    case "bridge":
      s.set = a(0.5, "pop");
      s.trouble = a(1.1, "fade");
      s.protect = a(1.7, "stroke", 1.0);
      break;
    case "shield":
      s.set = a(0.5, "pop");
      show.arrows.forEach((_, i) => { s[`arrow${i}`] = a(1.0 + i * 0.4, "left"); });
      s.protect = a(1.2 + show.arrows.length * 0.4, "pop");
      break;
  }
  const end = Math.max(...Object.values(s).map((x) => x.at + x.dur));
  s.note = a(end + 0.2, "fade");
  return s;
}

/** a metaphor's frame body at scene time t (showBody hands it the frame, the movements, where things stand, the ink) */
export function metaBody(show: MetaShow, d: Dev) {
  switch (show.layout) {
    case "umbrella": return <Umbrella d={d} show={show} />;
    case "housepillar": return <HousePillar d={d} show={show} />;
    case "lifering": return <LifeRing d={d} show={show} />;
    case "safetynet": return <SafetyNet d={d} show={show} />;
    // Task 3: seedtree, balance, bridge and shield; until then nothing is drawn (the title and the frame stand)
    default: return null;
  }
}

/* ---------- the sheet, the note, the people ---------- */

/** the sheet every picture is drawn on, in its own units: scaled whole into the room the note leaves */
const SHEET = { w: 400, h: 300 };

/**
 * where a metaphor stands: its picture (`art`, the sheet scaled by `k`) and the note's card under it, or beside it in
 * landscape, which is short. The note is set as lines (broken only at a space) in the largest size up to the frame's
 * text size at which every line fits the card; a note with no space shrinks onto one line.
 */
export function metaGeo(size: VideoSize, note?: string) {
  const g = geoOf(size);
  const r = g.dev;
  const pad = Math.round(g.text * 0.5);
  const fit = (pic: Rect) => {
    const k = Math.min(pic.w / SHEET.w, pic.h / SHEET.h);
    const w = Math.round(SHEET.w * k);
    const h = Math.round(SHEET.h * k);
    return { k, art: { x: pic.x + Math.round((pic.w - w) / 2), y: pic.y + Math.round((pic.h - h) / 2), w, h } };
  };
  if (!note) return { room: r, ...fit(r), pad, noteBox: null, noteSize: 0, noteLines: [] as string[], noteRoom: 0 };
  const side = size === "landscape";
  const maxW = side ? 560 : size === "portrait" ? 840 : 800;
  const noteRoom = maxW - pad * 2 - 8;
  const cap = g.text;
  const noteSize = fitWrap([note], noteRoom, Math.round(cap * 1.3 * (side ? 3 : 2)), cap);
  const noteLines = wrapHand(note, noteSize, noteRoom);
  const widest = Math.max(...noteLines.map((x) => Math.ceil(handWidth(x, noteSize))));
  // the card as wide as its words, and a little more: never as wide as the room for a short line
  const cardW = Math.min(maxW, widest + pad * 2 + 8 + Math.round(g.text * 1.2));
  const noteH = Math.round(noteLines.length * noteSize * 1.3) + pad * 2 + 8;
  if (side) {
    // the picture and the card side by side, the pair in the middle of the room
    const gap = Math.round(g.text);
    const { k, art } = fit({ x: r.x, y: r.y, w: r.w - cardW - gap, h: r.h });
    const x0 = r.x + Math.round((r.w - art.w - gap - cardW) / 2);
    return { room: r, k, art: { ...art, x: x0 }, pad, noteBox: { x: x0 + art.w + gap, y: r.y + Math.round((r.h - noteH) / 2), w: cardW, h: noteH }, noteSize, noteLines, noteRoom };
  }
  const gap = Math.round(g.text * 0.5);
  const { k, art } = fit({ x: r.x, y: r.y, w: r.w, h: r.h - noteH - gap });
  return { room: r, k, art, pad, noteBox: { x: r.x + Math.round((r.w - cardW) / 2), y: r.y + r.h - noteH, w: cardW, h: noteH }, noteSize, noteLines, noteRoom };
}
type MetaGeo = ReturnType<typeof metaGeo>;

/** the title every metaphor opens with, fitted to the frame */
const MetaTitle = ({ d, text }: { d: Dev; text: [string, string] }) => (
  <Title fit cut={paper(d.c.input)} pill={line(d.c.input)} ink={d.ink} g={d.g} w={d.w} an={d.s.title} t={d.t} text={text} />
);

/** the note on its card, under (or beside) the picture */
function MetaNote({ d, geo }: { d: Dev; geo: MetaGeo }) {
  const b = geo.noteBox;
  if (!b) return null;
  return (
    <div style={abs({ left: b.x, top: b.y, width: b.w, height: b.h, flexDirection: "column", justifyContent: "center" })}>
      <Card an={d.s.note} t={d.t} tilt={-0.7} pad={geo.pad} w={b.w}>
        <Lines lines={geo.noteLines} size={geo.noteSize} align="center" />
      </Card>
    </div>
  );
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
/** how far a movement has gone at t, 0 to 1, evenly (look() eases some kinds; the drawers here ease for themselves) */
const prog = (an: Anim | undefined, t: number) => (an ? clamp01((t - an.at) / an.dur) : 1);
const r1 = (v: number) => Math.round(v * 10) / 10;
/** a piece popping in: its scale as it comes */
const popScale = (p: number) => 0.4 + 0.6 * easeOut(p);

/** the sheet's picture box at its place in the frame; its children are placed in px from its corner */
const Sheet = ({ geo, children }: { geo: MetaGeo; children: ReactNode }) => (
  <div style={abs({ left: geo.art.x, top: geo.art.y, width: geo.art.w, height: geo.art.h })}>{children}</div>
);

/** one layer of the picture, drawn in the sheet's units (a plain function: the drawing library drops a component inside an <svg>) */
const layer = (geo: MetaGeo, body: ReactNode, opacity = 1) => (
  <div style={abs({ left: 0, top: 0, width: geo.art.w, height: geo.art.h, opacity })}>
    <svg width={geo.art.w} height={geo.art.h} viewBox={`0 0 ${SHEET.w} ${SHEET.h}`}>{body}</svg>
  </div>
);

/** a doll's box: 100 wide to 130 tall */
const TALL = 1.3;
/**
 * someone's box on the sheet, `w` a doll's width: as tall as a doll's in every look, so a head never rises past what
 * stands over it (the umbrella's rim, the sheet's top); มินิมอล's slim whole person stands in a narrower box, which it
 * fills from head to foot
 */
const boxOf = (c: StoryContext, w: number) => ({ w: minimal(c.input) ? r1((w * TALL) / 1.5) : w, h: r1(w * TALL) });

/** someone on the sheet: the middle of their feet, and their box (sheet units) */
export interface MetaFigure { x: number; foot: number; w: number; h: number }

/** where everyone a metaphor draws stands at scene time t (the drawers place them from here; the tests check it) */
export function metaFigures(show: MetaShow, c: StoryContext, t: number): MetaFigure[] {
  const at = (x: number, foot: number, w: number): MetaFigure => ({ x, foot, ...boxOf(c, w) });
  switch (show.layout) {
    case "umbrella": return UMB_PEOPLE.map(([x, w]) => at(x, GROUND, w));
    case "housepillar": return pillarPeople(!!show.spare).map(([x, w]) => at(x, FLOOR, w));
    // the sea up to their chest: a doll's under its big head; มินิมอล's higher up its slim body
    case "lifering": return [at(SWIM_X, SEA + (1 - (minimal(c.input) ? 0.36 : 0.62)) * SWIM_W * TALL + bobAt(t), SWIM_W)];
    case "safetynet": return [at(WALK_X, walkerAt(metaSpec(show), t).foot, WALK_W)];
    default: return [];
  }
}

/** turned `rot` degrees about the foot of a box `h` px tall: turned about its middle, then moved back so the feet stay put */
const aboutFeet = (rot: number, h: number) => {
  const th = (rot * Math.PI) / 180;
  return `translate(${r1((h / 2) * Math.sin(th))}px, ${r1((h / 2) * (1 - Math.cos(th)))}px) rotate(${r1(rot)}deg)`;
};

/** someone standing in their box `f` on the sheet, in `pose`; popping in on `an` */
function Who({ c, k, id, f, pose, t, an }: { c: StoryContext; k: number; id: string; f: MetaFigure; pose: PoseName | Pose; t: number; an?: Anim }) {
  const W = Math.round(f.w * k);
  const H = Math.round(f.h * k);
  const p = prog(an, t);
  return (
    <div style={abs({ left: Math.round((f.x - f.w / 2) * k), top: Math.round(f.foot * k) - H, width: W, height: H, opacity: an && p <= 0 ? 0 : 1, ...(p < 1 ? { transform: `scale(${popScale(p).toFixed(3)})` } : {}) })}>
      <Pic c={c} id={id} r={{ x: 0, y: 0, w: W, h: H }} pose={pose} t={t} />
    </div>
  );
}

/** the family of three the metaphors protect: the partner, a child and the hero (the episode's own faces) */
const family = (c: StoryContext) => [partnerFace(c.input), CHILDREN[0], c.input.faces.hero];

/** a pose with the face's smile on or off */
const smiling = (pose: Pose, smile: boolean): Pose => ({ ...pose, smile });
/** the head bowed, a frown: worried */
const worried = (t: number): Pose => ({ ...POSES.sad(t), smile: false });

/* ---------- umbrella: ร่มกันฝน ---------- */

/** the umbrella's canopy, about its tip at (200, 62), 150 to each side, its rim at 150 */
const UMB = { x: 200, top: 62, rim: 150, half: 150 };
/** the canopy's rim: every head under the umbrella stays below it */
export const UMBRELLA_RIM = UMB.rim;
/** the family under it, each a doll's width (the right one holds the umbrella: its stick comes down between the child and them) */
const UMB_PEOPLE: [number, number][] = [[106, 82], [162, 60], [252, 82]];
/** a number from 0 to 1 that looks random but is the same for the same `i` every frame */
const scatter = (i: number) => { const v = Math.sin(i * 12.9898) * 43758.5453; return v - Math.floor(v); };
/** the rain's drops: where each falls and how far down it starts, scattered */
const DROPS = Array.from({ length: 48 }, (_, i) => ({ x: Math.round(10 + scatter(i + 1) * 380), y0: Math.round(scatter(i + 101) * 220) }));
const RAIN_TOP = 60;
const GROUND = 272;
/** how fast the rain falls, sheet units a second */
const FALL = 240;

/** a rain cloud with its middle at (cx, cy), `s` its size: four puffs on a flat foot */
const cloud = (cx: number, cy: number, s: number, key: string) => {
  const v = (x: number) => r1(x * s);
  return (
    <path key={key} d={`M${r1(cx - 48 * s)} ${r1(cy + 16 * s)} a${v(16)} ${v(16)} 0 0 1 ${v(2)} ${v(-30)} a${v(20)} ${v(20)} 0 0 1 ${v(30)} ${v(-14)} a${v(24)} ${v(24)} 0 0 1 ${v(42)} ${v(-2)} a${v(18)} ${v(18)} 0 0 1 ${v(22)} ${v(26)} a${v(14)} ${v(14)} 0 0 1 ${v(-2)} ${v(20)} Z`}
      fill={C.struck} stroke={C.ink} strokeWidth={2.4} strokeLinejoin="round" />
  );
};

/**
 * ร่มกันฝน: the family of three; the rain starts from the clouds and falls on them; a red umbrella opens over them,
 * the rain stops on it and runs off its two edges, and the family are glad
 */
function Umbrella({ d, show }: { d: Dev; show: MetaShow<"umbrella"> }) {
  const { c, t, s } = d;
  const geo = metaGeo(c.size, show.note);
  const rain = prog(s.trouble, t);
  const open = easeOut(prog(s.protect, t));
  const opened = !!s.protect && t >= s.protect.at;
  // the canopy opens from a furled stick: narrow and tall to its whole width
  const sx = 0.14 + 0.86 * open;
  const sy = 0.8 + 0.2 * open;
  const half = UMB.half * sx;
  const rim = UMB.top + (UMB.rim - UMB.top) * sy;
  const under = (x: number, y: number) => opened && Math.abs(x - UMB.x) < half && y > rim - (rim - UMB.top) * Math.sqrt(Math.max(0, 1 - ((x - UMB.x) / half) ** 2)) - 4;
  const drops = rain > 0
    ? DROPS.flatMap((p, i) => {
      const y = RAIN_TOP + ((p.y0 + t * FALL) % (GROUND - RAIN_TOP));
      return y + 12 > GROUND || under(p.x, y + 12) ? [] : [<path key={i} d={`M${p.x} ${r1(y)} l-3 12`} stroke={C.waterInk} strokeWidth={2.6} strokeLinecap="round" />];
    })
    : [];
  // the water off the canopy's two edges, once it is open
  const runoff = open > 0.85
    ? [-1, 1].flatMap((side) => [0, 1, 2, 3].map((j) => {
      const y = rim + 4 + ((j * 29 + t * FALL) % (GROUND - rim - 12));
      return <path key={`${side}${j}`} d={`M${r1(UMB.x + side * (half + 2))} ${r1(y)} l${side * 1.5} 10`} stroke={C.waterInk} strokeWidth={2.8} strokeLinecap="round" />;
    }))
    : [];
  const splash = (x: number, key: string) => <path key={key} d={`M${r1(x - 12)} ${GROUND - 2} q4 -8 8 -2 M${r1(x + 4)} ${GROUND - 4} q4 -8 8 2`} fill="none" stroke={C.waterInk} strokeWidth={2.2} strokeLinecap="round" />;
  const [left, kid, right] = family(c);
  const sad = rain > 0 && open < 0.6;
  const glad = open >= 0.6;
  const figs = metaFigures(show, c, t);
  // the dome, and its rim in four scallops from right to left
  const canopy = `M${UMB.x - UMB.half} ${UMB.rim} C${UMB.x - UMB.half} 90 ${UMB.x - 82} ${UMB.top} ${UMB.x} ${UMB.top} C${UMB.x + 82} ${UMB.top} ${UMB.x + UMB.half} 90 ${UMB.x + UMB.half} ${UMB.rim}`
    + [1, 0, -1, -2].map((i) => ` Q${UMB.x + i * 75 + 37.5} ${UMB.rim - 18} ${UMB.x + i * 75} ${UMB.rim}`).join("") + " Z";
  return (
    <>
      <MetaTitle d={d} text={show.title} />
      <Sheet geo={geo}>
        {/* the clouds come over as the rain starts; the puddles fill */}
        {layer(geo, (
          <>
            <g transform={`translate(${r1((1 - easeOut(rain)) * -30)} 0)`}>{[cloud(112, 46, 0.85, "a"), cloud(284, 44, 0.9, "b")]}</g>
            <ellipse cx={46} cy={GROUND + 6} rx={r1(30 * rain)} ry={r1(5 * rain)} fill={C.blanket} stroke={C.waterInk} strokeWidth={1.6} />
            <ellipse cx={356} cy={GROUND + 6} rx={r1(26 * rain)} ry={r1(4.5 * rain)} fill={C.blanket} stroke={C.waterInk} strokeWidth={1.6} />
          </>
        ), rain > 0 ? easeOut(rain) : 0)}
        {[left, kid, right].map((id, i) => (
          <Who key={i} c={c} k={geo.k} id={id} f={figs[i]} t={t + i * 0.4} an={s.set}
            pose={sad ? worried(t + i * 0.4) : glad && i === 1 ? "wave" : smiling(POSES.stand(t + i * 0.4), glad)} />
        ))}
        {layer(geo, (
          <>
            {drops}
            {runoff}
            {open > 0.85 ? [splash(UMB.x - half, "l"), splash(UMB.x + half, "r")] : null}
            {/* the umbrella: its stick down to the hook by the right hand, then the canopy opening over them */}
            {opened ? (
              <g>
                <path d={`M${UMB.x} ${UMB.top} V238 q0 13 12 13 q10 0 10 -10`} fill="none" stroke={C.ink} strokeWidth={4.4} strokeLinecap="round" />
                <g transform={`translate(${UMB.x} ${UMB.top}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-UMB.x} ${-UMB.top})`}>
                  <path d={canopy} fill={C.red} stroke={C.ink} strokeWidth={3} strokeLinejoin="round" />
                  {[-1, 0, 1].map((i) => <path key={i} d={`M${UMB.x} ${UMB.top} Q${UMB.x + i * 44} 92 ${UMB.x + i * 75} ${UMB.rim}`} fill="none" stroke={C.ink} strokeWidth={2} opacity={0.55} />)}
                  <path d={`M${UMB.x - 112} 124 Q${UMB.x - 98} 90 ${UMB.x - 54} 74`} fill="none" stroke={C.white} strokeWidth={6} strokeLinecap="round" opacity={0.45} />
                </g>
                <path d={`M${UMB.x} ${UMB.top} v-10`} stroke={C.ink} strokeWidth={4} strokeLinecap="round" />
              </g>
            ) : null}
          </>
        ))}
      </Sheet>
      <MetaNote d={d} geo={geo} />
    </>
  );
}

/* ---------- housepillar: เสาหลักของบ้าน ---------- */

/** the floor the family stands on, the beam under the roof, and where the pillars stand: the main in the middle, a spare toward the right */
const FLOOR = 270;
const BEAM = 124;
const MAIN_X = 200;
const SPARE_X = 330;
/** a pillar's plaque, widest; its top; with a spare, how far right the main's may reach and from where the spare's starts */
const PLAQUE_W = 144;
const PLAQUE_TOP = 128;
const MAIN_RIGHT = 263;
const SPARE_LEFT = 269;
/** the family in the house, each a doll's width: the right one stands between the pillars when a spare comes, as far from the pillar as the left two otherwise */
const pillarPeople = (spare: boolean): [number, number][] => [[72, 80], [132, 60], [spare ? 262 : 300, 80]];

/**
 * where เสาหลักของบ้าน's words stand: each pillar's plaque (in the frame's px) with its word set in the largest size,
 * up to a little under the text size, at which it fits on one line; the spare's only when there is a spare word. A
 * plaque hangs in the middle of its pillar; with a spare, a wide main plaque leans left and a wide spare one right,
 * so the two never meet.
 */
export function pillarGeo(size: VideoSize, show: MetaShow<"housepillar">) {
  const g = geoOf(size);
  const geo = metaGeo(size, show.note);
  const plaque = (word: string, x: number, place: (w: number) => number) => {
    // the padding inside the plaque, its 3 px edge counted in
    const pad = Math.round(g.text * 0.26) + 3;
    const maxW = Math.round(PLAQUE_W * geo.k);
    const fs = Math.min(Math.round(g.text * 0.95), Math.floor((maxW - pad * 2) / (handWidth(word, 1) || 1)));
    const w = Math.min(maxW, Math.ceil(handWidth(word, fs)) + pad * 2 + Math.round(fs * 0.4));
    const h = Math.round(fs * 1.3) + 2 * (Math.round(fs * 0.12) + 3);
    // where its middle hangs, in the sheet's units
    const mid = place(w / geo.k);
    return { word, size: fs, pad, x, plaque: { x: geo.art.x + Math.round(mid * geo.k - w / 2), y: geo.art.y + Math.round(PLAQUE_TOP * geo.k), w, h } };
  };
  const spare = show.spare;
  return {
    geo,
    main: plaque(show.label || META_DEFAULTS.label, MAIN_X, (w) => (spare ? Math.min(MAIN_X, MAIN_RIGHT - w / 2) : MAIN_X)),
    spare: spare ? plaque(spare, SPARE_X, (w) => Math.max(SPARE_X, SPARE_LEFT + w / 2)) : null,
  };
}
type PlaqueGeo = ReturnType<typeof pillarGeo>["main"];

/** a pillar standing from the beam to the floor at `x`, `fill` its wood, with its grain */
const pillar = (x: number, fill: string, grain: string, key: string) => (
  <g key={key}>
    <rect x={x - 13} y={BEAM} width={26} height={FLOOR - BEAM} fill={fill} stroke={C.ink} strokeWidth={2.6} />
    <path d={`M${x - 5} ${BEAM + 18} v34 M${x + 4} ${BEAM + 62} v40 M${x - 3} ${BEAM + 112} v22`} stroke={grain} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
    <rect x={x - 19} y={BEAM} width={38} height={9} rx={2} fill={fill} stroke={C.ink} strokeWidth={2.6} />
    <rect x={x - 19} y={FLOOR - 9} width={38} height={9} rx={2} fill={fill} stroke={C.ink} strokeWidth={2.6} />
  </g>
);

/** a plaque on a pillar, its word on note paper, turned with the pillar; placed from the sheet's corner (`at`) */
function Plaque({ p, at, rot = 0, dx = 0 }: { p: PlaqueGeo; at: Rect; rot?: number; dx?: number }) {
  const pr = p.plaque;
  return (
    <div style={abs({ left: pr.x - at.x + Math.round(dx), top: pr.y - at.y, width: pr.w, height: pr.h, justifyContent: "center", alignItems: "center", background: C.note, border: `3px solid ${C.ink}`, borderRadius: 8, fontFamily: "Mali", fontSize: p.size, fontWeight: 600, lineHeight: 1.3, color: C.ink, transform: `rotate(${r1(-1.5 + rot)}deg)` })}>{p.word}</div>
  );
}

/**
 * เสาหลักของบ้าน: a house's roof on one pillar in its middle with its word (รายได้ when none is given), the family
 * under it; the pillar shakes; with a spare word a gold second pillar slides in under the roof carrying it (no spare,
 * the shake alone)
 */
function HousePillar({ d, show }: { d: Dev; show: MetaShow<"housepillar"> }) {
  const { c, t, s } = d;
  const pg = pillarGeo(c.size, show);
  const geo = pg.geo;
  const set = prog(s.set, t);
  const shake = prog(s.trouble, t);
  const shaking = shake > 0 && shake < 1;
  // the pillar rocks about its foot, dying away; the roof shudders with it
  const rot = shaking ? 3.4 * Math.sin(shake * Math.PI * 9) * (1 - shake) : 0;
  const jolt = shaking ? 2.2 * Math.sin(shake * Math.PI * 12) * (1 - shake) : 0;
  const spareIn = easeOut(prog(s.protect, t));
  const spare = pg.spare && s.protect && t >= s.protect.at ? pg.spare : null;
  // the spare slides in from beyond the right edge
  const slide = (1 - spareIn) * 110;
  const [left, kid, right] = family(c);
  const safe = !!spare && spareIn > 0.7;
  const pose = (i: number): PoseName | Pose => (shaking ? worried(t + i * 0.4) : safe ? (i === 1 ? "wave" : smiling(POSES.stand(t + i * 0.4), true)) : POSES.stand(t + i * 0.4));
  const figs = metaFigures(show, c, t);
  // the plaque rocks with the pillar: turned as it is, carried sideways as far as its height up the pillar
  const plaqueDx = Math.sin((rot * Math.PI) / 180) * (FLOOR - PLAQUE_TOP - 18) * geo.k;
  return (
    <>
      <MetaTitle d={d} text={show.title} />
      <Sheet geo={geo}>
        <div style={abs({ left: 0, top: 0, width: geo.art.w, height: geo.art.h, opacity: set > 0 ? 1 : 0, ...(set < 1 ? { transform: `scale(${popScale(set).toFixed(3)})` } : {}) })}>
          {layer(geo, (
            <>
              {/* the house's back wall, its boards, and the floor */}
              <rect x={42} y={BEAM} width={316} height={FLOOR - BEAM} fill={C.tiles[4]} stroke={C.ink} strokeWidth={2.4} />
              <path d={[82, 122, 162, 238, 278, 318].map((x) => `M${x} ${BEAM + 4} V${FLOOR - 4}`).join(" ")} stroke={C.ink} strokeWidth={1.6} opacity={0.12} />
              <rect x={26} y={FLOOR} width={348} height={12} rx={3} fill={C.paperChair} stroke={C.ink} strokeWidth={2.6} />
              <g transform={`translate(${r1(jolt)} ${r1(Math.abs(jolt) * 0.4)})`}>
                <path d={`M14 ${BEAM - 10} L200 22 L386 ${BEAM - 10} Z`} fill={C.red} stroke={C.ink} strokeWidth={3} strokeLinejoin="round" />
                <path d={`M64 ${BEAM - 30} L200 48 L336 ${BEAM - 30}`} fill="none" stroke={C.ink} strokeWidth={2} opacity={0.35} />
                <circle cx={200} cy={78} r={13} fill={C.note} stroke={C.ink} strokeWidth={2.6} />
                <path d="M200 65 V91 M187 78 H213" stroke={C.ink} strokeWidth={2} />
                <rect x={34} y={BEAM - 10} width={332} height={12} fill={C.wood} stroke={C.ink} strokeWidth={2.6} />
              </g>
              <g transform={`rotate(${r1(rot)} ${MAIN_X} ${FLOOR})`}>{pillar(MAIN_X, C.wood, C.woodGrain, "main")}</g>
              {/* the shake's marks either side of the pillar's head */}
              {shaking ? (
                <g stroke={C.ink} strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.8}>
                  <path d={`M${MAIN_X - 24} ${BEAM + 22} q-8 10 0 20 M${MAIN_X - 32} ${BEAM + 18} q-10 14 0 28`} />
                  <path d={`M${MAIN_X + 24} ${BEAM + 22} q8 10 0 20 M${MAIN_X + 32} ${BEAM + 18} q10 14 0 28`} />
                </g>
              ) : null}
              {spare ? <g transform={`translate(${r1(slide)} 0)`}>{pillar(SPARE_X, C.coin, C.ink, "spare")}</g> : null}
            </>
          ))}
          <Plaque p={pg.main} at={geo.art} rot={rot} dx={plaqueDx} />
          {spare ? <Plaque p={spare} at={geo.art} dx={slide * geo.k} /> : null}
        </div>
        {[left, kid, right].map((id, i) => <Who key={i} c={c} k={geo.k} id={id} f={figs[i]} t={t + i * 0.4} an={s.set} pose={pose(i)} />)}
      </Sheet>
      <MetaNote d={d} geo={geo} />
    </>
  );
}

/* ---------- lifering: ห่วงชูชีพ ---------- */

/** the water's surface; the one in it, and where the ring lands round them */
const SEA = 158;
const SWIM_X = 164;
const SWIM_W = 116;
const RING = { rx: 70, ry: 21 };
/** the ring's flight: from the jetty, up over, down onto the one in the water */
const THROW = { x0: 356, y0: 102, cx: 276, cy: -30, x1: SWIM_X, y1: SEA + 2 };
/** how the one in the water bobs at time t */
const bobAt = (t: number) => 3 * Math.sin(t * 3.4);
const along = (q: number) => ({
  x: (1 - q) ** 2 * THROW.x0 + 2 * (1 - q) * q * THROW.cx + q * q * THROW.x1,
  y: (1 - q) ** 2 * THROW.y0 + 2 * (1 - q) * q * THROW.cy + q * q * THROW.y1,
});

/** a line of waves at height y and time t, `amp` high, from `from` to `to` */
const wave = (y: number, amp: number, t: number, from = 0, to = SHEET.w, len = 80) => {
  const pts: string[] = [];
  for (let x = from; x <= to; x += 8) pts.push(`${x} ${r1(y + amp * Math.sin((x / len) * 2 * Math.PI - t * 3.2))}`);
  return `M${pts.join(" L")}`;
};

/** the ring, red with white bands and an ink edge: whole, or its far or near half (`part`) */
const ring = (cx: number, cy: number, rx: number, ry: number, part: "whole" | "far" | "near", key: string) => {
  const d = part === "whole"
    ? `M${r1(cx - rx)} ${r1(cy)} a${r1(rx)} ${r1(ry)} 0 1 1 ${r1(rx * 2)} 0 a${r1(rx)} ${r1(ry)} 0 1 1 ${r1(-rx * 2)} 0`
    : part === "far" ? `M${r1(cx - rx)} ${r1(cy)} a${r1(rx)} ${r1(ry)} 0 0 1 ${r1(rx * 2)} 0` : `M${r1(cx + rx)} ${r1(cy)} a${r1(rx)} ${r1(ry)} 0 0 1 ${r1(-rx * 2)} 0`;
  const band = (Math.PI * (rx + ry)) / 4;
  return (
    <g key={key}>
      <path d={d} fill="none" stroke={C.ink} strokeWidth={15} strokeLinecap="butt" />
      <path d={d} fill="none" stroke={C.red} strokeWidth={10.5} strokeLinecap="butt" />
      <path d={d} fill="none" stroke={C.white} strokeWidth={10.5} strokeLinecap="butt" strokeDasharray={`${r1(band * 0.42)} ${r1(band * 0.58)}`} />
    </g>
  );
};

/**
 * ห่วงชูชีพ: someone in the water, the waves moving; the waves rise and they call for help; a red-and-white ring is
 * thrown from the jetty along a dashed arc and lands round them, and they hold on
 */
function LifeRing({ d, show }: { d: Dev; show: MetaShow<"lifering"> }) {
  const { c, t, s } = d;
  const geo = metaGeo(c.size, show.note);
  const set = prog(s.set, t);
  const rough = easeOut(prog(s.trouble, t));
  const q = easeOut(prog(s.protect, t));
  const thrown = !!s.protect && t >= s.protect.at;
  const landed = thrown && q >= 1;
  const amp = 3.5 + 3.5 * rough * (landed ? 0.5 : 1);
  const bob = bobAt(t);
  // the throw's path, dashed, as far as the ring has come
  const trail: string[] = [];
  for (let i = 0; i <= 24; i += 1) { const p = along((q * i) / 24); trail.push(`${r1(p.x)} ${r1(p.y)}`); }
  const at = along(q);
  const help = rough > 0 && !landed;
  const pose: Pose = landed ? { ...POSES.hand(t), ua: [-60, 60], fa: [-80, 80] } : help ? { ...POSES.wave(t), smile: false, h: 18 } : worried(t);
  return (
    <>
      <MetaTitle d={d} text={show.title} />
      <Sheet geo={geo}>
        {layer(geo, (
          <>
            {/* the jetty the ring is thrown from */}
            <path d="M334 124 V186 M386 124 V186" stroke={C.woodGrain} strokeWidth={8} strokeLinecap="round" />
            <rect x={318} y={112} width={86} height={13} rx={2} fill={C.wood} stroke={C.ink} strokeWidth={2.6} />
            <path d="M340 112 v13 M362 112 v13 M384 112 v13" stroke={C.woodGrain} strokeWidth={2} />
            {landed ? ring(SWIM_X, SEA + 2 + bob, RING.rx, RING.ry, "far", "far") : null}
          </>
        ), set > 0 ? 1 : 0)}
        {/* the one in the water, the sea up to their chest */}
        <Who c={c} k={geo.k} id={c.input.faces.hero} f={metaFigures(show, c, t)[0]} t={t} an={s.set} pose={pose} />
        {layer(geo, (
          <>
            <path d={`${wave(SEA, amp, t)} L${SHEET.w} ${SHEET.h - 12} Q${SHEET.w} ${SHEET.h} ${SHEET.w - 12} ${SHEET.h} L12 ${SHEET.h} Q0 ${SHEET.h} 0 ${SHEET.h - 12} Z`} fill={C.blanket} stroke={C.waterInk} strokeWidth={2.6} strokeLinejoin="round" />
            {[[184, 20, 110, 0.6], [214, 236, 300, 1.4], [252, 40, 200, 2.1], [240, 270, 386, 0.9], [276, 220, 340, 1.7]].map(([y, a0, a1, ph]) => (
              <path key={y} d={wave(y, 3, t + ph, a0, a1, 56)} fill="none" stroke={C.white} strokeWidth={2.6} strokeLinecap="round" opacity={0.85} />
            ))}
            {/* the splashes while they call for help */}
            {help ? [-1, 1].map((side) => (
              <g key={side} opacity={rough}>
                <path d={`M${SWIM_X + side * 50} ${SEA - 2} q${side * 6} -12 ${side * 14} -6`} fill="none" stroke={C.waterInk} strokeWidth={2.4} strokeLinecap="round" />
                <circle cx={r1(SWIM_X + side * (62 + 4 * Math.sin(t * 6)))} cy={r1(SEA - 16 - 6 * Math.abs(Math.sin(t * 5 + side)))} r={3} fill={C.white} stroke={C.waterInk} strokeWidth={1.6} />
              </g>
            )) : null}
            {thrown ? <path d={`M${trail.join(" L")}`} fill="none" stroke={C.ink} strokeWidth={2.2} strokeDasharray="7 7" strokeLinecap="round" opacity={landed ? 0.7 : 1} /> : null}
            {landed ? ring(SWIM_X, SEA + 2 + bob, RING.rx, RING.ry, "near", "near") : thrown ? ring(at.x, at.y, 30 + 16 * q, 30 * (1 - q) + RING.ry * q, "whole", "fly") : null}
          </>
        ), set > 0 ? 1 : 0)}
      </Sheet>
      <MetaNote d={d} geo={geo} />
    </>
  );
}

/* ---------- safetynet: ตาข่ายนิรภัย ---------- */

/** the high line, the posts that hold it and the net, the net's ends, and where they walk */
const HIGH = 104;
const POSTS = [36, 364];
const NET_Y = 226;
const WALK_X = 200;
const WALK_W = 76;
/** how far into the net's mesh whoever lands in it sinks */
const SINK = 12;

/** the net's top rope at x, sagging `sag` in its middle */
const netAt = (x: number, sag: number) => NET_Y + sag * (1 - ((x - WALK_X) / (POSTS[1] - WALK_X)) ** 2);

/**
 * the walker at time t: on the line, wobbling as they slip; then down to the net in the fall's first part, gathering
 * speed; then the net gives and springs back, dying away, with them in it
 */
function walkerAt(s: Record<string, Anim>, t: number) {
  const slip = prog(s.trouble, t);
  const fall = prog(s.fall, t);
  const falling = !!s.fall && t >= s.fall.at;
  const DROP = 0.32;
  const rest = 26;
  const tau = Math.max(0, (fall - DROP) * (s.fall?.dur ?? 1));
  const give = fall > DROP ? 26 * Math.exp(-3.4 * tau) * Math.cos(2 * Math.PI * 1.6 * tau) : 0;
  const sag = rest * (falling ? 1 : 0.7) + give;
  const foot = !falling ? HIGH : fall < DROP ? HIGH + (netAt(WALK_X, rest) + SINK - HIGH) * (fall / DROP) ** 2 : netAt(WALK_X, sag) + SINK;
  const rot = !falling ? (slip > 0 ? 16 * Math.sin(slip * Math.PI * 2.5) : 0) : fall < DROP ? 24 * Math.sin((fall / DROP) * Math.PI) : 0;
  return { slip, sag, foot, rot, caught: falling && fall >= DROP };
}

/**
 * ตาข่ายนิรภัย: someone walking the high line with a pole; they slip and fall along the dashed line; a green net is
 * strung below from both posts; it catches them and they bounce, glad
 */
function SafetyNet({ d, show }: { d: Dev; show: MetaShow<"safetynet"> }) {
  const { c, t, s } = d;
  const geo = metaGeo(c.size, show.note);
  const set = prog(s.set, t);
  const strung = easeOut(prog(s.protect, t));
  const { slip, sag, rot, caught } = walkerAt(s, t);
  const f = metaFigures(show, c, t)[0];
  const pose: Pose = caught ? POSES.cheer(t) : slip > 0 ? { ...POSES.cheer(t), smile: false, h: 18 } : POSES.stand(t);
  const reach = (POSTS[1] - WALK_X) * strung;
  // the net strung from the posts inward: only the part strung so far is drawn
  const inNet = (x: number) => Math.abs(x - WALK_X) >= POSTS[1] - WALK_X - reach - 0.01;
  const ropeTop: [number, string][] = [];
  const ropeLow: [number, string][] = [];
  for (let x = POSTS[0]; x <= POSTS[1]; x += 6) {
    if (!inNet(x)) continue;
    ropeTop.push([x, `${x} ${r1(netAt(x, sag))}`]);
    ropeLow.push([x, `${x} ${r1(netAt(x, sag) + 20)}`]);
  }
  // the mesh: strands crossing between the top rope and the lower edge
  const mesh = Array.from({ length: 16 }, (_, i) => POSTS[0] + 4 + i * 20).filter((x) => x + 20 <= POSTS[1] && inNet(x) && inNet(x + 20)).map((x) => (
    <path key={x} d={`M${x} ${r1(netAt(x, sag))} L${x + 20} ${r1(netAt(x + 20, sag) + 20)} M${x + 20} ${r1(netAt(x + 20, sag))} L${x} ${r1(netAt(x, sag) + 20)}`} stroke={C.green} strokeWidth={1.8} />
  ));
  const run = (pts: [number, string][], key: string, width: number) => (pts.length > 1 ? <path key={key} d={`M${pts.map((p) => p[1]).join(" L")}`} fill="none" stroke={C.green} strokeWidth={width} strokeLinejoin="round" /> : null);
  // a rope is drawn in two runs, from each post, until they meet in the middle
  const rope = (pts: [number, string][], key: string, width: number) => (strung >= 1
    ? run(pts, key, width)
    : [run(pts.filter((p) => p[0] <= WALK_X), `${key}l`, width), run(pts.filter((p) => p[0] >= WALK_X), `${key}r`, width)]);
  const W = Math.round(f.w * geo.k);
  const H = Math.round(f.h * geo.k);
  // the walker's pole, held across at their hands
  const poleW = Math.round((WALK_W + 64) * geo.k);
  const pole = (
    <div style={abs({ left: Math.round(((f.w - WALK_W - 64) / 2) * geo.k), top: Math.round(H * 0.52), width: poleW, height: Math.round(14 * geo.k) })}>
      <svg width={poleW} height={Math.round(14 * geo.k)} viewBox={`0 0 ${WALK_W + 64} 14`}><path d={`M3 11 Q${(WALK_W + 64) / 2} 2 ${WALK_W + 61} 11`} fill="none" stroke={C.ink} strokeWidth={3.6} strokeLinecap="round" /></svg>
    </div>
  );
  const transform = [rot ? aboutFeet(rot, H) : "", set < 1 ? `scale(${popScale(set).toFixed(3)})` : ""].filter(Boolean).join(" ");
  return (
    <>
      <MetaTitle d={d} text={show.title} />
      <Sheet geo={geo}>
        {layer(geo, (
          <>
            {POSTS.map((x) => <rect key={x} x={x - 6} y={HIGH - 8} width={12} height={290 - HIGH + 8} rx={3} fill={C.wood} stroke={C.ink} strokeWidth={2.6} />)}
            <rect x={14} y={286} width={372} height={8} rx={3} fill={C.paperChair} stroke={C.ink} strokeWidth={2.2} />
            <path d={`M${POSTS[0]} ${HIGH} H${POSTS[1]}`} stroke={C.ink} strokeWidth={3.2} strokeLinecap="round" />
            {/* where they will fall, dashed, from the moment they slip */}
            {slip > 0 ? <path d={`M${WALK_X} ${HIGH + 8} V${NET_Y + 16}`} stroke={C.ink} strokeWidth={2} strokeDasharray="5 7" strokeLinecap="round" opacity={r1(0.65 * easeOut(slip))} /> : null}
          </>
        ), set > 0 ? 1 : 0)}
        <div style={abs({ left: Math.round((f.x - f.w / 2) * geo.k), top: Math.round(f.foot * geo.k) - H, width: W, height: H, opacity: set > 0 ? 1 : 0, ...(transform ? { transform } : {}) })}>
          <Pic c={c} id={c.input.faces.hero} r={{ x: 0, y: 0, w: W, h: H }} pose={pose} t={t} />
          {/* the pole is let go of as they land */}
          {caught ? null : pole}
        </div>
        {layer(geo, (
          <>
            {/* the net, in front of whoever lands in it */}
            {rope(ropeLow, "low", 2.2)}
            {mesh}
            {rope(ropeTop, "top", 3.4)}
            {strung > 0 ? POSTS.map((x) => <circle key={x} cx={x} cy={NET_Y} r={4.5} fill={C.green} stroke={C.ink} strokeWidth={2} />) : null}
          </>
        ))}
      </Sheet>
      <MetaNote d={d} geo={geo} />
    </>
  );
}
