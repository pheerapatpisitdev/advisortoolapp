import { textEms } from "@/lib/quote-video/caption";

/**
 * Thai lines for Shotstack's rich-text, broken by us: Shotstack breaks only at spaces, so a Thai
 * line with none is cut mid-word ("เงินก้อ|น"), and it ignores zero-width spaces; a "\n" it keeps
 * (tested on the sandbox, 2026-10-21). The fewest lines that fit `maxEm`, with the breaks that make
 * the longest line shortest, words from Intl.Segmenter; a break at a space wins a near tie, so
 * "เคยปฏิเสธ เพราะสุขภาพแข็งแรง" breaks at its space and not inside "แข็ง|แรง".
 */
export function thaiLines(text: string, maxEm: number): string[] {
  const whole = text.trim();
  if (!whole) return [];
  if (textEms(whole) <= maxEm) return [whole];
  const words = [...new Intl.Segmenter("th", { granularity: "word" }).segment(whole)].map((w) => w.segment);
  const fewest = Math.ceil(textEms(whole) / maxEm);
  // a line count past the fewest is tried only when no breaks at that count fit (one long word)
  for (let n = fewest; n <= Math.min(words.length, fewest + 2); n++) {
    const best = bestBreaks(words, n, maxEm);
    if (best) return best;
  }
  return [whole];
}

/** a space just before a break counts this many ems off the longest line: a Thai space ends a phrase */
const SPACE_BONUS = 2;

function bestBreaks(words: string[], n: number, maxEm: number): string[] | null {
  let best: { score: number; lines: string[] } | null = null;
  const walk = (from: number, left: number, lines: string[], spaces: number) => {
    if (left === 1) {
      const last = words.slice(from).join("").trim();
      if (!last || textEms(last) > maxEm) return;
      const all = [...lines, last];
      const score = Math.max(...all.map(textEms)) - spaces * SPACE_BONUS;
      if (!best || score < best.score) best = { score, lines: all };
      return;
    }
    let line = "";
    for (let i = from; i < words.length - 1; i++) {
      line += words[i];
      if (textEms(line.trim()) > maxEm) break;
      if (!line.trim()) continue;
      walk(i + 1, left - 1, [...lines, line.trim()], spaces + (/\s$/.test(words[i]) ? 1 : 0));
    }
  };
  walk(0, n, [], 0);
  return best ? (best as { lines: string[] }).lines : null;
}
