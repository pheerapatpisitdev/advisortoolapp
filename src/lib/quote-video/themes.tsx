import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { QUOTE_VIDEO_COLORS as C, VIDEO_THEME_COLORS, VIDEO_THEME_EXTRA as X, type VideoThemePalette } from "@/lib/card-theme";
import { DEFAULT_HERO_FACE, familyOf } from "@/lib/story/faces";
import { faceUris } from "./story-faces";
import { abs, box, El, MOTION_BG_H, type Anim } from "./motion";
import type { ThemeKey } from "./theme-keys";
import { W } from "./timeline";

/**
 * How a theme draws (owner, 2026-10-17; theme-keys.ts has the list). The scenes (motion.tsx, wide.tsx)
 * are drawn in the navy look as before. A theme then repaints the finished drawing by what each colour
 * does there — the words, the gold figures, a gold pill and the words on it, a white card and the
 * words on it, the subtitle's band — so the scenes keep one layout and every figure stays the
 * engine's. น้ำเงินทอง keeps the navy colours untouched.
 */

type Palette = VideoThemePalette;
const PALETTES: Partial<Record<ThemeKey, Palette>> = VIDEO_THEME_COLORS;

export const themeFont = (t: ThemeKey | undefined) => (t ? PALETTES[t]?.font : undefined);

const NAVY = C.motionNavy.toLowerCase();
const GOLD = C.motionGold.toLowerCase();
const SKY = C.motionSky.toLowerCase();
const WHITE = C.paper.toLowerCase();
const RED = C.motionRed.toLowerCase();
const GREEN = C.motionGreen.toLowerCase();
const PEN = C.motionPen.toLowerCase();
const BLUE = C.motionBluePen.toLowerCase();
const SUB_BAND = "rgba(0,0,0,0.45)";

/** what a colour stands on: the ground, a gold pill, a white card, the subtitle's band */
type Surface = "ground" | "fill" | "card" | "sub";

const COLOR = /#[0-9a-fA-F]{6}\b|rgba\([^)]*\)/g;
const norm = (c: string) => c.replace(/\s+/g, "").toLowerCase();
const whiteAlpha = (c: string) => /^rgba\(255,255,255,([\d.]+)\)$/.exec(c)?.[1];

/** a colour used for words, lines and drawn shapes, on its surface */
function ink(p: Palette, raw: string, s: Surface): string {
  const c = norm(raw);
  const a = whiteAlpha(c);
  if (s === "fill" && (c === NAVY || c === WHITE || c === GOLD)) return p.onFill;
  if (s === "sub") {
    if (c === WHITE) return p.subInk;
    if (c === GOLD) return p.subAccent;
    if (a) return `rgba(${p.subRgb},${a})`;
  }
  if (s === "card") {
    if (c === NAVY) return p.onCard;
    if (c === WHITE) return p.card;
    if (a) return `rgba(${p.onCardRgb},${a})`;
  }
  if (a) return `rgba(${p.inkRgb},${a})`;
  switch (c) {
    case WHITE: case NAVY: return p.ink;
    case GOLD: return p.accent;
    case SKY: return p.second;
    case RED: return p.red;
    case GREEN: return p.green;
    case PEN: return p.pen;
    case BLUE: return p.bluePen;
    default: return raw;
  }
}

/** a colour used to fill an area, on the surface under it */
function ground(p: Palette, raw: string, s: Surface): string {
  const c = norm(raw);
  const a = whiteAlpha(c);
  if (c === SUB_BAND) return p.subBg;
  if (a) return s === "card" ? `rgba(${p.onCardRgb},${a})` : `rgba(${p.inkRgb},${a})`;
  switch (c) {
    case GOLD: return p.fill;
    case WHITE: return p.card;
    case NAVY: return s === "fill" ? p.onFill : p.ink;
    default: return ink(p, raw, s);
  }
}

/** the surface an area makes for what is drawn on it */
function surfaceOf(bg: unknown, under: Surface): Surface {
  if (typeof bg !== "string") return under;
  const c = norm(bg);
  if (c === GOLD) return "fill";
  if (c === WHITE) return "card";
  if (c === SUB_BAND) return "sub";
  return under;
}

const swap = (v: unknown, f: (c: string) => string) => (typeof v === "string" ? v.replace(COLOR, f) : v);
const SVG_PAINT = ["fill", "stroke", "stopColor"] as const;

/**
 * The drawing repainted in a theme. Components are drawn here (they are plain functions of their
 * props, as the drawing library calls them), so every element it reaches is a plain one.
 */
function repaint(node: ReactNode, p: Palette, under: Surface, c?: Cut): ReactNode {
  if (Array.isArray(node)) return node.map((n) => repaint(n, p, under, c));
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<Record<string, unknown>>;
  if (typeof el.type === "function") return repaint((el.type as (props: unknown) => ReactNode)(el.props), p, under, c);
  const props = el.props;
  const kids = props.children as ReactNode;
  if ((el.type as unknown) === Fragment) return cloneElement(el, {}, ...Children.toArray(kids).map((k) => repaint(k, p, under, c)));
  const style = props.style as Record<string, unknown> | undefined;
  const own = surfaceOf(style?.background ?? style?.backgroundColor, under);
  const next: Record<string, unknown> = {};
  if (style) {
    const s: Record<string, unknown> = { ...style };
    for (const k of ["background", "backgroundColor"]) if (k in s) s[k] = swap(s[k], (c) => ground(p, c, under));
    for (const k of ["color", "border", "borderLeft", "borderRight", "borderTop", "borderBottom", "borderColor", "boxShadow", "textDecorationColor"]) {
      if (k in s) s[k] = swap(s[k], (c) => ink(p, c, own));
    }
    if (s.fontFamily === "Plex" && p.font) s.fontFamily = p.font;
    next.style = s;
  }
  for (const k of SVG_PAINT) if (typeof props[k] === "string") next[k] = swap(props[k], (col) => ink(p, col, own));
  let children = kids === undefined ? [] : Children.toArray(kids).map((k) => repaint(k, p, own, c));
  if (c && style && next.style) {
    const s = next.style as Record<string, unknown>;
    const n = c.n++;
    // a card or a pill: a piece of paper, laid a little crooked, that shifts six times a second
    if (own !== under && (own === "card" || own === "fill")) {
      Object.assign(s, { borderRadius: 4, boxShadow: "0 8px 16px rgba(0,0,0,0.18)", transform: tilt(s.transform, wobble(n, c.step, 1.2)) });
    }
    // a big gold figure on the ground: set on a strip of paper of its own
    const big = typeof style.fontSize === "number" && style.fontSize >= 96 && typeof style.color === "string" && norm(style.color) === GOLD;
    if (big && under === "ground") {
      s.transform = tilt(s.transform, wobble(n, c.step, 0.8));
      children = [<div key="strip" style={{ display: "flex", background: p.card, color: p.onCard, padding: "6px 34px", transform: "rotate(-2deg)", boxShadow: "0 8px 18px rgba(0,0,0,0.2)" }}>{children}</div>];
    }
  }
  return cloneElement(el, next, ...children);
}

/** คอลลาจกระดาษ's state through one frame: which element is being drawn, and the frame's stop-motion step */
interface Cut { n: number; step: number }
/** stop motion: a few hand-placed positions, changed six times a second, a little different for each piece */
const wobble = (n: number, step: number, deg: number) => (((n * 7 + step) % 3) - 1) * deg + (n % 2 ? 0.6 : -0.6);
const tilt = (was: unknown, deg: number) => `${typeof was === "string" ? `${was} ` : ""}rotate(${deg.toFixed(2)}deg)`;
/** a frame in its theme; the navy looks come back as they went in */
export function themed(frame: ReactNode, t: ThemeKey | undefined, at = 0): ReactNode {
  const p = t ? PALETTES[t] : undefined;
  return p ? repaint(frame, p, "ground", p.collage ? { n: 0, step: Math.floor(at * 6) } : undefined) : frame;
}

/** คอลลาจกระดาษ's family cut out in dots, read once a process */
let familyFile: Promise<string> | undefined;
const collageFamily = () => (familyFile ??= readFile(join(process.cwd(), "public/collage/family.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`));

/** the crumpled paper grounds, each read once a process (each named in full for the deploy's file tracing) */
const textureFiles: Partial<Record<"paper" | "paper-light", Promise<string>>> = {};
const texture = (k: "paper" | "paper-light") => (textureFiles[k] ??= readFile(join(process.cwd(), k === "paper" ? "public/collage/paper.jpg" : "public/collage/paper-light.jpg"))
  .then((b) => `data:image/jpeg;base64,${b.toString("base64")}`));

/** the drifting ground of a themed clip: its paper, or motion.tsx's shapes in the theme's colours */
export async function themeBackground(t: ThemeKey, size: { w: number; h: number }, bgH: number): Promise<ReactNode | null> {
  const p = PALETTES[t];
  if (!p) return null;
  if (p.texture) {
    const paper = await texture(p.texture);
    return (
      <div style={{ display: "flex", position: "relative", width: size.w, height: bgH, background: p.ground, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={paper} width={size.w} height={bgH} style={{ width: size.w, height: bgH, objectFit: "cover" }} alt="" />
      </div>
    );
  }
  const x = (v: number) => Math.round((v / W) * size.w);
  const y = (v: number) => Math.round((v / MOTION_BG_H) * bgH);
  const spots = [
    { left: x(-200), top: y(-120), d: 720 }, { left: x(820), top: y(900), d: 520 },
    { left: x(300), top: y(1700), d: 860 }, { left: x(-160), top: y(1250), d: 380 },
  ];
  return (
    <div style={{ display: "flex", position: "relative", width: size.w, height: bgH, background: p.ground, overflow: "hidden" }}>
      {spots.map((s, i) => <div key={i} style={abs({ left: s.left, top: s.top, width: s.d, height: s.d, borderRadius: s.d / 2, background: p.shapes[i].color, opacity: p.shapes[i].opacity })} />)}
    </div>
  );
}

/** the opening's picture where a theme has its own; the shield and the family otherwise */
export type Hero = (s: Record<string, Anim>, t: number, w: number, h: number) => ReactNode;

/** the hand-drawn theme's opening: the insured, their partner and a child as the story clips draw them */
export async function themeHero(theme: ThemeKey | undefined, sex: "M" | "F"): Promise<Hero | undefined> {
  if (theme === "paper") {
    const hero = DEFAULT_HERO_FACE[sex];
    const ids = [hero, DEFAULT_HERO_FACE[sex === "M" ? "F" : "M"], familyOf(hero).kids[0]];
    const uris = await faceUris(ids);
    return function paperHero(s, t, w, h) {
      const d = Math.round(Math.min(w / 2.6, h / 1.7));
      return (
        <div style={box({ position: "relative", width: w, height: h, alignItems: "center", justifyContent: "center" })}>
          {ids.map((id, i) => {
            const size = i === 2 ? Math.round(d * 0.78) : d;
            return (
              <El key={id} an={s.family} t={t} style={{ position: "absolute", left: Math.round(w / 2 + (i - 1) * d * 0.82 - size / 2), top: Math.round(h / 2 - size / 2 + (i === 2 ? d * 0.22 : -d * 0.08)), width: size, height: size, borderRadius: size / 2, border: `${Math.round(d * 0.045)}px solid ${X.paperFaceRing}`, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uris[id]} width={size} height={size} style={{ width: size, height: size }} alt="" />
              </El>
            );
          })}
        </div>
      );
    };
  }
  if (theme === "collage") {
    const family = await collageFamily();
    // the family cut out in dots, on a yellow circle of paper, as in the owner's Pinterest pictures
    return function collageHero(s, t, w, h) {
      const d = Math.round(Math.min(w, h) * 0.92);
      // the picture is square, the family filling its middle (22%–78% down)
      const fw = Math.round(w * 1.2);
      return (
        <div style={box({ position: "relative", width: w, height: h })}>
          <El an={s.shield ?? s.family} t={t} style={{ position: "absolute", left: Math.round((w - d) / 2), top: Math.round((h - d) / 2 - h * 0.04), width: d, height: d, borderRadius: d / 2, background: X.collageCircle }} />
          <El an={s.family} t={t} style={{ position: "absolute", left: Math.round((w - fw) / 2), top: Math.round(h - fw * 0.86), width: fw, height: fw, transform: `rotate(${(Math.floor(t * 6) % 2 ? 0.8 : -0.6)}deg)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={family} width={fw} height={fw} style={{ width: fw, height: fw }} alt="" />
          </El>
        </div>
      );
    };
  }
  return undefined;
}

/** every letter a themed frame can show, for the theme's own face (cut to these, fetched once a process) */
export const THEME_LETTERS = (() => {
  let s = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·…–—“”‘’฿";
  for (let c = 0x0e01; c <= 0x0e5b; c++) s += String.fromCharCode(c);
  return s;
})();

/** คอลลาจกระดาษ's sounds (owner, 2026-10-17): paper sliding in, a slap as a piece lands, a pop, the pen */
export type SoundKind = "pop" | "swish" | "slap" | "pen";
const SOUND_OF: Partial<Record<Anim["kind"], SoundKind>> = { pop: "pop", grow: "slap", up: "swish", left: "swish", stroke: "pen" };
export const SOUND_GAIN: Record<SoundKind, number> = { pop: 0.4, swish: 0.35, slap: 0.4, pen: 0.22 };

/**
 * When each sound plays in the finished clip: one as each piece of a scene moves in (its Anim), none
 * for a fade or a count, the pen once a scene, and two of a kind never closer than a fifth of a second.
 */
export function collageSounds(scenes: { start: number; anims: Anim[] }[]): { at: number; kind: SoundKind }[] {
  const out: { at: number; kind: SoundKind }[] = [];
  for (const { start, anims } of scenes) {
    let pen = false;
    for (const an of [...anims].sort((x, y) => x.at - y.at)) {
      const kind = SOUND_OF[an.kind];
      if (!kind || (kind === "pen" && pen)) continue;
      if (kind === "pen") pen = true;
      const at = start + an.at;
      if (out.some((o) => Math.abs(o.at - at) < (o.kind === kind ? 0.2 : 0.08))) continue;
      out.push({ at, kind });
    }
  }
  return out.sort((x, y) => x.at - y.at);
}

let soundFiles: Promise<Record<SoundKind, Buffer>> | undefined;
/** the four sounds as 24 kHz 16-bit mono, read once a process */
export const collageSoundFiles = () => (soundFiles ??= Promise.all([
  // each named in full, so the deploy's file tracing finds them (next.config.ts lists them too)
  readFile(join(process.cwd(), "public/collage/sfx/pop.pcm")),
  readFile(join(process.cwd(), "public/collage/sfx/swish.pcm")),
  readFile(join(process.cwd(), "public/collage/sfx/slap.pcm")),
  readFile(join(process.cwd(), "public/collage/sfx/pen.pcm")),
]).then(([pop, swish, slap, pen]) => ({ pop, swish, slap, pen })));
