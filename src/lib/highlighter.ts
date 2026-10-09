/**
 * A yellow highlighter stroke, drawn by hand rather than as a box.
 *
 * The owner asked for the look of a marker pen dragged across a figure: a slightly uneven top
 * and bottom edge, a blunt nib at each end, and a darker streak where the pen went over the
 * middle twice. A rounded rectangle in yellow reads as a UI badge; this reads as somebody's
 * pen, which is the point — it says "this is the number I want you to look at".
 *
 * The shape only, with no colour, so the one drawing can be filled on the card (which cannot
 * read a CSS variable) and masked on the page (which should read the token). It is stretched
 * to whatever it sits behind, hence `preserveAspectRatio="none"`.
 */
const SHAPE = (fill: string) =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 24' preserveAspectRatio='none'>`
  // the stroke: chisel-cut ends leaning the way a pen is held, edges that wander a little
  + `<path fill='${fill}' fill-opacity='0.9' d='M5.5 2.8C14 3.6 22 2.4 31 3.1C44 3.9 55 2.2 68 2.9C79 3.4 88 2.1 99.2 3.4L95.6 21.6C86 20.6 77 22.2 66 21.3C53 20.4 42 22.4 29 21.5C19 20.9 10 22.3 0.8 21.2Z'/>`
  // where the pen went back over the middle: a darker band, not quite straight
  + `<path fill='${fill}' fill-opacity='0.55' d='M3.6 9.6C25 8.1 48 10.4 72 8.6C82 8 90 8.9 97.6 8.2L96.8 13.9C87 14.8 79 13.6 70 14.5C47 16.1 25 13.9 2.6 15.4Z'/>`
  + `</svg>`;

/**
 * A loop drawn round a figure with a marker pen: an oval that does not quite close, with the
 * tail running past where it began and a second, thinner pass over the top. Stroked rather
 * than filled, so the width of the line is the pen's whatever the figure's width; the viewBox
 * is stretched like the highlighter's, so a short figure and a long one both get a loop.
 */
const LOOP = (stroke: string) =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 44' preserveAspectRatio='none'>`
  + `<path fill='none' stroke='${stroke}' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round' d='M20 8C40 2 80 1.5 102 8C116 12.5 118.5 28 104 36C84 44 38 43.5 18 37C3 32 2.5 16 17 9.5C30 4.2 62 2.5 92 5.5'/>`
  + `<path fill='none' stroke='${stroke}' stroke-opacity='0.55' stroke-width='1.4' stroke-linecap='round' d='M24 7C50 3 82 3.5 100 9'/>`
  + `</svg>`;

/** The loop in one colour, as a data URI — see LOOP. */
export function loopUri(color: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(LOOP(color))}")`;
}

/** A data URI of the stroke in one colour, for a drawing that has to carry its own colour. */
export function highlighterUri(color: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(SHAPE(color))}")`;
}

/**
 * Which of a block's figures carries the highlighter: the largest, the first when two tie.
 * The death benefit bands are the usual caller — the one the family most stands to receive
 * is the one the card and the sales page both mark.
 */
export function largestAt(amounts: readonly number[]): number {
  return amounts.reduce((best, n, i) => (n > amounts[best] ? i : best), 0);
}
