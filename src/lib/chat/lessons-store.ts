import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Lesson } from "@/lib/assistant/lessons";

/**
 * The taught answers (src/lib/assistant/lessons.ts): the rows of ins_faq the owner marked
 * บังคับตอบ (strict). The rest of ins_faq stays what it was, notes the model reads.
 *
 * Read for every customer message, so it is held for a minute: a lesson saved in /admin/teach
 * reaches the inbox within that minute, and a busy evening does not read the table per message.
 */

const FRESH_MS = 60_000;
/** more than anyone will teach by hand; a ceiling so one bad import cannot slow every turn */
const MOST = 500;

interface Row {
  id: string;
  question: string;
  answer: string;
  phrasings: string[] | null;
  page_id: string | null;
}

let held: { at: number; lessons: Lesson[] } | undefined;

export async function loadLessons(): Promise<Lesson[]> {
  if (held && Date.now() - held.at < FRESH_MS) return held.lessons;
  try {
    const { data, error } = await supabaseAdmin()
      .from("ins_faq")
      .select("id, question, answer, phrasings, page_id")
      .eq("enabled", true)
      .eq("strict", true)
      .limit(MOST);
    if (error) throw new Error(error.message);
    const lessons = ((data ?? []) as Row[]).map((r) => ({
      id: r.id, question: r.question, answer: r.answer, phrasings: r.phrasings ?? [], pageId: r.page_id,
    }));
    held = { at: Date.now(), lessons };
    return lessons;
  } catch (e) {
    // the bot answers without its lessons rather than not at all; the last good list stands
    console.warn("อ่านคำตอบที่สอนไว้ไม่ได้:", e instanceof Error ? e.message : e);
    return held?.lessons ?? [];
  }
}

/** Forgets the held list, so the next message reads the table — after a save in /admin/teach. */
export function forgetLessons(): void {
  held = undefined;
}

/** One more customer answered by this lesson; counted on the side, never in the customer's way. */
export function countLessonHit(id: string): void {
  void (async () => {
    const { error } = await supabaseAdmin().rpc("ins_faq_hit", { faq_id: id });
    if (error) throw new Error(error.message);
  })().catch((e) => console.warn("นับการใช้คำตอบที่สอนไม่ได้:", e instanceof Error ? e.message : e));
}
