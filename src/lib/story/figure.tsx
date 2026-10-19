import type { ReactNode } from "react";
import { BABY, faceOf, GRANDMAS, GRANDPAS } from "./faces";

/**
 * มินิมอล (owner, 2026-10-20, mockup https://claude.ai/artifact/5An8XCjjjVChgNFoDsogv1, ทาง ก): คลิปเล่าเรื่อง
 * told with whole people drawn flat, in the manner of the owner's Pinterest pictures, in place of
 * the hand-drawn faces. Each person is a rig — a hip, a body, a head, two arms and two legs, each
 * at an angle — so a pose is a handful of numbers and moves by changing them over time.
 *
 * Everyone in a clip has a face id still (faces.ts), so every scene keeps choosing its people as it
 * did; `lookFor` turns an id into how that person is drawn: the hero and the agent as the agent
 * dressed them in the form, everyone else from their id, the same every time.
 *
 * Browser-safe: the form's preview and the clip (Remotion) draw from here.
 */

/** the clip's ground, the three the form offers */
export type FigureGround = "lav" | "line" | "dark";
export interface GroundColors { name: string; bg: string; ink: string; outline: string | null; shadow: string; chair: string; chairLeg: string }
export const GROUNDS: Record<FigureGround, GroundColors> = {
  lav: { name: "ม่วงอ่อน", bg: "#e4e3f0", ink: "#2a2d3e", outline: null, shadow: "rgba(70,70,120,0.13)", chair: "#c4c7cf", chairLeg: "#2a2b30" },
  line: { name: "ขาว เส้นดำ", bg: "#ffffff", ink: "#1b1b1d", outline: "#1b1b1d", shadow: "rgba(0,0,0,0)", chair: "#e4e6ea", chairLeg: "#1b1b1d" },
  dark: { name: "เทาเข้ม", bg: "#343740", ink: "#f1f1f4", outline: null, shadow: "rgba(0,0,0,0.32)", chair: "#585c68", chairLeg: "#20222a" },
};
export const FIGURE_GROUNDS = Object.keys(GROUNDS) as FigureGround[];
export const isGround = (v: unknown): v is FigureGround => typeof v === "string" && v in GROUNDS;

/** what the agent picks for the hero and for themself */
export interface FigureLook {
  sex: "M" | "F";
  hair: "short" | "long" | "bun";
  hairColor: string;
  glasses: boolean;
  hat: boolean;
  sleeve: "short" | "long";
  shirt: string;
  bottom: "pants" | "skirt";
  pants: string;
}
export const FIGURE_SHIRTS = ["#ffffff", "#b9c3ea", "#bfb6aa", "#9fb59a", "#e9b7a4", "#2d3040", "#c7a0c9", "#f0d58a"];
export const FIGURE_PANTS = ["#2c2d28", "#3a4566", "#d9c49a", "#8a8f99", "#6e5a4a", "#f3f1ea"];
export const FIGURE_HAIRS = ["#1e1f24", "#5a3a2a", "#8a8a8a"];
export const HAIR_WORD: Record<FigureLook["hair"], string> = { short: "สั้น", long: "ยาว", bun: "มวย" };

/** the mockup's two: a man in a stone jacket and glasses, the agent a woman in light blue */
export const DEFAULT_CAST: { hero: Record<"M" | "F", FigureLook>; narrator: FigureLook } = {
  hero: {
    M: { sex: "M", hair: "short", hairColor: "#1e1f24", glasses: true, hat: false, sleeve: "long", shirt: "#bfb6aa", bottom: "pants", pants: "#2c2d28" },
    F: { sex: "F", hair: "bun", hairColor: "#5a3a2a", glasses: false, hat: false, sleeve: "short", shirt: "#e9b7a4", bottom: "pants", pants: "#3a4566" },
  },
  narrator: { sex: "F", hair: "long", hairColor: "#1e1f24", glasses: false, hat: false, sleeve: "short", shirt: "#b9c3ea", bottom: "pants", pants: "#3a4566" },
};

/** a look as sent, or null when any part of it is not one the form offers */
export function checkedLook(v: unknown): FigureLook | null {
  const o = (v ?? {}) as Record<string, unknown>;
  if (o.sex !== "M" && o.sex !== "F") return null;
  if (o.hair !== "short" && o.hair !== "long" && o.hair !== "bun") return null;
  if (o.sleeve !== "short" && o.sleeve !== "long") return null;
  if (o.bottom !== "pants" && o.bottom !== "skirt") return null;
  if (!FIGURE_HAIRS.includes(o.hairColor as string) || !FIGURE_SHIRTS.includes(o.shirt as string) || !FIGURE_PANTS.includes(o.pants as string)) return null;
  return {
    sex: o.sex, hair: o.hair, hairColor: o.hairColor as string, glasses: o.glasses === true, hat: o.hat === true,
    sleeve: o.sleeve, shirt: o.shirt as string, bottom: o.bottom, pants: o.pants as string,
  };
}

/** how one person is drawn: a look, and whether they are a child or older */
export interface Drawn extends FigureLook { hatColor?: string; age: "adult" | "kid" | "old" }

const hash = (id: string) => [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = <T,>(xs: T[], n: number) => xs[n % xs.length];

/** someone the agent did not dress: their sex as their face's, the rest from their id */
export function lookFromId(id: string): Drawn {
  const h = hash(id);
  const kid = id.startsWith("c");
  const old = id.startsWith("e");
  const sex: "M" | "F" = kid ? (id === "c01" ? "F" : id === "c02" ? "M" : h % 2 ? "M" : "F")
    : old ? (GRANDPAS.includes(id) ? "M" : GRANDMAS.includes(id) ? "F" : h % 2 ? "M" : "F")
      : faceOf(id)?.sex ?? "F";
  const hair: FigureLook["hair"] = sex === "M" ? "short" : pick(["long", "bun", "short"] as const, h >> 3);
  return {
    sex, hair, age: kid || id === BABY ? "kid" : old ? "old" : "adult",
    hairColor: old ? (h % 3 ? "#c4c4c4" : "#8a8a8a") : pick(["#1e1f24", "#1e1f24", "#5a3a2a"], h >> 5),
    glasses: old ? h % 2 === 0 : h % 5 === 0,
    hat: !kid && !old && h % 7 === 0, hatColor: pick(["#8f3b3b", "#3a4566", "#c9a24a"], h >> 7),
    sleeve: h % 3 ? "short" : "long",
    shirt: pick(FIGURE_SHIRTS, h >> 2),
    bottom: sex === "F" && !old && h % 4 === 1 ? "skirt" : "pants",
    pants: pick(FIGURE_PANTS, h >> 4),
  };
}

/** a pose: angles in degrees, 0 straight down, more toward where the person faces */
export interface Pose {
  /** the body's lean, the head's nod */
  t: number; h: number;
  /** upper arm, forearm, thigh, shin: [back, front] */
  ua: [number, number]; fa: [number, number]; th: [number, number]; sh: [number, number];
  smile?: boolean;
  /** sitting on a chair: the hip is the seat */
  seat?: boolean;
  hold?: "cup" | "coin" | "phone" | "bag";
  /** how far the walk lifts the body */
  bob?: number;
}
export type PoseName = "stand" | "walk" | "think" | "point" | "give" | "cheer" | "slump" | "sit" | "sad" | "wave" | "hand" | "phone";

const W = (p: number) => Math.sin(p * 2 * Math.PI);

/** each pose at time s (seconds), with its own small movement */
export const POSES: Record<PoseName, (s: number) => Pose> = {
  stand: (s) => ({ t: 0.8 * W(s / 3), h: 1.5 * W(s / 4), ua: [-4, 5], fa: [-2, 8], th: [-3, 3], sh: [-3, 3] }),
  walk: (s) => {
    const p = s * 0.95, a = 23 * W(p);
    const th: [number, number] = [-a, a];
    const sh = th.map((x, i) => x - 8 - 16 * Math.max(0, Math.sin((p + (i ? 0.5 : 0) - 0.1) * 2 * Math.PI))) as [number, number];
    const ua: [number, number] = [16 * W(p), -16 * W(p)];
    return { t: 4, h: 2, ua, fa: [ua[0] + 14, ua[1] + 14], th, sh, bob: 3 * Math.abs(Math.cos(p * 2 * Math.PI)) };
  },
  think: (s) => ({ t: 2, h: -10 + 4 * W(s / 3), ua: [8, 60], fa: [92, 212], th: [-3, 3], sh: [-3, 3] }),
  point: (s) => ({ t: 3, h: -4, ua: [-3, 98 + 6 * W(s / 2)], fa: [-1, 118 + 6 * W(s / 2)], th: [-3, 3], sh: [-3, 3], smile: true }),
  give: (s) => ({ t: 8, h: 6, ua: [-2, 58], fa: [2, 86 + 6 * W(s / 1.5)], th: [-4, 4], sh: [-4, 4], hold: "coin" }),
  cheer: (s) => { const b = 10 * W(s * 1.2); return { t: -2, h: -8, ua: [140 + b, 168 - b], fa: [160 + b, 178 - b], th: [-5, 5], sh: [-5, 5], smile: true }; },
  slump: (s) => ({ t: -34, h: -24 + 5 * W(s / 4), ua: [-8, -4], fa: [-6, 0], th: [80, 84], sh: [22, 28], seat: true }),
  sit: (s) => ({ t: 3, h: 4 + 2 * W(s / 3), ua: [12, 18], fa: [72, 76], th: [86, 90], sh: [2, 6], seat: true, smile: true }),
  sad: (s) => ({ t: 8, h: 26 + 2 * W(s / 4), ua: [2, 6], fa: [2, 6], th: [-3, 3], sh: [-3, 3] }),
  wave: (s) => ({ t: 1, h: -3, ua: [-4, 150], fa: [-2, 170 + 18 * W(s * 1.4)], th: [-3, 3], sh: [-3, 3], smile: true }),
  hand: () => ({ t: 2, h: 10, ua: [-3, 24], fa: [-1, 22], th: [-3, 3], sh: [-3, 3], smile: true }),
  phone: (s) => ({ t: 8, h: 18 + 2 * W(s / 3), ua: [10, 34], fa: [80, 150], th: [86, 92], sh: [0, 6], seat: true, hold: "phone" }),
};

/** one pose blended into another, k from 0 to 1 */
export function blend(a: Pose, b: Pose, k: number): Pose {
  const m = (x: number, y: number) => x + (y - x) * k;
  const two = (x: [number, number], y: [number, number]): [number, number] => [m(x[0], y[0]), m(x[1], y[1])];
  return { ...(k < 0.5 ? a : b), t: m(a.t, b.t), h: m(a.h, b.h), ua: two(a.ua, b.ua), fa: two(a.fa, b.fa), th: two(a.th, b.th), sh: two(a.sh, b.sh) };
}

/* ---------- the rig ---------- */

const D = Math.PI / 180;
const SKIN = "#f2d5c6";
const LEN = { thigh: 62, shin: 60, torso: 92, neck: 9, head: 17, upper: 50, fore: 46 };
type P2 = [number, number];
const at = (p: P2, a: number, len: number): P2 => [p[0] + len * Math.sin(a * D), p[1] + len * Math.cos(a * D)];
const rot = (c: P2, v: P2, a: number): P2 => [c[0] + v[0] * Math.cos(a * D) - v[1] * Math.sin(a * D), c[1] + v[0] * Math.sin(a * D) + v[1] * Math.cos(a * D)];
const r1 = (n: number) => Math.round(n * 10) / 10;

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - k)))).toString(16).padStart(2, "0");
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}
export function grey(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const y = 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
  const v = Math.min(255, Math.round(y * 0.85 + 30)).toString(16).padStart(2, "0");
  return `#${v}${v}${v}`;
}

/** the parts of a rig's own height: a standing adult's feet are this far below the hip */
export function footDrop(pose: Pose, kid = false): number {
  const kh = kid ? 0.74 : 1;
  return Math.max(...[0, 1].map((i) => at(at([0, 0], pose.th[i], LEN.thigh * kh), pose.sh[i], LEN.shin * kh)[1])) + 8;
}
/** how far above the hip the top of the head stands, upright */
export const headTop = (kid = false) => LEN.torso * (kid ? 0.74 : 1) + LEN.neck * (kid ? 0.74 : 1) + 2 * LEN.head * (kid ? 1.12 : 1) + 2;

export interface DrawOpts {
  /** where the hip is, how big, which way they face */
  x: number; y: number; s: number; dir?: 1 | -1;
  outline?: string | null;
  /** drawn grey (the crowd before it is covered); `dash`: a grey dashed outline only (someone gone) */
  gray?: boolean;
  dash?: boolean;
}

/** One person, as SVG, facing right (dir -1 mirrors), the hip at (x, y). */
export function person(look: Drawn, pose: Pose, o: DrawOpts, key?: string): ReactNode {
  const parts: ReactNode[] = [];
  let k = 0;
  const kid = look.age === "kid";
  const kh = kid ? 0.74 : 1;
  const dash = Boolean(o.dash);
  const col = (c: string) => (dash ? "none" : o.gray ? grey(c) : c);
  const ol = dash ? "#8b8c90" : o.outline ?? null;
  const olW = dash ? 2.6 : 4.5;
  const dashArray = dash ? "7 6" : undefined;
  const skin = col(SKIN), shirt = col(look.shirt), pants = col(look.pants), shoe = col("#f4f4f2"), hair = col(look.hairColor);
  const sh2 = (c: string, d: number) => (c === "none" ? c : shade(c, d));
  const t = pose.t, h = pose.h, th = t + h;
  const up = (f: number): P2 => [LEN.torso * kh * f * Math.sin(t * D), -LEN.torso * kh * f * Math.cos(t * D)];
  const neck = up(1), sh = up(0.9);
  const n: P2 = [Math.cos(t * D), Math.sin(t * D)];
  const hr = LEN.head * (kid ? 1.12 : 1);
  const hc = rot(neck, [0, -(LEN.neck * kh + hr)], th);
  const H = (v: P2) => rot(hc, v, th);

  const seg = (a: P2, b: P2, w: number, c: string) => {
    // someone gone: their limbs in grey dashes, with gaps that show (a round cap would close them)
    if (ol) parts.push(<line key={k++} x1={r1(a[0])} y1={r1(a[1])} x2={r1(b[0])} y2={r1(b[1])} stroke={ol} strokeWidth={dash ? w * 0.8 : w + olW} strokeLinecap={dash ? "butt" : "round"} strokeDasharray={dashArray} opacity={dash ? 0.6 : 1} fill="none" />);
    if (c !== "none") parts.push(<line key={k++} x1={r1(a[0])} y1={r1(a[1])} x2={r1(b[0])} y2={r1(b[1])} stroke={c} strokeWidth={w} strokeLinecap="round" />);
  };
  const dot = (c: P2, r: number, fill: string, edge = true) => {
    parts.push(<circle key={k++} cx={r1(c[0])} cy={r1(c[1])} r={r1(r)} fill={fill} {...(ol && edge ? { stroke: ol, strokeWidth: 2.2, strokeDasharray: dashArray } : {})} />);
  };
  const poly = (pts: P2[], fill: string, round: number, edge = true) => {
    const d = `M${pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(" L")} Z`;
    if (ol && edge) parts.push(<path key={k++} d={d} fill={dash ? "none" : ol} stroke={ol} strokeWidth={dash ? 2.6 : round + olW} strokeLinejoin="round" strokeDasharray={dashArray} />);
    if (fill !== "none") parts.push(<path key={k++} d={d} fill={fill} stroke={fill} strokeWidth={round} strokeLinejoin="round" />);
  };

  const legs = [0, 1].map((i) => { const knee = at([0, 0], pose.th[i], LEN.thigh * kh); return { knee, ank: at(knee, pose.sh[i], LEN.shin * kh) }; });
  const arms = [0, 1].map((i) => { const el = at(sh, pose.ua[i], LEN.upper * kh); return { el, wr: at(el, pose.fa[i], LEN.fore * kh) }; });
  const skirt = look.bottom === "skirt";
  const LEG = 22 * (kid ? 0.8 : 1), ARM = 16 * (kid ? 0.85 : 1);
  const leg = (i: number) => {
    const d = i === 0 ? 0.14 : 0, { knee, ank } = legs[i];
    if (skirt) { seg([0, 0], knee, LEG * 1.3, sh2(pants, d)); seg(knee, ank, LEG * 0.5, sh2(skin, d)); }
    else { seg([0, 0], knee, LEG, sh2(pants, d)); seg(knee, ank, LEG * 0.92, sh2(pants, d)); }
    seg([ank[0] - 3, ank[1] + 3], [ank[0] + 17 * kh, ank[1] + 3], 10, sh2(shoe, d));
  };
  const arm = (i: number) => {
    const d = i === 0 ? 0.16 : 0.06, { el, wr } = arms[i], long = look.sleeve === "long";
    seg(sh, el, ARM, sh2(shirt, d));
    seg(el, wr, ARM * (long ? 0.92 : 0.72), sh2(long ? shirt : skin, d));
    dot(wr, 6 * kh + 0.5, sh2(skin, d));
  };

  if (look.hair === "long" && !look.hat) {
    const back = H([-hr * 0.92, 0]);
    poly([H([-hr, -hr * 0.4]), [back[0] - 2, back[1] + hr * 2], [back[0] + hr * 0.9, back[1] + hr * 2.1], hc], hair, 6);
  }
  arm(0); leg(0);
  if (!skirt) dot([0, 3], 14 * kh, pants, false);
  leg(1);
  // the shirt hangs a little below the hip and narrows to the waist
  const hem = up(-0.07), wk = 17 * kh, sk = 20 * kh;
  poly([[hem[0] - n[0] * wk, hem[1] - n[1] * wk], [hem[0] + n[0] * wk, hem[1] + n[1] * wk], [sh[0] + n[0] * sk, sh[1] + n[1] * sk], [sh[0] - n[0] * sk, sh[1] - n[1] * sk]], shirt, 12);
  seg(rot(neck, [0, 4], t), rot(neck, [0, -LEN.neck - 2], th), 11 * kh, skin);
  // the head: the hair behind, the face a little forward of it
  dot(hc, hr + 1.6, look.hat ? skin : hair);
  if (!dash) dot(H([2.6, 2.4]), hr - 0.4, skin, false);
  if (look.hair === "bun" && !look.hat) dot(H([-hr * 0.55, -hr]), hr * 0.5, hair);
  if (look.hat) {
    const hat = col(look.hatColor ?? "#8f3b3b");
    poly([H([-hr - 2, 1]), H([-hr * 0.7, -hr * 0.9]), H([0, -hr - 2.5]), H([hr * 0.75, -hr * 0.8]), H([hr + 1.5, -1])], hat, 3);
    seg(H([hr * 0.6, -1.5]), H([hr + 13, 1.5]), 4.5, sh2(hat, 0.15));
  } else if (!dash) {
    poly([H([-hr * 0.25, -hr - 1.6]), H([hr * 0.9, -hr * 0.6]), H([hr * 0.62, -hr * 0.24]), H([0, -hr * 0.55])], hair, 3, false);
  }
  if (!dash && !o.gray) { const c = H([hr * 0.5, hr * 0.42]); parts.push(<ellipse key={k++} cx={r1(c[0])} cy={r1(c[1])} rx={3.6} ry={2.2} fill="#f0a3a0" opacity={0.75} />); }
  if (look.glasses && !dash) {
    const g = H([hr * 0.62, -1.5]), b = H([-hr * 0.05, -2.5]);
    parts.push(<circle key={k++} cx={r1(g[0])} cy={r1(g[1])} r={4.6} fill="none" stroke="#202024" strokeWidth={1.6} />);
    parts.push(<line key={k++} x1={r1(g[0] - 4.6)} y1={r1(g[1])} x2={r1(b[0])} y2={r1(b[1])} stroke="#202024" strokeWidth={1.4} />);
  }
  if (pose.smile && !dash) { const m = H([hr * 0.66, hr * 0.34]); parts.push(<path key={k++} d={`M${r1(m[0] - 3)},${r1(m[1] - 1)} q3,3 6,0`} stroke="#3a2a2a" strokeWidth={1.4} fill="none" />); }
  // what the front hand holds
  const w = arms[1].wr;
  if (!dash) {
    if (pose.hold === "cup") parts.push(<g key={k++} transform={`translate(${r1(w[0])},${r1(w[1])})`}><rect x={-6} y={-17} width={14} height={19} rx={2} fill={col("#7a4d2b")} {...(ol ? { stroke: ol, strokeWidth: 2 } : {})} /><rect x={-8} y={-20} width={18} height={5} rx={2} fill={col("#f1efe9")} /></g>);
    if (pose.hold === "coin") parts.push(<circle key={k++} cx={r1(w[0] + 4)} cy={r1(w[1] + 8)} r={7} fill={col("#e2b24a")} stroke={col("#b8862a")} strokeWidth={1.5} />);
    if (pose.hold === "phone") parts.push(<rect key={k++} x={r1(w[0] - 3)} y={r1(w[1] - 18)} width={11} height={19} rx={2.5} fill="#3b3e48" transform={`rotate(-12 ${r1(w[0])} ${r1(w[1])})`} />);
  }
  arm(1);
  if (pose.hold === "bag" && !dash) {
    const b = arms[0].wr;
    parts.push(<path key={k++} d={`M${r1(b[0] - 8)},${r1(b[1] + 5)} q8,-14 16,0`} fill="none" stroke={col("#3a3a3a")} strokeWidth={2} />);
    parts.push(<rect key={k++} x={r1(b[0] - 13)} y={r1(b[1] + 4)} width={26} height={28} rx={3} fill={col("#efe6d2")} {...(ol ? { stroke: ol, strokeWidth: 2 } : {})} />);
  }
  return <g key={key} transform={`translate(${r1(o.x)},${r1(o.y)}) scale(${o.s * (o.dir ?? 1)},${o.s})`}>{parts}</g>;
}

/** a chair, its seat at (x, y), facing right */
export function chair(x: number, y: number, s: number, g: GroundColors, key?: string): ReactNode {
  const edge = g.outline ? { stroke: g.outline, strokeWidth: 2 } : {};
  return (
    <g key={key} transform={`translate(${r1(x + 4 * s)},${r1(y + 6 * s)}) scale(${s})`}>
      <path d="M-44,-66 Q-50,-26 -38,0 L-30,0 Q-40,-28 -36,-64 Z" fill={g.chair} {...edge} />
      <path d="M-40,-2 L32,-4 L28,8 L-36,10 Z" fill={shade(g.chair, -0.08)} {...edge} />
      <path d="M-32,10 L-40,86 M24,8 L32,84 M-6,10 L-8,90" stroke={g.chairLeg} strokeWidth={3.2} strokeLinecap="round" fill="none" />
    </g>
  );
}

/**
 * A person standing (or sitting) in a box: the box's foot is the ground, and they are as tall as
 * the box allows. The rig is 1 at an adult's height (~230 units, head to toe); a child stands lower.
 * Returns an <svg> the size of the box, for a scene that places it absolutely.
 */
export function Figure({ look, pose, w, h, g, gray, dash, dir, shadow = true }: {
  look: Drawn; pose: Pose; w: number; h: number; g: GroundColors; gray?: boolean; dash?: boolean; dir?: 1 | -1; shadow?: boolean;
}) {
  const kid = look.age === "kid";
  // an adult stands ~230 tall with the arms down; room above for raised arms
  const reach = pose.ua[1] > 120 ? 1.18 : 1;
  const tall = (headTop(false) + footDrop(POSES.stand(0))) * reach;
  const seatH = pose.seat ? 0.86 : 1;
  const s = Math.min(h / (tall * seatH), w / 150);
  const ground = h - 6 * s;
  const hipY = pose.seat ? ground - 96 * s : ground - (footDrop(pose, kid) + (pose.bob ?? 0)) * s;
  const cx = w / 2 + (pose.seat ? 10 * s : 0) * (dir ?? 1);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {shadow && g.shadow !== "rgba(0,0,0,0)" ? <ellipse cx={w / 2} cy={ground + 2 * s} rx={Math.min(w * 0.42, 70 * s)} ry={5 * s} fill={g.shadow} /> : null}
      {pose.seat ? chair(cx - 4 * s * (dir ?? 1), hipY, s, g) : null}
      {person(look, pose, { x: cx, y: hipY, s, dir, outline: g.outline, gray, dash })}
    </svg>
  );
}
