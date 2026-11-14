import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { POSES, type Pose, type PoseName } from "@/lib/story/figure";
import { CHILDREN } from "@/lib/story/faces";
import type { ReactNode } from "react";
import { a, abs, type Anim } from "./motion";
import type { Dev } from "./story-health-motion";
import { META_DEFAULTS, META_LIMITS, partnerFace, type Kin, type MetaShow } from "./story-knowledge";
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
      // the seed in the soil with the ground's words; it sprouts, and a small tree grows beside it; then the big tree
      s.set = a(0.5, "pop");
      s.trouble = a(1.1, "grow", 1.1);
      s.protect = a(2.3, "grow", 1.0);
      break;
    case "balance":
      // the scale stands level; the beam swings; it settles to its tilt
      s.set = a(0.5, "pop");
      s.trouble = a(1.2, "fade", 0.8);
      s.protect = a(2.0, "pop", 0.9);
      break;
    case "bridge":
      // the cliffs, the water and someone on the left; stones fall from the edge; the bridge is drawn across; they walk over
      s.set = a(0.5, "pop");
      s.trouble = a(1.1, "fade", 0.8);
      s.protect = a(1.9, "stroke", 1.0);
      s.walk = a(3.0, "fade", 1.6);
      break;
    case "shield": {
      // the family behind the shield; the arrows fly in one by one (the trouble is their whole flight) and stick in it; it gleams
      s.set = a(0.5, "pop");
      const n = shieldArrows(show).length;
      for (let i = 0; i < n; i += 1) s[`arrow${i}`] = a(1.1 + i * 0.42, "left", 0.5);
      const last = 1.1 + Math.max(0, n - 1) * 0.42 + 0.5;
      s.trouble = a(1.1, "fade", last - 1.1);
      s.protect = a(last + 0.1, "pop", 0.7);
      break;
    }
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
    case "seedtree": return <SeedTree d={d} show={show} />;
    case "balance": return <Balance d={d} show={show} />;
    case "bridge": return <Bridge d={d} show={show} />;
    case "shield": return <Shield d={d} show={show} />;
  }
}

/* ---------- the sheet, the note, the people ---------- */

/** the sheet every picture is drawn on, in its own units: scaled whole into the room the note leaves */
export const SHEET = { w: 400, h: 300 };

/**
 * where a metaphor is set in the frame: the device's room and the frame's text size — the story looks' (geoOf), or
 * the info route's room under its own title (story-meta-info.tsx)
 */
export interface MetaPlace { room: Rect; text: number }
const paperPlace = (size: VideoSize): MetaPlace => ({ room: geoOf(size).dev, text: geoOf(size).text });

/**
 * where a metaphor stands: its picture (`art`, the sheet scaled by `k`) and the note's card under it, or beside it in
 * landscape, which is short. The note is set as lines (broken only at a space) in the largest size up to the frame's
 * text size at which every line fits the card; a note with no space shrinks onto one line.
 */
export function metaGeo(size: VideoSize, note?: string, place: MetaPlace = paperPlace(size)) {
  const r = place.room;
  const text = place.text;
  const pad = Math.round(text * 0.5);
  const fit = (pic: Rect) => {
    const k = Math.min(pic.w / SHEET.w, pic.h / SHEET.h);
    const w = Math.round(SHEET.w * k);
    const h = Math.round(SHEET.h * k);
    return { k, art: { x: pic.x + Math.round((pic.w - w) / 2), y: pic.y + Math.round((pic.h - h) / 2), w, h } };
  };
  if (!note) return { room: r, text, ...fit(r), pad, noteBox: null, noteSize: 0, noteLines: [] as string[], noteRoom: 0 };
  const side = size === "landscape";
  const maxW = side ? 560 : size === "portrait" ? 840 : 800;
  const noteRoom = maxW - pad * 2 - 8;
  const cap = text;
  const noteSize = fitWrap([note], noteRoom, Math.round(cap * 1.3 * (side ? 3 : 2)), cap);
  const noteLines = wrapHand(note, noteSize, noteRoom);
  const widest = Math.max(...noteLines.map((x) => Math.ceil(handWidth(x, noteSize))));
  // the card as wide as its words, and a little more: never as wide as the room for a short line
  const cardW = Math.min(maxW, widest + pad * 2 + 8 + Math.round(text * 1.2));
  const noteH = Math.round(noteLines.length * noteSize * 1.3) + pad * 2 + 8;
  if (side) {
    // the picture and the card side by side, the pair in the middle of the room
    const gap = Math.round(text);
    const { k, art } = fit({ x: r.x, y: r.y, w: r.w - cardW - gap, h: r.h });
    const x0 = r.x + Math.round((r.w - art.w - gap - cardW) / 2);
    return { room: r, text, k, art: { ...art, x: x0 }, pad, noteBox: { x: x0 + art.w + gap, y: r.y + Math.round((r.h - noteH) / 2), w: cardW, h: noteH }, noteSize, noteLines, noteRoom };
  }
  const gap = Math.round(text * 0.5);
  const { k, art } = fit({ x: r.x, y: r.y, w: r.w, h: r.h - noteH - gap });
  return { room: r, text, k, art, pad, noteBox: { x: r.x + Math.round((r.w - cardW) / 2), y: r.y + r.h - noteH, w: cardW, h: noteH }, noteSize, noteLines, noteRoom };
}
export type MetaGeo = ReturnType<typeof metaGeo>;

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

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
/** how far a movement has gone at t, 0 to 1, evenly (look() eases some kinds; the drawers here ease for themselves) */
export const prog = (an: Anim | undefined, t: number) => (an ? clamp01((t - an.at) / an.dur) : 1);
export const r1 = (v: number) => Math.round(v * 10) / 10;
/** a piece popping in: its scale as it comes */
export const popScale = (p: number) => 0.4 + 0.6 * easeOut(p);

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
    case "housepillar": return (show.people ? householdPlaces(show.people, !!show.spare) : pillarPeople(!!show.spare)).map(([x, w]) => at(x, FLOOR, w));
    // the sea up to their chest: a doll's under its big head; มินิมอล's higher up its slim body
    case "lifering": return [at(SWIM_X, SEA + (1 - (minimal(c.input) ? 0.36 : 0.62)) * SWIM_W * TALL + bobAt(t), SWIM_W)];
    case "safetynet": return [at(WALK_X, walkerAt(metaSpec(show), t).foot, WALK_W)];
    case "bridge": return [at(bridgeWalk(show, t).x, BRIDGE.deck, CROSS_W)];
    case "shield": return SHIELD_PEOPLE.map(([x, w]) => at(x, SHIELD_GROUND, w));
    default: return [];
  }
}

/** turned `rot` degrees about the foot of a box `h` px tall: turned about its middle, then moved back so the feet stay put */
export const aboutFeet = (rot: number, h: number) => {
  const th = (rot * Math.PI) / 180;
  return `translate(${r1((h / 2) * Math.sin(th))}px, ${r1((h / 2) * (1 - Math.cos(th)))}px) rotate(${r1(rot)}deg)`;
};

/**
 * how the people come in: on the scene's set beat, a moment after its own pieces start, one after another from the
 * left. Person `i` (counted from the left) enters on its own movement; their poses keep their own phase apart
 * (`phase`), which never moves an entrance.
 */
export const ENTER = { after: 0.15, gap: 0.12, dur: 0.4 };
export const enterOf = (set: Anim | undefined, i: number): Anim | undefined => (set ? { ...set, at: set.at + ENTER.after + i * ENTER.gap, dur: ENTER.dur } : undefined);

/** someone standing in their box `f` on the sheet, in `pose`; popping in on `an` (scene time); their pose `phase` s ahead */
function Who({ c, k, id, f, pose, t, an, who = 0, phase = 0 }: { c: StoryContext; k: number; id: string; f: MetaFigure; pose: PoseName | Pose; t: number; an?: Anim; who?: number; phase?: number }) {
  const W = Math.round(f.w * k);
  const H = Math.round(f.h * k);
  const p = prog(an, t);
  return (
    <div data-who={who} data-face={id} style={abs({ left: Math.round((f.x - f.w / 2) * k), top: Math.round(f.foot * k) - H, width: W, height: H, opacity: an && p <= 0 ? 0 : 1, ...(p < 1 ? { transform: `scale(${popScale(p).toFixed(3)})` } : {}) })}>
      <Pic c={c} id={id} r={{ x: 0, y: 0, w: W, h: H }} pose={pose} t={t + phase} />
    </div>
  );
}

/** the family of three the metaphors protect: the partner, a child and the hero (the episode's own faces) */
export const family = (c: StoryContext) => [partnerFace(c.input), CHILDREN[0], c.input.faces.hero];

/** a pose with the face's smile on or off */
const smiling = (pose: Pose, smile: boolean): Pose => ({ ...pose, smile });
/** the head bowed, a frown: worried */
const worried = (t: number): Pose => ({ ...POSES.sad(t), smile: false });

/** a four-pointed sparkle at (x, y), `r` its reach */
export const sparkleD = (x: number, y: number, r: number) => `M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z`;
/** a sun's eight rays about (x, y), from `r0` out to `r1` */
export const raysD = (x: number, y: number, a: number, b: number) => Array.from({ length: 8 }, (_, i) => { const th = (i * Math.PI) / 4; return `M${r1(x + a * Math.cos(th))} ${r1(y + a * Math.sin(th))} L${r1(x + b * Math.cos(th))} ${r1(y + b * Math.sin(th))}`; });

/* ---------- umbrella: ร่มกันฝน ---------- */

/** the umbrella's canopy, about its tip at (200, 62), 150 to each side, its rim at 150 */
export const UMB = { x: 200, top: 62, rim: 150, half: 150 };
/** the canopy's rim: every head under the umbrella stays below it */
export const UMBRELLA_RIM = UMB.rim;
/** the family under it, each a doll's width (the right one holds the umbrella: its stick comes down between the child and them) */
export const UMB_PEOPLE: [number, number][] = [[106, 82], [162, 60], [252, 82]];
/** a number from 0 to 1 that looks random but is the same for the same `i` every frame */
export const scatter = (i: number) => { const v = Math.sin(i * 12.9898) * 43758.5453; return v - Math.floor(v); };
/** the rain's drops: where each falls and how far down it starts, scattered */
export const DROPS = Array.from({ length: 48 }, (_, i) => ({ x: Math.round(10 + scatter(i + 1) * 380), y0: Math.round(scatter(i + 101) * 220) }));
export const RAIN_TOP = 60;
export const GROUND = 272;
/** how fast the rain falls, sheet units a second */
export const FALL = 240;

/** a rain cloud with its middle at (cx, cy), `s` its size: four puffs on a flat foot */
export const cloudD = (cx: number, cy: number, s: number) => {
  const v = (x: number) => r1(x * s);
  return `M${r1(cx - 48 * s)} ${r1(cy + 16 * s)} a${v(16)} ${v(16)} 0 0 1 ${v(2)} ${v(-30)} a${v(20)} ${v(20)} 0 0 1 ${v(30)} ${v(-14)} a${v(24)} ${v(24)} 0 0 1 ${v(42)} ${v(-2)} a${v(18)} ${v(18)} 0 0 1 ${v(22)} ${v(26)} a${v(14)} ${v(14)} 0 0 1 ${v(-2)} ${v(20)} Z`;
};
const cloud = (cx: number, cy: number, s: number, key: string) => (
  <path key={key} d={cloudD(cx, cy, s)} fill={C.struck} stroke={C.ink} strokeWidth={2.4} strokeLinejoin="round" />
);
/** the clouds' places: the pair drifts in from the left as the rain starts */
export const CLOUDS: [number, number, number][] = [[112, 46, 0.85], [284, 44, 0.9]];
/** the canopy: the dome, and its rim in four scallops from right to left (about the tip, before it is opened out) */
export const CANOPY = `M${UMB.x - UMB.half} ${UMB.rim} C${UMB.x - UMB.half} 90 ${UMB.x - 82} ${UMB.top} ${UMB.x} ${UMB.top} C${UMB.x + 82} ${UMB.top} ${UMB.x + UMB.half} 90 ${UMB.x + UMB.half} ${UMB.rim}`
  + [1, 0, -1, -2].map((i) => ` Q${UMB.x + i * 75 + 37.5} ${UMB.rim - 18} ${UMB.x + i * 75} ${UMB.rim}`).join("") + " Z";
/** the canopy's ribs, and its stick down to the hook by the right hand */
export const umbrellaRib = (i: number) => `M${UMB.x} ${UMB.top} Q${UMB.x + i * 44} 92 ${UMB.x + i * 75} ${UMB.rim}`;
export const UMBRELLA_STICK = `M${UMB.x} ${UMB.top} V238 q0 13 12 13 q10 0 10 -10`;

/**
 * the rain and the umbrella at t (sheet units), whatever the look: how far the rain and the opening have gone, the
 * canopy's spread, the drops still falling (none under the open canopy) and the water running off its two edges
 */
export function umbrellaAt(s: Record<string, Anim>, t: number) {
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
      return y + 12 > GROUND || under(p.x, y + 12) ? [] : [{ i, x: p.x, y }];
    })
    : [];
  // the water off the canopy's two edges, once it is open
  const runoff = open > 0.85
    ? [-1, 1].flatMap((side) => [0, 1, 2, 3].map((j) => ({ side, j, x: UMB.x + side * (half + 2), y: rim + 4 + ((j * 29 + t * FALL) % (GROUND - rim - 12)) })))
    : [];
  return { rain, open, opened, sx, sy, half, rim, drops, runoff, sad: rain > 0 && open < 0.6, glad: open >= 0.6 };
}

/**
 * ร่มกันฝน: the family of three; the rain starts from the clouds and falls on them; a red umbrella opens over them,
 * the rain stops on it and runs off its two edges, and the family are glad
 */
function Umbrella({ d, show }: { d: Dev; show: MetaShow<"umbrella"> }) {
  const { c, t, s } = d;
  const geo = metaGeo(c.size, show.note);
  const u = umbrellaAt(s, t);
  const { rain, open, opened, sx, sy, half, sad, glad } = u;
  const drops = u.drops.map((p) => <path key={p.i} d={`M${p.x} ${r1(p.y)} l-3 12`} stroke={C.waterInk} strokeWidth={2.6} strokeLinecap="round" />);
  const runoff = u.runoff.map((p) => <path key={`${p.side}${p.j}`} d={`M${r1(p.x)} ${r1(p.y)} l${p.side * 1.5} 10`} stroke={C.waterInk} strokeWidth={2.8} strokeLinecap="round" />);
  const splash = (x: number, key: string) => <path key={key} d={`M${r1(x - 12)} ${GROUND - 2} q4 -8 8 -2 M${r1(x + 4)} ${GROUND - 4} q4 -8 8 2`} fill="none" stroke={C.waterInk} strokeWidth={2.2} strokeLinecap="round" />;
  const [left, kid, right] = family(c);
  const figs = metaFigures(show, c, t);
  return (
    <>
      <MetaTitle d={d} text={show.title} />
      <Sheet geo={geo}>
        {/* the clouds come over as the rain starts; the puddles fill */}
        {layer(geo, (
          <>
            <g transform={`translate(${r1((1 - easeOut(rain)) * -30)} 0)`}>{CLOUDS.map(([x, y, k], i) => cloud(x, y, k, i ? "b" : "a"))}</g>
            <ellipse cx={46} cy={GROUND + 6} rx={r1(30 * rain)} ry={r1(5 * rain)} fill={C.blanket} stroke={C.waterInk} strokeWidth={1.6} />
            <ellipse cx={356} cy={GROUND + 6} rx={r1(26 * rain)} ry={r1(4.5 * rain)} fill={C.blanket} stroke={C.waterInk} strokeWidth={1.6} />
          </>
        ), rain > 0 ? easeOut(rain) : 0)}
        {[left, kid, right].map((id, i) => (
          <Who key={i} who={i} c={c} k={geo.k} id={id} f={figs[i]} t={t} phase={i * 0.4} an={enterOf(s.set, i)}
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
                <path d={UMBRELLA_STICK} fill="none" stroke={C.ink} strokeWidth={4.4} strokeLinecap="round" />
                <g transform={`translate(${UMB.x} ${UMB.top}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-UMB.x} ${-UMB.top})`}>
                  <path d={CANOPY} fill={C.red} stroke={C.ink} strokeWidth={3} strokeLinejoin="round" />
                  {[-1, 0, 1].map((i) => <path key={i} d={umbrellaRib(i)} fill="none" stroke={C.ink} strokeWidth={2} opacity={0.55} />)}
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
export const FLOOR = 270;
export const BEAM = 124;
export const MAIN_X = 200;
export const SPARE_X = 330;
/** a pillar's plaque, widest; its top; with a spare, how far right the main's may reach and from where the spare's starts */
const PLAQUE_W = 144;
export const PLAQUE_TOP = 128;
const MAIN_RIGHT = 263;
const SPARE_LEFT = 269;
/** the family in the house, each a doll's width: the right one stands between the pillars when a spare comes, as far from the pillar as the left two otherwise */
const pillarPeople = (spare: boolean): [number, number][] => [[72, 80], [132, 60], [spare ? 262 : 300, 80]];
/** a doll's width under the roof by who they are, as the kin row sizes them as far as the house allows: the hero a little larger, a child smaller */
const HOUSEHOLD_W: Record<Kin["size"], number> = { hero: 84, adult: 80, old: 80, kid: 60 };
/**
 * the household's places under the roof (the pillar episode's kin row, in its order): the first half left of the
 * pillar, the rest right of it (short of the spare when one comes), each side's people close as a row in the middle
 * of their side, their boxes just overlapping, as the family of three's do
 */
export function householdPlaces(people: Kin[], spare: boolean): [number, number][] {
  const ws = people.map((p) => HOUSEHOLD_W[p.size]);
  const left = Math.ceil(ws.length / 2);
  const side = (w: number[], a: number, b: number): [number, number][] => {
    if (!w.length) return [];
    const steps = w.slice(1).map((x, i) => ((w[i] + x) / 2) * 0.85);
    const ends = w[0] / 2 + w[w.length - 1] / 2;
    const sum = steps.reduce((x, y) => x + y, 0);
    const k = sum > 0 && ends + sum > b - a ? Math.max(0, b - a - ends) / sum : 1;
    let x = a + (b - a - (ends + sum * k)) / 2 + w[0] / 2;
    return w.map((wi, i) => { if (i) x += steps[i - 1] * k; return [r1(x), wi]; });
  };
  return [...side(ws.slice(0, left), 34, 184), ...side(ws.slice(left), 216, spare ? 312 : 366)];
}
/** who stands under the roof, left to right: the household the show carries, else the family of three */
export const pillarCast = (show: MetaShow<"housepillar">, c: StoryContext) => (show.people ? show.people.map((p) => p.id) : family(c));

/**
 * a word's plaque, sized: its word set on one line in the largest size, up to `cap`, at which it fits `maxW` of the
 * sheet's units; as wide as the word and a little more (frame px)
 */
export function tagSize(geo: MetaGeo, word: string, maxW: number, cap: number) {
  // the padding inside the plaque, its 3 px edge counted in
  const pad = Math.round(geo.text * 0.26) + 3;
  const maxPx = Math.round(maxW * geo.k);
  const fs = Math.min(cap, Math.floor((maxPx - pad * 2) / (handWidth(word, 1) || 1)));
  const w = Math.min(maxPx, Math.ceil(handWidth(word, fs)) + pad * 2 + Math.round(fs * 0.4));
  const h = Math.round(fs * 1.3) + 2 * (Math.round(fs * 0.12) + 3);
  return { word, size: fs, pad, w, h };
}
type TagSize = ReturnType<typeof tagSize>;
/** a plaque placed in the frame: its middle at the sheet's `mid`, its top `top` px down the frame */
export const placeTag = (geo: MetaGeo, p: TagSize, mid: number, top: number) => ({ word: p.word, size: p.size, pad: p.pad, plaque: { x: geo.art.x + Math.round(mid * geo.k - p.w / 2), y: top, w: p.w, h: p.h } });
export type MetaTag = ReturnType<typeof placeTag>;
/** the middle a plaque `w` px wide may have on the sheet to stand `edge` units inside it, nearest to `mid` */
export const keepIn = (geo: MetaGeo, w: number, mid: number, edge = 4) => Math.min(SHEET.w - edge - w / 2 / geo.k, Math.max(edge + w / 2 / geo.k, mid));

/**
 * where เสาหลักของบ้าน's words stand: each pillar's plaque (in the frame's px) with its word set in the largest size,
 * up to a little under the text size, at which it fits on one line; the spare's only when there is a spare word. A
 * plaque hangs in the middle of its pillar; with a spare, a wide main plaque leans left and a wide spare one right,
 * so the two never meet.
 */
export function pillarGeo(size: VideoSize, show: MetaShow<"housepillar">, where?: MetaPlace) {
  const geo = metaGeo(size, show.note, where);
  const plaque = (word: string, x: number, place: (w: number) => number) => {
    const p = tagSize(geo, word, PLAQUE_W, Math.round(geo.text * 0.95));
    // where its middle hangs, in the sheet's units
    return { ...placeTag(geo, p, place(p.w / geo.k), geo.art.y + Math.round(PLAQUE_TOP * geo.k)), x };
  };
  const spare = show.spare;
  return {
    geo,
    main: plaque(show.label || META_DEFAULTS.label, MAIN_X, (w) => (spare ? Math.min(MAIN_X, MAIN_RIGHT - w / 2) : MAIN_X)),
    spare: spare ? plaque(spare, SPARE_X, (w) => Math.max(SPARE_X, SPARE_LEFT + w / 2)) : null,
  };
}
type PlaqueGeo = MetaTag;

/**
 * the house at t, whatever the look: the main pillar rocking about its foot as it shakes, dying away, and the roof
 * shuddering with it; how far the spare has slid in (from beyond the right edge)
 */
export function pillarAt(s: Record<string, Anim>, t: number) {
  const shake = prog(s.trouble, t);
  const shaking = shake > 0 && shake < 1;
  const rot = shaking ? 3.4 * Math.sin(shake * Math.PI * 9) * (1 - shake) : 0;
  const jolt = shaking ? 2.2 * Math.sin(shake * Math.PI * 12) * (1 - shake) : 0;
  const spareIn = easeOut(prog(s.protect, t));
  return { shaking, rot, jolt, spareIn, slide: (1 - spareIn) * 110, spared: !!s.protect && t >= s.protect.at };
}
/** the roof, its inner line, and the round window under its peak */
export const ROOF = `M14 ${BEAM - 10} L200 22 L386 ${BEAM - 10} Z`;
export const ROOF_LINE = `M64 ${BEAM - 30} L200 48 L336 ${BEAM - 30}`;
/** the shake's marks either side of the pillar's head */
export const SHAKE_MARKS = [`M${MAIN_X - 24} ${BEAM + 22} q-8 10 0 20 M${MAIN_X - 32} ${BEAM + 18} q-10 14 0 28`, `M${MAIN_X + 24} ${BEAM + 22} q8 10 0 20 M${MAIN_X + 32} ${BEAM + 18} q10 14 0 28`];

/** a pillar standing from the beam to the floor at `x`, `fill` its wood, with its grain */
const pillar = (x: number, fill: string, grain: string, key: string) => (
  <g key={key}>
    <rect x={x - 13} y={BEAM} width={26} height={FLOOR - BEAM} fill={fill} stroke={C.ink} strokeWidth={2.6} />
    <path d={`M${x - 5} ${BEAM + 18} v34 M${x + 4} ${BEAM + 62} v40 M${x - 3} ${BEAM + 112} v22`} stroke={grain} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
    <rect x={x - 19} y={BEAM} width={38} height={9} rx={2} fill={fill} stroke={C.ink} strokeWidth={2.6} />
    <rect x={x - 19} y={FLOOR - 9} width={38} height={9} rx={2} fill={fill} stroke={C.ink} strokeWidth={2.6} />
  </g>
);

/** a word's plaque on note paper, turned a little (and `rot` more); placed from the sheet's corner (`at`), moved `dx`/`dy` px */
function Plaque({ p, at, rot = 0, dx = 0, dy = 0, opacity = 1 }: { p: PlaqueGeo; at: Rect; rot?: number; dx?: number; dy?: number; opacity?: number }) {
  const pr = p.plaque;
  return (
    <div style={abs({ left: pr.x - at.x + Math.round(dx), top: pr.y - at.y + Math.round(dy), width: pr.w, height: pr.h, justifyContent: "center", alignItems: "center", background: C.note, border: `3px solid ${C.ink}`, borderRadius: 8, fontFamily: "Mali", fontSize: p.size, fontWeight: 600, lineHeight: 1.3, color: C.ink, transform: `rotate(${r1(-1.5 + rot)}deg)`, ...(opacity < 1 ? { opacity: r1(opacity * 100) / 100 } : {}) })}>{p.word}</div>
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
  const { shaking, rot, jolt, spareIn, slide, spared } = pillarAt(s, t);
  const spare = pg.spare && spared ? pg.spare : null;
  const cast = pillarCast(show, c);
  // the child waves once the spare holds: the family's child, or the household's first
  const waver = show.people ? show.people.findIndex((p) => p.size === "kid") : 1;
  const safe = !!spare && spareIn > 0.7;
  const pose = (i: number): PoseName | Pose => (shaking ? worried(t + i * 0.4) : safe ? (i === waver ? "wave" : smiling(POSES.stand(t + i * 0.4), true)) : POSES.stand(t + i * 0.4));
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
                <path d={ROOF} fill={C.red} stroke={C.ink} strokeWidth={3} strokeLinejoin="round" />
                <path d={ROOF_LINE} fill="none" stroke={C.ink} strokeWidth={2} opacity={0.35} />
                <circle cx={200} cy={78} r={13} fill={C.note} stroke={C.ink} strokeWidth={2.6} />
                <path d="M200 65 V91 M187 78 H213" stroke={C.ink} strokeWidth={2} />
                <rect x={34} y={BEAM - 10} width={332} height={12} fill={C.wood} stroke={C.ink} strokeWidth={2.6} />
              </g>
              <g transform={`rotate(${r1(rot)} ${MAIN_X} ${FLOOR})`}>{pillar(MAIN_X, C.wood, C.woodGrain, "main")}</g>
              {/* the shake's marks either side of the pillar's head */}
              {shaking ? (
                <g stroke={C.ink} strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.8}>
                  <path d={SHAKE_MARKS[0]} />
                  <path d={SHAKE_MARKS[1]} />
                </g>
              ) : null}
              {spare ? <g transform={`translate(${r1(slide)} 0)`}>{pillar(SPARE_X, C.coin, C.ink, "spare")}</g> : null}
            </>
          ))}
          <Plaque p={pg.main} at={geo.art} rot={rot} dx={plaqueDx} />
          {spare ? <Plaque p={spare} at={geo.art} dx={slide * geo.k} /> : null}
        </div>
        {cast.map((id, i) => <Who key={i} who={i} c={c} k={geo.k} id={id} f={figs[i]} t={t} phase={i * 0.4} an={enterOf(s.set, i)} pose={pose(i)} />)}
      </Sheet>
      <MetaNote d={d} geo={geo} />
    </>
  );
}

/* ---------- lifering: ห่วงชูชีพ ---------- */

/** the water's surface; the one in it, and where the ring lands round them */
export const SEA = 158;
export const SWIM_X = 164;
export const SWIM_W = 116;
export const RING = { rx: 70, ry: 21 };
/** the ring's flight: from the jetty, up over, down onto the one in the water */
export const THROW = { x0: 356, y0: 102, cx: 276, cy: -30, x1: SWIM_X, y1: SEA + 2 };
/** how the one in the water bobs at time t */
export const bobAt = (t: number) => 3 * Math.sin(t * 3.4);
export const along = (q: number) => ({
  x: (1 - q) ** 2 * THROW.x0 + 2 * (1 - q) * q * THROW.cx + q * q * THROW.x1,
  y: (1 - q) ** 2 * THROW.y0 + 2 * (1 - q) * q * THROW.cy + q * q * THROW.y1,
});

/** a line of waves at height y and time t, `amp` high, from `from` to `to` */
export const wave = (y: number, amp: number, t: number, from = 0, to = SHEET.w, len = 80) => {
  const pts: string[] = [];
  for (let x = from; x <= to; x += 8) pts.push(`${x} ${r1(y + amp * Math.sin((x / len) * 2 * Math.PI - t * 3.2))}`);
  return `M${pts.join(" L")}`;
};

/** the ring, red with white bands and an ink edge: whole, or its far or near half (`part`) */
export const ringD = (cx: number, cy: number, rx: number, ry: number, part: "whole" | "far" | "near") => (part === "whole"
  ? `M${r1(cx - rx)} ${r1(cy)} a${r1(rx)} ${r1(ry)} 0 1 1 ${r1(rx * 2)} 0 a${r1(rx)} ${r1(ry)} 0 1 1 ${r1(-rx * 2)} 0`
  : part === "far" ? `M${r1(cx - rx)} ${r1(cy)} a${r1(rx)} ${r1(ry)} 0 0 1 ${r1(rx * 2)} 0` : `M${r1(cx + rx)} ${r1(cy)} a${r1(rx)} ${r1(ry)} 0 0 1 ${r1(-rx * 2)} 0`);
const ring = (cx: number, cy: number, rx: number, ry: number, part: "whole" | "far" | "near", key: string) => {
  const d = ringD(cx, cy, rx, ry, part);
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
 * the water and the throw at t, whatever the look: how rough the sea is, how far the ring has flown along its arc (the
 * dashed trail as far as it has come, and where it is), whether it has landed, and the bob of the one in the water
 */
export function ringAt(s: Record<string, Anim>, t: number) {
  const rough = easeOut(prog(s.trouble, t));
  const q = easeOut(prog(s.protect, t));
  const thrown = !!s.protect && t >= s.protect.at;
  const landed = thrown && q >= 1;
  const trail: string[] = [];
  for (let i = 0; i <= 24; i += 1) { const p = along((q * i) / 24); trail.push(`${r1(p.x)} ${r1(p.y)}`); }
  return { rough, q, thrown, landed, amp: 3.5 + 3.5 * rough * (landed ? 0.5 : 1), bob: bobAt(t), trail: `M${trail.join(" L")}`, at: along(q), help: rough > 0 && !landed };
}
/** the sea from its moving surface down to the sheet's foot, its corners rounded */
export const seaD = (amp: number, t: number) => `${wave(SEA, amp, t)} L${SHEET.w} ${SHEET.h - 12} Q${SHEET.w} ${SHEET.h} ${SHEET.w - 12} ${SHEET.h} L12 ${SHEET.h} Q0 ${SHEET.h} 0 ${SHEET.h - 12} Z`;
/** the white crests on the sea: height, from, to, phase */
export const CRESTS = [[184, 20, 110, 0.6], [214, 236, 300, 1.4], [252, 40, 200, 2.1], [240, 270, 386, 0.9], [276, 220, 340, 1.7]];
/** the jetty the ring is thrown from: its legs, its deck, its boards */
export const JETTY = { legs: "M334 124 V186 M386 124 V186", deck: { x: 318, y: 112, w: 86, h: 13 }, boards: "M340 112 v13 M362 112 v13 M384 112 v13" };

/**
 * ห่วงชูชีพ: someone in the water, the waves moving; the waves rise and they call for help; a red-and-white ring is
 * thrown from the jetty along a dashed arc and lands round them, and they hold on
 */
function LifeRing({ d, show }: { d: Dev; show: MetaShow<"lifering"> }) {
  const { c, t, s } = d;
  const geo = metaGeo(c.size, show.note);
  const set = prog(s.set, t);
  const { rough, q, thrown, landed, amp, bob, trail, at, help } = ringAt(s, t);
  const pose: Pose = landed ? { ...POSES.hand(t), ua: [-60, 60], fa: [-80, 80] } : help ? { ...POSES.wave(t), smile: false, h: 18 } : worried(t);
  return (
    <>
      <MetaTitle d={d} text={show.title} />
      <Sheet geo={geo}>
        {layer(geo, (
          <>
            {/* the jetty the ring is thrown from */}
            <path d={JETTY.legs} stroke={C.woodGrain} strokeWidth={8} strokeLinecap="round" />
            <rect x={JETTY.deck.x} y={JETTY.deck.y} width={JETTY.deck.w} height={JETTY.deck.h} rx={2} fill={C.wood} stroke={C.ink} strokeWidth={2.6} />
            <path d={JETTY.boards} stroke={C.woodGrain} strokeWidth={2} />
            {landed ? ring(SWIM_X, SEA + 2 + bob, RING.rx, RING.ry, "far", "far") : null}
          </>
        ), set > 0 ? 1 : 0)}
        {/* the one in the water, the sea up to their chest */}
        <Who who={0} c={c} k={geo.k} id={c.input.faces.hero} f={metaFigures(show, c, t)[0]} t={t} an={s.set} pose={pose} />
        {layer(geo, (
          <>
            <path d={seaD(amp, t)} fill={C.blanket} stroke={C.waterInk} strokeWidth={2.6} strokeLinejoin="round" />
            {CRESTS.map(([y, a0, a1, ph]) => (
              <path key={y} d={wave(y, 3, t + ph, a0, a1, 56)} fill="none" stroke={C.white} strokeWidth={2.6} strokeLinecap="round" opacity={0.85} />
            ))}
            {/* the splashes while they call for help */}
            {help ? [-1, 1].map((side) => (
              <g key={side} opacity={rough}>
                <path d={`M${SWIM_X + side * 50} ${SEA - 2} q${side * 6} -12 ${side * 14} -6`} fill="none" stroke={C.waterInk} strokeWidth={2.4} strokeLinecap="round" />
                <circle cx={r1(SWIM_X + side * (62 + 4 * Math.sin(t * 6)))} cy={r1(SEA - 16 - 6 * Math.abs(Math.sin(t * 5 + side)))} r={3} fill={C.white} stroke={C.waterInk} strokeWidth={1.6} />
              </g>
            )) : null}
            {thrown ? <path d={trail} fill="none" stroke={C.ink} strokeWidth={2.2} strokeDasharray="7 7" strokeLinecap="round" opacity={landed ? 0.7 : 1} /> : null}
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
export const HIGH = 104;
export const POSTS = [36, 364];
export const NET_Y = 226;
export const WALK_X = 200;
export const WALK_W = 76;
/** how far into the net's mesh whoever lands in it sinks */
export const SINK = 12;

/** the net's top rope at x, sagging `sag` in its middle */
export const netAt = (x: number, sag: number) => NET_Y + sag * (1 - ((x - WALK_X) / (POSTS[1] - WALK_X)) ** 2);

/** how much of the fall beat the drop to the net takes; the rest is the net giving and springing back */
export const FALL_DROP = 0.32;
/** how long the dashed fall line takes to go once they have landed */
export const FALL_LINE_GOES = 0.3;

/**
 * the walker at time t: on the line, wobbling as they slip; then down to the net in the fall's first part, gathering
 * speed; then the net gives and springs back, dying away, with them in it
 */
export function walkerAt(s: Record<string, Anim>, t: number) {
  const slip = prog(s.trouble, t);
  const fall = prog(s.fall, t);
  const falling = !!s.fall && t >= s.fall.at;
  const DROP = FALL_DROP;
  const rest = 26;
  const tau = Math.max(0, (fall - DROP) * (s.fall?.dur ?? 1));
  const give = fall > DROP ? 26 * Math.exp(-3.4 * tau) * Math.cos(2 * Math.PI * 1.6 * tau) : 0;
  const sag = rest * (falling ? 1 : 0.7) + give;
  const foot = !falling ? HIGH : fall < DROP ? HIGH + (netAt(WALK_X, rest) + SINK - HIGH) * (fall / DROP) ** 2 : netAt(WALK_X, sag) + SINK;
  const rot = !falling ? (slip > 0 ? 16 * Math.sin(slip * Math.PI * 2.5) : 0) : fall < DROP ? 24 * Math.sin((fall / DROP) * Math.PI) : 0;
  return { slip, sag, foot, rot, caught: falling && fall >= DROP };
}

/**
 * the net at t, whatever the look: strung from the posts inward (the two runs of each rope, each a list of points, and
 * the mesh's crossing strands, only as far as it is strung), sagging under whoever is in it; and the walker's state
 */
export function netShape(s: Record<string, Anim>, t: number) {
  const w = walkerAt(s, t);
  const strung = easeOut(prog(s.protect, t));
  const reach = (POSTS[1] - WALK_X) * strung;
  const inNet = (x: number) => Math.abs(x - WALK_X) >= POSTS[1] - WALK_X - reach - 0.01;
  const ropeTop: [number, string][] = [];
  const ropeLow: [number, string][] = [];
  for (let x = POSTS[0]; x <= POSTS[1]; x += 6) {
    if (!inNet(x)) continue;
    ropeTop.push([x, `${x} ${r1(netAt(x, w.sag))}`]);
    ropeLow.push([x, `${x} ${r1(netAt(x, w.sag) + 20)}`]);
  }
  const mesh = Array.from({ length: 16 }, (_, i) => POSTS[0] + 4 + i * 20).filter((x) => x + 20 <= POSTS[1] && inNet(x) && inNet(x + 20)).map((x) => ({
    x, d: `M${x} ${r1(netAt(x, w.sag))} L${x + 20} ${r1(netAt(x + 20, w.sag) + 20)} M${x + 20} ${r1(netAt(x + 20, w.sag))} L${x} ${r1(netAt(x, w.sag) + 20)}`,
  }));
  /** a rope's runs: one whole, or (still being strung) one from each post until they meet in the middle */
  const runs = (pts: [number, string][]) => (strung >= 1 ? [pts] : [pts.filter((p) => p[0] <= WALK_X), pts.filter((p) => p[0] >= WALK_X)]).map((r) => (r.length > 1 ? `M${r.map((p) => p[1]).join(" L")}` : null));
  // the dashed fall line: from the slip, while they fall; it fades away in a few tenths of a second once they land (left
  // on, it reads as a string they hang from in the final hold)
  const since = w.caught && s.fall ? t - (s.fall.at + s.fall.dur * FALL_DROP) : 0;
  const fallLine = w.slip > 0 ? 0.65 * easeOut(w.slip) * (1 - clamp01(since / FALL_LINE_GOES)) : 0;
  return { ...w, strung, ropeTop, ropeLow, mesh, runs, fallLine };
}
/** where they will fall, from the line to the net */
export const FALL_LINE = `M${WALK_X} ${HIGH + 8} V${NET_Y + 16}`;

/**
 * ตาข่ายนิรภัย: someone walking the high line with a pole; they slip and fall along the dashed line; a green net is
 * strung below from both posts; it catches them and they bounce, glad
 */
function SafetyNet({ d, show }: { d: Dev; show: MetaShow<"safetynet"> }) {
  const { c, t, s } = d;
  const geo = metaGeo(c.size, show.note);
  const set = prog(s.set, t);
  const net = netShape(s, t);
  const { slip, rot, caught, strung, ropeTop, ropeLow } = net;
  const f = metaFigures(show, c, t)[0];
  const pose: Pose = caught ? POSES.cheer(t) : slip > 0 ? { ...POSES.cheer(t), smile: false, h: 18 } : POSES.stand(t);
  // the mesh: strands crossing between the top rope and the lower edge
  const mesh = net.mesh.map((m) => <path key={m.x} d={m.d} stroke={C.green} strokeWidth={1.8} />);
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
            {/* where they will fall, dashed, from the moment they slip; gone soon after they land */}
            {net.fallLine > 0 ? <path d={FALL_LINE} stroke={C.ink} strokeWidth={2} strokeDasharray="5 7" strokeLinecap="round" opacity={r1(net.fallLine)} /> : null}
          </>
        ), set > 0 ? 1 : 0)}
        <div data-who={0} data-face={c.input.faces.hero} style={abs({ left: Math.round((f.x - f.w / 2) * geo.k), top: Math.round(f.foot * geo.k) - H, width: W, height: H, opacity: set > 0 ? 1 : 0, ...(transform ? { transform } : {}) })}>
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

/** a piece growing up from its foot with a little overshoot, 0 to 1 */
export const growScale = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2);
export const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
/** a shape on the sheet that grows from (x, y), its foot, `v` its growth */
export const grownAt = (x: number, y: number, v: number, body: ReactNode, key: string) => (v <= 0 ? null : (
  <g key={key} transform={`translate(${x} ${y}) scale(${growScale(v).toFixed(3)})`}>{body}</g>
));

/* ---------- seedtree: เมล็ดโตเป็นต้นไม้ ---------- */

/** the soil's top; the sprout, the small tree and the big tree along it, left to right; where the ground's words hang */
export const SOIL = 212;
export const SEED_X = [80, 188, 310] as const;
export const SEED_WORD_TOP = 246;
/** the sun, low on the left; the soil (its top, a gentle swell) and its line of grass */
export const SEED_SUN = { x: 44, y: 46 };
export const SOIL_TOP = `M6 ${SOIL} Q100 ${SOIL - 6} 200 ${SOIL} T394 ${SOIL}`;
export const SOIL_D = `${SOIL_TOP} V288 Q394 298 384 298 H16 Q6 298 6 288 Z`;
/** a ground word's plaque at most this wide (sheet units): the two leave room for the arrow between them */
const SEED_WORD_W = 160;
const LEAF = C.paperShirts[5];

/**
 * where เมล็ดโตเป็นต้นไม้'s words stand (the ground's two, วันนี้ / วันข้างหน้า when none are given) and how far each of
 * its three plants has grown at t: the sprout and then the small tree in the trouble beat, the big tree in the
 * protection; a plant starts only once the one to its left is grown
 */
export function seedGeo(size: VideoSize, show: MetaShow<"seedtree">, where?: MetaPlace) {
  const geo = metaGeo(size, show.note, where);
  const cap = Math.round(geo.text * 0.9);
  const top = geo.art.y + Math.round(SEED_WORD_TOP * geo.k);
  const word = (w: string, mid: number) => { const p = tagSize(geo, w, SEED_WORD_W, cap); return placeTag(geo, p, keepIn(geo, p.w, mid), top); };
  const s = metaSpec(show);
  const stages = (t: number) => {
    const tr = s.trouble;
    const half = tr.dur * 0.45;
    return [prog({ ...tr, dur: half }, t), prog({ ...tr, at: tr.at + half, dur: tr.dur - half }, t), prog(s.protect, t)];
  };
  return { geo, from: word(show.from || META_DEFAULTS.from, SEED_X[0]), to: word(show.to || META_DEFAULTS.to, SEED_X[2]), stages };
}

/**
 * the three plants' shapes, each about its foot at (0, 0): the sprout's stem and two leaves; the small tree's trunk and
 * crown (round blobs, a lighter one on top); the big tree's trunk, two branches, crown and fruit
 */
export const PLANTS = {
  sprout: { stem: "M0 0 C-2 -16 4 -28 0 -44", leaves: ["M0 -40 C-8 -56 -30 -58 -36 -46 C-26 -36 -10 -36 0 -40 Z", "M0 -42 C8 -60 30 -62 36 -50 C26 -38 10 -38 0 -42 Z"] },
  small: { trunk: "M-6 0 L-5 -66 L5 -66 L6 0 Z", crown: [[-22, -74, 20], [22, -74, 20], [0, -94, 28]] as [number, number, number][], light: [[-6, -104, 9]] as [number, number, number][] },
  big: {
    trunk: "M-15 0 Q-9 -50 -8 -108 L8 -108 Q9 -50 15 0 Z", branches: "M-4 -80 L-30 -106 M4 -90 L28 -114",
    crown: [[-44, -116, 34], [44, -116, 34], [-24, -158, 36], [26, -160, 36], [0, -128, 40]] as [number, number, number][], light: [[-30, -176, 12], [14, -182, 10]] as [number, number, number][],
    fruit: [[-46, -110], [-8, -140], [36, -122], [20, -170], [-30, -160]],
  },
};
/** the pebbles in the soil */
export const PEBBLES = [[30, 228], [150, 232], [252, 226], [372, 230], [214, 290], [118, 290]];
/** the seed's roots, once it sprouts */
export const ROOTS = `M${SEED_X[0]} ${SOIL + 12} q-10 6 -14 14 M${SEED_X[0]} ${SOIL + 12} q8 8 10 16`;
/** the sprout: a curved stem and two leaves, its foot at (0, 0) */
const sprout = (
  <>
    <path d={PLANTS.sprout.stem} fill="none" stroke={C.green} strokeWidth={4} strokeLinecap="round" />
    <path d={PLANTS.sprout.leaves[0]} fill={LEAF} stroke={C.ink} strokeWidth={2.2} strokeLinejoin="round" />
    <path d={PLANTS.sprout.leaves[1]} fill={LEAF} stroke={C.ink} strokeWidth={2.2} strokeLinejoin="round" />
  </>
);
/** a crown of leaves: round blobs, the ink round the whole, a lighter blob or two on top */
const crown = (blobs: [number, number, number][], light: [number, number, number][]) => (
  <>
    {blobs.map(([x, y, r], i) => <circle key={`o${i}`} cx={x} cy={y} r={r} fill={C.ink} stroke={C.ink} strokeWidth={5} />)}
    {blobs.map(([x, y, r], i) => <circle key={`i${i}`} cx={x} cy={y} r={r} fill={i % 2 ? C.green : LEAF} />)}
    {light.map(([x, y, r], i) => <circle key={`l${i}`} cx={x} cy={y} r={r} fill={C.white} opacity={0.22} />)}
  </>
);
const smallTree = (
  <>
    <path d={PLANTS.small.trunk} fill={C.wood} stroke={C.ink} strokeWidth={2.4} strokeLinejoin="round" />
    {crown(PLANTS.small.crown, PLANTS.small.light)}
  </>
);
const bigTree = (fruit: number) => (
  <>
    <path d={PLANTS.big.trunk} fill={C.wood} stroke={C.ink} strokeWidth={2.6} strokeLinejoin="round" />
    <path d={PLANTS.big.branches} stroke={C.wood} strokeWidth={7} strokeLinecap="round" />
    {crown(PLANTS.big.crown, PLANTS.big.light)}
    {/* the fruit, last */}
    {fruit > 0 ? PLANTS.big.fruit.map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={r1(6.5 * growScale(clamp01(fruit * 5 - i * 0.8)))} fill={C.red} stroke={C.ink} strokeWidth={1.6} />
    )) : null}
  </>
);

/**
 * เมล็ดโตเป็นต้นไม้: a seed in the soil under the ground's two words (วันนี้ → วันข้างหน้า); it sprouts; a small tree
 * grows beside it; then a big tree with fruit, left to right
 */
function SeedTree({ d, show }: { d: Dev; show: MetaShow<"seedtree"> }) {
  const { c, t, s } = d;
  const sg = seedGeo(c.size, show);
  const geo = sg.geo;
  const set = prog(s.set, t);
  const [a0, a1, a2] = sg.stages(t);
  // the arrow on the soil from the first word to the second, in the sheet's units
  const right = (sg.from.plaque.x + sg.from.plaque.w - geo.art.x) / geo.k + 8;
  const left = (sg.to.plaque.x - geo.art.x) / geo.k - 8;
  const ay = SEED_WORD_TOP + sg.from.plaque.h / geo.k / 2;
  return (
    <>
      <MetaTitle d={d} text={show.title} />
      <Sheet geo={geo}>
        <div style={abs({ left: 0, top: 0, width: geo.art.w, height: geo.art.h, opacity: set > 0 ? 1 : 0, ...(set < 1 ? { transform: `scale(${popScale(set).toFixed(3)})` } : {}) })}>
          {layer(geo, (
            <>
              {/* the sun, low on the left */}
              <g>
                {raysD(SEED_SUN.x, SEED_SUN.y, 25, 33).map((ray, i) => <path key={i} d={ray} stroke={C.coin} strokeWidth={3} strokeLinecap="round" />)}
                <circle cx={SEED_SUN.x} cy={SEED_SUN.y} r={18} fill={C.spoken} stroke={C.ink} strokeWidth={2.4} />
              </g>
              {/* the soil, its pebbles, the seed in it and, once it sprouts, its roots */}
              <path d={SOIL_D} fill={C.paperChair} stroke={C.ink} strokeWidth={2.6} strokeLinejoin="round" />
              <path d={SOIL_TOP} fill="none" stroke={LEAF} strokeWidth={6} strokeLinecap="round" />
              {PEBBLES.map(([x, y]) => <ellipse key={`${x}`} cx={x} cy={y} rx={4} ry={2.6} fill={C.woodGrain} opacity={0.45} />)}
              {a0 > 0 ? <path d={ROOTS} fill="none" stroke={C.woodGrain} strokeWidth={2} strokeLinecap="round" opacity={r1(easeOut(a0))} /> : null}
              <ellipse cx={SEED_X[0]} cy={SOIL + 10} rx={9} ry={6} fill={C.woodGrain} stroke={C.ink} strokeWidth={2} />
              {/* the way from today to later, between the ground's words */}
              {left - right > 24 ? (
                <g stroke={C.ink} strokeWidth={2.6} strokeLinecap="round" fill="none" opacity={0.8}>
                  <path d={`M${r1(right)} ${r1(ay)} H${r1(left)}`} strokeDasharray="2 7" />
                  <path d={`M${r1(left - 8)} ${r1(ay - 7)} L${r1(left)} ${r1(ay)} L${r1(left - 8)} ${r1(ay + 7)}`} />
                </g>
              ) : null}
            </>
          ))}
          {layer(geo, (
            <>
              {grownAt(SEED_X[0], SOIL + 4, a0, sprout, "sprout")}
              {grownAt(SEED_X[1], SOIL + 4, a1, smallTree, "small")}
              {grownAt(SEED_X[2], SOIL + 4, a2, bigTree(a2 >= 1 ? 1 : Math.max(0, (a2 - 0.6) / 0.4)), "big")}
            </>
          ))}
          <Plaque p={sg.from} at={geo.art} />
          <Plaque p={sg.to} at={geo.art} rot={2.4} />
        </div>
      </Sheet>
      <MetaNote d={d} geo={geo} />
    </>
  );
}

/* ---------- balance: ตาชั่ง ---------- */

/** the beam's pivot, its half-length, how far below its ends the pans' rims hang, a pan's half-width */
export const PIVOT = { x: 200, y: 82 };
export const ARM = 118;
export const HANG = 96;
export const PAN = 66;
/** how far the beam leans when it settles to one side, degrees */
export const TILT = 12;
/** the sparkles by the pivot once it has settled: offset and reach */
export const BALANCE_GLEAM = [[-26, -26, 7], [24, -34, 5], [30, -10, 4]];
/** the post's foot */
export const BALANCE_FOOT = "M150 288 L250 288 L232 264 L168 264 Z";
/** a pan's word at most this wide (sheet units): clear of the post at the widest swing */
const PAN_WORD_W = 160;

/**
 * the beam's angle at t, degrees (clockwise: the right pan down): level until the trouble; it swings both ways;
 * then it settles to its tilt (left, right, or level when even or none is given)
 */
export function beamAngle(show: MetaShow<"balance">, t: number) {
  const s = metaSpec(show);
  const want = show.tilt === "left" ? -TILT : show.tilt === "right" ? TILT : 0;
  if (t < s.trouble.at) return 0;
  const p = prog(s.trouble, t);
  if (p < 1) return r1(14 * Math.sin(p * Math.PI * 3) * (1 - 0.4 * p));
  const q = prog(s.protect, t);
  if (q >= 1) return want;
  return r1(want * (1 - Math.exp(-4 * q) * Math.cos(3 * Math.PI * q)) + (want === 0 ? 4 * Math.sin(q * Math.PI * 2) * (1 - q) : 0));
}

/** the beam's two ends at an angle (sheet units) */
export const beamEnds = (deg: number) => {
  const th = (deg * Math.PI) / 180;
  return [-1, 1].map((side) => ({ x: PIVOT.x + side * ARM * Math.cos(th), y: PIVOT.y + side * ARM * Math.sin(th) }));
};

/** where ตาชั่ง's words stand at t: each on its pan, which hangs from its end of the beam; and the post (frame px) */
export function balanceGeo(size: VideoSize, show: MetaShow<"balance">, t: number, where?: MetaPlace) {
  const geo = metaGeo(size, show.note, where);
  const cap = Math.round(geo.text * 0.9);
  const ends = beamEnds(beamAngle(show, t));
  const [left, right] = show.sides.map((w, i) => {
    const p = tagSize(geo, w, PAN_WORD_W, cap);
    // the plaque stands in its pan, its foot on the rim
    return placeTag(geo, p, keepIn(geo, p.w, ends[i].x), geo.art.y + Math.round((ends[i].y + HANG + 1) * geo.k) - p.h);
  });
  const post = { x: geo.art.x + Math.round((PIVOT.x - 8) * geo.k), y: geo.art.y + Math.round(PIVOT.y * geo.k), w: Math.round(16 * geo.k), h: Math.round((280 - PIVOT.y) * geo.k) };
  return { geo, left, right, post };
}

/** ตาชั่ง: a golden scale with a word in each pan; the beam swings; it settles to its tilt and gleams */
function Balance({ d, show }: { d: Dev; show: MetaShow<"balance"> }) {
  const { c, t, s } = d;
  const bg = balanceGeo(c.size, show, t);
  const geo = bg.geo;
  const set = prog(s.set, t);
  const deg = beamAngle(show, t);
  const ends = beamEnds(deg);
  const settled = prog(s.protect, t) >= 1;
  return (
    <>
      <MetaTitle d={d} text={show.title} />
      <Sheet geo={geo}>
        <div style={abs({ left: 0, top: 0, width: geo.art.w, height: geo.art.h, opacity: set > 0 ? 1 : 0, ...(set < 1 ? { transform: `scale(${popScale(set).toFixed(3)})` } : {}) })}>
          {layer(geo, (
            <>
              {/* the post on its foot */}
              <path d={BALANCE_FOOT} fill={C.wood} stroke={C.ink} strokeWidth={2.6} strokeLinejoin="round" />
              <rect x={PIVOT.x - 7} y={PIVOT.y} width={14} height={264 - PIVOT.y} fill={C.coin} stroke={C.ink} strokeWidth={2.6} />
              {/* the pans hang straight down from the beam's ends: their strings, then the bowls */}
              {ends.map((e, i) => (
                <g key={i}>
                  <path d={`M${r1(e.x)} ${r1(e.y)} L${r1(e.x - PAN + 6)} ${r1(e.y + HANG)} M${r1(e.x)} ${r1(e.y)} L${r1(e.x + PAN - 6)} ${r1(e.y + HANG)}`} stroke={C.ink} strokeWidth={2} />
                </g>
              ))}
              <g transform={`rotate(${deg} ${PIVOT.x} ${PIVOT.y})`}>
                <rect x={PIVOT.x - ARM - 4} y={PIVOT.y - 6} width={ARM * 2 + 8} height={12} rx={6} fill={C.coin} stroke={C.ink} strokeWidth={2.6} />
                {[-1, 1].map((side) => <circle key={side} cx={PIVOT.x + side * ARM} cy={PIVOT.y} r={7} fill={C.coin} stroke={C.ink} strokeWidth={2.2} />)}
              </g>
              <path d={`M${PIVOT.x - 10} ${PIVOT.y - 6} L${PIVOT.x} ${PIVOT.y - 30} L${PIVOT.x + 10} ${PIVOT.y - 6} Z`} fill={C.coin} stroke={C.ink} strokeWidth={2.4} strokeLinejoin="round" />
              <circle cx={PIVOT.x} cy={PIVOT.y} r={10} fill={C.coin} stroke={C.ink} strokeWidth={2.6} />
              <circle cx={PIVOT.x} cy={PIVOT.y} r={3.5} fill={C.ink} />
              {/* settled: a gleam by the pivot */}
              {settled ? BALANCE_GLEAM.map(([dx, dy, r]) => (
                <path key={dx} d={sparkleD(PIVOT.x + dx, PIVOT.y + dy, r)} fill={C.spoken} stroke={C.ink} strokeWidth={1.4} strokeLinejoin="round" />
              )) : null}
            </>
          ))}
          {/* each word in its pan, then the pan's near lip in front of it */}
          <Plaque p={bg.left} at={geo.art} />
          <Plaque p={bg.right} at={geo.art} rot={2.4} />
          {layer(geo, (
            <>
              {ends.map((e, i) => (
                <path key={i} d={`M${r1(e.x - PAN)} ${r1(e.y + HANG)} Q${r1(e.x)} ${r1(e.y + HANG + 34)} ${r1(e.x + PAN)} ${r1(e.y + HANG)} Z`} fill={C.coin} stroke={C.ink} strokeWidth={2.6} strokeLinejoin="round" />
              ))}
            </>
          ))}
        </div>
      </Sheet>
      <MetaNote d={d} geo={geo} />
    </>
  );
}

/* ---------- bridge: สะพานข้ามช่วงยาก ---------- */

/** the cliff tops (and the deck, level with them), the gap between the cliffs, where the walker starts and ends */
export const BRIDGE = { deck: 172, gap: [120, 280] as [number, number], from: 58, to: 342 };
const CROSS_W = 66;

/** where the one crossing stands at t (sheet units), and how much of the bridge is drawn (0 to 1) */
export function bridgeWalk(show: MetaShow<"bridge">, t: number) {
  const s = metaSpec(show);
  const walk = prog(s.walk, t);
  return { x: r1(BRIDGE.from + (BRIDGE.to - BRIDGE.from) * easeInOut(walk)), foot: BRIDGE.deck, built: prog(s.protect, t), walk };
}

/** a cliff from the top edge at `x0` to its face at `x1` (the face jagged), down to the sheet's foot */
export const cliff = (x0: number, x1: number) => {
  const dir = Math.sign(x1 - x0);
  return `M${x0} ${BRIDGE.deck} H${x1} L${x1 + dir * 8} 198 L${x1 - dir * 4} 226 L${x1 + dir * 6} 258 L${x1 - dir * 2} 300 H${x0} Z`;
};

/**
 * the bridge at t, whatever the look: how rough the water is; how far across it is drawn (`reach`), its arch as far as
 * that, the planks, hangers and rail posts laid so far; the stones falling from the edge in the trouble beat only
 */
export function bridgeShape(show: MetaShow<"bridge">, t: number) {
  const s = metaSpec(show);
  const rough = prog(s.trouble, t);
  const w = bridgeWalk(show, t);
  const [g0, g1] = BRIDGE.gap;
  const reach = g0 - 4 + (g1 - g0 + 8) * easeOut(w.built);
  // the arch under the deck, as far as it is drawn: from one cliff face to the other, rising to just under the deck
  const arch: string[] = [];
  for (let i = 0; i <= 32; i += 1) {
    const u = i / 32;
    const x = 126 + 148 * u;
    if (x > reach) break;
    arch.push(`${r1(x)} ${r1((1 - u) ** 2 * 238 + 2 * (1 - u) * u * 146 + u * u * 238)}`);
  }
  const archY = (x: number) => { const u = (x - 126) / 148; return (1 - u) ** 2 * 238 + 2 * (1 - u) * u * 146 + u * u * 238; };
  const stones = rough > 0 && rough < 1 ? [0, 1, 2].flatMap((i) => {
    const p = clamp01(rough * 1.6 - i * 0.3);
    return p > 0 && p < 1 ? [{ i, x: g0 + 4 + i * 5 + 6 * p, y: BRIDGE.deck + 6 + 66 * p * p, r: 3.5 - i * 0.6 }] : [];
  }) : [];
  return {
    ...w, rough, reach, drawn: w.built > 0, arch: arch.length > 1 ? `M${arch.join(" L")}` : null, stones,
    hangers: [146, 166, 186, 214, 234, 254].filter((x) => x <= reach).map((x) => ({ x, top: archY(x) - 3 })),
    planks: Array.from({ length: 12 }, (_, i) => g0 - 4 + i * 14).filter((x) => x + 14 <= reach + 0.01),
    posts: [g0, 160, 200, 240, g1].filter((x) => x <= reach),
  };
}
/** the sun over the gap, clear of whoever stands or cheers below it */
export const BRIDGE_SUN = { x: 238, y: 42 };
/** the two cliffs: from the sheet's edge to the gap */
export const CLIFFS = [[0, BRIDGE.gap[0]], [400, BRIDGE.gap[1]]];
/** a cliff's layers of rock */
export const rockLines = (x0: number, x1: number) => `M${x0 === 0 ? 14 : x1 + 18} 214 h${x0 === 0 ? 70 : 64} M${x0 === 0 ? 30 : x1 + 30} 252 h${x0 === 0 ? 74 : 60}`;
/** the water in the gap, rougher in the trouble (calmer once the bridge is drawn), and its ripples */
export const gapAmp = (rough: number, built: boolean) => 3 + 2.5 * rough * (built ? 0.4 : 1);
export const GAP_SURFACE = 244;
export const gapWaterD = (rough: number, built: boolean, t: number) => `${wave(GAP_SURFACE, gapAmp(rough, built), t, 100, 300, 72)} L300 300 L100 300 Z`;
export const GAP_RIPPLES = [[262, 150, 200, 0.4], [282, 210, 260, 1.3]];

/**
 * สะพานข้ามช่วงยาก: two cliffs with water between, someone on the left; stones fall from the edge and they worry; a
 * blue arch bridge is drawn across from the left; they walk over and are glad on the far side
 */
function Bridge({ d, show }: { d: Dev; show: MetaShow<"bridge"> }) {
  const { c, t, s } = d;
  const geo = metaGeo(c.size, show.note);
  const set = prog(s.set, t);
  const w = bridgeShape(show, t);
  const { rough, reach } = w;
  const [g0, g1] = BRIDGE.gap;
  const built = w.drawn;
  const stones = w.stones.map((x) => <circle key={x.i} cx={r1(x.x)} cy={r1(x.y)} r={x.r} fill={C.woodGrain} stroke={C.ink} strokeWidth={1.4} />);
  const glad = w.walk >= 1;
  const pose: PoseName | Pose = glad ? POSES.cheer(t) : w.walk > 0 ? POSES.walk(t) : rough > 0 && !built ? worried(t) : smiling(POSES.stand(t), built);
  const f = metaFigures(show, c, t)[0];
  return (
    <>
      <MetaTitle d={d} text={show.title} />
      <Sheet geo={geo}>
        <div style={abs({ left: 0, top: 0, width: geo.art.w, height: geo.art.h, opacity: set > 0 ? 1 : 0, ...(set < 1 ? { transform: `scale(${popScale(set).toFixed(3)})` } : {}) })}>
          {layer(geo, (
            <>
              {/* the sun over the gap, clear of whoever stands or cheers below it */}
              {raysD(BRIDGE_SUN.x, BRIDGE_SUN.y, 24, 31).map((ray, i) => <path key={i} d={ray} stroke={C.coin} strokeWidth={3} strokeLinecap="round" />)}
              <circle cx={BRIDGE_SUN.x} cy={BRIDGE_SUN.y} r={17} fill={C.spoken} stroke={C.ink} strokeWidth={2.4} />
              {/* the water in the gap, rougher in the trouble */}
              <path d={gapWaterD(rough, built, t)} fill={C.blanket} stroke={C.waterInk} strokeWidth={2.4} strokeLinejoin="round" />
              {GAP_RIPPLES.map(([y, a0, a1, ph]) => <path key={y} d={wave(y, 2.5, t + ph, a0, a1, 40)} fill="none" stroke={C.white} strokeWidth={2.4} strokeLinecap="round" opacity={0.85} />)}
              {stones}
              {/* the two cliffs, grass on top, their layers of rock */}
              {CLIFFS.map(([x0, x1]) => (
                <g key={x0}>
                  <path d={cliff(x0, x1)} fill={C.paperChair} stroke={C.ink} strokeWidth={2.6} strokeLinejoin="round" />
                  <path d={rockLines(x0, x1)} stroke={C.woodGrain} strokeWidth={2.2} strokeLinecap="round" opacity={0.45} />
                  <rect x={Math.min(x0, x1) - 2} y={BRIDGE.deck - 6} width={Math.abs(x1 - x0) + 6} height={10} rx={5} fill={LEAF} stroke={C.ink} strokeWidth={2.2} />
                </g>
              ))}
              {/* the bridge, drawn across from the left: the arch, its hangers, the deck's planks, the rail */}
              {built && w.arch ? (
                <g>
                  <path d={w.arch} fill="none" stroke={C.ink} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
                  <path d={w.arch} fill="none" stroke={C.boardBlue} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
                  {w.hangers.map((h) => <path key={h.x} d={`M${h.x} ${r1(h.top)} V${BRIDGE.deck + 8}`} stroke={C.boardBlue} strokeWidth={2.6} />)}
                  {w.planks.map((x) => <rect key={x} x={x} y={BRIDGE.deck - 2} width={14} height={10} fill={C.wood} stroke={C.ink} strokeWidth={1.8} />)}
                  {w.posts.map((x) => <path key={`p${x}`} d={`M${x} ${BRIDGE.deck - 2} V${BRIDGE.deck - 22}`} stroke={C.ink} strokeWidth={2.4} strokeLinecap="round" />)}
                  <path d={`M${g0} ${BRIDGE.deck - 20} H${r1(Math.min(reach, g1))}`} stroke={C.boardBlue} strokeWidth={3.4} strokeLinecap="round" />
                </g>
              ) : null}
            </>
          ))}
          <Who who={0} c={c} k={geo.k} id={c.input.faces.hero} f={f} t={t} pose={pose} />
        </div>
      </Sheet>
      <MetaNote d={d} geo={geo} />
    </>
  );
}

/* ---------- shield: โล่กันลูกศร ---------- */

/** the arrows a shield takes: five at most (more are refused upstream) */
export const shieldArrows = (show: MetaShow<"shield">) => show.arrows.slice(0, META_LIMITS.arrows);
/** the shield: its middle, its two sides, its top and where its sides start to curve to its point */
export const SH = { x: 238, left: 188, right: 288, top: 58, waist: 150, point: 266 };
/** the family behind it, each a doll's width, and the ground they stand on */
export const SHIELD_PEOPLE: [number, number][] = [[310, 58], [343, 44], [371, 58]];
export const SHIELD_GROUND = 270;
/** an arrow's tag at most this wide (sheet units), how far its tip goes into the shield, its head's length */
const ARROW_WORD_W = 146;
export const BITE = 5;
export const HEAD = 16;
/** the bare shaft between a tag and its head, and from the tail's feathers to the tag */
export const SHAFT = 10;
export const FEATHER = 18;
/** the shield's outline: a gentle arch on top, straight sides, curving to a point */
export const SHIELD_PATH = `M${SH.left} ${SH.top} Q${SH.x} ${SH.top - 18} ${SH.right} ${SH.top} L${SH.right} ${SH.waist} C${SH.right} 208 ${SH.x + 24} 244 ${SH.x} ${SH.point} C${SH.x - 24} 244 ${SH.left} 208 ${SH.left} ${SH.waist} Z`;
/** the shield's left edge at height y */
export const faceAt = (y: number) => {
  if (y <= SH.waist) return SH.left;
  let prev = { x: SH.left, y: SH.waist };
  for (let i = 1; i <= 40; i += 1) {
    const u = i / 40;
    const m = 1 - u;
    const p = { x: m ** 3 * SH.left + 3 * m * m * u * SH.left + 3 * m * u * u * (SH.x - 24) + u ** 3 * SH.x, y: m ** 3 * SH.waist + 3 * m * m * u * 208 + 3 * m * u * u * 244 + u ** 3 * SH.point };
    if (p.y >= y) return prev.x + ((p.x - prev.x) * (y - prev.y)) / (p.y - prev.y || 1);
    prev = p;
  }
  return SH.x;
};

/**
 * where โล่กันลูกศร's arrows end, one row each down the shield's face (sheet units: `y` its row, `face` the shield's
 * edge there, `tip` how far in it goes) with each one's word on its tag (frame px), right up to its head
 */
export function shieldGeo(size: VideoSize, show: MetaShow<"shield">, where?: MetaPlace) {
  const geo = metaGeo(size, show.note, where);
  const list = shieldArrows(show);
  const gap = list.length >= 5 ? 40 : 44;
  const arrows = list.map((word, i) => {
    const y = 150 + (i - (list.length - 1) / 2) * gap;
    const face = faceAt(y);
    const tip = face + BITE;
    // a few arrows, a little larger: their rows have the room
    const p = tagSize(geo, word, ARROW_WORD_W, Math.round(geo.text * (list.length <= 3 ? 0.9 : 0.8)));
    const mid = tip - HEAD - SHAFT - p.w / 2 / geo.k;
    return { ...placeTag(geo, p, mid, geo.art.y + Math.round(y * geo.k - p.h / 2)), y, face, tip };
  });
  return { geo, arrows };
}

/**
 * the arrows and the shield at t, whatever the look: each arrow's flight (how far, whether it has started, how far
 * left of its place it still is, its tail), the jolt of the last to land, each arrow's hit (a moment only), the gleam
 */
export function shieldAt(sg: ReturnType<typeof shieldGeo>, s: Record<string, Anim>, t: number) {
  const geo = sg.geo;
  const flights = sg.arrows.map((a, i) => {
    const an = s[`arrow${i}`];
    const p = prog(an, t);
    const tail = (a.plaque.x - geo.art.x) / geo.k - FEATHER;
    const after = an && t >= an.at ? t - (an.at + an.dur) : -1;
    return { an, p, on: !!an && t >= an.at, tail, dx: -Math.min(90, tail + 20) * (1 - p), hit: after >= 0 && after < 0.25 };
  });
  const since = Math.min(...flights.filter((x) => x.p >= 1).map((x) => t - (x.an.at + x.an.dur)), 9);
  const gleam = prog(s.protect, t);
  return {
    flights, gleam,
    jolt: since < 0.3 ? r1(4 * Math.exp(-since * 10) * Math.cos(since * 40)) : 0,
    fearful: flights.some((x) => x.on) && gleam <= 0, glad: gleam >= 0.5,
    tick: gleam > 0 ? 1 + 0.25 * Math.sin(Math.PI * gleam) : 1,
  };
}
/** the shield's inner line, its tick (about its middle), the sparkles of its gleam, an arrow's hit off its face */
export const SHIELD_INNER = `M${SH.left + 12} ${SH.top + 6} Q${SH.x} ${SH.top - 8} ${SH.right - 12} ${SH.top + 6} L${SH.right - 12} ${SH.waist} C${SH.right - 12} 202 ${SH.x + 20} 234 ${SH.x} 250 C${SH.x - 20} 234 ${SH.left + 12} 202 ${SH.left + 12} ${SH.waist} Z`;
export const SHIELD_TICK = "M-28 0 L-8 20 L30 -22";
export const SHIELD_GLEAM = [[SH.right + 4, SH.top - 10, 9], [SH.left - 2, SH.top - 22, 6], [SH.right - 6, SH.top - 34, 5]];
export const hitD = (face: number, y: number) => `M${r1(face - 6)} ${y - 10} l-8 -8 M${r1(face - 8)} ${y} l-11 0 M${r1(face - 6)} ${y + 10} l-8 8`;
/** an arrow's shaft from its tail to its head, its feathers, its head */
export const arrowD = (a: { y: number; tip: number }, tail: number) => ({
  shaft: `M${r1(tail)} ${a.y} H${r1(a.tip - HEAD + 2)}`,
  feathers: `M${r1(tail + 16)} ${a.y} l-10 -8 h-8 l10 8 l-10 8 h8 Z`,
  head: `M${r1(a.tip)} ${a.y} l${-HEAD} -8 l3 8 l-3 8 Z`,
});

/**
 * โล่กันลูกศร: a family behind a blue shield with a tick; arrows, each with its word, fly in from the left one by one
 * and stick in the shield, which jolts as each lands; then it gleams and the family are glad
 */
function Shield({ d, show }: { d: Dev; show: MetaShow<"shield"> }) {
  const { c, t, s } = d;
  const sg = shieldGeo(c.size, show);
  const geo = sg.geo;
  const set = prog(s.set, t);
  const { flights, gleam, jolt, fearful, glad, tick } = shieldAt(sg, s, t);
  const figs = metaFigures(show, c, t);
  const pose = (i: number): PoseName | Pose => (fearful ? worried(t + i * 0.4) : glad && i === 1 ? "wave" : smiling(POSES.stand(t + i * 0.4), glad));
  return (
    <>
      <MetaTitle d={d} text={show.title} />
      <Sheet geo={geo}>
        {SHIELD_PEOPLE.map((_, i) => family(c)[i]).map((id, i) => <Who key={i} who={i} c={c} k={geo.k} id={id} f={figs[i]} t={t} phase={i * 0.4} an={enterOf(s.set, i)} pose={pose(i)} />)}
        {/* the arrows: their shafts, feathers and heads, flying in from the left as their words do */}
        {layer(geo, (
          <>
            {sg.arrows.map((a, i) => {
              const fl = flights[i];
              if (!fl.on) return null;
              const ad = arrowD(a, fl.tail);
              return (
                <g key={i} transform={`translate(${r1(fl.dx)} 0)`} opacity={r1(clamp01(fl.p / 0.3))}>
                  <path d={ad.shaft} stroke={C.ink} strokeWidth={3.4} strokeLinecap="round" />
                  <path d={ad.feathers} fill={C.red} stroke={C.ink} strokeWidth={1.6} strokeLinejoin="round" />
                  <path d={ad.head} fill={C.ink} stroke={C.ink} strokeWidth={1.4} strokeLinejoin="round" />
                </g>
              );
            })}
          </>
        ))}
        {/* the shield over the arrows' tips; the tick on it; the gleam */}
        <div style={abs({ left: 0, top: 0, width: geo.art.w, height: geo.art.h, opacity: set > 0 ? 1 : 0, ...(set < 1 ? { transform: `scale(${popScale(set).toFixed(3)})` } : jolt ? { transform: `translate(${r1(jolt * geo.k)}px, 0px)` } : {}) })}>
          {layer(geo, (
            <>
              <ellipse cx={SH.x} cy={SHIELD_GROUND + 2} rx={44} ry={5} fill={C.struck} opacity={0.35} />
              {gleam > 0 ? <path d={SHIELD_PATH} fill="none" stroke={C.spoken} strokeWidth={r1(10 * easeOut(gleam))} strokeLinejoin="round" opacity={0.8} /> : null}
              <path d={SHIELD_PATH} fill={C.boardBlue} stroke={C.ink} strokeWidth={3} strokeLinejoin="round" />
              <path d={SHIELD_INNER} fill="none" stroke={C.white} strokeWidth={2.4} opacity={0.5} />
              <g transform={`translate(${SH.x} 150) scale(${tick.toFixed(3)})`}>
                <path d={SHIELD_TICK} fill="none" stroke={C.ink} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
                <path d={SHIELD_TICK} fill="none" stroke={C.white} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
              </g>
              {/* each arrow's hit: three strokes off its tip, a moment only */}
              {sg.arrows.map((a, i) => {
                return flights[i].hit ? (
                  <path key={i} d={hitD(a.face, a.y)} stroke={C.ink} strokeWidth={2.4} strokeLinecap="round" />
                ) : null;
              })}
              {gleam > 0 ? SHIELD_GLEAM.map(([x, y, r]) => {
                const k = r * easeOut(gleam);
                return <path key={x + y} d={`M${x} ${r1(y - k)} L${r1(x + k * 0.3)} ${r1(y - k * 0.3)} L${r1(x + k)} ${y} L${r1(x + k * 0.3)} ${r1(y + k * 0.3)} L${x} ${r1(y + k)} L${r1(x - k * 0.3)} ${r1(y + k * 0.3)} L${r1(x - k)} ${y} L${r1(x - k * 0.3)} ${r1(y - k * 0.3)} Z`} fill={C.spoken} stroke={C.ink} strokeWidth={1.4} strokeLinejoin="round" />;
              }) : null}
            </>
          ))}
        </div>
        {/* the arrows' words, on their tags, flying with them */}
        {sg.arrows.map((a, i) => {
          const fl = flights[i];
          if (!fl.on) return null;
          return <Plaque key={i} p={a} at={geo.art} rot={i % 2 ? 2.4 : 0} dx={fl.dx * geo.k} opacity={clamp01(fl.p / 0.3)} />;
        })}
      </Sheet>
      <MetaNote d={d} geo={geo} />
    </>
  );
}
