import { BudgetExceeded, chat } from "@/lib/ai/client";
import { isLogoSpot } from "./logo";
import { roundLogo } from "./logo-store";
import type { GenerateResult } from "@/app/studio/actions";
import { findWords, strayNumbers } from "./check";
import { OVERHEAD_THB, writerOf } from "./models";
import type { ContentOutput } from "./output";
import { checkPolicy } from "./policy";
import { posterText } from "./poster";
import { applyPosterWords, cleanPosterWords } from "./poster-words";
import { LENGTHS, MAX_READER, type Format, type Length } from "./prompt";
import { MAX_RECRUIT_PIECES, RECRUIT_HREF, parseRecruitPiece, recruitMessages, recruitTones, topicOf } from "./recruit";
import {
  contentCap, contentSpentThisMonth, holdContentBudget, listWords, recentHooks, releaseContentBudget, saveContent, type ContentItem,
} from "./store";
import { withAvoid } from "./one-call-run";
import { fallbackWriters, UnreadableReply } from "./write";
import { formulaOf, markFormula } from "./formula";
import { ownerWording } from "./wording";

/**
 * หาทีม on the server: one call per piece on the picked writer, checked and saved as a
 * รีวิวเคลม round is. Called by the generateRecruit action only, which holds the rate limit.
 */

const WRITE_TIMEOUT_MS = 60_000;
const capReached = (cap: number) => `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${cap} บาทแล้ว — เพิ่มงบได้ที่หน้า /admin/ai`;
const BUDGET_OUT = "ถึงงบค่า AI ของเดือนนี้แล้ว";

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

/** every line the checks read, as the workbench's own checks read them */
function checkedText(o: ContentOutput, withPoster = true): string {
  return [...o.hooks, o.body, o.closing, o.hashtags.join(" "), withPoster ? posterText(o.poster) : ""].join("\n");
}

export async function writeRecruit(input: RecruitWriteInput, pageId: string | null): Promise<GenerateResult> {
  const topic = topicOf(input.topic, input.custom ?? "");
  if (!topic) return { ok: false, error: "เลือกหัวข้อ หรือพิมพ์หัวข้อเองก่อนนะครับ" };
  const count = Math.min(MAX_RECRUIT_PIECES, Math.max(1, Math.round(Number(input.count) || 1)));
  const format: Format = input.format === "script" || input.format === "ad" ? input.format : "post";
  const length: Length | null = format === "script" ? (LENGTHS.find((l) => l.id === input.length)?.id ?? "60") : null;
  const loop = format === "script" && Boolean(input.loop);
  const formula = formulaOf(input, format);
  const logo = format === "script" ? null
    : await roundLogo(pageId, isLogoSpot(input.logoSpot) ? input.logoSpot : null);
  const reader = (input.reader ?? "").trim().slice(0, MAX_READER);
  // the agent's own poster words are theirs to answer for: a figure on them is not the AI's to be flagged
  const ownWords = cleanPosterWords(input.posterWords);
  let hold: string | null = null;
  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) return { ok: false, error: capReached(cap) };
    const writer = writerOf(input.writer, cap - spent);
    const held = await holdContentBudget(count * (writer.thb + OVERHEAD_THB), cap);
    if (!held.ok) return { ok: false, error: `งบสร้างคอนเทนต์เดือนนี้เหลือ ${held.left.toFixed(2)} บาท ไม่พอรอบนี้ — ลดจำนวนชิ้นหรือเลือกโมเดลประหยัด` };
    hold = held.id;
    const [words, avoid] = await Promise.all([listWords(), recentHooks(RECRUIT_HREF, pageId)]);

    const settled = await Promise.allSettled(recruitTones(input.tone ?? "", count).map(async (tone) => {
      const r = await chat({
        tier: "large", task: "content", messages: withAvoid(recruitMessages(topic, tone, reader, format, length, loop, formula), avoid),
        maxTokens: 4000, json: true, timeoutMs: WRITE_TIMEOUT_MS, effort: "low",
        prefer: writer.model, within: fallbackWriters(writer.model),
      });
      const parsed = parseRecruitPiece(r.text, topic, tone.label, format);
      const output = parsed && applyPosterWords(ownerWording(parsed), ownWords);
      if (!output) {
        console.error(`recruit piece unreadable (${r.model}, ${r.outputTokens} tokens):`, r.text.slice(0, 600));
        throw new UnreadableReply();
      }
      return {
        output: { ...markFormula(output, formula, r.text), ...(loop ? { loop: true } : {}), ...(logo && output.poster ? { poster: { ...output.poster, logo } } : {}) },
        model: r.model, costThb: r.costThb,
      };
    }));
    const written = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
    const reasons = settled.flatMap((s) => (s.status === "rejected" ? [s.reason as unknown] : []));
    if (written.length === 0) {
      const why = reasons.find((r) => r instanceof BudgetExceeded) ?? reasons[0];
      if (why instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
      if (why instanceof UnreadableReply) return { ok: false, error: why.message };
      throw why;
    }

    const items: ContentItem[] = [];
    for (const w of written) {
      try {
        items.push(await saveContent({
          planHref: RECRUIT_HREF, format, angle: "", length, output: w.output, pageId,
          flags: {
            // the topic's brief is the only place a figure may come from, and it has none of income
            numbers: strayNumbers(checkedText(w.output, !ownWords), topic.brief),
            words: findWords(checkedText(w.output), words),
            policy: checkPolicy(checkedText(w.output), { recruit: true }),
            fixes: null,
          },
          rateVersion: null, model: w.model, costThb: w.costThb, hookTemplateId: null,
        }));
      } catch (e) {
        console.error("recruit save failed mid-round:", e);
        return items.length
          ? { ok: false, error: `บันทึกได้ ${items.length} จาก ${written.length} ชิ้น — ดูชิ้นที่ได้ในรอตรวจ`, saved: items.length, items }
          : { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ", saved: 0 };
      }
    }
    return { ok: true, items, costThb: items.reduce((s, i) => s + i.costThb, 0), missing: count - items.length };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
    console.error("recruit write failed:", e);
    return { ok: false, error: "สร้างไม่สำเร็จ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ" };
  } finally {
    if (hold) await releaseContentBudget(hold);
  }
}
