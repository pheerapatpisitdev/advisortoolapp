"use server";
import { answerFromKnowledge, type CopilotAnswer } from "@/lib/copilot/answer";
import { allow } from "@/lib/assistant/rate-limit";
import { getViewer } from "@/lib/auth/viewer";
import { BudgetExceeded } from "@/lib/ai/client";
import { asWho } from "@/lib/ai/who";
import { keepAsk } from "@/lib/ai/asks";
import type { ChatMessage } from "@/lib/ai/types";
import type { AnySlots } from "@/lib/assistant/slots";
import { cleanHistory, cleanSlots } from "@/lib/chat/public-input";
import { memberAccess, PASS_EXPIRED_CHAT, PASS_UNREADABLE, passOpen } from "@/lib/members/access";

/**
 * The home page's assistant, for people signed in only (owner, 2026-10-12: "เป็นระบบปิด").
 *
 * Until then somebody not signed in had three free questions, counted in a cookie and per
 * address per day; the owner closed it — the sales pages and the Messenger/LINE bots stay open
 * to customers, the chat does not. /home sends a visitor to sign in before they see it, and this
 * refuses too, because a server action takes whatever its caller posts, not only what the page
 * would have sent.
 *
 * What is kept is the burst limit the bot already uses, per person: it only stops one caller
 * asking eight times a minute, which no person does and a script does immediately.
 *
 * Everything the browser sends is cleaned before a model sees it: see
 * src/lib/chat/public-input.ts for what and how many.
 */

const MAX_QUESTION = 500;

const BUSY = "ตอนนี้มีคำถามเข้ามาเยอะครับ รบกวนรอสักครู่แล้วถามใหม่นะครับ";
const OUT_OF_BUDGET = "ตอนนี้ผู้ช่วยปิดชั่วคราวครับ รบกวนติดต่อตัวแทนโดยตรงนะครับ";
const BROKEN = "ขออภัยครับ ระบบขัดข้องชั่วคราว ลองถามใหม่อีกครั้งนะครับ";
const SIGN_IN = "ถาม AI ใช้ได้เฉพาะสมาชิกครับ เข้าสู่ระบบเพื่อถามต่อได้ไม่จำกัด\n\n[เข้าสู่ระบบ](/?next=/home)";

export async function askCopilot(
  question: string,
  history: ChatMessage[] = [],
  slots: AnySlots | null = null,
): Promise<CopilotAnswer> {
  // typed for the page, but posted by anyone: nothing below trusts the types
  const asked = (typeof question === "string" ? question : "").trim().slice(0, MAX_QUESTION);
  if (!asked) return { text: "", model: "—" };
  const turns = cleanHistory(history);
  const known = cleanSlots(slots);

  // a failed read of who is asking is nobody: no answer is given on a guess
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return { text: SIGN_IN, model: "—" };
  if (!allow(`copilot:${viewer.agentId}`)) return { text: BUSY, model: "—", failed: true };
  // an outside member asks while their pass is live (owner, 2026-10-13); unreadable is no answer
  const access = await memberAccess(viewer).catch((e) => {
    console.error("copilot refused, pass unreadable:", e);
    return null;
  });
  if (!access) return { text: PASS_UNREADABLE, model: "—", failed: true };
  if (!passOpen(access)) return { text: PASS_EXPIRED_CHAT, model: "—" };

  try {
    // free, but written down under who asked, so the owner sees who uses it (owner, 2026-10-10);
    // the words too, for the Super Admin's ประวัติผู้ใช้ (owner chose ก, 2026-10-15)
    return await asWho(viewer.agentId, async () => {
      const got = await answerFromKnowledge(asked, turns, known);
      await keepAsk(viewer.agentId, asked, got.text, got.model, Boolean(got.failed));
      return got;
    });
  } catch (e) {
    if (e instanceof BudgetExceeded) return { text: OUT_OF_BUDGET, model: "—" };
    console.error("copilot failed:", e);
    return { text: BROKEN, model: "—", failed: true };
  }
}
