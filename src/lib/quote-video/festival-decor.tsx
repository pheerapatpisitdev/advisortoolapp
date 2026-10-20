import type { ReactNode } from "react";
import { FESTIVAL_DECOR as D, VIDEO_FESTIVAL_COLORS } from "@/lib/card-theme";
import type { FestivalKey } from "./festival";

/**
 * ธีมเทศกาล's moving decorations and greeting (owner, 2026-10-20, idea 1 on
 * https://claude.ai/artifact/MsvkeeeepPz4XG4TDvhN9n): drawn by Remotion at every frame of the clip,
 * the decorations over the ground and under the scene, the greeting over everything in a strip the
 * scenes leave empty — above the header on a portrait clip, at the foot's right on a wide one.
 * Positions are fractions of the frame, so every shape scales with it.
 */

const TAU = Math.PI * 2;
/** a repeating 0 → 1 over `period` seconds, started `delay` seconds late */
const cycle = (t: number, period: number, delay = 0) => (((t - delay) % period) + period) % period / period;

function fireworks(t: number, w: number, h: number) {
  const r = Math.min(w, h);
  const bursts = [[0.18, 0.13, 0], [0.82, 0.09, 0.7], [0.62, 0.24, 1.4], [0.3, 0.3, 2]] as const;
  return bursts.flatMap(([x, y, delay], b) => {
    const q = cycle(t, 2.6, delay) / 0.7;
    if (q > 1) return [];
    const reach = (1 - (1 - q) * (1 - q)) * r * 0.09;
    return Array.from({ length: 16 }, (_, k) => {
      const ang = (k / 16) * TAU + b;
      return <circle key={`${b}-${k}`} cx={x * w + Math.cos(ang) * reach} cy={y * h + Math.sin(ang) * reach + q * q * r * 0.02} r={r * 0.005} fill={k % 2 ? D.gold : D.white} opacity={1 - q} />;
    });
  });
}

function lanterns(t: number, w: number, h: number) {
  const r = Math.min(w, h) * 0.05;
  // the body hangs below the header's line (portrait 70–115, wide 40–75), its string behind it
  const top = (h > w ? 135 : 85) * (Math.min(w, h) / 1080);
  return [0.07, 0.93].map((x, i) => (
    <g key={i} transform={`translate(${x * w} 0) rotate(${Math.sin(t * 2 + i) * 5})`}>
      <line x1={0} y1={0} x2={0} y2={top} stroke={D.lanternGold} strokeWidth={r * 0.06} />
      <rect x={-r * 0.45} y={top} width={r * 0.9} height={r * 0.22} fill={D.lanternGold} />
      <ellipse cx={0} cy={top + r * 1.25} rx={r} ry={r * 1.15} fill={D.lantern} stroke={D.lanternGold} strokeWidth={r * 0.08} />
      <rect x={-r * 0.45} y={top + r * 2.3} width={r * 0.9} height={r * 0.22} fill={D.lanternGold} />
      <line x1={0} y1={top + r * 2.5} x2={0} y2={top + r * 3.2} stroke={D.lanternGold} strokeWidth={r * 0.1} />
    </g>
  ));
}

const flower = (key: string, x: number, y: number, size: number, petal: string, heart: string, turn = 0) => (
  <g key={key} transform={`translate(${x} ${y}) rotate(${turn})`}>
    {[0, 1, 2, 3, 4].map((k) => <circle key={k} cx={Math.cos((k / 5) * TAU) * size} cy={Math.sin((k / 5) * TAU) * size} r={size * 0.75} fill={petal} />)}
    <circle r={size * 0.55} fill={heart} />
  </g>
);

function water(t: number, w: number, h: number) {
  const r = Math.min(w, h);
  const drops = Array.from({ length: 18 }, (_, i) => {
    const x = ((i * 0.137 + 0.05) % 0.95) * w;
    const y = cycle(t, 3.2, i * 0.29) * (h + r * 0.1) - r * 0.05;
    const s = r * 0.012;
    return <path key={i} d={`M${x} ${y - s * 1.6} Q${x + s} ${y} ${x} ${y + s * 0.6} Q${x - s} ${y} ${x} ${y - s * 1.6} Z`} fill={D.drop} opacity={0.5} />;
  });
  // clear of the header (top) and the subtitle (foot)
  const flowers = [[0.06, 0.8], [0.94, 0.15], [0.92, 0.84]].map(([x, y], i) => flower(`f${i}`, x * w, y * h, r * 0.025, D.petal, D.petalHeart, t * 20 + i * 40));
  return [...drops, ...flowers];
}

function jasmine(t: number, w: number, h: number) {
  const r = Math.min(w, h);
  return Array.from({ length: 12 }, (_, i) => {
    const x = ((i * 0.173 + 0.07) % 0.93) * w + Math.sin(t + i) * r * 0.02;
    const y = cycle(t, 7, i * 0.6) * (h + r * 0.1) - r * 0.05;
    return flower(`j${i}`, x, y, r * 0.012, D.jasmine, D.jasmineHeart, t * 30 + i * 25);
  });
}

function krathongs(t: number, w: number, h: number) {
  const r = Math.min(w, h);
  // the moon under the header's right end
  const my = h > w ? h * 0.15 : h * 0.24;
  const moon = <g key="moon"><circle cx={w * 0.86} cy={my} r={r * 0.11} fill={D.moon} opacity={0.18} /><circle cx={w * 0.86} cy={my} r={r * 0.07} fill={D.moon} /></g>;
  const stars = Array.from({ length: 14 }, (_, i) => (
    <circle key={`s${i}`} cx={((i * 0.29 + 0.03) % 0.97) * w} cy={((i * 0.17 + 0.02) % 0.32) * h} r={r * 0.004} fill={D.white} opacity={0.35 + 0.35 * Math.sin(t * 3 + i)} />
  ));
  const boats = [0, 1, 2].map((i) => {
    const x = (cycle(t, 14, i * 4.7) * 1.3 - 0.15) * w;
    const y = h * (0.8 + i * 0.03) + Math.sin(t * 2 + i) * r * 0.004;
    const s = r * 0.035;
    return (
      <g key={`k${i}`} transform={`translate(${x} ${y})`}>
        <ellipse cx={0} cy={0} rx={s * 1.6} ry={s * 0.45} fill={D.leaf} />
        {[-1, 0, 1].map((k) => <path key={k} d={`M${k * s * 0.7 - s * 0.35} 0 L${k * s * 0.7} ${-s * 0.9} L${k * s * 0.7 + s * 0.35} 0 Z`} fill={D.leaf} />)}
        <rect x={-s * 0.06} y={-s * 1.5} width={s * 0.12} height={s * 0.7} fill={D.white} />
        <ellipse cx={0} cy={-s * 1.65} rx={s * 0.13} ry={s * (0.24 + 0.05 * Math.sin(t * 9 + i))} fill={D.flame} />
      </g>
    );
  });
  return [moon, ...stars, ...boats];
}

function cannas(t: number, w: number, h: number) {
  const r = Math.min(w, h);
  const plants = [[0.07, 0.97], [0.93, 0.97]].map(([x, y], i) => (
    <g key={i} transform={`translate(${x * w} ${y * h}) rotate(${Math.sin(t * 1.5 + i) * 4})`}>
      <path d={`M0 0 Q${r * 0.02} ${-r * 0.12} 0 ${-r * 0.22}`} stroke={D.leaf} strokeWidth={r * 0.012} fill="none" />
      <path d={`M0 ${-r * 0.06} Q${r * 0.07} ${-r * 0.12} ${r * 0.05} ${-r * 0.2} Q${r * 0.01} ${-r * 0.12} 0 ${-r * 0.06} Z`} fill={D.leaf} />
      {[0, 1, 2].map((k) => <ellipse key={k} cx={(k - 1) * r * 0.025} cy={-r * 0.24} rx={r * 0.022} ry={r * 0.045} fill={k === 1 ? D.cannaDeep : D.canna} transform={`rotate(${(k - 1) * 30} ${(k - 1) * r * 0.025} ${-r * 0.24})`} />)}
    </g>
  ));
  const sparks = Array.from({ length: 10 }, (_, i) => {
    const q = cycle(t, 5, i * 0.5);
    return <circle key={`p${i}`} cx={((i * 0.31 + 0.08) % 0.9) * w} cy={h * (0.95 - q * 0.5)} r={r * 0.006} fill={D.canna} opacity={(1 - q) * 0.8} />;
  });
  return [...plants, ...sparks];
}

const DRAW: Record<FestivalKey, (t: number, w: number, h: number) => ReactNode[]> = {
  newyear: fireworks, cny: lanterns, songkran: water, mother: jasmine, loykrathong: krathongs, father: cannas,
};

/** the decorations at clip time t, over the ground and under the scene */
export function festivalBack(key: FestivalKey, t: number, w: number, h: number): ReactNode {
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: 0, top: 0 }}>{DRAW[key](t, w, h)}</svg>;
}

/** the greeting, over the scene: above the header on a portrait clip, at the foot's right on a wide one */
export function festivalFront(key: FestivalKey, greeting: string, w: number, h: number): ReactNode {
  const p = VIDEO_FESTIVAL_COLORS[key];
  const portrait = h > w;
  return (
    <div style={{
      position: "absolute", display: "flex", justifyContent: portrait ? "center" : "flex-end",
      left: 0, width: w, ...(portrait ? { top: 8 } : { bottom: 8 }), paddingRight: portrait ? 0 : 24,
    }}>
      <div style={{ display: "flex", background: p.fill, color: p.onFill, borderRadius: 30, padding: portrait ? "4px 30px" : "2px 20px", fontFamily: "Plex", fontSize: portrait ? 30 : 22, fontWeight: 600 }}>{greeting}</div>
    </div>
  );
}
