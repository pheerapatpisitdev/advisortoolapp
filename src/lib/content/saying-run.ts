import type { GenerateResult } from "@/app/studio/actions";
import { modeChecks } from "./mode-checks";
import { formulaOf } from "./formula";
import { oneCallRound } from "./one-call-run";
import { cleanPosterWords } from "./poster-words";
import { LENGTHS, MAX_READER, type Length } from "./prompt";
import {
  MAX_SAYING_PIECES, parseSayingPiece, readSaying, SAYING_HREF, SAYING_SHAPES, sayingAims, sayingFormat, sayingMessages, sayingSpread, sayingTones, type SayingAsk,
} from "./saying";

export interface SayingWriteInput extends SayingAsk {
  /** how the round's pieces differ, a SAYING_SPREADS id; anything else is ต่างประเด็น */
  spread?: string;
  /** a tone id from SAYING_TONES; empty lets the round take them in turn */
  tone?: string;
  reader?: string;
  format?: string;
  length?: string;
  loop?: boolean;
  /** the writing formula (formula.ts); posts and scripts */
  formula?: string | null;
  /** สูตรคอนเทนต์โปร as a page loaded before there were two formulas sends it (2026-10-01) */
  pro?: boolean;
  logoSpot?: string;
  /** the agent's own words for the poster (poster-words.ts); a request body, so read before use */
  posterWords?: unknown;
  /** the Page the screen asks for; the action settles it (projectPage) and hands the runner the answer */
  page?: string;
  count: number;
  writer?: string;
}

/** คำคม on the server. Called by the generateSaying action only, which holds the limits. */
export async function writeSaying(input: SayingWriteInput, pageId: string | null): Promise<GenerateResult> {
  const read = readSaying(input);
  if (!read.ok) return { ok: false, error: read.error };
  const { source } = read;
  const format = sayingFormat(input.format);
  const length: Length | null = format === "script" ? (LENGTHS.find((l) => l.id === input.length)?.id ?? "60") : null;
  const loop = format === "script" && input.loop === true;
  const formula = formulaOf(input, format);
  const reader = (typeof input.reader === "string" ? input.reader : "").trim().slice(0, MAX_READER);
  const count = Math.min(MAX_SAYING_PIECES, Math.max(1, Math.round(Number(input.count) || 1)));
  const tones = sayingTones(typeof input.tone === "string" ? input.tone : "", count);
  // each round starts its points and shapes at a place of its own, so the next does not open as this one did
  const aims = sayingAims(source, sayingSpread(input.spread), count, Math.floor(Math.random() * SAYING_SHAPES.length * 3));
  return oneCallRound({
    href: SAYING_HREF, format, length, loop, formula, count,
    writer: input.writer,
    messages: (i) => sayingMessages(source, tones[i], reader, format, length, loop, formula, aims[i]),
    parse: (reply, i) => parseSayingPiece(reply, source, tones[i].label, format),
    // a figure in the agent's own saying is theirs; any other is flagged for the owner to confirm
    yardstick: source.kind === "own" ? `${source.text} ${source.who}` : "",
    checks: modeChecks(SAYING_HREF, undefined),
    logoSpot: input.logoSpot, posterWords: cleanPosterWords(input.posterWords), pageId, label: "saying",
  });
}
