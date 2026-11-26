import type { VideoSize } from "@/lib/quote-video/timeline";

/**
 * Where every piece of โมชันกราฟิก stands, in px of the real frame (portrait 1080×1920, square 1080×1080, landscape
 * 1920×1080): the mockup's tables (ข round 2: HOOK, CARD, NUM, CMP, CHECK, CONTACT, its .sub, .bars and .wipe), whose
 * em is 30 px, multiplied out. `full` and the figure card are not in the mockup: placed as the spec and the
 * controller describe them. A later tweak of the look is made here.
 */

export type Rect = { x: number; y: number; w: number; h: number };
/** a piece sized by its words: its left or right edge and its top */
export type Spot = { left?: number; right?: number; top: number };

export interface MotionGeo {
  /** the icon's box (drawn tilted 12°), the headline's box and its lines' type sizes, first line to last */
  hook: { icon: Rect; head: Rect; fs: number[]; left: boolean };
  /** the tag over the picture card, the card, its two chips (type size, tilt), and where the card flies in from */
  card: { tag: Rect; tagFs: number; card: Rect; c1: Spot; c2: Spot; cf: number; r: [number, number]; left: boolean; from: { dx: number; dy: number; rot: number } };
  /** the tag, big figure and unit's box, their sizes, the bill card, its type size and where it flies in from */
  number: { head: Rect; tagFs: number; big: number; unit: number; rc: Rect; rf: number; left: boolean; from: { dx: number; dy: number } };
  /** the title, the two sides, the VS disc's centre and size, the sides' type size and where they fly in from */
  compare: { title: Rect; tf: number; A: Rect; B: Rect; vs: { x: number; y: number; d: number }; cf: number; dx: [number, number] };
  /** the round photo, the headline, the three ticks' rows (their left and width, the first's top, the step) and type size */
  check: { ph: Rect; head: Rect; fs: number[]; ticks: { x: number; w: number }; top: number; gap: number; tf: number; left: boolean };
  /** the full-bleed picture's headline */
  full: { head: Rect; fs: number[]; left: boolean };
  /** the figure card: the area it is centred in, its width, its big line and other lines' type sizes */
  figure: { area: Rect; w: number; big: number; line: number };
  /** the closing card: the heading (kicker, two lines' sizes), the agent's card and where it flies in from */
  contact: { head: Rect; fs: [number, number, number]; ag: { x: number; y: number; w: number }; af: number; left: boolean; from: { dx: number; dy: number } };
  /** the subtitle: its bottom edge, type size and the band's widest */
  sub: { bottom: number; fs: number; maxWidth: number };
}

export const GEO: Record<VideoSize, MotionGeo> = {
  portrait: {
    hook: { icon: { x: 816, y: 180, w: 162, h: 324 }, head: { x: 48, y: 510, w: 984, h: 780 }, fs: [90, 108, 138], left: false },
    card: { tag: { x: 0, y: 126, w: 1080, h: 72 }, tagFs: 37.5, card: { x: 135, y: 246, w: 810, h: 900 }, c1: { left: 78, top: 1080 }, c2: { right: 72, top: 1182 }, cf: 46.5, r: [-5, 4], left: false, from: { dx: 0, dy: 300, rot: 8 } },
    number: { head: { x: 60, y: 165, w: 960, h: 540 }, tagFs: 37.5, big: 198, unit: 78, rc: { x: 210, y: 810, w: 660, h: 510 }, rf: 30, left: false, from: { dx: 0, dy: 360 } },
    compare: { title: { x: 60, y: 192, w: 960, h: 150 }, tf: 87, A: { x: 60, y: 396, w: 960, h: 402 }, B: { x: 60, y: 900, w: 960, h: 402 }, vs: { x: 540, y: 849, d: 140 }, cf: 34.5, dx: [-420, 420] },
    check: { ph: { x: 375, y: 180, w: 330, h: 330 }, head: { x: 60, y: 552, w: 960, h: 300 }, fs: [84, 114], ticks: { x: 66, w: 948 }, top: 912, gap: 162, tf: 49.5, left: false },
    full: { head: { x: 48, y: 150, w: 984, h: 420 }, fs: [84, 108], left: false },
    figure: { area: { x: 0, y: 300, w: 1080, h: 1200 }, w: 900, big: 66, line: 46 },
    contact: { head: { x: 48, y: 270, w: 984, h: 450 }, fs: [43.5, 93, 75], ag: { x: 66, y: 840, w: 948 }, af: 33.6, left: false, from: { dx: 0, dy: 180 } },
    sub: { bottom: 138, fs: 48, maxWidth: 960 },
  },
  square: {
    hook: { icon: { x: 924, y: 114, w: 84, h: 168 }, head: { x: 60, y: 165, w: 960, h: 630 }, fs: [57, 69, 87], left: false },
    card: { tag: { x: 0, y: 99, w: 1080, h: 66 }, tagFs: 37.5, card: { x: 300, y: 189, w: 480, h: 555 }, c1: { left: 102, top: 636 }, c2: { right: 102, top: 723 }, cf: 39, r: [-5, 4], left: false, from: { dx: 0, dy: 300, rot: 8 } },
    number: { head: { x: 60, y: 180, w: 570, h: 570 }, tagFs: 37.5, big: 132, unit: 60, rc: { x: 660, y: 210, w: 360, h: 450 }, rf: 21.6, left: true, from: { dx: 300, dy: 120 } },
    compare: { title: { x: 60, y: 96, w: 960, h: 102 }, tf: 57, A: { x: 90, y: 222, w: 900, h: 282 }, B: { x: 90, y: 570, w: 900, h: 282 }, vs: { x: 540, y: 537, d: 140 }, cf: 23.4, dx: [-360, 360] },
    check: { ph: { x: 72, y: 120, w: 210, h: 210 }, head: { x: 324, y: 114, w: 696, h: 228 }, fs: [54, 75], ticks: { x: 72, w: 936 }, top: 396, gap: 123, tf: 37.5, left: true },
    full: { head: { x: 60, y: 70, w: 960, h: 300 }, fs: [60, 78], left: false },
    figure: { area: { x: 0, y: 120, w: 1080, h: 760 }, w: 840, big: 52, line: 38 },
    contact: { head: { x: 60, y: 99, w: 960, h: 300 }, fs: [31.5, 66, 51], ag: { x: 150, y: 450, w: 780 }, af: 24, left: false, from: { dx: 0, dy: 180 } },
    sub: { bottom: 63, fs: 40.5, maxWidth: 960 },
  },
  landscape: {
    hook: { icon: { x: 1485, y: 210, w: 195, h: 390 }, head: { x: 150, y: 120, w: 1200, h: 750 }, fs: [69, 87, 114], left: true },
    card: { tag: { x: 960, y: 210, w: 780, h: 72 }, tagFs: 37.5, card: { x: 210, y: 126, w: 600, h: 732 }, c1: { left: 960, top: 336 }, c2: { left: 960, top: 486 }, cf: 63, r: [-2, 2], left: true, from: { dx: -360, dy: 0, rot: -6 } },
    number: { head: { x: 150, y: 135, w: 900, h: 660 }, tagFs: 37.5, big: 222, unit: 84, rc: { x: 1170, y: 165, w: 570, h: 570 }, rf: 30, left: true, from: { dx: 300, dy: 120 } },
    compare: { title: { x: 120, y: 102, w: 1680, h: 120 }, tf: 72, A: { x: 120, y: 276, w: 750, h: 450 }, B: { x: 1050, y: 276, w: 750, h: 450 }, vs: { x: 960, y: 501, d: 140 }, cf: 30, dx: [-480, 480] },
    check: { ph: { x: 150, y: 138, w: 285, h: 285 }, head: { x: 150, y: 462, w: 750, h: 270 }, fs: [69, 96], ticks: { x: 960, w: 840 }, top: 180, gap: 162, tf: 45, left: true },
    full: { head: { x: 120, y: 80, w: 1100, h: 360 }, fs: [72, 96], left: true },
    figure: { area: { x: 0, y: 120, w: 1920, h: 760 }, w: 1200, big: 66, line: 46 },
    contact: { head: { x: 150, y: 180, w: 810, h: 480 }, fs: [37.5, 78, 63], ag: { x: 1020, y: 240, w: 750 }, af: 30, left: true, from: { dx: 240, dy: 0 } },
    sub: { bottom: 63, fs: 40.5, maxWidth: 1400 },
  },
};

/** the progress bar along the top (the mockup's .bars): its side margin, top, gap between segments and thickness */
export const BARS = { side: 48, top: 42, gap: 10.5, h: 6 };
/** the gold edge riding the wipe between scenes (.wipe) */
export const WIPE_W = 15;
/** the dot grid on the cream ground, a dot every 1.6em */
export const DOT_STEP = 48;
