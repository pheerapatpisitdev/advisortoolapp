/**
 * Putting a piece into English. Apart from output.ts because it needs the poster's default,
 * and output.ts must stay free of anything but types from poster.ts (browser-safe, no cycles).
 */

import { DISCLAIMER_EN, type ContentOutput } from "./output";
import { defaultPoster } from "./poster";

/**
 * Stamps a written piece as English: the language, the English regulator line, and a poster
 * that is always present and marked — a later caller with no poster falls back to the Thai
 * default, which would put a Thai footer on an English piece. The writer's own poster is kept.
 */
export function englishOutput(o: ContentOutput, productName: string): ContentOutput {
  return {
    ...o,
    lang: "en",
    disclaimer: DISCLAIMER_EN,
    poster: { ...(o.poster ?? defaultPoster(o.hooks[0] ?? "", productName, "en")), lang: "en" },
  };
}
