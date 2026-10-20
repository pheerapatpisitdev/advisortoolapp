import { QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import { ICON_AT } from "./fx";
import { W } from "./timeline";

/**
 * ลูกเล่นคลิปใหม่'s moving icons (fx.ts; owner chose ก, ไอคอนวาดเองในโค้ด, 2026-10-20): one a scene, bottom right above
 * the subtitles, in the scenes that have no picture of their own. Not top right, where it was tried first: a long
 * headline (PLB's, Global Savings', an English one) runs into it, and the bottom right is empty in every product's
 * scenes that get one (checked on stills of each); น้องโล่ keeps the bottom left. Drawn in motion.tsx's own colours so a theme repaints them as it
 * repaints the frame (themes.tsx themed). Portrait clips only: the square and landscape frames are laid out
 * otherwise, and nothing was checked there.
 */

export type FxIconKind = "home" | "hospital" | "heart" | "calendar" | "growth" | "phone" | "checklist";

const NAVY = C.motionNavy;
const GOLD = C.motionGold;
const SKY = C.motionSky;
const RED = C.motionRed;
const GREEN = C.motionGreen;
const WHITE = C.paper;

/** the icon a scene gets, by the product (absent = Life Protect) and the scene; none where the scene draws its own picture */
export function iconFor(product: string | undefined, scene: string): FxIconKind | null {
  if (scene === "contact" || scene === "fhcContact") return "phone";
  if (scene === "terms") return "checklist";
  if (scene !== "cover") return null;
  switch (product) {
    case "IHEALTHY": return "hospital";
    case "ISHIELD": return "heart";
    case "PENSION": return "calendar";
    case "GSAVING": return "growth";
    default: return "home";
  }
}

/** when an icon pops in, in scene seconds */
export const ICON_POP = ICON_AT;

const SIZE = 170;
/** the box's top: its foot clears the subtitle band (motion.tsx Subtitle, bottom 96) with room for two lines */
const TOP = 1440;
const ramp = (x: number) => Math.max(0, Math.min(1, x));
const easeBack = (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
/** a beat once a second, from `from` on: 1, then a quick swell and back */
const beat = (t: number, from: number) => (t > from ? 1 + 0.14 * Math.max(0, Math.sin(((t - from) % 1) * Math.PI * 2)) ** 3 : 1);
/** a ring every 1.2 s: the phone shakes for the first third of it */
const shake = (t: number) => { const ph = (t % 1.2) / 1.2; return t > 0.9 && ph < 0.35 ? Math.sin((ph / 0.35) * Math.PI * 6) * 14 : 0; };

/** the icon at scene time t, placed bottom right of a portrait frame; null before it pops in */
export function fxIcon(kind: FxIconKind, t: number) {
  const q = ramp((t - ICON_POP) / 0.55);
  if (q <= 0) return null;
  const scale = 0.3 + 0.7 * easeBack(q);
  return (
    <div style={{ display: "flex", position: "absolute", left: W - 64 - SIZE, top: TOP, width: SIZE, height: SIZE, opacity: ramp(q * 2), transform: `scale(${scale.toFixed(3)})` }}>
      <svg width={SIZE} height={SIZE} viewBox="0 0 120 120">{drawn(kind, t)}</svg>
    </div>
  );
}

function drawn(kind: FxIconKind, t: number) {
  switch (kind) {
    case "home": {
      const b = beat(t, 1);
      return (
        <>
          <path d="M18 58 L60 22 L102 58" fill="none" stroke={GOLD} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          <rect x={30} y={54} width={60} height={50} rx={6} fill={NAVY} stroke={GOLD} strokeWidth={6} />
          <path transform={`translate(60 76) scale(${b.toFixed(3)}) translate(-60 -76)`} d="M60 92 C40 78 44 62 52 62 C56 62 59 65 60 68 C61 65 64 62 68 62 C76 62 80 78 60 92 Z" fill={RED} />
        </>
      );
    }
    case "hospital": {
      // the building, then its cross turning green to gold, a light on the roof blinking
      const blink = Math.floor(t * 2) % 2 === 0 ? 1 : 0.35;
      return (
        <>
          <rect x={24} y={34} width={72} height={70} rx={6} fill={NAVY} stroke={GOLD} strokeWidth={6} />
          <rect x={50} y={80} width={20} height={24} rx={2} fill={GOLD} />
          <path d="M60 46 V68 M49 57 H71" stroke={WHITE} strokeWidth={8} strokeLinecap="round" />
          <circle cx={60} cy={22} r={6} fill={RED} opacity={blink} />
        </>
      );
    }
    case "heart": {
      // a heart with a pulse line running across it
      const p = (t % 1.4) / 1.4;
      const b = beat(t, 0.9);
      return (
        <>
          <path transform={`translate(60 62) scale(${b.toFixed(3)}) translate(-60 -62)`} d="M60 104 C20 78 16 50 34 36 C46 27 56 32 60 42 C64 32 74 27 86 36 C104 50 100 78 60 104 Z" fill={RED} />
          <path d="M14 64 H40 L48 50 L58 80 L66 58 L72 64 H106" fill="none" stroke={WHITE} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="160 160" strokeDashoffset={Math.round(160 * (1 - p))} />
        </>
      );
    }
    case "calendar": {
      // a calendar whose pages turn: the month marked off one after another
      const n = Math.floor(Math.max(0, t - 0.9) * 2.5) % 9;
      return (
        <>
          <rect x={20} y={28} width={80} height={76} rx={8} fill={WHITE} stroke={GOLD} strokeWidth={6} />
          <rect x={20} y={28} width={80} height={20} rx={8} fill={GOLD} />
          <path d="M38 20 V36 M82 20 V36" stroke={NAVY} strokeWidth={6} strokeLinecap="round" />
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={i} cx={38 + (i % 3) * 22} cy={62 + Math.floor(i / 3) * 14} r={4.5} fill={i <= n ? GREEN : SKY} opacity={i <= n ? 1 : 0.35} />
          ))}
        </>
      );
    }
    case "growth": {
      // three bars rising and an arrow going up over them
      const g = ramp((t - 0.6) / 1.2);
      const bars = [0.45, 0.7, 1].map((h, i) => {
        const height = Math.round(60 * h * ramp(g * 1.6 - i * 0.3));
        return <rect key={i} x={24 + i * 26} y={100 - height} width={18} height={height} rx={3} fill={i === 2 ? GOLD : SKY} />;
      });
      return (
        <>
          {bars}
          <path d="M20 78 L48 58 L64 66 L98 30" fill="none" stroke={GREEN} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="120 120" strokeDashoffset={Math.round(120 * (1 - g))} />
          <path d="M84 28 H100 V44" fill="none" stroke={GREEN} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={g >= 1 ? 1 : 0} />
        </>
      );
    }
    case "checklist": {
      // a clipboard ticked down, one line after another
      const n = Math.floor(Math.max(0, t - 0.8) / 0.5);
      return (
        <>
          <rect x={26} y={20} width={68} height={88} rx={8} fill={WHITE} stroke={GOLD} strokeWidth={6} />
          <rect x={46} y={12} width={28} height={14} rx={4} fill={GOLD} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <path d={`M36 ${48 + i * 20} l6 6 l10 -12`} fill="none" stroke={GREEN} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={i < n ? 1 : 0} />
              <rect x={58} y={46 + i * 20} width={26} height={6} rx={3} fill={NAVY} opacity={0.55} />
            </g>
          ))}
        </>
      );
    }
    case "phone": {
      const ring = shake(t);
      const wave = (d: number) => { const x = ((t + d) % 1.2) / 1.2; return { r: 30 + 30 * x, o: t > 0.9 ? 0.9 * (1 - x) : 0 }; };
      return (
        <>
          {[0, 0.6].map((d) => { const v = wave(d); return <circle key={d} cx={60} cy={60} r={v.r} fill="none" stroke={GOLD} strokeWidth={4} opacity={v.o} />; })}
          <g transform={`rotate(${ring.toFixed(1)} 60 60)`}>
            <rect x={40} y={22} width={40} height={76} rx={9} fill={NAVY} stroke={GOLD} strokeWidth={6} />
            <rect x={47} y={32} width={26} height={46} rx={3} fill={SKY} />
            <circle cx={60} cy={88} r={4} fill={GOLD} />
          </g>
        </>
      );
    }
  }
}
