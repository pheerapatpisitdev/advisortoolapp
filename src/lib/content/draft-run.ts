import type { GenerateResult } from "@/app/studio/actions";
import { cleanDraft, draftMessages, DRAFT_HREF, MAX_DRAFT_PIECES, parseDraftPiece } from "./draft";
import { modeChecks } from "./mode-checks";
import { oneCallRound } from "./one-call-run";
import { LENGTHS, MAX_READER, type Format, type Length } from "./prompt";

export interface DraftWriteInput {
  draft: string;
  reader?: string;
  format?: string;
  length?: string;
  loop?: boolean;
  pro?: boolean;
  logoSpot?: string;
  page?: string;
  count: number;
  writer?: string;
}

/** เขียนเอง on the server. Called by the generateDraft action only, which holds the limits. */
export async function writeDraft(input: DraftWriteInput): Promise<GenerateResult> {
  const draft = cleanDraft(input.draft);
  if (!draft) return { ok: false, error: "พิมพ์ร่างก่อนนะครับ" };
  const format: Format = input.format === "script" || input.format === "ad" ? input.format : "post";
  const length: Length | null = format === "script" ? (LENGTHS.find((l) => l.id === input.length)?.id ?? "60") : null;
  const loop = format === "script" && input.loop === true;
  const pro = format !== "ad" && input.pro === true;
  const reader = (typeof input.reader === "string" ? input.reader : "").trim().slice(0, MAX_READER);
  return oneCallRound({
    href: DRAFT_HREF, format, length, loop, pro,
    count: Math.min(MAX_DRAFT_PIECES, Math.max(1, Math.round(Number(input.count) || 1))),
    writer: input.writer,
    messages: (i) => draftMessages(draft, i, reader, format, length, loop, pro),
    parse: (reply, i) => parseDraftPiece(reply, draft, i, format),
    // the draft is where a figure may come from; one the AI brought in is flagged
    yardstick: draft,
    // a draft that recruits is read with หาทีม's rules: no income figure, even one it wrote itself
    checks: modeChecks(DRAFT_HREF, draft),
    logoSpot: input.logoSpot, page: input.page, label: "draft",
  });
}
