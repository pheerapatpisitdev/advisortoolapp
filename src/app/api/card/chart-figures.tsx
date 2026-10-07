import type { ChartFigure, FigureKind } from "@/lib/chart-figures";
import { CARD_PALETTE, FIGURE_COLORS } from "@/lib/card-theme";

/**
 * The little people on a chat's value table, drawn as SVG shapes.
 *
 * Written out here rather than handed over as a picture, for the reason chart-drawing.tsx gives:
 * the drawing library silently drops an <img> holding an SVG data URI. Nor are they <use>d from
 * a <defs>, which the library's serialiser cannot be relied on to carry.
 *
 * Each is drawn in its own units with the feet at the origin and the head about 100 units up at
 * most, so that a figure is placed by translating to where it stands and scaling it. Their
 * clothes take the card's navy, sand, olive and yellow; skin, hair and the rest are
 * FIGURE_COLORS, held in card-theme.ts with the other colours a drawing needs.
 */
const F = FIGURE_COLORS;
const SKIN = F.skin;
const HAIR = F.hair;
const BLUSH = F.blush;
const GREY = F.grey;
/** the palette's own: navy is the figure colour, olive the accent, sand the cover line, yellow the highlighter */
const NAVY = CARD_PALETTE.figure;
const SAND = CARD_PALETTE.line.cover;
const OLIVE = CARD_PALETTE.accent;
const YELLOW = CARD_PALETTE.highlighter;

/**
 * Everything below is a plain function that is called, and every group is a <g>: the drawing
 * library writes an <svg>'s children out as markup itself, and it neither calls a component
 * placed among them nor reads a fragment — either one blanks the whole drawing, lines and all.
 */

/** the soft shadow every figure stands in */
const shadow = (rx: number) => <ellipse cx={0} cy={1} rx={rx} ry={3.5} fill={HAIR} opacity={0.12} />;

const smile = (y: number) => (
  <path d={`M-4,${y} q4,4 8,0`} fill="none" stroke={HAIR} strokeWidth={1.7} strokeLinecap="round" />
);

const eyes = (y: number, dx = 5) => (
  <g>
    <circle cx={-dx} cy={y} r={1.9} fill={HAIR} />
    <circle cx={dx} cy={y} r={1.9} fill={HAIR} />
  </g>
);

const glasses = (y: number, dx: number, r: number) => (
  <g>
    <circle cx={-dx} cy={y} r={r} fill="none" stroke={HAIR} strokeWidth={1.5} />
    <circle cx={dx} cy={y} r={r} fill="none" stroke={HAIR} strokeWidth={1.5} />
    <path d={`M-1,${y} h2`} stroke={HAIR} strokeWidth={1.5} />
    <circle cx={-dx} cy={y} r={1.5} fill={HAIR} />
    <circle cx={dx} cy={y} r={1.5} fill={HAIR} />
  </g>
);

function Kid() {
  return (
    <g>
      {shadow(17)}
      <rect x={-8} y={-14} width={5.5} height={13} rx={2} fill={SKIN} />
      <rect x={2.5} y={-14} width={5.5} height={13} rx={2} fill={SKIN} />
      <ellipse cx={-5.5} cy={-1} rx={6} ry={3} fill={NAVY} />
      <ellipse cx={5.5} cy={-1} rx={6} ry={3} fill={NAVY} />
      <rect x={-11} y={-31} width={22} height={19} rx={6} fill={YELLOW} />
      <rect x={-11} y={-17} width={22} height={7} fill={NAVY} />
      <circle cx={0} cy={-46} r={16} fill={SKIN} />
      <path d="M-16,-48 a16,16 0 0 1 32,0 q-6,-8 -16,-6 q-10,-2 -16,6z" fill={HAIR} />
      <circle cx={-5.5} cy={-45} r={2} fill={HAIR} />
      <circle cx={5.5} cy={-45} r={2} fill={HAIR} />
      <circle cx={-9} cy={-40} r={2.8} fill={BLUSH} opacity={0.7} />
      <circle cx={9} cy={-40} r={2.8} fill={BLUSH} opacity={0.7} />
      <path d="M-4,-39 q4,4.5 8,0" fill="none" stroke={HAIR} strokeWidth={1.8} strokeLinecap="round" />
    </g>
  );
}

function Teen() {
  return (
    <g>
      {shadow(19)}
      <rect x={-18} y={-62} width={8} height={26} rx={3} fill={OLIVE} />
      <rect x={-8} y={-30} width={7} height={29} rx={2.5} fill={F.denim} />
      <rect x={1} y={-30} width={7} height={29} rx={2.5} fill={F.denim} />
      <ellipse cx={-5} cy={-1} rx={7} ry={3.2} fill={F.white} stroke={F.edge} />
      <ellipse cx={6} cy={-1} rx={7} ry={3.2} fill={F.white} stroke={F.edge} />
      <rect x={-13} y={-62} width={26} height={34} rx={9} fill={NAVY} />
      <path d="M-6,-62 q6,6 12,0" fill="none" stroke={SAND} strokeWidth={2} />
      <rect x={-17} y={-58} width={5.5} height={22} rx={2.7} fill={NAVY} />
      <rect x={11.5} y={-58} width={5.5} height={22} rx={2.7} fill={NAVY} />
      <circle cx={0} cy={-77} r={14} fill={SKIN} />
      <circle cx={13} cy={-76} r={5.5} fill={HAIR} />
      <path d="M-14.5,-78 a14.5,14.5 0 0 1 29,0 q-8,-9 -29,0z" fill={HAIR} />
      {eyes(-76)}
      {smile(-70)}
    </g>
  );
}

/** the father: the working-age family's tall one, in a suit with a yellow tie */
function Adult() {
  return (
    <g>
      {shadow(20)}
      <rect x={-9} y={-38} width={8} height={37} rx={2.5} fill={F.suit} />
      <rect x={1} y={-38} width={8} height={37} rx={2.5} fill={F.suit} />
      <ellipse cx={-5.5} cy={-1} rx={7.5} ry={3} fill={HAIR} />
      <ellipse cx={5.5} cy={-1} rx={7.5} ry={3} fill={HAIR} />
      <rect x={-14} y={-75} width={28} height={40} rx={7} fill={NAVY} />
      <path d="M-5.5,-75 L0,-60 L5.5,-75z" fill={F.white} />
      <path d="M0,-72 l-2.2,4 2.2,11 2.2,-11z" fill={YELLOW} />
      <rect x={13} y={-68} width={6} height={26} rx={3} fill={NAVY} />
      <circle cx={0} cy={-90} r={14.5} fill={SKIN} />
      <path d="M-14.5,-92 a14.5,14.5 0 0 1 29,0 q-14,-8 -29,0z" fill={HAIR} />
      {eyes(-89)}
      {smile(-83)}
    </g>
  );
}

function Mom() {
  return (
    <g>
      {shadow(19)}
      <path d="M-12,-76 q-6,20 -2,40 h28 q4,-20 -2,-40z" fill={HAIR} />
      <rect x={-6.5} y={-30} width={5.5} height={29} rx={2.5} fill={SKIN} />
      <rect x={1} y={-30} width={5.5} height={29} rx={2.5} fill={SKIN} />
      <ellipse cx={-4} cy={-1} rx={6.5} ry={3} fill={F.heel} />
      <ellipse cx={4.5} cy={-1} rx={6.5} ry={3} fill={F.heel} />
      <path d="M-10,-52 L-17,-24 H17 L10,-52z" fill={F.denim} />
      <rect x={-11} y={-75} width={22} height={26} rx={8} fill={F.denim} />
      <path d="M-7,-75 q7,7 14,0" fill="none" stroke={SAND} strokeWidth={3} />
      <rect x={-16} y={-70} width={5.5} height={22} rx={2.7} fill={F.denim} />
      <rect x={10.5} y={-70} width={5.5} height={22} rx={2.7} fill={F.denim} />
      <circle cx={0} cy={-90} r={14} fill={SKIN} />
      <path d="M-14.5,-91 a14.5,14.5 0 0 1 29,0 q-6,-9 -14.5,-8 q-9,-1 -14.5,8z" fill={HAIR} />
      {eyes(-89)}
      <circle cx={-8.5} cy={-84} r={2.6} fill={BLUSH} opacity={0.7} />
      <circle cx={8.5} cy={-84} r={2.6} fill={BLUSH} opacity={0.7} />
      <path d="M-4,-83 q4,4 8,0" fill="none" stroke={F.lips} strokeWidth={1.8} strokeLinecap="round" />
    </g>
  );
}

function Mid() {
  return (
    <g>
      {shadow(22)}
      <rect x={-10} y={-38} width={9} height={37} rx={3} fill={F.slacks} />
      <rect x={1} y={-38} width={9} height={37} rx={3} fill={F.slacks} />
      <ellipse cx={-6} cy={-1} rx={8} ry={3} fill={HAIR} />
      <ellipse cx={6} cy={-1} rx={8} ry={3} fill={HAIR} />
      <rect x={-17} y={-75} width={34} height={42} rx={12} fill={OLIVE} />
      <path d="M-6,-75 L0,-64 L6,-75z" fill={F.white} />
      <rect x={-17} y={-60} width={7} height={24} rx={3.5} fill={OLIVE} />
      <rect x={10} y={-60} width={7} height={24} rx={3.5} fill={OLIVE} />
      <circle cx={0} cy={-91} r={15} fill={SKIN} />
      <path d="M-15,-93 a15,15 0 0 1 30,0 q-15,-9 -30,0z" fill={HAIR} />
      <path d="M-15,-92 q-2,8 1,12 M15,-92 q2,8 -1,12" stroke={GREY} strokeWidth={4} fill="none" strokeLinecap="round" />
      {glasses(-90, 5.5, 4.6)}
      {smile(-83)}
    </g>
  );
}

function Senior() {
  return (
    <g>
      {shadow(20)}
      <rect x={-9} y={-34} width={8.5} height={33} rx={3} fill={F.trousers} />
      <rect x={1} y={-34} width={8.5} height={33} rx={3} fill={F.trousers} />
      <ellipse cx={-6} cy={-1} rx={7.5} ry={3} fill={HAIR} />
      <ellipse cx={6} cy={-1} rx={7.5} ry={3} fill={HAIR} />
      {/* the cane */}
      <path d="M17,-34 V-3" stroke={OLIVE} strokeWidth={3.2} strokeLinecap="round" />
      <path d="M17,-34 q0,-6 -6,-6" fill="none" stroke={OLIVE} strokeWidth={3.2} strokeLinecap="round" />
      {/* stooping a little, from the waist up */}
      <g transform="rotate(7 0 -34)">
        <rect x={-14} y={-68} width={28} height={38} rx={9} fill={SAND} />
        <path d="M-5,-68 L0,-57 L5,-68z" fill={F.white} />
        <rect x={12} y={-62} width={6} height={24} rx={3} fill={SAND} transform="rotate(14 15 -62)" />
        <circle cx={0} cy={-82} r={14} fill={SKIN} />
        <path d="M-14,-84 a14,14 0 0 1 28,0 q-4,-4 -9,-4 q-5,-3 -10,0 q-5,0 -9,4z" fill={F.silver} stroke={F.edge} strokeWidth={0.8} />
        <path d="M-14,-82 q-2,7 1,11 M14,-82 q2,7 -1,11" stroke={F.silver} strokeWidth={4.5} fill="none" strokeLinecap="round" />
        {glasses(-81, 5, 4.4)}
        <path d="M-5,-74 q5,3 10,0" fill="none" stroke={HAIR} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M-4.5,-76 q4.5,-2.5 9,0" fill="none" stroke={F.silver} strokeWidth={2.6} strokeLinecap="round" />
      </g>
    </g>
  );
}

const DRAW: Record<FigureKind, () => React.JSX.Element> = {
  kid: Kid, teen: Teen, adult: Adult, mom: Mom, mid: Mid, senior: Senior,
};

/** One person, standing with their feet on the line a little below where they are placed. */
export function figureShape(figure: ChartFigure, key: number) {
  return (
    <g key={key} transform={`translate(${figure.x.toFixed(1)} ${(figure.y - 2).toFixed(1)}) scale(${figure.scale})`}>
      {DRAW[figure.kind]()}
    </g>
  );
}
