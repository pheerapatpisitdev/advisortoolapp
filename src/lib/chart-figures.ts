/**
 * The little people standing on the cash-value line of a chat's value table.
 *
 * Which of them stand where is a matter of the insured's age, and where each stands is a matter
 * of the chart's geometry, so both are worked out here, beside the other figures on the card,
 * and the drawing only paints what it is handed. It also means a placement can be tested
 * without rendering anything.
 */

export type FigureKind = "kid" | "teen" | "adult" | "mom" | "mid" | "senior";

/** One person on the line: `x` is where the feet are, `y` is the line's height under them. */
export interface ChartFigure {
  kind: FigureKind;
  x: number;
  y: number;
  scale: number;
}

/**
 * The stages of a life, as ages from `from` up to but not including `to`. The working-age
 * stage is a family — father, child, mother — standing together, where every other stage is
 * one person; `at` is where each stands in the group, in steps from its middle.
 */
const STAGES: { from: number; to: number; cast: { kind: FigureKind; at: number }[] }[] = [
  { from: 0, to: 13, cast: [{ kind: "kid", at: 0 }] },
  { from: 13, to: 25, cast: [{ kind: "teen", at: 0 }] },
  { from: 25, to: 45, cast: [{ kind: "adult", at: -1 }, { kind: "kid", at: 0 }, { kind: "mom", at: 1 }] },
  { from: 45, to: 60, cast: [{ kind: "mid", at: 0 }] },
  { from: 60, to: Infinity, cast: [{ kind: "senior", at: 0 }] },
];

/** In drawing units at scale 1: how far apart a family stands, and how wide one person is. */
const STEP = 42;
const BODY = 26;
/** Clear space kept between two groups, and around the break-even marker. */
const GAP = 8;
const MARKER = 14;
/** Room kept beside the axes. */
const EDGE = 6;
/** The tallest figure's height at scale 1 (the head of the middle-aged man), and the room kept over it. */
const HEIGHT = 108;
const CEILING = 4;
/** Smaller than this and a figure is not worth drawing: the cartoon would be a speck. */
const SMALLEST = 0.45;

export interface PlaceInput {
  /** the insured's age now, and the age the line ends at */
  startAge: number;
  endAge: number;
  /** an age's place along the chart */
  x: (age: number) => number;
  /** the height of the line at a place along the chart */
  yAt: (x: number) => number;
  /** the chart's edges, between which every figure stays: a figure under the top is shrunk to fit */
  left: number;
  right: number;
  top: number;
  /** how large a figure is drawn, from the chart's width */
  scale: number;
  /** where the break-even marker sits, which no figure may cover */
  avoidX?: number;
}

/**
 * Who stands on the line, and where.
 *
 * A stage is drawn when the insured has at least a year of it on the chart, in the middle of
 * the part of it that is on the chart. A figure that would stand on the break-even marker moves
 * to its side if its stage has room there, and is left out if not; one that would crowd the
 * figure before it is left out, so what is drawn never overlaps. Where the line runs close under
 * the top of the chart a figure is drawn smaller, so its head is never cut off.
 */
export function placeFigures(input: PlaceInput): ChartFigure[] {
  const { startAge, endAge, x, yAt, left, right, top, scale: full, avoidX } = input;
  const figures: ChartFigure[] = [];
  let taken = -Infinity;
  for (const stage of STAGES) {
    const lo = Math.max(stage.from, startAge);
    const hi = Math.min(stage.to, endAge);
    if (hi - lo < 1) continue;
    const group = stage.cast.length > 1;

    /** where the group stands drawn at `scale`, or undefined when the chart has no room for it */
    const stand = (scale: number) => {
      const reach = (group ? STEP * scale : 0) + BODY * scale;
      const lowest = left + reach + EDGE;
      const highest = right - reach;
      if (lowest > highest) return undefined;
      const within = (c: number) => Math.min(highest, Math.max(lowest, c));
      let center = within(x((lo + hi) / 2));
      if (avoidX !== undefined && Math.abs(center - avoidX) < reach + MARKER * scale) {
        const clear = reach + MARKER * scale;
        const stays = [avoidX - clear, avoidX + clear]
          .find((c) => c >= lowest && c <= highest && c >= x(lo) && c <= x(hi));
        if (stays === undefined) return undefined;
        center = stays;
      }
      return { center, reach };
    };
    /** the largest the group can be drawn at where it stands, for the room over the line there */
    const roomFor = (center: number, scale: number) =>
      Math.min(...stage.cast.map((m) => (yAt(center + m.at * STEP * scale) - top - CEILING) / HEIGHT));

    let scale = full;
    let at = stand(scale);
    if (!at) continue;
    if (roomFor(at.center, scale) < scale) {
      scale = roomFor(at.center, scale);
      if (scale < SMALLEST) continue;
      at = stand(scale);
      if (!at) continue;
      scale = Math.min(scale, roomFor(at.center, scale));
      if (scale < SMALLEST) continue;
    }
    const { center, reach } = at;
    if (center - reach < taken + GAP * scale) continue;
    taken = center + reach;

    for (const member of stage.cast) {
      const place = center + member.at * STEP * scale;
      figures.push({ kind: member.kind, x: place, y: yAt(place), scale });
    }
  }
  return figures;
}
