import type { GenerateResult } from "@/app/studio/actions";
import { modeChecks } from "./mode-checks";
import { formulaOf } from "./formula";
import { oneCallRound } from "./one-call-run";
import { LENGTHS, MAX_READER, type Length } from "./prompt";
import { MAX_THANKS_PIECES, occasionOf, parseThanksPiece, THANKS_HREF, thanksFormat, thanksMessages, thanksTones } from "./thanks";

export interface ThanksWriteInput {
  /** an occasion id from THANKS_OCCASIONS, or "custom" with the owner's words */
  occasion: string;
  custom?: string;
  /** a tone id from THANKS_TONES; empty lets the round take them in turn */
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
  /** the Page the screen asks for; the action settles it (projectPage) and hands the runner the answer */
  page?: string;
  count: number;
  writer?: string;
}

/** ขอบคุณลูกค้า on the server. Called by the generateThanks action only, which holds the limits. */
export async function writeThanks(input: ThanksWriteInput, pageId: string | null): Promise<GenerateResult> {
  const occasion = occasionOf(String(input.occasion ?? ""), typeof input.custom === "string" ? input.custom : "");
  if (!occasion) return { ok: false, error: "เลือกโอกาส หรือพิมพ์เองก่อนนะครับ" };
  const format = thanksFormat(input.format);
  const length: Length | null = format === "script" ? (LENGTHS.find((l) => l.id === input.length)?.id ?? "60") : null;
  const loop = format === "script" && input.loop === true;
  const formula = formulaOf(input, format);
  const reader = (typeof input.reader === "string" ? input.reader : "").trim().slice(0, MAX_READER);
  const count = Math.min(MAX_THANKS_PIECES, Math.max(1, Math.round(Number(input.count) || 1)));
  const tones = thanksTones(typeof input.tone === "string" ? input.tone : "", count);
  return oneCallRound({
    href: THANKS_HREF, format, length, loop, formula, count,
    writer: input.writer,
    messages: (i) => thanksMessages(occasion, tones[i], reader, format, length, loop, formula),
    parse: (reply, i) => parseThanksPiece(reply, occasion, tones[i].label, format),
    // a thank-you has no figures of its own: every one is flagged for the owner to confirm
    yardstick: "",
    checks: modeChecks(THANKS_HREF, undefined),
    logoSpot: input.logoSpot, pageId, label: "thanks",
  });
}
