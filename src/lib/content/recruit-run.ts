import type { GenerateResult } from "@/app/studio/actions";
import { oneCallRound } from "./one-call-run";
import { cleanPosterWords } from "./poster-words";
import { LENGTHS, MAX_READER, type Format, type Length } from "./prompt";
import { MAX_RECRUIT_PIECES, RECRUIT_HREF, parseRecruitPiece, recruitMessages, recruitTones, topicOf } from "./recruit";
import { formulaOf } from "./formula";

/**
 * หาทีม on the server: one call per piece on the picked writer, through the round every one-call
 * mode shares (one-call-run.ts — it was a copy of it, owner 2026-10-18): the topic's brief the
 * only place a figure may come from, and the recruiting policy checked. Called by the
 * generateRecruit action only, which holds the rate limit.
 */

export interface RecruitWriteInput {
  /** a topic id, or "custom" with the owner's words in `custom` */
  topic: string;
  custom?: string;
  reader?: string;
  /** a tone id, or "" for the three in turn */
  tone?: string;
  format?: string;
  length?: string;
  /** a คลิปวนลูป (scripts only): the closing runs back into the hook */
  loop?: boolean;
  /** the writing formula (formula.ts); posts and scripts */
  formula?: string | null;
  /** กันซ้ำกับโพสต์เก่า: false turns the Page's past openings off for the round; a request body, so only false counts */
  avoid?: boolean;
  /** สูตรคอนเทนต์โปร as a page loaded before there were two formulas sends it (2026-10-01) */
  pro?: boolean;
  /** where the Page's logo goes on the posters, and the Page (logo.ts); a script has no poster */
  logoSpot?: string;
  /** the agent's own words for the poster (poster-words.ts); a request body, so read before use */
  posterWords?: unknown;
  /** the Page the screen asks for; the action settles it (projectPage) and hands the runner the answer */
  page?: string;
  count: number;
  writer?: string;
}

export async function writeRecruit(input: RecruitWriteInput, pageId: string | null): Promise<GenerateResult> {
  const topic = topicOf(input.topic, input.custom ?? "");
  if (!topic) return { ok: false, error: "เลือกหัวข้อ หรือพิมพ์หัวข้อเองก่อนนะครับ" };
  const count = Math.min(MAX_RECRUIT_PIECES, Math.max(1, Math.round(Number(input.count) || 1)));
  // an ad is written in Ads Studio, never here (the actions refuse one before a round): post or script
  const format: Format = input.format === "script" ? "script" : "post";
  const length: Length | null = format === "script" ? (LENGTHS.find((l) => l.id === input.length)?.id ?? "60") : null;
  const loop = format === "script" && Boolean(input.loop);
  const formula = formulaOf(input, format);
  const reader = (input.reader ?? "").trim().slice(0, MAX_READER);
  const tones = recruitTones(input.tone ?? "", count);
  return oneCallRound({
    href: RECRUIT_HREF, format, length, count, writer: input.writer,
    messages: (i) => recruitMessages(topic, tones[i], reader, format, length, loop, formula),
    parse: (reply, i) => parseRecruitPiece(reply, topic, tones[i].label, format),
    yardstick: topic.brief, checks: { recruit: true }, loop, formula, logoSpot: input.logoSpot,
    posterWords: cleanPosterWords(input.posterWords), pageId, label: "recruit", avoid: input.avoid,
  });
}
