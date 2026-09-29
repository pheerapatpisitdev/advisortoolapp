import { BudgetExceeded, chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import type { GenerateResult } from "@/app/studio/actions";
import { findWords, strayNumbers } from "./check";
import { isLogoSpot } from "./logo";
import { roundLogo } from "./logo-store";
import { OVERHEAD_THB, writerOf } from "./models";
import type { ContentOutput } from "./output";
import { checkPolicy } from "./policy";
import { posterText } from "./poster";
import type { Format, Length } from "./prompt";
import {
  contentCap, contentSpentThisMonth, holdContentBudget, listWords, releaseContentBudget, saveContent, type ContentItem,
} from "./store";
import { fallbackWriters, UnreadableReply } from "./write";
import { ownerWording } from "./wording";

/**
 * A round written one call per piece with no planner — ความรู้ and เขียนเอง (2026-09-29), in
 * the shape หาทีม's writeRecruit has: the month's money checked and held, each piece written on
 * the picked writer with its fallbacks, the owner's wording applied, the Page's logo put on,
 * each saved with its checks. What differs per mode is passed in: the brief, the reply's
 * reading, and the yardstick a figure must be found in.
 */

const WRITE_TIMEOUT_MS = 60_000;
const capReached = (cap: number) => `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${cap} บาทแล้ว — เพิ่มงบได้ที่หน้า /admin/ai`;
const BUDGET_OUT = "ถึงงบค่า AI ของเดือนนี้แล้ว";

export interface OneCallRound {
  href: string;
  format: Format;
  length: Length | null;
  count: number;
  writer?: string;
  messages: (piece: number) => ChatMessage[];
  parse: (reply: string, piece: number) => ContentOutput | null;
  /** where a figure may come from; "" flags every figure for the owner to confirm */
  yardstick: string;
  loop: boolean;
  pro: boolean;
  logoSpot?: string;
  page?: string;
  /** names the round in the server log */
  label: string;
}

function checkedText(o: ContentOutput): string {
  return [...o.hooks, o.body, o.closing, o.hashtags.join(" "), posterText(o.poster)].join("\n");
}

export async function oneCallRound(r: OneCallRound): Promise<GenerateResult> {
  const logo = r.format === "script" ? null
    : await roundLogo(typeof r.page === "string" ? r.page : null, isLogoSpot(r.logoSpot) ? r.logoSpot : null);
  let hold: string | null = null;
  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) return { ok: false, error: capReached(cap) };
    const writer = writerOf(r.writer, cap - spent);
    const held = await holdContentBudget(r.count * (writer.thb + OVERHEAD_THB), cap);
    if (!held.ok) return { ok: false, error: `งบสร้างคอนเทนต์เดือนนี้เหลือ ${held.left.toFixed(2)} บาท ไม่พอรอบนี้ — ลดจำนวนชิ้นหรือเลือกโมเดลประหยัด` };
    hold = held.id;
    const words = await listWords();

    const settled = await Promise.allSettled(Array.from({ length: r.count }, async (_, i) => {
      const reply = await chat({
        tier: "large", task: "content", messages: r.messages(i),
        maxTokens: 4000, json: true, timeoutMs: WRITE_TIMEOUT_MS, effort: "low",
        prefer: writer.model, within: fallbackWriters(writer.model),
      });
      const parsed = r.parse(reply.text, i);
      const output = parsed && ownerWording(parsed);
      if (!output) {
        console.error(`${r.label} piece unreadable (${reply.model}, ${reply.outputTokens} tokens):`, reply.text.length);
        throw new UnreadableReply();
      }
      return {
        output: {
          ...output, ...(r.loop ? { loop: true } : {}), ...(r.pro ? { pro: true } : {}),
          ...(logo && output.poster ? { poster: { ...output.poster, logo } } : {}),
        },
        model: reply.model, costThb: reply.costThb,
      };
    }));
    const written = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
    const reasons = settled.flatMap((s) => (s.status === "rejected" ? [s.reason as unknown] : []));
    if (written.length === 0) {
      const why = reasons.find((x) => x instanceof BudgetExceeded) ?? reasons[0];
      if (why instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
      if (why instanceof UnreadableReply) return { ok: false, error: why.message };
      throw why;
    }

    const items: ContentItem[] = [];
    for (const w of written) {
      try {
        items.push(await saveContent({
          planHref: r.href, format: r.format, angle: "", length: r.length, output: w.output,
          flags: {
            numbers: strayNumbers(checkedText(w.output), r.yardstick),
            words: findWords(checkedText(w.output), words),
            policy: checkPolicy(checkedText(w.output)),
            fixes: null,
          },
          rateVersion: null, model: w.model, costThb: w.costThb, hookTemplateId: null,
        }));
      } catch (e) {
        console.error(`${r.label} save failed mid-round:`, e);
        return items.length
          ? { ok: false, error: `บันทึกได้ ${items.length} จาก ${written.length} ชิ้น — ดูชิ้นที่ได้ในรอตรวจ`, saved: items.length, items }
          : { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ", saved: 0 };
      }
    }
    return { ok: true, items, costThb: items.reduce((s, i) => s + i.costThb, 0), missing: r.count - items.length };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
    console.error(`${r.label} write failed:`, e);
    return { ok: false, error: "สร้างไม่สำเร็จ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ" };
  } finally {
    if (hold) await releaseContentBudget(hold);
  }
}
