import { BudgetExceeded, chat } from "@/lib/ai/client";
import type { ChatImage } from "@/lib/ai/types";
import type { GenerateResult } from "@/app/studio/actions";
import {
  attachPapers, BUDGET_OUT, capReached, READ_FALLBACK, READ_HOLD_THB, READ_TIMEOUT_MS, READER, type Paper,
} from "./claim-run";
import { formulaOf } from "./formula";
import { modeChecks } from "./mode-checks";
import { oneCallRound } from "./one-call-run";
import { LENGTHS, MAX_READER, type Length } from "./prompt";
import {
  cleanShowcaseFacts, MAX_DOCS, MAX_SHOWCASE_PIECES, parseShowcasePiece, parseShowcaseRead, SHOWCASE_HREF, showcaseAngleLines,
  showcaseFactsBlock, showcaseFormat, showcaseMessages, showcaseReadMessages, showcaseTooThin, type ShowcaseRead,
} from "./showcase";
import { contentCap, contentSpentThisMonth, holdContentBudget, releaseContentBudget } from "./store";

/**
 * โชว์ผลงาน on the server: reading the pictures, and writing the pieces. Called by
 * /api/content-showcase only, which checks the consent tick and the files first.
 */

export const THIN_SHOWCASE = "AI อ่านไม่ออกว่ารูปนี้แสดงผลงานอะไร — ลองรูปที่ชัดขึ้น หรือเล่าเองในช่อง “เล่าเพิ่ม” แล้วลองใหม่นะครับ";

export type ShowcaseReadResult = ({ ok: true; costThb: number } & ShowcaseRead) | { ok: false; error: string };

export async function readShowcase(images: ChatImage[]): Promise<ShowcaseReadResult> {
  if (images.length === 0 || images.length > MAX_DOCS) return { ok: false, error: `เลือกรูป 1–${MAX_DOCS} รูปนะครับ` };
  let hold: string | null = null;
  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) return { ok: false, error: capReached(cap) };
    const held = await holdContentBudget(READ_HOLD_THB, cap);
    if (!held.ok) return { ok: false, error: `งบสร้างคอนเทนต์เดือนนี้เหลือ ${held.left.toFixed(2)} บาท ไม่พออ่านรูป — เพิ่มงบได้ที่หน้าตั้งค่า` };
    hold = held.id;
    const [system, user] = showcaseReadMessages(images.length);
    const r = await chat({
      tier: "large", task: "content-showcase-read", messages: [system, { ...user, images }],
      maxTokens: 8000, json: true, timeoutMs: READ_TIMEOUT_MS, prefer: READER, within: READ_FALLBACK,
    });
    const read = parseShowcaseRead(r.text, images.length);
    if (!read) {
      console.error(`showcase read unreadable (${r.model}, ${r.outputTokens} tokens):`, r.text.slice(0, 600));
      return { ok: false, error: "AI อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้ง หรือแคปหน้าจอให้ชัดขึ้นนะครับ" };
    }
    return { ok: true, costThb: r.costThb, ...read };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
    console.error("showcase read failed:", e);
    return { ok: false, error: "อ่านรูปไม่สำเร็จ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ" };
  } finally {
    if (hold) await releaseContentBudget(hold);
  }
}

export interface ShowcaseWriteInput {
  facts: unknown;
  count: number;
  /** โพสต์ or สคริปต์; never an ad */
  format?: string;
  length?: string;
  loop?: boolean;
  /** the writing formula (formula.ts); posts and scripts */
  formula?: string | null;
  logoSpot?: string;
  /** the Page the screen asks for; the action settles it (projectPage) and hands the runner the answer */
  page?: string;
  writer?: string;
  /** an angle id, "custom" with the owner's words, or "" for the AI's turn-taking */
  angle?: string;
  custom?: string;
  reader?: string;
  /** the pictures for the poster, one to MAX_PAPERS, stickered in the browser; none draws the plain poster */
  papers: Paper[];
}

/** โชว์ผลงาน's pieces, written one call each and filed with their stickered pictures. */
export async function writeShowcase(input: ShowcaseWriteInput, pageId: string | null): Promise<GenerateResult> {
  const facts = cleanShowcaseFacts(input.facts);
  if (showcaseTooThin(facts)) return { ok: false, error: THIN_SHOWCASE };
  const format = showcaseFormat(input.format);
  const length: Length | null = format === "script" ? (LENGTHS.find((l) => l.id === input.length)?.id ?? "60") : null;
  const loop = format === "script" && input.loop === true;
  const formula = formulaOf(input, format);
  const reader = (typeof input.reader === "string" ? input.reader : "").trim().slice(0, MAX_READER);
  const count = Math.min(MAX_SHOWCASE_PIECES, Math.max(1, Math.round(Number(input.count) || 1)));
  const angles = showcaseAngleLines({ angle: input.angle, custom: input.custom }, count);
  const round = await oneCallRound({
    href: SHOWCASE_HREF, format, length, loop, formula, count,
    writer: input.writer,
    messages: (i) => showcaseMessages(facts, angles[i], reader, format, length, loop, formula),
    parse: (reply, i) => parseShowcasePiece(reply, facts, angles[i].label, format),
    // the facts are where a figure may come from; one the AI brought in is flagged
    yardstick: showcaseFactsBlock(facts),
    checks: modeChecks(SHOWCASE_HREF, undefined),
    logoSpot: input.logoSpot, pageId, label: "showcase",
  });
  // a script is spoken to camera: no poster, so no pictures on one
  if (!round.ok || !input.papers.length || format === "script") return round;
  return { ...round, items: await Promise.all(round.items.map((item) => attachPapers(item, input.papers))) };
}
