"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { answerAny } from "@/lib/assistant/dispatch";
import { isExpatPage } from "@/lib/assistant/expat";
import { teachable } from "@/lib/assistant/lessons";
import { recordUnanswered, rehearse } from "@/lib/assistant/unanswered";
import { loadLessons } from "@/lib/chat/lessons-store";
import { loadWelcome } from "@/lib/chat/page-welcome-store";
import { pageConnections } from "@/lib/facebook/connection";
import type { Product } from "@/lib/assistant/choose";
import type { AnySlots } from "@/lib/assistant/slots";
import type { ChatMessage } from "@/lib/ai/types";

/**
 * ห้องสอนบอท (owner, 2026-10-11): the owner talks to the bot as a customer of one Page, and
 * teaches it an answer word for word where its own was wrong.
 *
 * The turn is the inbox's own — `answerAny` on the "facebook" channel, with the Page's greeting
 * and the taught answers, exactly as conversation.ts calls it — and nothing around it: no
 * message leaves for Messenger, no transcript or lead is written, and a question the bot cannot
 * answer is not filed for /admin/crm (rehearse). The model, where a turn reaches one, is real
 * and is paid for like any other.
 */

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** One bubble as the test chat draws it. */
export interface TriedMessage {
  text: string;
  /** a picture on this site: a quotation card, a value table, the intro picture */
  card?: string;
  /** a PDF handed over on this turn */
  file?: string;
}

export interface Tried {
  messages: TriedMessage[];
  replies: string[];
  slots: AnySlots;
  /** where the words came from, for the line under the answer */
  source: "taught" | "model" | "rules";
  /** the model that wrote it, when one did */
  model?: string;
}

const PRODUCTS: readonly Product[] = ["lifeprotect", "ishield", "ihealthy", "legacy", "plb"];
/** as long as a real conversation the test chat replays; older turns fall off */
const MAX_TURNS = 30;
const MAX_SAID = 1000;

/** Only a Page that is connected; the Expat Pages answer in their own bot. */
async function pageOf(pageId: unknown): Promise<string | undefined> {
  if (typeof pageId !== "string" || !pageId) return undefined;
  return (await pageConnections()).some((p) => p.pageId === pageId) ? pageId : undefined;
}

function cleanTurns(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history.slice(-MAX_TURNS).flatMap((m): ChatMessage[] => {
    const role = (m as { role?: unknown })?.role;
    const content = (m as { content?: unknown })?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return [];
    return [{ role, content: content.slice(0, MAX_SAID) }];
  });
}

export async function tryBot(
  history: unknown, slots: unknown, pageId: unknown, cameFor: unknown,
): Promise<Result<{ tried: Tried }>> {
  await requireStaff("admin");
  const turns = cleanTurns(history);
  if (turns.at(-1)?.role !== "user" || !turns.at(-1)!.content.trim()) return { ok: false, error: "พิมพ์ข้อความก่อนส่ง" };
  const page = await pageOf(pageId).catch(() => undefined);
  const product = PRODUCTS.includes(cameFor as Product) ? (cameFor as Product) : undefined;
  try {
    const expat = isExpatPage(page);
    const [welcome, lessons] = await Promise.all([
      expat ? undefined : loadWelcome(page),
      expat ? undefined : loadLessons({ fresh: true }),
    ]);
    // the session the browser holds is the browser's: it is only ever handed back to the bot
    const stored = slots && typeof slots === "object" ? (slots as AnySlots) : null;
    const answer = await rehearse(() => answerAny(turns, stored, "facebook", product, page, welcome, lessons));
    return {
      ok: true,
      tried: {
        messages: answer.messages.map((m) => ({
          text: m.text,
          ...(m.card ? { card: m.card } : {}),
          ...(m.file ? { file: m.file } : {}),
        })),
        replies: answer.replies ?? [],
        slots: answer.slots,
        source: answer.taught ? "taught" : answer.writtenBy ? "model" : "rules",
        ...(answer.writtenBy ? { model: answer.writtenBy } : {}),
      },
    };
  } catch (e) {
    console.error("test chat turn failed:", e);
    return { ok: false, error: "บอทตอบไม่สำเร็จ ลองส่งใหม่อีกครั้ง" };
  }
}

const MAX_Q = 200;
const MAX_A = 2000;
const MAX_PHRASINGS = 10;

export interface TeachInput {
  question: string;
  answer: string;
  /** other ways of asking, one per line on screen */
  phrasings: string[];
  /** this Page only, or every Page and LINE */
  pageId: string | null;
}

/**
 * A taught answer: a row of ins_faq marked strict, which the bot sends word for word
 * (src/lib/assistant/lessons.ts). A question with a figure in it is refused — it is how a
 * customer gives an age or a sum, and one fixed answer would be sent to everyone who does.
 */
export async function teachLesson(input: TeachInput): Promise<Result<{ id: string }>> {
  await requireStaff("admin");
  const question = String(input?.question ?? "").trim().slice(0, MAX_Q);
  const answer = String(input?.answer ?? "").trim().slice(0, MAX_A);
  const phrasings = [...new Set((Array.isArray(input?.phrasings) ? input.phrasings : [])
    .map((p) => String(p).trim().slice(0, MAX_Q)).filter(Boolean))].slice(0, MAX_PHRASINGS);
  if (question.length < 2 || answer.length < 2) return { ok: false, error: "พิมพ์คำถามและคำตอบก่อนบันทึก" };
  const numbered = [question, ...phrasings].find((q) => !teachable(q));
  if (numbered) {
    return {
      ok: false,
      error: `“${numbered}” มีตัวเลข (อายุ ทุน หรือระยะจ่าย) ซึ่งบอทใช้คิดเบี้ย สอนเป็นคำตอบตายตัวไม่ได้ ถ้าบอทตอบผิด กด “แจ้งปัญหาให้ทีมแก้” แทน`,
    };
  }
  const pageId = input?.pageId ? await pageOf(input.pageId).catch(() => undefined) : null;
  if (input?.pageId && !pageId) return { ok: false, error: "ไม่พบเพจนี้" };
  try {
    const { data, error } = await supabaseAdmin().from("ins_faq")
      .insert({ question, answer, phrasings, page_id: pageId, strict: true, enabled: true })
      .select("id").single();
    if (error) throw new Error(error.message);
    const id = String((data as { id: unknown }).id);
    await audit("teach-lesson", id, { question, pageId, phrasings: phrasings.length });
    revalidatePath("/admin/knowledge");
    return { ok: true, id };
  } catch (e) {
    console.error("lesson not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

/**
 * A wrong answer that a fixed sentence cannot fix — the wrong plan quoted, a figure misread —
 * written down where the unanswered questions already are (/admin/crm), with what the bot said,
 * for whoever fixes the bot next.
 */
export async function reportProblem(asked: string, said: string, pageId: string | null): Promise<Result> {
  await requireStaff("admin");
  const question = String(asked ?? "").trim().slice(0, 150);
  if (!question) return { ok: false, error: "ไม่มีข้อความให้แจ้ง" };
  const answer = String(said ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  await recordUnanswered({ question: `${question} → บอทตอบ: ${answer}`, route: "ห้องสอนบอท", intent: "report" });
  await audit("teach-report", pageId, { question });
  return { ok: true };
}
