import { siteUrl } from "@/lib/site-url";
import { hashUserId } from "@/lib/line/verify";
import { claimEvent, loadSession, saveTurn } from "@/lib/chat/session";
import { push, reply, showLoading, toBatches, toMessages, MAX_MESSAGES, type LineMessage, type Said } from "@/lib/line/client";
import { showQuotedMenu } from "@/lib/line/menu-link";
import { wantsQuotedMenu } from "@/lib/line/rich-menu";
import { answerAny } from "@/lib/assistant/dispatch";
import { allow } from "@/lib/assistant/rate-limit";
import { BudgetExceeded, TurnTimeout, withTurnDeadline } from "@/lib/ai/client";
import { turnBudgetMs } from "@/lib/chat/batch";
import type { ChatMessage } from "@/lib/ai/types";
import { openConversation, openLead, record, type RecordedEvent } from "@/lib/chat/record";
import { WANTS_IN } from "@/lib/assistant/common";
import { RECRUIT_PRODUCT } from "@/lib/crm/plans";
import { botTurn, keepTranscript } from "@/lib/chat/transcript";

/**
 * One event from the LINE official account, answered — the same brains, the same session
 * store and the same report as the Page's inbox, so a customer who writes to either gets the
 * same figure and the owner sees both in one place.
 *
 * What the Messenger side has and this does not, and why:
 *
 * - No follow-up five minutes after a quotation. A follow-up is a push, every push is one of
 *   the account's 300 a month, and the owner chose not to spend them (2026-09-25).
 * - No pause when an agent types. LINE does not tell the webhook what an agent writes in the
 *   OA Manager, so there is no signal to pause on. The form's hand-over still silences the
 *   bot for good, the same as on Messenger — that is the moment a person takes over.
 * - No advertisement attribution. A LINE chat carries no referral.
 */

export interface LineEvent {
  type: string;
  replyToken?: string;
  webhookEventId?: string;
  source?: { type?: string; userId?: string };
  message?: { type: string; text?: string };
}

const MAX_CHARS = 1000;
const BUSY = "ตอนนี้มีคำถามเข้ามาเยอะครับ รบกวนรอสักครู่แล้วถามใหม่นะครับ";
/** the agency reads this account, as it reads the Page, so the apology says a person is coming */
const BROKEN = "ขออภัยครับ ระบบขัดข้องชั่วคราว เดี๋ยวแอดมินกลับมาตอบให้นะครับ 🙏";
const OUT_OF_BUDGET = "ขอเวลาสักครู่นะครับ เดี๋ยวกลับมาตอบในแชทนี้";

function handedOver(slots: unknown): boolean {
  return Boolean((slots as { formSent?: boolean } | null)?.formSent);
}

function productOf(slots: unknown): string | null {
  return (slots as { product?: string } | null)?.product ?? null;
}

/**
 * The answer, with one more attempt before giving up, both inside the turn's clock — the same
 * reasoning as Messenger's (src/lib/facebook/conversation.ts).
 */
async function answered(history: ChatMessage[], slots: Parameters<typeof answerAny>[1], turnMs: number) {
  return withTurnDeadline(turnMs, async () => {
    try {
      return await answerAny(history, slots, "line");
    } catch (e) {
      if (e instanceof BudgetExceeded || e instanceof TurnTimeout) throw e;
      console.error("answer failed, trying once more:", e);
      return await answerAny(history, slots, "line");
    }
  });
}

/** a value table's picture, whose own words can be spared when there are too many bubbles */
const TABLE_PICTURE = "/api/card/table?";

/** The first five as the reply, the rest as pushes, in order. */
async function sayAll(replyToken: string, userId: string, batches: LineMessage[][]): Promise<void> {
  const [first, ...rest] = batches;
  if (!first) return;
  await say(replyToken, userId, first);
  /**
   * The reply is out. A push after it that fails (the month's 300 spent) cuts the answer
   * short and nothing more: the turn is still saved, and an apology now would follow words
   * the customer already has — and could not be sent anyway (review, 2026-10-11).
   */
  for (const batch of rest) {
    try {
      await push(userId, batch);
    } catch (e) {
      console.error("[line] answer cut short, turn kept:", e);
      return;
    }
  }
}

/** A reply, or — when its token lapsed while the model was thinking — a push. */
async function say(replyToken: string, userId: string, messages: LineMessage[]): Promise<void> {
  if (!messages.length) return;
  try {
    await reply(replyToken, messages);
  } catch (e) {
    console.error("LINE reply failed, pushing instead:", e);
    await push(userId, messages);
  }
}

/**
 * `destination` is the account's own id, from the webhook body. It stands where Messenger puts
 * the Page's id, so the report can tell which account a conversation came in on. `startedAt`
 * is when the batch began, as on Messenger.
 */
export async function handle(event: LineEvent, destination = "", opts: { startedAt?: number } = {}): Promise<void> {
  // a person, one to one: a group or a room is not a customer asking for a quotation
  if (event.source?.type && event.source.type !== "user") return;
  if (event.type !== "message" || event.message?.type !== "text") return;
  const userId = event.source?.userId;
  const replyToken = event.replyToken;
  const text = (event.message.text ?? "").trim().slice(0, MAX_CHARS);
  if (!userId || !replyToken || !text) return;

  // LINE redelivers an event it believes failed; the second arrival must not be answered again
  if (event.webhookEventId && !(await claimEvent("line", event.webhookEventId))) return;

  const userHash = hashUserId(userId);
  const session = await loadSession("line", userHash);

  let conversationId = session.conversationId;
  if (!conversationId) {
    conversationId = await openConversation("line", destination, userHash, undefined, undefined);
  }
  const ledger: RecordedEvent[] = [{ kind: "message" }];
  const thread = { channel: "line" as const, pageId: destination, userHash, conversationId };
  await keepTranscript({ ...thread, product: productOf(session.slots) }, [{ role: "customer", text }]);

  /**
   * A thread a person has taken. The form no longer counts as one (owner, 2026-09-26: the bot
   * answers until a person writes) — and LINE never tells the webhook what an agent types in
   * OA Manager, so here only a stamp set some other way silences the bot. The message is
   * still counted.
   */
  if (session.handedOverAt) {
    await record(conversationId, ledger, productOf(session.slots));
    return;
  }

  if (!allow(`line:${userHash}`)) {
    await say(replyToken, userId, toMessages([{ text: BUSY }]));
    return;
  }

  const wantsIn = text === WANTS_IN;
  const history: ChatMessage[] = [...session.messages, { role: "user", content: text }];

  await showLoading(userId).catch(() => {});
  try {
    const answer = await answered(history, session.slots, turnBudgetMs(opts.startedAt));

    // the words first and each card after the words it belongs to, as on Messenger
    const saidWith = (wordsOverTables: boolean): Said[] => answer.messages.flatMap((m) => [
      ...(m.text && (wordsOverTables || !m.card?.includes(TABLE_PICTURE)) ? [{ text: m.text }] : []),
      ...(m.card ? [{ image: siteUrl(m.card) }] : []),
      // a link LINE draws as a tap-to-open line: the file is one tap from the route. The flag
      // opens it in the phone's own browser, because LINE's on Android shows a PDF as nothing
      ...(m.file ? [{ text: `${siteUrl(m.file)}&openExternalBrowser=1` }] : []),
    ]);
    /**
     * A couple is two cards, two tables and a question, which is more than the five a reply
     * holds. A push spends one of the month's 300, so the words over the tables go first — the
     * picture says whose it is — and only what still does not fit is pushed after the reply.
     */
    let said = saidWith(true);
    if (said.length > MAX_MESSAGES) said = saidWith(false);
    await sayAll(replyToken, userId, toBatches(said, answer.replies));
    // after a Life Protect price the menu offers the table and the file instead of the plans
    // a menu that will not switch is not worth an apology after a whole answer
    if (wantsQuotedMenu({ priced: answer.priced, product: productOf(answer.slots) })) {
      await showQuotedMenu(userId).catch((e) => console.error("[line] quoted menu not shown:", e));
    }
    await keepTranscript({ ...thread, product: productOf(answer.slots) }, [botTurn(answer.messages, answer.replies)]);

    const spoken = answer.messages.map((m) => m.text).join("\n\n");
    // counted in the report, but it silences nothing any more
    const justSent = handedOver(answer.slots) && !handedOver(session.slots);
    // a second message answered beside this one is merged with, not written over
    await saveTurn("line", userHash, {
      base: session,
      added: [{ role: "user", content: text }, { role: "assistant", content: spoken }],
      slots: answer.slots,
      conversationId,
    });

    // a would-be agent is filed under หาทีม, whatever plan the thread was about before
    const product = answer.recruit ? RECRUIT_PRODUCT : productOf(answer.slots);
    if (answer.priced) ledger.push({ kind: "quoted", data: { ...answer.quote } });
    if (wantsIn) ledger.push({ kind: "handover" });
    if (justSent) ledger.push({ kind: "form_sent" });
    if (answer.formDone) ledger.push({ kind: "form_done" });
    if (answer.recruit) ledger.push({ kind: "recruit_interest" });

    // written last, and its failure is its own: the customer has already been answered
    await record(conversationId, ledger, product);
    const formSent = handedOver(answer.slots);
    if (answer.recruit) {
      await openLead(conversationId, userId, "interested", product);
    } else if (wantsIn || formSent || answer.formDone) {
      const stage = answer.formDone ? "form_done" : formSent ? "form_sent" : "interested";
      await openLead(conversationId, userId, stage, product);
    }
  } catch (e) {
    // the apology first: it is the one thing that has to be out before the function's limit
    await say(replyToken, userId, toMessages([{ text: e instanceof BudgetExceeded ? OUT_OF_BUDGET : BROKEN }]))
      .catch((err) => console.error("apology not sent:", err));
    ledger.push({ kind: "failed" });
    await record(conversationId, ledger, null);
    throw e;
  }
}
