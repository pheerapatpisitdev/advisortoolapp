"use server";
import { cookies, headers } from "next/headers";
import { answerFromKnowledge, type CopilotAnswer } from "@/lib/copilot/answer";
import { clientIp, allow } from "@/lib/assistant/rate-limit";
import { ASKS_COOKIE, ASKS_MAX_AGE_S, decodeAsks, encodeAsks, FREE_ASKS } from "@/lib/auth/free-asks";
import { sessionSecret } from "@/lib/auth/session";
import { getViewer } from "@/lib/auth/viewer";
import { BudgetExceeded } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import type { AnySlots } from "@/lib/assistant/slots";
import { cleanHistory, cleanSlots } from "@/lib/chat/public-input";
import { claimWebAsk } from "@/lib/chat/web-asks";

/**
 * The home page's assistant, open to anyone — which the owner chose knowingly after being
 * told what it means: this and the Messenger bot spend one monthly budget, so a busy day
 * here is a quieter one there.
 *
 * What is kept is the burst limit the bot already uses. It is not a gate — nobody is asked
 * who they are — it only stops one caller asking eight times a minute, which no person does
 * and a script does immediately.
 *
 * Somebody not signed in gets FREE_ASKS answers, then an invitation to sign up or sign in
 * (owner, 2026-10-01, in place of closing the site): see src/lib/auth/free-asks.ts.
 *
 * Everything the browser sends is cleaned before a model sees it, and the cookie's count has
 * a database count behind it per address per day (review, 2026-10-01): a server action takes
 * whatever its caller posts, not only what the page would have sent. See
 * src/lib/chat/public-input.ts and src/lib/chat/web-asks.ts for what and how many.
 */

const MAX_QUESTION = 500;

const BUSY = "ตอนนี้มีคำถามเข้ามาเยอะครับ รบกวนรอสักครู่แล้วถามใหม่นะครับ";
const OUT_OF_BUDGET = "ตอนนี้ผู้ช่วยปิดชั่วคราวครับ รบกวนติดต่อตัวแทนโดยตรงนะครับ";
const BROKEN = "ขออภัยครับ ระบบขัดข้องชั่วคราว ลองถามใหม่อีกครั้งนะครับ";
const SIGN_UP =
  `ถามฟรีครบ ${FREE_ASKS} ข้อแล้วครับ สมัครสมาชิกฟรีเพื่อถามต่อได้ไม่จำกัด และได้ลองใช้ Studio ช่วยเขียนคอนเทนต์ฟรี 10 รอบ\n\n` +
  "[สมัครสมาชิก](/signup?next=/home) · [เข้าสู่ระบบ](/?next=/home)";

/** Whoever is asking, as well as this can be known behind a proxy: the platform's x-real-ip first (see clientIp). */
async function caller(): Promise<string> {
  return clientIp(await headers());
}

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

  // a failed read of who is asking is somebody not signed in: they still get their free questions
  const signedIn = Boolean(await getViewer().catch(() => null));
  const jar = await cookies();
  const used = signedIn ? 0 : decodeAsks(jar.get(ASKS_COOKIE)?.value, sessionSecret());
  if (!signedIn && used >= FREE_ASKS) return { text: SIGN_UP, model: "—" };

  const ip = await caller();
  if (!allow(`copilot:${ip}`)) return { text: BUSY, model: "—", failed: true };
  // the count a caller without a cookie cannot reset; members ask without limit
  if (!signedIn && !(await claimWebAsk(ip))) return { text: SIGN_UP, model: "—" };

  try {
    const answer = await answerFromKnowledge(asked, turns, known);
    // only an answer counts: "busy" or a failure is no reason to spend one of the three
    if (!signedIn && !answer.failed) {
      jar.set(ASKS_COOKIE, encodeAsks(used + 1, sessionSecret()), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ASKS_MAX_AGE_S,
      });
    }
    return answer;
  } catch (e) {
    if (e instanceof BudgetExceeded) return { text: OUT_OF_BUDGET, model: "—" };
    console.error("copilot failed:", e);
    return { text: BROKEN, model: "—", failed: true };
  }
}
