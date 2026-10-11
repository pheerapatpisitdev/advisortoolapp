import { AsyncLocalStorage } from "node:async_hooks";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * The questions this system could not answer, kept so that next month it can.
 *
 * `/admin/crm` has had a tab for these since it was built and it has always been empty:
 * nothing ever wrote to `ins_unanswered`. The consequence showed up the day a customer was
 * told there was no picture of the comparison table — there is one, and this brain sends it
 * unprompted — and the only reason anybody found out is that the owner happened to be looking
 * at their own screen. A question that falls through and is not written down is a bug that can
 * only be caught by luck.
 *
 * What is written down is bounded by what advisortool.app/privacy already promises, which the
 * owner chose to keep rather than widen: the question, rewritten to take out anything personal,
 * for thirty days, tied to no one and to no conversation. Not the answer, not who asked, not
 * which conversation it belonged to.
 */

/** Long enough to be a question, short enough that a pasted document is not stored. */
const MAX = 300;

/**
 * The patterns worth taking out, in the order they have to run.
 *
 * Ordering is not cosmetic. A national id is thirteen digits and a mobile number is ten, so
 * the longer one is matched first — the other way round, the id's first ten digits are taken
 * as a phone number and three digits of it are written down.
 */
const SCRUB: [RegExp, string][] = [
  [/\b\d[\d\s-]{11,}\d\b/g, "[เลขบัตร]"],
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, "[อีเมล]"],
  [/(?:line|ไลน์)\s*(?:id)?\s*[:：]?\s*[@]?[\w.\-_]{3,}/gi, "[ไลน์]"],
  [/(?:\+66|0)[\d\s-]{8,11}\d/g, "[เบอร์]"],
];

/** The same contact details taken out of any text, whatever its length — the transcripts use it too. */
export function scrubContact(text: string): string {
  let out = text;
  for (const [pattern, replacement] of SCRUB) out = out.replace(pattern, replacement);
  return out;
}

/**
 * A question with the person taken out of it.
 *
 * Deliberately not "remove every number". An age and a sum assured are the question — strip
 * them and what is left is "ผู้ชาย [เลข] ปี ทุน [เลข]", which is every quotation ever asked
 * for and teaches nothing. So each pattern is written to match a shape a customer's contact
 * details have and a premium question does not.
 *
 * Undefined where nothing survives, because a message that was only a phone number is not a
 * question and keeping the word "[เบอร์]" three hundred times helps no one.
 */
export function scrubForLearning(question: string): string | undefined {
  const out = scrubContact(question).replace(/\s+/g, " ").trim().slice(0, MAX);
  // what is left has to contain something that is not a placeholder
  const bare = out.replace(/\[(เลขบัตร|อีเมล|ไลน์|เบอร์)\]/g, "").trim();
  return bare.length > 0 ? out : undefined;
}

export interface Unanswered {
  question: string;
  /** which path answered it — "library", "brain": where to look first */
  route: string;
  product?: string;
  /**
   * What the customer appeared to want. The column is NOT NULL, so this is defaulted rather
   * than omitted — the first version left it out and every insert was rejected.
   */
  intent?: string;
}

/**
 * Write one down, and take the old ones out on the way past.
 *
 * The thirty days is a promise on a public page, so it is enforced where the writing happens
 * rather than left to a scheduled job that can be switched off without anybody noticing the
 * promise has quietly stopped being true.
 *
 * Never throws. This is a note to ourselves taken while a customer is waiting for an answer;
 * a failure to take it must not become a failure to answer them.
 */
export async function recordUnanswered(entry: Unanswered): Promise<void> {
  const question = scrubForLearning(entry.question);
  if (!question) return;

  try {
    const supabase = supabaseAdmin();
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    /**
     * The error is read, not assumed away.
     *
     * The Supabase client returns a failure in the result rather than throwing one, so the
     * try/catch around this caught nothing and the first version of this function reported
     * success while every single insert was being rejected — `intent` is NOT NULL and was
     * being left out. A note nobody can see failing is worse than no note, because the empty
     * tab reads as "no customer has ever asked anything we could not answer".
     */
    const { error } = await supabase.from("ins_unanswered").insert({
      question,
      route: entry.route,
      intent: entry.intent ?? "other",
      ...(entry.product ? { product: entry.product } : {}),
    });
    if (error) {
      console.error("recordUnanswered rejected:", error.message);
      return;
    }
    await supabase.from("ins_unanswered").delete().lt("at", cutoff);
  } catch (e) {
    console.error("recordUnanswered failed:", e);
  }
}

/**
 * Take the note once the customer has their answer.
 *
 * `after` is the right tool and it is not always available: it throws outside a request
 * scope, which is where a unit test calling the answer function directly runs. Rather than
 * let a note-taking convenience fail three tests — or, worse, teach the next person to drop
 * the call from the tested path — the absence of a request is treated as what it is. There is
 * no customer there, so there is nothing to learn from, and nothing is written.
 *
 * Not a silent catch of anything else: a real failure inside `recordUnanswered` still reaches
 * the console, which is the lesson from the version of this that reported success while every
 * insert was being rejected.
 */
/**
 * A turn played in /admin/teach's test chat. The owner trying the bot out is not a customer
 * whose question went unanswered, and /admin/crm would fill with the owner's own tries.
 */
const rehearsal = new AsyncLocalStorage<true>();

/** Runs a turn as a rehearsal: nothing it fails to answer is written down. */
export function rehearse<T>(turn: () => Promise<T>): Promise<T> {
  return rehearsal.run(true, turn);
}

export function noteAfterAnswer(entry: Unanswered): void {
  if (rehearsal.getStore()) return;
  try {
    after(() => recordUnanswered(entry));
  } catch {
    // no request in scope: a test, not a customer
  }
}
