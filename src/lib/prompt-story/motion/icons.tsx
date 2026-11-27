import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import type { MotionIcon } from "../types";
import { ease } from "./ease";

const C = STORY_CLIP_COLORS;

/** one stroke of an icon: gold unless it is the coral accent, at its own width */
type Stroke = { d: string; accent?: true; width?: number };

/**
 * A hook's six icons (ปรอท โรงพยาบาล เงิน หัวใจ โล่ บ้าน), each drawn as the mockup's thermometer is: a few gold strokes
 * and one coral accent in a tall 60×120 box, written in stroke after stroke. The thermometer is the mockup's own.
 */
const ICONS: Record<MotionIcon, Stroke[]> = {
  fever: [
    { d: "M22 78 V18 a8 8 0 0 1 16 0 V78 a17 17 0 1 1 -16 0 Z" },
    { d: "M30 40 V92", accent: true, width: 8 },
    { d: "M44 30 h8 M44 44 h8 M44 58 h8" },
  ],
  hospital: [
    { d: "M10 112 V44 H50 V112 Z" },
    { d: "M30 8 V32 M18 20 H42", accent: true, width: 8 },
    { d: "M19 58 h7 M34 58 h7 M19 74 h7 M34 74 h7 M24 112 V94 H36 V112" },
  ],
  money: [
    { d: "M30 8 a21 21 0 1 1 0 42 a21 21 0 1 1 0 -42 Z" },
    { d: "M26 19 V39 M26 19 h5 a4.5 4.5 0 0 1 0 9 h-5 M26 28 h6 a5.5 5.5 0 0 1 0 11 h-6 M30 15 V43", accent: true, width: 4 },
    { d: "M15 64 h30 a6 6 0 0 1 0 12 h-30 a6 6 0 0 1 0 -12 Z M15 80 h30 a6 6 0 0 1 0 12 h-30 a6 6 0 0 1 0 -12 Z M15 96 h30 a6 6 0 0 1 0 12 h-30 a6 6 0 0 1 0 -12 Z" },
  ],
  heart: [
    { d: "M30 58 C12 46 6 34 12 24 C17 15 27 15 30 24 C33 15 43 15 48 24 C54 34 48 46 30 58 Z" },
    { d: "M4 88 H18 L24 74 L32 104 L38 88 H56", accent: true, width: 6 },
  ],
  shield: [
    { d: "M30 10 L52 20 V54 C52 80 42 98 30 110 C18 98 8 80 8 54 V20 Z" },
    { d: "M18 58 L27 68 L43 46", accent: true, width: 7 },
  ],
  home: [
    { d: "M6 64 L30 40 L54 64 M12 58 V110 H48 V58" },
    { d: "M40 50 V32 H48 V58" },
    { d: "M30 98 C20 90 16 84 19 79 C21 75 27 75 30 80 C33 75 39 75 41 79 C44 84 40 90 30 98 Z", accent: true, width: 5 },
  ],
};

/** the icon at scene time t, its strokes written in one after another from 0.2 s */
export function MotionIconSvg({ icon, t, w, h }: { icon: MotionIcon; t: number; w: number; h: number }) {
  return (
    <svg viewBox="0 0 60 120" width={w} height={h} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[icon].map((s, i) => (
        <path key={i} d={s.d} pathLength={1} strokeDasharray={1} strokeDashoffset={Math.round((1 - ease((t - 0.2 - i * 0.25) / 0.7)) * 1000) / 1000}
          stroke={s.accent ? C.mgCoral : C.mgGold} strokeWidth={s.width ?? 5} />
      ))}
    </svg>
  );
}

/** a check mark written in: the check list's ticks, and its badge when it has no photo */
export function tickPath(t: number, start: number, dur = 0.3) {
  return Math.round((1 - ease((t - start) / dur)) * 1000) / 1000;
}
