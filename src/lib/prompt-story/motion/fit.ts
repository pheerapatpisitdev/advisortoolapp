/**
 * A line of the look is never wrapped (spec, Sizes): it is set smaller until it fits across its box. Prompt's
 * letters run about 0.55–0.62 of the type size at every weight it is drawn in, so 0.62 a base letter is the
 * safe guess; Thai marks above and below a letter take no room.
 */

const MARK = /[ัิ-ฺ็-๎]/u;

/** the letters that take room: every character but the Thai marks */
export const letters = (text: string) => [...text].filter((ch) => !MARK.test(ch)).length;

/** the type size, at most `maxPx`, at which `text` fits across `widthPx` */
export function fitSize(text: string, widthPx: number, maxPx: number, perLetter = 0.62): number {
  const n = letters(text);
  if (!n) return maxPx;
  return Math.min(maxPx, Math.floor(widthPx / (n * perLetter)));
}

/**
 * one size for a group of lines that keeps their steps (a headline's lines grow down the box): every line shrunk
 * by the share the tightest of them needs
 */
export function fitGroup(lines: string[], widthPx: number, sizes: number[], perLetter = 0.62): number[] {
  const want = lines.map((_, i) => sizes[Math.min(i, sizes.length - 1)]);
  const k = Math.min(1, ...lines.map((l, i) => fitSize(l, widthPx, want[i], perLetter) / want[i]));
  return want.map((s) => Math.floor(s * k));
}
