import type { PosterSpec } from "./poster";

/**
 * A suggested fix (the proofreader's, or a watched word's) accepted in the editor.
 *
 * The checks read every line that goes up — all the hooks, the body, the closing, the tags and
 * the poster's words — so the fix is made in all of them, everywhere the words occur. It used
 * to change only the first place in the hooks, body or closing: a typo on the poster alone, or
 * one written twice, stayed, while its suggestion was put away as done, and the poster went up
 * with it in the picture, where nothing can be edited afterwards.
 */

export interface FixableText {
  hooks: string[];
  body: string;
  closing: string;
  /** the hashtags as the editor holds them, one line */
  tags: string;
  poster: PosterSpec;
}

/** `changed` false: the words are nowhere in it now (fixed by hand already), and nothing moved */
export function applyFix<T extends FixableText>(d: T, fix: { find: string; replace: string }): { draft: T; changed: boolean } {
  const { find, replace } = fix;
  if (!find || find === replace) return { draft: d, changed: false };
  let changed = false;
  const swap = (s: string) => {
    if (!s.includes(find)) return s;
    changed = true;
    return s.split(find).join(replace);
  };
  const draft: T = {
    ...d,
    hooks: d.hooks.map(swap),
    body: swap(d.body),
    closing: swap(d.closing),
    tags: swap(d.tags),
    poster: { ...d.poster, blocks: d.poster.blocks.map((b) => ({ ...b, text: swap(b.text) })) },
  };
  return changed ? { draft, changed } : { draft: d, changed };
}
