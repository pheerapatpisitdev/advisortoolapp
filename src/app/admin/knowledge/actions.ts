"use server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ContentWord, WordKind } from "@/lib/content/check";
import { addWord, deleteWord, listWords } from "@/lib/content/store";
import { requireStaff } from "@/lib/auth/viewer";

/**
 * What the assistant knows on top of the plan rules.
 *
 * The box lived on the home page and was open to anyone, which was the owner's decision when
 * that page was the agent's own. It is a customer's page now — and since the notes reach the
 * Messenger bot as well, a stranger typing into it would be typing into what the page says to
 * people who arrived through an advertisement. So it sits behind the PIN, and these actions
 * ask for it: they never did, which meant the delete button was a public one.
 */

/** the same caps the box enforces on screen, kept here because the browser is not the guard */
const MAX_Q = 200;
const MAX_A = 2000;

/**
 * What every action that changes something answers with.
 *
 * The toggle and the two deletes used to catch their own failure and return nothing, and
 * the page updated itself regardless — so a delete the database had refused looked done,
 * and the note came back on the next visit, still reaching the bot. Now the page moves only
 * on `ok`, and says the error otherwise.
 */
export type Result = { ok: true } | { ok: false; error: string };

export interface Note {
  id: string;
  question: string;
  answer: string;
  enabled: boolean;
  updatedAt: string;
}

export async function listNotes(): Promise<Note[]> {
  await requireStaff("admin");
  try {
    const { data, error } = await supabaseAdmin()
      .from("ins_faq").select("id, question, answer, enabled, updated_at")
      .order("updated_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id), question: String(r.question), answer: String(r.answer),
      enabled: Boolean(r.enabled), updatedAt: String(r.updated_at),
    }));
  } catch (e) {
    console.error("อ่านบันทึกไม่สำเร็จ:", e);
    return [];
  }
}

export async function addNote(question: string, answer: string): Promise<Result> {
  await requireStaff("admin");
  const q = question.trim().slice(0, MAX_Q);
  const a = answer.trim().slice(0, MAX_A);
  if (q.length < 4 || a.length < 4) return { ok: false, error: "พิมพ์คำถามและคำตอบให้ยาวกว่านี้หน่อยครับ" };
  try {
    const { error } = await supabaseAdmin().from("ins_faq").insert({ question: q, answer: a, enabled: true });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/knowledge");
    return { ok: true };
  } catch (e) {
    console.error("เพิ่มบันทึกไม่สำเร็จ:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

export async function setNoteEnabled(id: string, enabled: boolean): Promise<Result> {
  await requireStaff("admin");
  try {
    const { error } = await supabaseAdmin().from("ins_faq").update({ enabled: Boolean(enabled) }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/knowledge");
    return { ok: true };
  } catch (e) {
    console.error("เปิด/ปิดบันทึกไม่สำเร็จ:", e);
    return { ok: false, error: "เปิด/ปิดไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

export async function deleteNote(id: string): Promise<Result> {
  await requireStaff("admin");
  try {
    const { error } = await supabaseAdmin().from("ins_faq").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/knowledge");
    return { ok: true };
  } catch (e) {
    console.error("ลบบันทึกไม่สำเร็จ:", e);
    return { ok: false, error: "ลบไม่สำเร็จ บันทึกยังอยู่ ลองใหม่อีกครั้งนะครับ" };
  }
}

/* ------------------------------------------------------------------ *
 * The words the content generator's first check looks for
 *
 * Claims an advertisement must not make, and misspellings with their
 * fix. Kept here rather than on /content because that page is public
 * and this list decides what the owner is warned about.
 * ------------------------------------------------------------------ */

const MAX_WORD = 60;

export async function listContentWords(): Promise<ContentWord[]> {
  await requireStaff("admin");
  return listWords();
}

export async function addContentWord(word: string, kind: WordKind, fix: string): Promise<Result> {
  await requireStaff("admin");
  const w = word.trim().slice(0, MAX_WORD);
  const f = fix.trim().slice(0, MAX_WORD);
  if (!w) return { ok: false, error: "พิมพ์คำก่อนนะครับ" };
  if (kind === "misspelling" && !f) return { ok: false, error: "คำสะกดผิดต้องใส่คำที่ถูกด้วยครับ" };
  try {
    await addWord(w, kind, kind === "misspelling" ? f : null);
    revalidatePath("/admin/knowledge");
    return { ok: true };
  } catch (e) {
    console.error("เพิ่มคำไม่สำเร็จ:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

export async function removeContentWord(word: string): Promise<Result> {
  await requireStaff("admin");
  try {
    await deleteWord(word);
    revalidatePath("/admin/knowledge");
    return { ok: true };
  } catch (e) {
    console.error("ลบคำไม่สำเร็จ:", e);
    return { ok: false, error: "ลบคำไม่สำเร็จ คำนี้ยังอยู่ ลองใหม่อีกครั้งนะครับ" };
  }
}

/* ------------------------------------------------------------------ *
 * Lessons from the chats: the daily review and its proposals
 *
 * A proposal reaches customers only through ใช้, which copies it into ins_faq, so it is read
 * the way every other note is. ข้าม keeps it out of the list without deleting the review.
 * ------------------------------------------------------------------ */

export interface ChatReview {
  id: number;
  createdAt: string;
  conversations: number;
  summary: string;
  costThb: number;
}

export interface Lesson {
  id: number;
  kind: "unanswered" | "wrong" | "dropoff" | "agent";
  question: string;
  evidence: string;
  answer: string;
  reviewedAt: string;
}

export async function listLessons(): Promise<{ review: ChatReview | null; lessons: Lesson[] }> {
  await requireStaff("admin");
  try {
    const db = supabaseAdmin();
    const [rev, items] = await Promise.all([
      db.from("ins_chat_reviews").select("id, created_at, conversations, summary, cost_thb")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("ins_chat_review_items").select("id, kind, question, evidence, answer, ins_chat_reviews(created_at)")
        .eq("status", "open").order("id", { ascending: false }).limit(40),
    ]);
    if (rev.error) throw new Error(rev.error.message);
    if (items.error) throw new Error(items.error.message);
    const r = rev.data as Record<string, unknown> | null;
    return {
      review: r ? {
        id: Number(r.id), createdAt: String(r.created_at), conversations: Number(r.conversations),
        summary: String(r.summary), costThb: Number(r.cost_thb),
      } : null,
      lessons: ((items.data ?? []) as Record<string, unknown>[]).map((x) => ({
        id: Number(x.id),
        kind: x.kind as Lesson["kind"],
        question: String(x.question),
        evidence: String(x.evidence ?? ""),
        answer: String(x.answer),
        reviewedAt: String((x.ins_chat_reviews as { created_at?: string } | null)?.created_at ?? ""),
      })),
    };
  } catch (e) {
    console.error("อ่านบทเรียนจากแชทไม่สำเร็จ:", e);
    return { review: null, lessons: [] };
  }
}

/** The owner's ใช้: the answer as they left it, into the notes the AI reads. */
export async function applyLesson(id: number, question: string, answer: string): Promise<Result> {
  await requireStaff("admin");
  const q = question.trim().slice(0, MAX_Q);
  const a = answer.trim().slice(0, MAX_A);
  if (q.length < 4 || a.length < 4) return { ok: false, error: "คำถามหรือคำตอบสั้นเกินไปครับ" };
  if (/\[ตรวจ:/.test(a)) return { ok: false, error: "ยังมีจุด [ตรวจ: …] ในคำตอบ แก้ให้เรียบร้อยก่อนกดใช้นะครับ" };
  try {
    const db = supabaseAdmin();
    const faq = await db.from("ins_faq").insert({ question: q, answer: a, enabled: true }).select("id").single();
    if (faq.error || !faq.data) throw new Error(faq.error?.message ?? "no row");
    const { error } = await db.from("ins_chat_review_items")
      .update({ status: "used", faq_id: (faq.data as { id: string }).id, decided_at: new Date().toISOString(), question: q, answer: a })
      .eq("id", id);
    if (error) console.error("บันทึกสถานะบทเรียนไม่สำเร็จ:", error.message);
    revalidatePath("/admin/knowledge");
    return { ok: true };
  } catch (e) {
    console.error("ใช้บทเรียนไม่สำเร็จ:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

export async function skipLesson(id: number): Promise<Result> {
  await requireStaff("admin");
  try {
    const { error } = await supabaseAdmin().from("ins_chat_review_items")
      .update({ status: "skipped", decided_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/knowledge");
    return { ok: true };
  } catch (e) {
    console.error("ข้ามบทเรียนไม่สำเร็จ:", e);
    return { ok: false, error: "ข้ามไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

/** The same review the morning cron runs, on the owner's press. */
export async function reviewChatsNow(): Promise<Result> {
  await requireStaff("admin");
  try {
    const { runChatReview } = await import("@/lib/chat/review");
    const r = await runChatReview();
    if (!r.ok) return { ok: false, error: `สรุปไม่สำเร็จ: ${r.error ?? ""}` };
    revalidatePath("/admin/knowledge");
    return { ok: true };
  } catch (e) {
    console.error("สรุปแชทไม่สำเร็จ:", e);
    return { ok: false, error: "สรุปแชทไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
