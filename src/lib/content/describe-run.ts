import { headers } from "next/headers";
import { BudgetExceeded, chat } from "@/lib/ai/client";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { takeRound } from "@/lib/auth/quota";
import { requireMember } from "@/lib/auth/viewer";
import { payRound } from "@/lib/wallet/round";
import { ceilingBeforeRound } from "./ceiling";
import { OutOfTime, within } from "./deadline";
import { ACCEPTED_TYPES, MAX_IMAGE_BASE64, assemblePrompt, describeMessages, parseDescribed } from "./describe";
import type { Swatch } from "./palette";
import { contentCap, contentSpentThisMonth, holdContentBudget, releaseContentBudget } from "./store";

/**
 * A picture read into a drawing prompt: the round control of drawBackground (the hour's limit,
 * the owner's ceiling, the round and its wallet hold, the content budget set aside), then one
 * call that reads the picture. The picture lives in memory for the call and is not saved.
 */

export { MAX_IMAGE_BASE64 };

/** content-*, so the owner's ceiling counts it (contentBaht in store.ts) */
export const DESCRIBE_TASK = "content-describe-picture";
/** what a read sets aside, in baht: two measured reads cost ฿0.27 and ฿0.30 (2026-10-08), so half as much again, to the next ฿0.10 */
export const DESCRIBE_HOLD_THB = 0.5;
/** each provider's own try, and the whole read: a fallback starts its clock again, so the whole is bounded apart (the route allows 60 s) */
const TRY_MS = 25_000;
const WHOLE_MS = 50_000;
/** the models that can see a picture, as the other picture readers pin them (poster-read.ts): the large tier's chain ends in GLM, which is sent no picture and would invent one */
const READER = "gemini-3.7-flash";
const READ_FALLBACK = ["gpt-5", "claude-sonnet-5"];

/** a read is cheaper and quicker than a picture, so twenty an hour against drawing's forty */
const readPerHour = limiter(20, 60 * 60_000);

/** `palette`: the picture's colours as the browser measured them (palette.ts), already checked by the route */
export interface DescribeInput { base64: string; mimeType: string; palette?: Swatch[] }
export type DescribeResult =
  | { ok: true; prompt: string; summaryTh: string; costThb: number }
  | { ok: false; error: string };

const fail = (error: string): DescribeResult => ({ ok: false, error });

const BAD_PICTURE = "ใช้ได้เฉพาะรูป jpg, png หรือ webp ที่ไม่ใหญ่เกินไป";
const UNREADABLE = "อ่านรูปนี้ไม่สำเร็จ ลองรูปอื่นนะครับ";
const capReached = (cap: number) => `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${cap} บาทแล้ว — เพิ่มงบได้ที่หน้า /admin/ai`;
const tooDear = (left: number) => `งบสร้างคอนเทนต์เดือนนี้เหลือ ${left.toFixed(2)} บาท ไม่พออ่านรูปนี้ — เพิ่มงบได้ที่หน้า /admin/ai`;
const BUDGET_OUT = "ถึงงบค่า AI ของเดือนนี้แล้ว";
const TOO_SLOW = "AI ตอบไม่ทัน — ลองใหม่อีกครั้งนะครับ";

export async function describePicture(input: DescribeInput): Promise<DescribeResult> {
  const viewer = await requireMember();
  const { base64, mimeType } = input;
  const palette = input.palette ?? [];
  if (!(ACCEPTED_TYPES as readonly string[]).includes(mimeType) || typeof base64 !== "string" || !base64 || base64.length > MAX_IMAGE_BASE64) {
    return fail(BAD_PICTURE);
  }
  if (!readPerHour(`describe:${clientIp(await headers())}`)) return fail("อ่านรูปครบ 20 ครั้งในชั่วโมงนี้แล้ว รอสักพักนะครับ");
  // the ceiling before the round is counted, so a round it would refuse costs nobody a free round
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return fail(capReached(ceiling));
  const pass = await takeRound(viewer, "ai-describe", null, DESCRIBE_HOLD_THB);
  if (!pass.ok) return fail(pass.refusal);
  return payRound(pass, async (): Promise<DescribeResult> => {
    let hold: string | null = null;
    try {
      const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
      if (spent >= cap) return fail(capReached(cap));
      const held = await holdContentBudget(DESCRIBE_HOLD_THB, cap);
      if (!held.ok) return fail(tooDear(held.left));
      hold = held.id;
      const read = await within(chat({
        tier: "large", task: DESCRIBE_TASK, messages: describeMessages({ base64, mimeType }, palette),
        json: true, maxTokens: 1500, timeoutMs: TRY_MS, prefer: READER, within: READ_FALLBACK,
      }), WHOLE_MS, "describe");
      const described = parseDescribed(read.text);
      if (!described) return fail(UNREADABLE);
      return { ok: true, prompt: assemblePrompt(described, palette), summaryTh: described.summaryTh, costThb: read.costThb };
    } catch (e) {
      if (e instanceof BudgetExceeded) return fail(BUDGET_OUT);
      if (e instanceof OutOfTime) return fail(TOO_SLOW);
      console.error("picture not read:", e);
      return fail(UNREADABLE);
    } finally {
      if (hold) await releaseContentBudget(hold).catch((e) => console.error("content hold not released:", e));
    }
  });
}
