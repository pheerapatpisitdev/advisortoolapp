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
import { cleanTurns as cleanTestTurns, runBotTest, type TestRun, type TestTurn } from "@/lib/chat/bot-tests";
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

/**
 * The inbox's own turn for one Page, rehearsed: what tryBot plays once and a saved test replays
 * message by message. The Page's greeting and the taught answers are read once per call.
 */
async function turnFor(pageId: unknown, cameFor: unknown) {
  const page = await pageOf(pageId).catch(() => undefined);
  const product = PRODUCTS.includes(cameFor as Product) ? (cameFor as Product) : undefined;
  const expat = isExpatPage(page);
  const [welcome, lessons] = await Promise.all([
    expat ? undefined : loadWelcome(page),
    expat ? undefined : loadLessons({ fresh: true }),
  ]);
  return (history: ChatMessage[], slots: AnySlots | null) =>
    rehearse(() => answerAny(history, slots, "facebook", product, page, welcome, lessons));
}

export async function tryBot(
  history: unknown, slots: unknown, pageId: unknown, cameFor: unknown,
): Promise<Result<{ tried: Tried }>> {
  await requireStaff("admin");
  const turns = cleanTurns(history);
  if (turns.at(-1)?.role !== "user" || !turns.at(-1)!.content.trim()) return { ok: false, error: "พิมพ์ข้อความก่อนส่ง" };
  try {
    const play = await turnFor(pageId, cameFor);
    // the session the browser holds is the browser's: it is only ever handed back to the bot
    const stored = slots && typeof slots === "object" ? (slots as AnySlots) : null;
    const answer = await play(turns, stored);
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
  /** บังคับตอบ (the default here) or a note for the model */
  strict?: boolean;
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
  const strict = input?.strict ?? true;
  const numbered = strict ? [question, ...phrasings].find((q) => !teachable(q)) : undefined;
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
      .insert({ question, answer, phrasings, page_id: pageId, strict, enabled: true })
      .select("id").single();
    if (error) throw new Error(error.message);
    const id = String((data as { id: unknown }).id);
    await audit("teach-lesson", id, { question, pageId, strict, phrasings: phrasings.length });
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

/** One row of ins_faq as the คำตอบที่สอนไว้ tab lists it: taught answers and the model's notes alike. */
export interface Taught {
  id: string;
  question: string;
  answer: string;
  phrasings: string[];
  pageId: string | null;
  /** บังคับตอบ: sent word for word; otherwise a note the model reads */
  strict: boolean;
  enabled: boolean;
  hits: number;
  lastHitAt: string | null;
  updatedAt: string;
}

/** more than the owner will write by hand; the tab filters in the browser */
const MOST_TAUGHT = 500;

export async function listTaught(): Promise<Result<{ rows: Taught[] }>> {
  await requireStaff("admin");
  try {
    const { data, error } = await supabaseAdmin().from("ins_faq")
      .select("id, question, answer, phrasings, page_id, strict, enabled, hits, last_hit_at, updated_at")
      .order("updated_at", { ascending: false }).limit(MOST_TAUGHT);
    if (error) throw new Error(error.message);
    return {
      ok: true,
      rows: ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        question: String(r.question),
        answer: String(r.answer),
        phrasings: Array.isArray(r.phrasings) ? r.phrasings.map(String) : [],
        pageId: r.page_id ? String(r.page_id) : null,
        strict: Boolean(r.strict),
        enabled: Boolean(r.enabled),
        hits: Number(r.hits ?? 0),
        lastHitAt: r.last_hit_at ? String(r.last_hit_at) : null,
        updatedAt: String(r.updated_at),
      })),
    };
  } catch (e) {
    console.error("taught answers unreadable:", e);
    return { ok: false, error: "อ่านรายการไม่สำเร็จ ลองรีเฟรชหน้านี้" };
  }
}

/**
 * Saves an edit, and the switch between บังคับตอบ and a note for the model. Switching a row to
 * บังคับตอบ is held to the same rule as teaching one: no question with a figure in it.
 */
export async function updateTaught(id: string, input: TeachInput & { strict: boolean }): Promise<Result> {
  await requireStaff("admin");
  if (typeof id !== "string" || !id) return { ok: false, error: "ไม่พบรายการนี้" };
  const question = String(input?.question ?? "").trim().slice(0, MAX_Q);
  const answer = String(input?.answer ?? "").trim().slice(0, MAX_A);
  const phrasings = [...new Set((Array.isArray(input?.phrasings) ? input.phrasings : [])
    .map((p) => String(p).trim().slice(0, MAX_Q)).filter(Boolean))].slice(0, MAX_PHRASINGS);
  const strict = Boolean(input?.strict);
  if (question.length < 2 || answer.length < 2) return { ok: false, error: "พิมพ์คำถามและคำตอบก่อนบันทึก" };
  const numbered = strict ? [question, ...phrasings].find((q) => !teachable(q)) : undefined;
  if (numbered) return { ok: false, error: `“${numbered}” มีตัวเลข ใช้แบบบังคับตอบไม่ได้ เลือก “ให้ AI อ้างอิง” แทน` };
  const pageId = input?.pageId ? await pageOf(input.pageId).catch(() => undefined) : null;
  if (input?.pageId && !pageId) return { ok: false, error: "ไม่พบเพจนี้" };
  try {
    const { error } = await supabaseAdmin().from("ins_faq")
      .update({ question, answer, phrasings, page_id: pageId, strict, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await audit("teach-edit", id, { question, strict, pageId });
    revalidatePath("/admin/knowledge");
    return { ok: true };
  } catch (e) {
    console.error("taught answer not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

/** A saved conversation as the ชุดเทส tab lists it, with its last run. */
export interface BotTest {
  id: string;
  name: string;
  pageId: string | null;
  cameFor: string | null;
  turns: TestTurn[];
  lastRunAt: string | null;
  lastOk: boolean | null;
  lastResult: TestRun | null;
}

const MOST_TESTS = 200;

function testOf(r: Record<string, unknown>): BotTest {
  return {
    id: String(r.id),
    name: String(r.name),
    pageId: r.page_id ? String(r.page_id) : null,
    cameFor: r.came_for ? String(r.came_for) : null,
    turns: cleanTestTurns(r.turns),
    lastRunAt: r.last_run_at ? String(r.last_run_at) : null,
    lastOk: typeof r.last_ok === "boolean" ? r.last_ok : null,
    lastResult: (r.last_result as TestRun | null) ?? null,
  };
}

export async function listBotTests(): Promise<Result<{ tests: BotTest[] }>> {
  await requireStaff("admin");
  try {
    const { data, error } = await supabaseAdmin().from("ins_bot_tests")
      .select("id, name, page_id, came_for, turns, last_run_at, last_ok, last_result")
      .order("created_at", { ascending: false }).limit(MOST_TESTS);
    if (error) throw new Error(error.message);
    return { ok: true, tests: ((data ?? []) as Record<string, unknown>[]).map(testOf) };
  } catch (e) {
    console.error("bot tests unreadable:", e);
    return { ok: false, error: "อ่านชุดเทสไม่สำเร็จ ลองรีเฟรชหน้านี้" };
  }
}

/** Saves a conversation from the test chat as a test: its name, its Page, and each message's checks. */
export async function saveBotTest(name: string, pageId: string | null, cameFor: string | null, turns: unknown): Promise<Result<{ id: string }>> {
  await requireStaff("admin");
  const title = String(name ?? "").trim().slice(0, 120);
  const clean = cleanTestTurns(turns);
  if (!title) return { ok: false, error: "ตั้งชื่อชุดเทสก่อนบันทึก" };
  if (!clean.length) return { ok: false, error: "ยังไม่มีข้อความลูกค้าให้เก็บ" };
  const page = pageId ? await pageOf(pageId).catch(() => undefined) : null;
  const product = PRODUCTS.includes(cameFor as Product) ? cameFor : null;
  try {
    const { data, error } = await supabaseAdmin().from("ins_bot_tests")
      .insert({ name: title, page_id: page ?? null, came_for: product, turns: clean })
      .select("id").single();
    if (error) throw new Error(error.message);
    const id = String((data as { id: unknown }).id);
    await audit("bot-test-save", id, { name: title, turns: clean.length });
    return { ok: true, id };
  } catch (e) {
    console.error("bot test not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

/**
 * Replays one saved test against the bot as it is now, and keeps the result beside it. A test
 * whose turns reach a model is paid for like any other turn, which the tab says before running.
 */
export async function runBotTestNow(id: string): Promise<Result<{ test: BotTest }>> {
  await requireStaff("admin");
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.from("ins_bot_tests")
      .select("id, name, page_id, came_for, turns, last_run_at, last_ok, last_result").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ok: false, error: "ไม่พบชุดเทสนี้" };
    const test = testOf(data as Record<string, unknown>);
    const run = await runBotTest(test.turns, await turnFor(test.pageId, test.cameFor));
    const at = new Date().toISOString();
    const saved = await db.from("ins_bot_tests").update({ last_run_at: at, last_ok: run.ok, last_result: run }).eq("id", id);
    if (saved.error) console.error("bot test result not kept:", saved.error.message);
    return { ok: true, test: { ...test, lastRunAt: at, lastOk: run.ok, lastResult: run } };
  } catch (e) {
    console.error("bot test run failed:", e);
    return { ok: false, error: "รันชุดเทสไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

export async function deleteBotTest(id: string): Promise<Result> {
  await requireStaff("admin");
  try {
    const { error } = await supabaseAdmin().from("ins_bot_tests").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await audit("bot-test-delete", id);
    return { ok: true };
  } catch (e) {
    console.error("bot test not deleted:", e);
    return { ok: false, error: "ลบไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}
