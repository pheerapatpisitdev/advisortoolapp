import type React from "react";
import type { ReactNode } from "react";
import { abs, box, type Anim } from "./motion";
import { devArea, E, flicker, GEO, glowBox, ink, kit, pen, Title, type Dev } from "./story-info-motion";
import type { MetaShow } from "./story-knowledge";
import { geoOf } from "./story-knowledge-motion";
import { handWidth } from "./story-life-motion";
import {
  aboutFeet, ARM, arrowD, BALANCE_FOOT, BALANCE_GLEAM, balanceGeo, beamAngle, beamEnds, BEAM, BRIDGE, BRIDGE_SUN, bridgeShape,
  CANOPY, clamp01, cliff, CLIFFS, cloudD, CLOUDS, CRESTS, easeOut, FALL_LINE, FLOOR, gapAmp, gapWaterD, GAP_RIPPLES, GAP_SURFACE, GROUND, grownAt, HANG,
  HIGH, hitD, JETTY, MAIN_X, metaFigures, metaGeo, NET_Y, netShape, PAN, PEBBLES, pillarAt, pillarGeo, PIVOT, PLANTS, POSTS, prog,
  r1, raysD, ringAt, ringD, RING, rockLines, ROOF, ROOF_LINE, ROOTS, SEA, seedGeo, SEED_SUN, SEED_WORD_TOP, SEED_X, SH, SHAKE_MARKS, SHEET,
  SHIELD_GLEAM, SHIELD_GROUND, SHIELD_INNER, SHIELD_PATH, SHIELD_TICK, shieldAt, shieldGeo, SOIL, SOIL_TOP, SPARE_X, sparkleD, SWIM_X,
  UMB, umbrellaAt, umbrellaRib, UMBRELLA_STICK, WALK_W, wave, type MetaFigure, type MetaGeo, type MetaPlace, type MetaTag,
} from "./story-meta-motion";
import { SIZES, type VideoSize } from "./timeline";

/**
 * อุปมาเล่าเรื่อง (device round 3) in the info route — ปากกาพล็อตเตอร์, ไวต์บอร์ด, นีออน, บลูพริ้นท์ and the retired
 * อินโฟกราฟิก: the same eight little stories story-meta-motion.tsx draws on paper, on the same 400 × 300 sheet with the
 * same places and beats (its geometry and its state at t are imported, never redrawn here), drawn with the Kit
 * story-info-motion.tsx sets for the frame: its inks, its hand, its bold (Sriracha never above 400), its glow, its
 * reveal. A drawn look draws in outline, the line's own colour (นีออน's tubes glow: a wide faint line under the
 * crisp one); อินโฟกราฟิก fills its shapes flat on the navy. People are plain figures in the Kit's inks, as faceless as
 * its icons. Every word stands on a plaque or a card of its own ground, so no line of the picture runs through it.
 */

/** a metaphor's frame body in the info route at scene time t (infoShow hands it the frame, the movements, the room) */
export function metaInfo(d: Dev, show: MetaShow) {
  switch (show.layout) {
    case "umbrella": return umbrella(d, show);
    case "housepillar": return housepillar(d, show);
    case "lifering": return lifering(d, show);
    case "safetynet": return safetynet(d, show);
    case "seedtree": return seedtree(d, show);
    case "balance": return balance(d, show);
    case "bridge": return bridge(d, show);
    case "shield": return shield(d, show);
  }
}

/**
 * where a metaphor is set in the info route: the room under its title (above the plotter's rail), the frame's text
 * size. The picture fills the room's width; in portrait, which is tall, the room is drawn in round the picture and its
 * note so the two stand together in its middle, not the note alone at its foot
 */
export function metaInfoPlace(size: VideoSize, note?: string): MetaPlace {
  const room = devArea(size);
  const text = geoOf(size).text;
  const first = metaGeo(size, note, { room, text });
  const slack = first.noteBox && size !== "landscape" ? first.noteBox.y - Math.round(text * 0.5) - (first.art.y + first.art.h) + (first.art.y - room.y) : 0;
  return slack > 0 ? { room: { ...room, y: room.y + Math.round(slack / 2), h: room.h - slack }, text } : { room, text };
}

/** the title's two lines, each as large as the look sets it but no wider than the look's frame (a 20-letter line fits) */
export function metaTitleSize(size: VideoSize, title: [string, string]) {
  const K = kit();
  const g = GEO[size];
  // clear of the look's own frame (ไวต์บอร์ด's board edge, นีออน's tube) by a hand's width either side
  const room = SIZES[size].w - 2 * Math.round(100 * g.k);
  const fit = (text: string, cap: number) => Math.min(Math.round(cap), Math.floor(room / Math.max(1, handWidth(text, 1))));
  return { first: fit(title[0], (K.drawn && g.title < 100 ? 88 : 104) * g.k), second: fit(title[1], 56 * g.k) };
}

/* ---------- the pen: lines, shapes, layers ---------- */

type SvgProps = React.SVGProps<SVGPathElement>;

/** a line's width on the sheet: the pen's, thinner in บลูพริ้นท์ */
const lw = (x: number) => r1(Math.max(1.2, x * kit().line));

/** a line in `color`, `width` sheet units; in นีออน a wide faint line of its own colour under it, its glow */
function ln(key: string | number, d: string, color: string, width = 2.6, extra: SvgProps = {}) {
  const K = kit();
  const w = lw(width);
  const base: SvgProps = { d, fill: "none", stroke: color, strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round", ...extra };
  if (!K.glow) return <path key={key} {...base} />;
  return (
    <g key={key}>
      <path {...base} fill="none" strokeWidth={r1(Math.min(w * 3, w + 9))} strokeOpacity={0.28} />
      <path {...base} />
    </g>
  );
}

/** a closed shape: อินโฟกราฟิก's flat fill; a drawn look's outline, its inside the page's own ground when `mask` (hiding what is behind) */
function shape(key: string | number, d: string, color: string, width = 2.6, mask = false, extra: SvgProps = {}) {
  const K = kit();
  if (!K.drawn) return <path key={key} d={d} fill={color} {...extra} />;
  return ln(key, d, color, width, { fill: mask ? K.page : "none", ...extra });
}

/** a rect as a path, for shape() */
const rectD = (x: number, y: number, w: number, h: number) => `M${r1(x)} ${r1(y)} h${r1(w)} v${r1(h)} h${r1(-w)} Z`;
/** a circle (or an ellipse) as a path, for shape() */
const ovalD = (cx: number, cy: number, rx: number, ry = rx) => `M${r1(cx - rx)} ${r1(cy)} a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(rx * 2)} 0 a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(-rx * 2)} 0 Z`;

/** one layer of the picture in the sheet's units; a helper line's layer (a throw, a fall, stones, hits) says so */
function svg(geo: MetaGeo, body: ReactNode, opts: { opacity?: number; helper?: boolean } = {}) {
  const o = opts.opacity ?? 1;
  return (
    <div {...(opts.helper ? { "data-helper": "" } : {})} style={abs({ left: 0, top: 0, width: geo.art.w, height: geo.art.h, ...(o < 1 ? { opacity: r1(o * 100) / 100 } : {}) })}>
      <svg width={geo.art.w} height={geo.art.h} viewBox={`0 0 ${SHEET.w} ${SHEET.h}`}>{body}</svg>
    </div>
  );
}

/** the picture's box in the frame */
const Sheet = ({ geo, children }: { geo: MetaGeo; children: ReactNode }) => (
  <div style={abs({ left: geo.art.x, top: geo.art.y, width: geo.art.w, height: geo.art.h })}>{children}</div>
);

/** the scene's set pieces, written (switched on, popped in) on the set beat */
const SetIn = ({ d, geo, children }: { d: Dev; geo: MetaGeo; children: ReactNode }) => (
  <E an={d.s.set} t={d.t} style={{ position: "absolute", left: 0, top: 0, width: geo.art.w, height: geo.art.h }}>{children}</E>
);

/** นีออน switches a protection on as it comes: two quick dips; whole in every other look */
const lit = (an: Anim | undefined, t: number) => (kit().reveal === "switch" && an && t >= an.at ? flicker(prog(an, t)) : 1);

/** the water's ink: the accent in a drawn look (the marker's blue, the tube's cyan), อินโฟกราฟิก's sky */
const water = () => (kit().drawn ? kit().gold : kit().sky);

/* ---------- the words: the title, the note, the plaques ---------- */

function MetaTitle({ d, show }: { d: Dev; show: MetaShow }) {
  return <Title text={show.title} an={d.s.title} t={d.t} w={d.w} g={d.g} sizes={metaTitleSize(d.c.size, show.title)} />;
}

/** the note on its card, under (beside, in landscape) the picture */
function Note({ d, geo }: { d: Dev; geo: MetaGeo }) {
  const K = kit();
  const b = geo.noteBox;
  if (!b) return null;
  return (
    <div data-note="" style={abs({ left: b.x, top: b.y, width: b.w, height: b.h })}>
      <E an={d.s.note} t={d.t} style={{ width: b.w, height: b.h, flexDirection: "column", alignItems: "center", justifyContent: "center", background: K.tile, border: `${pen(3)}px solid ${K.tileLine}`, borderRadius: Math.round(geo.text * 0.5), ...glowBox(K.tileLine) }}>
        {geo.noteLines.map((x, i) => <div key={i} style={box({ fontSize: geo.noteSize, lineHeight: 1.3, fontWeight: K.bold, ...ink(K.white), textAlign: "center" })}>{x}</div>)}
      </E>
    </div>
  );
}

/**
 * a word on its plaque, placed from the sheet's corner (`at`), moved `dx` px: on the page's own ground with an edge in
 * the accent (glowing in นีออน); อินโฟกราฟิก's a white tile edged in gold, the word in navy (it stands off the gold pans and pillar)
 */
function Plaque({ p, at, rot = 0, dx = 0, opacity = 1, spare }: { p: MetaTag; at: { x: number; y: number }; rot?: number; dx?: number; opacity?: number; spare?: boolean }) {
  const K = kit();
  const pr = p.plaque;
  const turn = K.tilt ? r1(-1.5 + rot) : 0;
  return (
    <div {...(spare ? { "data-spare": "" } : {})} style={abs({
      left: pr.x - at.x + Math.round(dx), top: pr.y - at.y, width: pr.w, height: pr.h, justifyContent: "center", alignItems: "center",
      background: K.drawn ? K.page : K.white, border: `${pen(3)}px solid ${K.gold}`, borderRadius: 8, fontSize: p.size, fontWeight: K.bold, lineHeight: 1.3,
      ...(K.drawn ? ink(K.white) : { color: K.ground }), ...glowBox(K.gold),
      ...(turn ? { transform: `rotate(${turn}deg)` } : {}), ...(opacity < 1 ? { opacity: r1(opacity * 100) / 100 } : {}),
    })}>{p.word}</div>
  );
}

/* ---------- the people ---------- */

/** what a figure is doing: standing, arms up (glad), waving, hands to the head (worried), walking, arms out (the pole), holding on */
type Act = "stand" | "up" | "wave" | "worried" | "walk" | "out" | "hold";

/**
 * a plain figure in a 100 × 130 box (a doll's): a round head, a body, arms and legs, as faceless as the Kit's icons —
 * its outline in `color` in a drawn look, filled flat in อินโฟกราฟิก
 */
function figure(act: Act, color: string, t: number) {
  const K = kit();
  const bow = act === "worried" ? 4 : 0;
  const swing = act === "walk" ? 9 * Math.sin(t * 9) : 0;
  const waveArm = 4 * Math.sin(t * 9);
  const arms: Record<Act, string> = {
    stand: "M37 50 L28 84 M63 50 L72 84",
    up: "M37 50 L22 14 M63 50 L78 14",
    wave: `M37 50 L28 84 M63 50 L${r1(80 + waveArm)} 16`,
    worried: "M37 50 L24 42 L33 24 M63 50 L76 42 L67 24",
    walk: `M37 50 L${r1(30 - swing * 0.6)} 84 M63 50 L${r1(70 + swing * 0.6)} 84`,
    out: "M37 52 L10 58 M63 52 L90 58",
    hold: "M37 52 L16 70 M63 52 L84 70",
  };
  const legs = `M43 88 L${r1(41 - swing)} 126 M57 88 L${r1(59 + swing)} 126`;
  const body = "M36 46 Q50 38 64 46 L66 88 H34 Z";
  const head = ovalD(50, 24 + bow, 16);
  const limb = K.drawn ? 3.4 : 8;
  return (
    <>
      {ln("arms", arms[act], color, limb)}
      {ln("legs", legs, color, limb)}
      {shape("body", body, color, 3.4, K.shade)}
      {shape("head", head, K.drawn ? color : K.white, 3.4, K.shade)}
    </>
  );
}

/** someone standing in their box `f` on the sheet (where metaFigures puts them), written in on `an` */
function Person({ geo, f, who, act, color, t, an, transform, clipBelow, held }: { geo: MetaGeo; f: MetaFigure; who: number; act: Act; color: string; t: number; an?: Anim; transform?: string; clipBelow?: number; held?: ReactNode }) {
  const W = Math.round(f.w * geo.k);
  const H = Math.round(f.h * geo.k);
  const top = Math.round(f.foot * geo.k) - H;
  // in the water: drawn only down to the surface (`clipBelow`, on the sheet), the sea hiding the rest
  const cut = clipBelow === undefined ? 0 : Math.max(0, top + H - Math.round(clipBelow * geo.k));
  return (
    <div data-who={who} style={abs({ left: Math.round((f.x - f.w / 2) * geo.k), top, width: W, height: H, ...(transform ? { transform } : {}), ...(cut ? { clipPath: `inset(0px 0px ${cut}px 0px)` } : {}) })}>
      <E an={an} t={t} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }}>
        <svg width={W} height={H} viewBox="0 0 100 130">{figure(act, color, t)}</svg>
      </E>
      {held ? <E an={an} t={t} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }}>{held}</E> : null}
    </div>
  );
}

/** the family's inks: the partner, the child, the hero */
const familyInks = () => { const K = kit(); return [K.sky, K.gold, K.white]; };

/* ---------- umbrella: ร่มกันฝน ---------- */

/** ร่มกันฝน: the family of three; the rain starts from the clouds; a red umbrella opens over them and the rain runs off its edges */
function umbrella(d: Dev, show: MetaShow<"umbrella">) {
  const K = kit();
  const { c, t, s } = d;
  const geo = metaGeo(c.size, show.note, metaInfoPlace(c.size, show.note));
  const u = umbrellaAt(s, t);
  const figs = metaFigures(show, c, t);
  const inks = familyInks();
  // worried in the rain; once it is open the child cheers (the right one's hand is at the umbrella's hook)
  const act = (i: number): Act => (u.sad ? "worried" : u.glad && i === 1 ? "up" : "stand");
  const splash = (x: number) => `M${r1(x - 12)} ${GROUND - 2} q4 -8 8 -2 M${r1(x + 4)} ${GROUND - 4} q4 -8 8 2`;
  return (
    <>
      <MetaTitle d={d} show={show} />
      <Sheet geo={geo}>
        <SetIn d={d} geo={geo}>{svg(geo, ln("ground", `M14 ${GROUND + 1} H386`, K.soft, 2))}</SetIn>
        {u.rain > 0 ? svg(geo, (
          <>
            <g transform={`translate(${r1((1 - easeOut(u.rain)) * -30)} 0)`}>{CLOUDS.map(([x, y, k], i) => shape(`c${i}`, cloudD(x, y, k), K.drawn ? K.soft : K.dim, 2.4))}</g>
            {shape("pl", ovalD(46, GROUND + 6, 30 * u.rain, 5 * u.rain), water(), 1.6)}
            {shape("pr", ovalD(356, GROUND + 6, 26 * u.rain, 4.5 * u.rain), water(), 1.6)}
          </>
        ), { opacity: easeOut(u.rain) }) : null}
        {figs.map((f, i) => <Person key={i} geo={geo} f={f} who={i} act={act(i)} color={inks[i]} t={t + i * 0.4} an={s.set} />)}
        {svg(geo, (
          <>
            {u.drops.map((p) => ln(`d${p.i}`, `M${p.x} ${r1(p.y)} l-3 12`, water(), 2.4))}
            {u.runoff.map((p) => ln(`r${p.side}${p.j}`, `M${r1(p.x)} ${r1(p.y)} l${p.side * 1.5} 10`, water(), 2.6))}
            {u.open > 0.85 ? [ln("sl", splash(UMB.x - u.half), water(), 2.2), ln("sr", splash(UMB.x + u.half), water(), 2.2)] : null}
            {u.opened ? (
              <g opacity={lit(s.protect, t)}>
                {ln("stick", UMBRELLA_STICK, K.white, 4)}
                <g transform={`translate(${UMB.x} ${UMB.top}) scale(${u.sx.toFixed(3)} ${u.sy.toFixed(3)}) translate(${-UMB.x} ${-UMB.top})`}>
                  {shape("canopy", CANOPY, K.red, 3.4, K.shade)}
                  {[-1, 0, 1].map((i) => ln(`rib${i}`, umbrellaRib(i), K.drawn ? K.red : K.ground, 1.8, { opacity: K.drawn ? 1 : 0.4 }))}
                </g>
                {ln("tip", `M${UMB.x} ${UMB.top} v-10`, K.white, 4)}
              </g>
            ) : null}
          </>
        ))}
      </Sheet>
      <Note d={d} geo={geo} />
    </>
  );
}

/* ---------- housepillar: เสาหลักของบ้าน ---------- */

/** a pillar from the beam to the floor at `x`, with a cap at each end */
const pillarD = (x: number) => [rectD(x - 13, BEAM, 26, FLOOR - BEAM), rectD(x - 19, BEAM, 38, 9), rectD(x - 19, FLOOR - 9, 38, 9)];

/**
 * the pillars' plaques kept on the sheet: in the info route the picture fills its room to the edge, so a wide spare
 * plaque that would run off the sheet's right edge moves left onto it, and the main one moves left as far as the two
 * would meet (both still on their pillars)
 */
export function pillarInfoGeo(size: VideoSize, show: MetaShow<"housepillar">) {
  const pg = pillarGeo(size, show, metaInfoPlace(size, show.note));
  const { geo } = pg;
  if (!pg.spare) return pg;
  const over = pg.spare.plaque.x + pg.spare.plaque.w - (geo.art.x + geo.art.w - Math.round(4 * geo.k));
  if (over <= 0) return pg;
  const spare = { ...pg.spare, plaque: { ...pg.spare.plaque, x: pg.spare.plaque.x - over } };
  const clash = pg.main.plaque.x + pg.main.plaque.w + Math.round(6 * geo.k) - spare.plaque.x;
  return { ...pg, spare, main: clash > 0 ? { ...pg.main, plaque: { ...pg.main.plaque, x: pg.main.plaque.x - clash } } : pg.main };
}

/** เสาหลักของบ้าน: a roof on one pillar with its word, the family under it; the pillar shakes; a spare word brings a second pillar */
function housepillar(d: Dev, show: MetaShow<"housepillar">) {
  const K = kit();
  const { c, t, s } = d;
  const pg = pillarInfoGeo(c.size, show);
  const geo = pg.geo;
  const h = pillarAt(s, t);
  const spare = pg.spare && h.spared ? pg.spare : null;
  const safe = !!spare && h.spareIn > 0.7;
  const figs = metaFigures(show, c, t);
  const inks = familyInks();
  const act = (i: number): Act => (h.shaking ? "worried" : safe && i === 1 ? "up" : "stand");
  const plaqueDx = Math.sin((h.rot * Math.PI) / 180) * (FLOOR - 128 - 18) * geo.k;
  return (
    <>
      <MetaTitle d={d} show={show} />
      <Sheet geo={geo}>
        <SetIn d={d} geo={geo}>
          {svg(geo, (
            <>
              {shape("wall", rectD(42, BEAM, 316, FLOOR - BEAM), K.drawn ? K.soft : K.tile, 2, false)}
              {ln("floor", `M26 ${FLOOR + 2} H374`, K.white, 3.4)}
              <g transform={`translate(${r1(h.jolt)} ${r1(Math.abs(h.jolt) * 0.4)})`}>
                {shape("roof", ROOF, K.red, 3.2, K.shade)}
                {ln("roofline", ROOF_LINE, K.drawn ? K.red : K.ground, 1.8, { opacity: 0.5 })}
                {shape("window", ovalD(200, 78, 13), K.gold, 2.4, K.shade)}
                {ln("cross", "M200 65 V91 M187 78 H213", K.drawn ? K.gold : K.ground, 2)}
                {shape("beam", rectD(34, BEAM - 10, 332, 12), K.white, 2.4, K.shade)}
              </g>
              <g transform={`rotate(${r1(h.rot)} ${MAIN_X} ${FLOOR})`}>{pillarD(MAIN_X).map((p, i) => shape(`m${i}`, p, K.white, 2.6, K.shade))}</g>
            </>
          ))}
          <Plaque p={pg.main} at={geo.art} rot={h.rot} dx={plaqueDx} />
        </SetIn>
        {h.shaking ? svg(geo, <>{SHAKE_MARKS.map((m, i) => ln(`sh${i}`, m, K.red, 2.4))}</>) : null}
        {spare ? (
          <div style={abs({ left: 0, top: 0, width: geo.art.w, height: geo.art.h, opacity: lit(s.protect, t) })}>
            {svg(geo, <g transform={`translate(${r1(h.slide)} 0)`}>{pillarD(SPARE_X).map((p, i) => shape(`s${i}`, p, K.gold, 2.6, K.shade))}</g>)}
            <Plaque p={spare} at={geo.art} dx={h.slide * geo.k} spare />
          </div>
        ) : null}
        {figs.map((f, i) => <Person key={i} geo={geo} f={f} who={i} act={act(i)} color={inks[i]} t={t + i * 0.4} an={s.set} />)}
      </Sheet>
      <Note d={d} geo={geo} />
    </>
  );
}

/* ---------- lifering: ห่วงชูชีพ ---------- */

/** the ring: its red, banded in the words' ink; whole, or its far or near half */
function ring(key: string, cx: number, cy: number, rx: number, ry: number, part: "whole" | "far" | "near") {
  const K = kit();
  const d = ringD(cx, cy, rx, ry, part);
  const band = (Math.PI * (rx + ry)) / 4;
  return (
    <g key={key}>
      {ln("r", d, K.red, 9, { strokeLinecap: "butt" })}
      <path d={d} fill="none" stroke={K.white} strokeWidth={lw(9)} strokeDasharray={`${r1(band * 0.42)} ${r1(band * 0.58)}`} />
    </g>
  );
}

/** ห่วงชูชีพ: someone in the water, the waves moving; the waves rise; a ring is thrown along a dashed arc and lands round them */
function lifering(d: Dev, show: MetaShow<"lifering">) {
  const K = kit();
  const { c, t, s } = d;
  const geo = metaGeo(c.size, show.note, metaInfoPlace(c.size, show.note));
  const r = ringAt(s, t);
  const f = metaFigures(show, c, t)[0];
  // the dashed throw goes once the ring has landed: gone in a few tenths of a second
  const landedFor = s.protect ? t - (s.protect.at + s.protect.dur) : -1;
  const trail = r.thrown && (!r.landed || landedFor < 0.4) ? 1 - Math.max(0, landedFor) / 0.4 : 0;
  const act: Act = r.landed ? "hold" : r.help ? "up" : "worried";
  return (
    <>
      <MetaTitle d={d} show={show} />
      <Sheet geo={geo}>
        <SetIn d={d} geo={geo}>
          {svg(geo, (
            <>
              {ln("legs", JETTY.legs, K.white, 5)}
              {/* the deck stops short of the sheet's right edge, so its end is drawn, not cut */}
              {shape("deck", rectD(JETTY.deck.x, JETTY.deck.y, Math.min(JETTY.deck.w, SHEET.w - 3 - JETTY.deck.x), JETTY.deck.h), K.white, 2.6, K.shade)}
              {ln("boards", JETTY.boards, K.white, 1.6)}
            </>
          ))}
        </SetIn>
        {r.landed ? svg(geo, ring("far", SWIM_X, SEA + 2 + r.bob, RING.rx, RING.ry, "far")) : null}
        <Person geo={geo} f={f} who={0} act={act} color={K.white} t={t} an={s.set} clipBelow={SEA + 1} />
        <SetIn d={d} geo={geo}>
          {svg(geo, (
            <>
              {ln("sea", wave(SEA, r.amp, t), water(), 3.2)}
              {CRESTS.map(([y, a0, a1, ph]) => ln(`w${y}`, wave(y, 3, t + ph, a0, a1, 56), water(), 2.2, { opacity: 0.7 }))}
              {r.help ? [-1, 1].map((side) => (
                <g key={side} opacity={r1(r.rough)}>
                  {ln("a", `M${SWIM_X + side * 50} ${SEA - 2} q${side * 6} -12 ${side * 14} -6`, water(), 2.4)}
                  {shape("b", ovalD(r1(SWIM_X + side * (62 + 4 * Math.sin(t * 6))), r1(SEA - 16 - 6 * Math.abs(Math.sin(t * 5 + side))), 3), water(), 1.6)}
                </g>
              )) : null}
            </>
          ))}
        </SetIn>
        {trail > 0 ? svg(geo, ln("trail", r.trail, K.white, 2.2, { strokeDasharray: "7 7" }), { opacity: trail, helper: true }) : null}
        {r.thrown ? svg(geo, r.landed ? ring("near", SWIM_X, SEA + 2 + r.bob, RING.rx, RING.ry, "near") : ring("fly", r.at.x, r.at.y, 30 + 16 * r.q, 30 * (1 - r.q) + RING.ry * r.q, "whole"), { opacity: lit(s.protect, t) }) : null}
      </Sheet>
      <Note d={d} geo={geo} />
    </>
  );
}

/* ---------- safetynet: ตาข่ายนิรภัย ---------- */

/** ตาข่ายนิรภัย: someone walking the high line with a pole; they slip and fall; a green net strung below catches them */
function safetynet(d: Dev, show: MetaShow<"safetynet">) {
  const K = kit();
  const { c, t, s } = d;
  const geo = metaGeo(c.size, show.note, metaInfoPlace(c.size, show.note));
  const n = netShape(s, t);
  const f = metaFigures(show, c, t)[0];
  const H = Math.round(f.h * geo.k);
  // the pole held out at their hands all the way down (the slip is in the wobble and the fall); arms up once caught
  const act: Act = n.caught ? "up" : "out";
  // the pole, held across at their hands (turning and falling with them), let go of as they land
  const W = Math.round(f.w * geo.k);
  const poleW = Math.round((WALK_W + 64) * geo.k);
  const poleH = Math.round(16 * geo.k);
  const pole = (
    <div style={abs({ left: Math.round((W - poleW) / 2), top: Math.round(H * (58 / 130)) - Math.round(poleH * 0.6), width: poleW, height: poleH })}>
      <svg width={poleW} height={poleH} viewBox={`0 0 ${WALK_W + 64} 16`}>{ln("pole", `M4 12 Q${(WALK_W + 64) / 2} 2 ${WALK_W + 60} 12`, kit().gold, 3.4)}</svg>
    </div>
  );
  const turn = n.rot ? aboutFeet(n.rot, H) : undefined;
  const runs = (pts: [number, string][], key: string, width: number) => n.runs(pts).map((x, i) => (x ? ln(`${key}${i}`, x, K.green, width) : null));
  return (
    <>
      <MetaTitle d={d} show={show} />
      <Sheet geo={geo}>
        <SetIn d={d} geo={geo}>
          {svg(geo, (
            <>
              {POSTS.map((x) => shape(`p${x}`, rectD(x - 6, HIGH - 8, 12, 290 - HIGH + 8), K.white, 2.4, K.shade))}
              {ln("ground", "M14 290 H386", K.soft, 2.4)}
              {ln("line", `M${POSTS[0]} ${HIGH} H${POSTS[1]}`, K.white, 3)}
            </>
          ))}
        </SetIn>
        {n.slip > 0 && !n.caught ? svg(geo, ln("fall", FALL_LINE, K.white, 2, { strokeDasharray: "5 7" }), { opacity: 0.65 * easeOut(n.slip), helper: true }) : null}
        <Person geo={geo} f={f} who={0} act={act} color={K.white} t={t} an={s.set} transform={turn} held={n.caught ? null : pole} />
        {n.strung > 0 ? svg(geo, (
          <>
            {runs(n.ropeLow, "low", 2)}
            {n.mesh.map((m) => ln(`m${m.x}`, m.d, K.green, 1.6))}
            {runs(n.ropeTop, "top", 3.2)}
            {POSTS.map((x) => shape(`k${x}`, ovalD(x, NET_Y, 4.5), K.green, 2))}
          </>
        ), { opacity: lit(s.protect, t) }) : null}
      </Sheet>
      <Note d={d} geo={geo} />
    </>
  );
}

/* ---------- seedtree: เมล็ดโตเป็นต้นไม้ ---------- */

/** a crown of leaves as one outline: each blob's ring, then the blobs' insides over the rings (a drawn look's union) */
function crown(key: string, blobs: [number, number, number][]) {
  const K = kit();
  if (!K.drawn) return <g key={key}>{blobs.map(([x, y, r], i) => <path key={i} d={ovalD(x, y, r)} fill={K.green} />)}</g>;
  return (
    <g key={key}>
      {blobs.map(([x, y, r], i) => ln(`o${i}`, ovalD(x, y, r), K.green, 2.6))}
      {blobs.map(([x, y, r], i) => <path key={`i${i}`} d={ovalD(x, y, Math.max(1, r - lw(2.6) / 2))} fill={K.page} />)}
    </g>
  );
}

/** เมล็ดโตเป็นต้นไม้: a seed in the soil under the ground's two words; it sprouts; a small tree grows; then a big tree with fruit */
function seedtree(d: Dev, show: MetaShow<"seedtree">) {
  const K = kit();
  const { c, t } = d;
  const sg = seedGeo(c.size, show, metaInfoPlace(c.size, show.note));
  const geo = sg.geo;
  const [a0, a1, a2] = sg.stages(t);
  const fruit = a2 >= 1 ? 1 : Math.max(0, (a2 - 0.6) / 0.4);
  // the arrow on the soil from the first word to the second, in the sheet's units
  const right = (sg.from.plaque.x + sg.from.plaque.w - geo.art.x) / geo.k + 8;
  const left = (sg.to.plaque.x - geo.art.x) / geo.k - 8;
  const ay = SEED_WORD_TOP + sg.from.plaque.h / geo.k / 2;
  const trunk = (dd: string, key: string) => shape(key, dd, K.white, 2.4, K.shade);
  return (
    <>
      <MetaTitle d={d} show={show} />
      <Sheet geo={geo}>
        <SetIn d={d} geo={geo}>
          {svg(geo, (
            <>
              {raysD(SEED_SUN.x, SEED_SUN.y, 25, 33).map((ray, i) => ln(`ray${i}`, ray, K.gold, 2.6))}
              {shape("sun", ovalD(SEED_SUN.x, SEED_SUN.y, 18), K.gold, 2.4, K.shade)}
              {ln("soil", SOIL_TOP, K.white, 3)}
              {PEBBLES.map(([x, y]) => shape(`pb${x}`, ovalD(x, y, 4, 2.6), K.soft, 1.4))}
              {a0 > 0 ? ln("roots", ROOTS, K.soft, 2, { opacity: r1(easeOut(a0)) }) : null}
              {shape("seed", ovalD(SEED_X[0], SOIL + 10, 9, 6), K.white, 2, K.shade)}
              {left - right > 24 ? (
                <g opacity={0.8}>
                  {ln("way", `M${r1(right)} ${r1(ay)} H${r1(left)}`, K.white, 2.6, { strokeDasharray: "2 7" })}
                  {ln("head", `M${r1(left - 8)} ${r1(ay - 7)} L${r1(left)} ${r1(ay)} L${r1(left - 8)} ${r1(ay + 7)}`, K.white, 2.6)}
                </g>
              ) : null}
            </>
          ))}
          {svg(geo, (
            <>
              {grownAt(SEED_X[0], SOIL + 4, a0, (
                <>
                  {ln("stem", PLANTS.sprout.stem, K.green, 3.4)}
                  {PLANTS.sprout.leaves.map((x, i) => shape(`lf${i}`, x, K.green, 2.2, K.shade))}
                </>
              ), "sprout")}
              {grownAt(SEED_X[1], SOIL + 4, a1, <>{trunk(PLANTS.small.trunk, "t")}{crown("c", PLANTS.small.crown)}</>, "small")}
              {grownAt(SEED_X[2], SOIL + 4, a2, (
                <>
                  {ln("br", PLANTS.big.branches, K.white, 4)}
                  {trunk(PLANTS.big.trunk, "t")}
                  {crown("c", PLANTS.big.crown)}
                  {fruit > 0 ? PLANTS.big.fruit.map(([x, y], i) => shape(`f${i}`, ovalD(x, y, Math.max(0.1, 6.5 * clamp01(fruit * 5 - i * 0.8))), K.red, 1.6, K.shade)) : null}
                </>
              ), "big")}
            </>
          ))}
          <Plaque p={sg.from} at={geo.art} />
          <Plaque p={sg.to} at={geo.art} rot={2.4} />
        </SetIn>
      </Sheet>
      <Note d={d} geo={geo} />
    </>
  );
}

/* ---------- balance: ตาชั่ง ---------- */

/** ตาชั่ง: a scale with a word in each pan; the beam swings; it settles to its tilt and gleams */
function balance(d: Dev, show: MetaShow<"balance">) {
  const K = kit();
  const { c, t, s } = d;
  const bg = balanceGeo(c.size, show, t, metaInfoPlace(c.size, show.note));
  const geo = bg.geo;
  const deg = beamAngle(show, t);
  const ends = beamEnds(deg);
  const settled = prog(s.protect, t) >= 1;
  return (
    <>
      <MetaTitle d={d} show={show} />
      <Sheet geo={geo}>
        <SetIn d={d} geo={geo}>
          {svg(geo, (
            <>
              {shape("foot", BALANCE_FOOT, K.gold, 2.6, K.shade)}
              {shape("post", rectD(PIVOT.x - 7, PIVOT.y, 14, 264 - PIVOT.y), K.gold, 2.6, K.shade)}
              {ends.map((e, i) => ln(`str${i}`, `M${r1(e.x)} ${r1(e.y)} L${r1(e.x - PAN + 6)} ${r1(e.y + HANG)} M${r1(e.x)} ${r1(e.y)} L${r1(e.x + PAN - 6)} ${r1(e.y + HANG)}`, K.white, 1.8))}
              {ends.map((e, i) => shape(`pan${i}`, `M${r1(e.x - PAN)} ${r1(e.y + HANG)} Q${r1(e.x)} ${r1(e.y + HANG + 34)} ${r1(e.x + PAN)} ${r1(e.y + HANG)} Z`, K.gold, 2.6, K.shade))}
              <g transform={`rotate(${deg} ${PIVOT.x} ${PIVOT.y})`}>
                {shape("beam", rectD(PIVOT.x - ARM - 4, PIVOT.y - 6, ARM * 2 + 8, 12), K.gold, 2.6, K.shade)}
                {[-1, 1].map((side) => shape(`end${side}`, ovalD(PIVOT.x + side * ARM, PIVOT.y, 7), K.gold, 2.2, K.shade))}
              </g>
              {shape("top", `M${PIVOT.x - 10} ${PIVOT.y - 6} L${PIVOT.x} ${PIVOT.y - 30} L${PIVOT.x + 10} ${PIVOT.y - 6} Z`, K.gold, 2.4, K.shade)}
              {shape("pivot", ovalD(PIVOT.x, PIVOT.y, 10), K.gold, 2.6, K.shade)}
              {shape("pin", ovalD(PIVOT.x, PIVOT.y, 3.5), K.drawn ? K.white : K.ground, 1.2)}
              {settled ? <g opacity={lit({ ...s.protect, at: s.protect.at + s.protect.dur, dur: 0.4 }, t)}>{BALANCE_GLEAM.map(([dx, dy, r]) => shape(`g${dx}`, sparkleD(PIVOT.x + dx, PIVOT.y + dy, r), K.gold, 1.4))}</g> : null}
            </>
          ))}
          <Plaque p={bg.left} at={geo.art} />
          <Plaque p={bg.right} at={geo.art} rot={2.4} />
        </SetIn>
      </Sheet>
      <Note d={d} geo={geo} />
    </>
  );
}

/* ---------- bridge: สะพานข้ามช่วงยาก ---------- */

/** a pen's ground hatching under a cliff's top: short slanted strokes along it, clear of its face */
const groundHatch = (x0: number, x1: number) => {
  const [a, b] = x0 < x1 ? [x0 + 8, x1 - 14] : [x1 + 16, x0 - 6];
  return Array.from({ length: Math.floor((b - a) / 14) + 1 }, (_, i) => `M${a + i * 14 + 10} ${BRIDGE.deck + 10} l-10 14`).join(" ");
};

/** สะพานข้ามช่วงยาก: two cliffs with water between, someone on the left; stones fall; a bridge is drawn across; they walk over */
function bridge(d: Dev, show: MetaShow<"bridge">) {
  const K = kit();
  const { c, t, s } = d;
  const geo = metaGeo(c.size, show.note, metaInfoPlace(c.size, show.note));
  const b = bridgeShape(show, t);
  const [g0, g1] = BRIDGE.gap;
  const f = metaFigures(show, c, t)[0];
  const act: Act = b.walk >= 1 ? "up" : b.walk > 0 ? "walk" : b.rough > 0 && !b.drawn ? "worried" : "stand";
  return (
    <>
      <MetaTitle d={d} show={show} />
      <Sheet geo={geo}>
        <SetIn d={d} geo={geo}>
          {svg(geo, (
            <>
              {raysD(BRIDGE_SUN.x, BRIDGE_SUN.y, 24, 31).map((ray, i) => ln(`ray${i}`, ray, K.gold, 2.6))}
              {shape("sun", ovalD(BRIDGE_SUN.x, BRIDGE_SUN.y, 17), K.gold, 2.4, K.shade)}
              {/* the water: อินโฟกราฟิก's flat pool behind the cliffs; a drawn look's moving surface between their faces */}
              {K.drawn
                ? ln("water", wave(GAP_SURFACE, gapAmp(b.rough, b.drawn), t, 124, 276, 72), water(), 2.6)
                : shape("water", gapWaterD(b.rough, b.drawn, t), water(), 2.4, false, { opacity: 0.5 })}
              {GAP_RIPPLES.map(([y, a0, a1, ph]) => ln(`rp${y}`, wave(y, 2.5, t + ph, a0, a1, 40), K.drawn ? water() : K.white, 2.2, { opacity: 0.8 }))}
              {CLIFFS.map(([x0, x1]) => (
                <g key={x0}>
                  {/* a drawn cliff: its face and top ruled, not the sheet's edges; อินโฟกราฟิก's a pale block */}
                  {K.drawn ? null : <g><path d={cliff(x0, x1)} fill={K.page} /><path d={cliff(x0, x1)} fill={K.tile} /></g>}
                  {ln("face", cliff(x0, x1).replace(/ H\d+ Z$/, ""), K.white, 2.6)}
                  {K.drawn ? (K.hatch ? ln("hatch", groundHatch(x0, x1), K.soft, 1.6) : null) : ln("rock", rockLines(x0, x1), K.soft, 2)}
                  {shape("grass", rectD(Math.min(x0, x1) - 2, BRIDGE.deck - 6, Math.abs(x1 - x0) + 6, 10), K.green, 2.2, K.shade)}
                </g>
              ))}
            </>
          ))}
        </SetIn>
        {b.stones.length ? svg(geo, <>{b.stones.map((x) => shape(`st${x.i}`, ovalD(r1(x.x), r1(x.y), x.r), K.white, 1.4))}</>, { helper: true }) : null}
        {b.drawn && b.arch ? svg(geo, (
          <>
            {ln("arch", b.arch, K.gold, 5.5)}
            {b.hangers.map((x) => ln(`h${x.x}`, `M${x.x} ${r1(x.top)} V${BRIDGE.deck + 8}`, K.gold, 2.2))}
            {b.planks.map((x) => shape(`pk${x}`, rectD(x, BRIDGE.deck - 2, 14, 10), K.white, 1.6, K.shade))}
            {b.posts.map((x) => ln(`po${x}`, `M${x} ${BRIDGE.deck - 2} V${BRIDGE.deck - 22}`, K.white, 2.2))}
            {ln("rail", `M${g0} ${BRIDGE.deck - 20} H${r1(Math.min(b.reach, g1))}`, K.gold, 3.2)}
          </>
        ), { opacity: lit(s.protect, t) }) : null}
        <Person geo={geo} f={f} who={0} act={act} color={K.white} t={t} an={s.set} />
      </Sheet>
      <Note d={d} geo={geo} />
    </>
  );
}

/* ---------- shield: โล่กันลูกศร ---------- */

/** โล่กันลูกศร: a family behind a shield with a tick; arrows with their words fly in one by one and stick in it; it gleams */
function shield(d: Dev, show: MetaShow<"shield">) {
  const K = kit();
  const { c, t, s } = d;
  const sg = shieldGeo(c.size, show, metaInfoPlace(c.size, show.note));
  const geo = sg.geo;
  const sh = shieldAt(sg, s, t);
  const figs = metaFigures(show, c, t);
  const inks = familyInks();
  const act = (i: number): Act => (sh.fearful ? "worried" : sh.glad && i === 1 ? "up" : "stand");
  const hits = sg.arrows.filter((_, i) => sh.flights[i].hit);
  return (
    <>
      <MetaTitle d={d} show={show} />
      <Sheet geo={geo}>
        {figs.map((f, i) => <Person key={i} geo={geo} f={f} who={i} act={act(i)} color={inks[i]} t={t + i * 0.4} an={s.set} />)}
        {svg(geo, (
          <>
            {sg.arrows.map((a, i) => {
              const fl = sh.flights[i];
              if (!fl.on) return null;
              const ad = arrowD(a, fl.tail);
              return (
                <g key={i} transform={`translate(${r1(fl.dx)} 0)`} opacity={r1(clamp01(fl.p / 0.3))}>
                  {ln("shaft", ad.shaft, K.white, 3)}
                  {shape("feathers", ad.feathers, K.red, 1.6, K.shade)}
                  {shape("head", ad.head, K.white, 1.4)}
                </g>
              );
            })}
          </>
        ))}
        <div style={abs({ left: 0, top: 0, width: geo.art.w, height: geo.art.h, ...(sh.jolt ? { transform: `translate(${r1(sh.jolt * geo.k)}px, 0px)` } : {}) })}>
          <SetIn d={d} geo={geo}>
            {svg(geo, (
              <>
                {shape("shadow", ovalD(SH.x, SHIELD_GROUND + 2, 44, 5), K.soft, 1.6)}
                {sh.gleam > 0 ? <g opacity={lit(s.protect, t)}>{ln("halo", SHIELD_PATH, K.gold, r1(9 * easeOut(sh.gleam)), { opacity: 0.45 })}</g> : null}
                {shape("shield", SHIELD_PATH, K.drawn ? K.gold : K.sky, 3.4, K.shade)}
                {ln("inner", SHIELD_INNER, K.drawn ? K.gold : K.white, 1.8, { opacity: 0.6 })}
                <g transform={`translate(${SH.x} 150) scale(${sh.tick.toFixed(3)})`}>{ln("tick", SHIELD_TICK, K.drawn ? K.tick : K.white, 8)}</g>
                {sh.gleam > 0 ? <g opacity={lit(s.protect, t)}>{SHIELD_GLEAM.map(([x, y, r]) => shape(`g${x}${y}`, sparkleD(x, y, r1(r * easeOut(sh.gleam))), K.gold, 1.4))}</g> : null}
              </>
            ))}
          </SetIn>
          {hits.length ? svg(geo, <>{hits.map((a) => ln(`hit${a.y}`, hitD(a.face, a.y), K.red, 2.4))}</>, { helper: true }) : null}
        </div>
        {sg.arrows.map((a, i) => {
          const fl = sh.flights[i];
          if (!fl.on) return null;
          return <Plaque key={i} p={a} at={geo.art} rot={i % 2 ? 2.4 : 0} dx={fl.dx * geo.k} opacity={clamp01(fl.p / 0.3)} />;
        })}
      </Sheet>
      <Note d={d} geo={geo} />
    </>
  );
}
