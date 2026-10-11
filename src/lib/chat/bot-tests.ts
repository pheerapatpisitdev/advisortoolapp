import type { ChatMessage } from "@/lib/ai/types";
import type { AnySlots } from "@/lib/assistant/slots";

/**
 * ชุดเทส (/admin/teach, owner 2026-10-11): a conversation the owner saved, replayed against the
 * bot whenever it changes, each answer checked for words it should and should not say.
 *
 * The replay takes the turn as a function, so this file knows nothing of the database or the
 * model: the action hands it the inbox's own turn, a test hands it a stand-in.
 */

export interface TestTurn {
  /** what the customer types */
  say: string;
  /** words the answer must contain; none means only that it answers at all */
  contains: string[];
  /** words the answer must not contain */
  not: string[];
}

export interface TurnResult {
  say: string;
  /** everything the bot sent for this message, bubbles and buttons */
  said: string;
  ok: boolean;
  missing: string[];
  unwanted: string[];
}

export interface TestRun {
  ok: boolean;
  turns: TurnResult[];
  /** a turn that threw, with the reason; the replay stops there */
  error?: string;
}

/** What a turn hands back that the check reads. */
export interface Answered {
  messages: { text: string }[];
  replies?: string[];
  slots: AnySlots;
}

export type Turn = (history: ChatMessage[], slots: AnySlots | null) => Promise<Answered>;

/** the longest conversation a test may hold; a real one that runs longer is two tests */
export const MOST_TURNS = 20;
const MOST_WORDS = 10;

const words = (list: unknown): string[] => (Array.isArray(list) ? list : [])
  .map((w) => String(w).trim().slice(0, 100)).filter(Boolean).slice(0, MOST_WORDS);

/** A test's turns as stored, cleaned of anything the screen or a hand edit put in wrong. */
export function cleanTurns(turns: unknown): TestTurn[] {
  if (!Array.isArray(turns)) return [];
  return turns.slice(0, MOST_TURNS).flatMap((t): TestTurn[] => {
    const say = String((t as { say?: unknown })?.say ?? "").trim().slice(0, 1000);
    if (!say) return [];
    return [{ say, contains: words((t as { contains?: unknown }).contains), not: words((t as { not?: unknown }).not) }];
  });
}

const fold = (s: string) => s.toLowerCase().replace(/\s+/g, " ");

/** Plays the conversation from the start, one customer message at a time, and checks every answer. */
export async function runBotTest(turns: TestTurn[], turn: Turn): Promise<TestRun> {
  const history: ChatMessage[] = [];
  let slots: AnySlots | null = null;
  const results: TurnResult[] = [];
  for (const t of turns) {
    history.push({ role: "user", content: t.say });
    let answer: Answered;
    try {
      answer = await turn([...history], slots);
    } catch (e) {
      return { ok: false, turns: results, error: `“${t.say}”: ${e instanceof Error ? e.message : String(e)}` };
    }
    const spoken = answer.messages.map((m) => m.text).filter(Boolean).join("\n");
    const said = [spoken, ...(answer.replies?.length ? [`[ปุ่ม] ${answer.replies.join(" | ")}`] : [])].join("\n");
    const seen = fold(said);
    const missing = t.contains.filter((w) => !seen.includes(fold(w)));
    const unwanted = t.not.filter((w) => seen.includes(fold(w)));
    results.push({ say: t.say, said, ok: Boolean(said.trim()) && !missing.length && !unwanted.length, missing, unwanted });
    history.push({ role: "assistant", content: spoken });
    slots = answer.slots;
  }
  return { ok: results.every((r) => r.ok), turns: results };
}
