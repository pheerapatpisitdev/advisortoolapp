import { BLOCK_KINDS, clip, MAX_CHARS, type BlockKind, type PosterBlock, type PosterSpec } from "./poster";

/**
 * The agent's own words on the poster (owner, 2026-10-08): typed on a round's form, before the
 * writer is asked, they stand in place of every line the writer would have put on the round's
 * posters. The writer still writes the post and the picture's brief, and the colours and the
 * layout stay its own; only the words are the agent's. Without a headline the round is as it
 * always was — a poster with no headline is not a poster (parsePoster).
 */

export type OwnPosterWords = Partial<Record<BlockKind, string>>;

/**
 * The words from a request, or null when there is nothing to lay: an object, or the JSON string
 * a form sends one as. Each line is trimmed and cut to what a poster allows.
 */
export function cleanPosterWords(raw: unknown): OwnPosterWords | null {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const words: OwnPosterWords = {};
  for (const kind of BLOCK_KINDS) {
    const text = typeof r[kind] === "string" ? clip(r[kind], MAX_CHARS[kind]) : "";
    if (text) words[kind] = text;
  }
  return words.headline ? words : null;
}

/** A piece with its poster's lines replaced by the agent's; a piece with no poster (a script) is left as it is. */
export function applyPosterWords<T extends { poster?: PosterSpec }>(output: T, words: OwnPosterWords | null): T {
  if (!words || !output.poster) return output;
  const blocks = BLOCK_KINDS.flatMap((kind): PosterBlock[] => (words[kind] ? [{ kind, text: words[kind] }] : []));
  return { ...output, poster: { ...output.poster, blocks } };
}
