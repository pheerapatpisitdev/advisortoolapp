import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { myColorPalette, QUOTE_VIDEO_COLORS as C, VIDEO_FESTIVAL_COLORS, VIDEO_THEME_COLORS, VIDEO_THEME_EXTRA as X, type MyColor, type VideoThemePalette } from "@/lib/card-theme";
import { DEFAULT_HERO_FACE, familyOf } from "@/lib/story/faces";
import { faceUris } from "./story-faces";
import { abs, box, El, MOTION_BG_H, setPenMode, type Anim } from "./motion";
import type { FestivalKey } from "./festival";
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
/** what a look needs beside its key: ธีมเทศกาล's festival, สีของฉัน's colour */
export interface LookOf { festival?: FestivalKey; myColor?: MyColor }
/** the look a clip's props name (remotion.ts) */
export const lookOf = (p: { festival?: { key: FestivalKey }; myColor?: MyColor }): LookOf => ({ festival: p.festival?.key, myColor: p.myColor });

/**
 * สีของฉัน's band (owner, 2026-10-20): the agent's photo and name over every scene, in the strip the
 * scenes leave empty — above the header on a portrait clip, at the foot's right on a wide one.
 */
export function mineFront(myColor: MyColor, contact: { name: string; photo?: string }, w: number, h: number): ReactNode {
  const p = myColorPalette(myColor);
  const portrait = h > w;
  const d = portrait ? 44 : 30;
  const initials = [...contact.name.replace(/^คุณ/, "")].slice(0, 2).join("");
  return (
    <div style={{ position: "absolute", display: "flex", justifyContent: portrait ? "center" : "flex-end", left: 0, width: w, ...(portrait ? { top: 8 } : { bottom: 8 }), paddingRight: portrait ? 0 : 24 }}>
      <div style={{ display: "flex", alignItems: "center", background: p.fill, color: p.onFill, borderRadius: 40, padding: portrait ? "4px 26px 4px 5px" : "2px 18px 2px 3px", fontFamily: "Plex", fontSize: portrait ? 30 : 22, fontWeight: 600 }}>
        <div style={{ display: "flex", width: d, height: d, borderRadius: d, overflow: "hidden", background: p.card, color: p.onCard, alignItems: "center", justifyContent: "center", fontSize: Math.round(d * 0.42), marginRight: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {contact.photo ? <img src={contact.photo} width={d} height={d} style={{ width: d, height: d, objectFit: "cover" }} alt="" /> : initials}
        </div>
        {contact.name}
      </div>
    </div>
  );
}

/** a look's gold pill and its words, for what is laid over the scenes (carry.tsx): the navy look's own where it has none */
export function lookFill(t: ThemeKey | undefined, look?: LookOf): { fill: string; onFill: string } {
  const p = paletteOf(t, look);
  return p ? { fill: p.fill, onFill: p.onFill } : { fill: C.motionGold, onFill: C.motionNavy };
}

/** a theme's colours: ธีมเทศกาล's are its festival's (festival.ts), สีของฉัน's the agent's; none for น้ำเงินทอง, or a look not named */
const paletteOf = (t: ThemeKey | undefined, look: LookOf = {}): Palette | undefined =>
  (t === "festival" ? (look.festival ? VIDEO_FESTIVAL_COLORS[look.festival] : undefined)
    : t === "mine" ? (look.myColor ? myColorPalette(look.myColor) : undefined)
    : t ? PALETTES[t] : undefined);

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
function repaint(node: ReactNode, p: Palette, under: Surface): ReactNode {
  if (Array.isArray(node)) return node.map((n) => repaint(n, p, under));
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<Record<string, unknown>>;
  if (typeof el.type === "function") return repaint((el.type as (props: unknown) => ReactNode)(el.props), p, under);
  const props = el.props;
  const kids = props.children as ReactNode;
  if ((el.type as unknown) === Fragment) return cloneElement(el, {}, ...Children.toArray(kids).map((k) => repaint(k, p, under)));
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
  const children = kids === undefined ? [] : Children.toArray(kids).map((k) => repaint(k, p, own));
  return cloneElement(el, next, ...children);
}

/** a frame in its theme; the navy looks come back as they went in */
export function themed(frame: ReactNode, t: ThemeKey | undefined, look?: LookOf): ReactNode {
  const p = paletteOf(t, look);
  if (!p) return frame;
  if (!p.marker) return repaint(frame, p, "ground");
  // ไวท์บอร์ด: the pieces are run here, so their marker is on for this repaint only (motion.tsx El);
  // a first pass finds what is being written, so the second draws one marker, on the last piece started
  try {
    setPenMode("survey");
    repaint(frame, p, "ground");
    setPenMode("draw");
    return repaint(frame, p, "ground");
  } finally { setPenMode(false); }
}

/** the crumpled paper ground, read once a process (named in full for the deploy's file tracing) */
let paperFile: Promise<string> | undefined;
const texture = () => (paperFile ??= readFile(join(process.cwd(), "public/collage/paper-light.jpg"))
  .then((b) => `data:image/jpeg;base64,${b.toString("base64")}`));

/** the drifting ground of a themed clip: its paper, or motion.tsx's shapes in the theme's colours */
export async function themeBackground(t: ThemeKey, size: { w: number; h: number }, bgH: number, look?: LookOf): Promise<ReactNode | null> {
  const p = paletteOf(t, look);
  if (!p) return null;
  if (p.texture) {
    const paper = await texture();
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
  return undefined;
}

/** every letter a themed frame can show, for the theme's own face (cut to these, fetched once a process) */
export const THEME_LETTERS = (() => {
  let s = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·…–—“”‘’฿";
  for (let c = 0x0e01; c <= 0x0e5b; c++) s += String.fromCharCode(c);
  return s;
})();
