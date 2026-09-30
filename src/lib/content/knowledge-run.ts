import type { GenerateResult } from "@/app/studio/actions";
import { knowledgeFormat, knowledgeMessages, KNOWLEDGE_HREF, MAX_KNOWLEDGE_PIECES, parseKnowledgePiece, subjectOf } from "./knowledge";
import { modeChecks } from "./mode-checks";
import { formulaOf } from "./formula";
import { oneCallRound } from "./one-call-run";
import { LENGTHS, MAX_READER, type Length } from "./prompt";

export interface KnowledgeWriteInput {
  /** myth, article or quote */
  kind: string;
  /** a subject id from KNOWLEDGE_SUBJECTS[kind], or "custom" with the owner's words */
  subject: string;
  custom?: string;
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

/** ความรู้ on the server. Called by the generateKnowledge action only, which holds the limits. */
export async function writeKnowledge(input: KnowledgeWriteInput, pageId: string | null): Promise<GenerateResult> {
  const subject = subjectOf(String(input.kind ?? ""), String(input.subject ?? ""), typeof input.custom === "string" ? input.custom : "");
  if (!subject) return { ok: false, error: "เลือกหัวข้อ หรือพิมพ์หัวข้อเองก่อนนะครับ" };
  const format = knowledgeFormat(input.format);
  const length: Length | null = format === "script" ? (LENGTHS.find((l) => l.id === input.length)?.id ?? "60") : null;
  const loop = format === "script" && input.loop === true;
  const formula = formulaOf(input, format);
  const reader = (typeof input.reader === "string" ? input.reader : "").trim().slice(0, MAX_READER);
  return oneCallRound({
    href: KNOWLEDGE_HREF, format, length, loop, formula,
    count: Math.min(MAX_KNOWLEDGE_PIECES, Math.max(1, Math.round(Number(input.count) || 1))),
    writer: input.writer,
    messages: (i) => knowledgeMessages(subject, i, reader, format, length, loop, formula),
    parse: (reply) => parseKnowledgePiece(reply, subject, format),
    // general knowledge is allowed, so there is nothing to find a figure in: every one is flagged
    yardstick: "",
    checks: modeChecks(KNOWLEDGE_HREF, undefined),
    logoSpot: input.logoSpot, pageId, label: "knowledge",
  });
}
