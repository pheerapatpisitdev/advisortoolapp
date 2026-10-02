import { siteUrl } from "@/lib/site-url";
import { hashUserId } from "@/lib/facebook/verify";
import { claimEvent, isMuted, loadSession, muteFor, saveSession, saveTurn } from "@/lib/chat/session";
import { armFollowup, dropFollowup } from "@/lib/chat/followup";
import { sendFile, sendImage, sendMessage, showTyping } from "@/lib/facebook/client";
import { answerAny } from "@/lib/assistant/dispatch";
import { allow } from "@/lib/assistant/rate-limit";
import { BudgetExceeded, TurnTimeout, withTurnDeadline } from "@/lib/ai/client";
import { turnBudgetMs } from "@/lib/chat/batch";
import type { ChatMessage } from "@/lib/ai/types";
import { agentTyped, customerOf, eventKey, referralOf, textOf, type Messaging } from "@/lib/facebook/events";
import { productFromAd } from "@/lib/facebook/from-ad";
import { attribute, openConversation, openLead, record, type RecordedEvent } from "@/lib/chat/record";
import { WANTS_IN } from "@/lib/assistant/common";
import { pagePathFor } from "@/lib/quote-pdf/link";
import { RECRUIT_PRODUCT } from "@/lib/crm/plans";
import { botTurn, keepTranscript } from "@/lib/chat/transcript";
import { isExpatPage, languageOf } from "@/lib/assistant/expat";
import { BROKEN_EN, BUSY_EN, CARD_UNSENT_EN, OUT_OF_BUDGET_EN, WANTS_IN_EN } from "@/lib/assistant/ihealthy-en/words";

/**
 * The answer, with one more attempt before giving up — both inside the turn's clock.
 *
 * The failures that reach a customer are transient — a key table that could not be read on a
 * cold start, a provider refusing one call. A second try costs a second and saves the lead.
 *
 * The clock (withTurnDeadline, src/lib/ai/client.ts) is what makes sure the apology below is
 * sent at all: without it two slow attempts could run the function into its limit, and the
 * platform kills it before the catch is reached (review, 2026-10-01). A turn out of time is
 * not tried again.
 */
async function answered(
  history: ChatMessage[], slots: Parameters<typeof answerAny>[1],
  cameFor: Parameters<typeof answerAny>[3], turnMs: number, pageId?: string,
) {
  return withTurnDeadline(turnMs, async () => {
    try {
      return await answerAny(history, slots, "facebook", cameFor, pageId);
    } catch (e) {
      if (e instanceof BudgetExceeded || e instanceof TurnTimeout) throw e;
      console.error("answer failed, trying once more:", e);
      return await answerAny(history, slots, "facebook", cameFor, pageId);
    }
  });
}

/**
 * One event from the page's inbox, answered.
 *
 * It sits here rather than in the route because a Next route file may export only its own
 * verbs, and this is the half worth testing: the route's job is to check Meta's signature
 * and get out of the way.
 */

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Whether the application form has already been handed to this customer. */
function handedOver(slots: unknown): boolean {
  return Boolean((slots as { formSent?: boolean } | null)?.formSent);
}

/** The arrangement a stored session was about, for the events that carry one. */
function productOf(slots: unknown): string | null {
  return (slots as { product?: string } | null)?.product ?? null;
}

const BUSY = "ตอนนี้มีคำถามเข้ามาเยอะครับ รบกวนรอสักครู่แล้วถามใหม่นะครับ";
/**
 * What the customer sees when the bot cannot answer at all. It used to send them away —
 * "รบกวนถามใหม่อีกครั้งครับ" — which is no way to treat someone who arrived through a paid
 * advertisement. The agent watches this inbox, so the message says so.
 */
const BROKEN = "ขออภัยครับ ระบบขัดข้องชั่วคราว เดี๋ยวแอดมินกลับมาตอบให้นะครับ 🙏";
const OUT_OF_BUDGET = "ขอเวลาสักครู่นะครับ เดี๋ยวกลับมาตอบในแชทนี้";


/**
 * The quotation as a picture, with somewhere to go when the picture will not send.
 *
 * Messenger fetches the URL itself and now and then does not — "อัพโหลดไฟล์แนบไม่สำเร็จ" —
 * and the failure used to end there: the customer had been quoted in words and the picture of
 * the figures simply never arrived. So it is attempted twice, and if the second attempt fails
 * the customer is given the link to the same card. The buttons ride along either way, because
 * they were riding on the picture and a customer left without them has nothing to tap.
 */
const CARD_UNSENT = "ใบเสนอราคาเป็นรูปครับ เปิดดูได้ที่ลิงก์นี้เลย";

const PDF_UNSENT = "ส่งไฟล์ไม่สำเร็จครับ เปิดหน้านี้แล้วกดปุ่มบันทึก PDF ได้เลยครับ";
const PDF_WAIT = "รอสักครู่แล้วขอใหม่นะครับ";

/**
 * The words the inbox says on its own — the apologies and the card's fallback — in the
 * language this turn is in. Thai everywhere but an Expat Page answering English.
 */
const OWN_WORDS = {
  th: { busy: BUSY, broken: BROKEN, outOfBudget: OUT_OF_BUDGET, cardUnsent: CARD_UNSENT, pdfUnsent: PDF_UNSENT, pdfWait: PDF_WAIT },
  en: {
    busy: BUSY_EN, broken: BROKEN_EN, outOfBudget: OUT_OF_BUDGET_EN, cardUnsent: CARD_UNSENT_EN,
    pdfUnsent: "I couldn't send the file — open this page and tap the save-as-PDF button:",
    pdfWait: "Give me a moment and ask again, please.",
  },
};

function ownWordsFor(pageId: string | undefined, text: string, slots: unknown) {
  if (!isExpatPage(pageId)) return OWN_WORDS.th;
  const before = slots ? ((slots as { lang?: string }).lang === "en" ? "en" : "th") : undefined;
  return OWN_WORDS[languageOf(text, before)];
}

async function sendCard(
  psid: string, url: string, replies: string[] | undefined, pageId?: string,
  cardUnsent: string = CARD_UNSENT,
): Promise<void> {
  try {
    await sendImage(psid, url, replies, pageId);
    return;
  } catch (e) {
    console.error("card failed, trying once more:", e);
  }
  try {
    await sendImage(psid, url, replies, pageId);
    return;
  } catch (e) {
    console.error("card failed twice, sending the link instead:", e);
  }
  await sendMessage(psid, `${cardUnsent}\n${url}`, replies, { pageId })
    .catch((e) => console.error("card link failed:", e));
}

/** the route prints with Chrome and is allowed 60 s; the webhook keeps its own margin on top */
const PDF_FETCH_MS = 55_000;

/**
 * The quote's PDF, fetched from our own route and uploaded as a file.
 *
 * The route is public and rate-limited per address, so the bot says who it is with the cron
 * key — and where there is none, goes without it and takes the limit like anyone else. Whatever
 * goes wrong, the customer is given the sales page itself, where the same figures sit under a
 * save button: a bare failure would leave them with a promise ("กำลังทำไฟล์ให้ครับ") and nothing.
 */
async function sendPdf(
  psid: string, pdfPath: string, replies: string[] | undefined, pageId?: string,
  words: { pdfUnsent: string; pdfWait: string } = { pdfUnsent: PDF_UNSENT, pdfWait: PDF_WAIT },
): Promise<void> {
  const key = process.env.CRON_SECRET;
  try {
    const res = await fetch(siteUrl(pdfPath), {
      ...(key ? { headers: { authorization: `Bearer ${key}` } } : {}),
      signal: AbortSignal.timeout(PDF_FETCH_MS),
    });
    if (res.status === 429) {
      await sendMessage(psid, words.pdfWait, replies, { pageId });
      return;
    }
    if (!res.ok) throw new Error(`quote-pdf ${res.status}`);
    const name = /filename="?([^";]+)"?/i.exec(res.headers.get("content-disposition") ?? "")?.[1];
    await sendFile(psid, new Uint8Array(await res.arrayBuffer()), name ?? "quote.pdf", replies, pageId);
  } catch (e) {
    console.error("pdf failed, sending the page instead:", e);
    const page = pagePathFor(pdfPath);
    await sendMessage(psid, page ? `${words.pdfUnsent}\n${siteUrl(page)}` : words.pdfUnsent, replies, { pageId })
      .catch((err) => console.error("pdf link failed:", err));
  }
}

/**
 * `startedAt` is when the webhook's batch began (Date.now()), so a turn late in a long batch
 * gets only the time the function has left; left out, the turn has its full TURN_MS.
 */
export async function handle(event: Messaging, pageId?: string, opts: { startedAt?: number } = {}): Promise<void> {
  // on an echo the sender is the page, so the thread is named by who it was sent to
  const psid = customerOf(event);
  if (!psid) return;
  const userHash = hashUserId(psid);

  // the agent has answered in the page's own inbox. Checked before the customer's words are
  // read, because this event carries the page's words, not theirs.
  if (agentTyped(event)) {
    const session = await loadSession("facebook", userHash);
    /**
     * The thread becomes a person's, and stays one.
     *
     * The owner asked for this after running the other way round: the bot used to pick the
     * thread back up the moment the customer wrote again, so a lead the agent was already
     * talking to would get an agent and a bot answering the same message. One reply by hand
     * is the whole signal — whoever typed it is in this conversation now.
     *
     * It does not time out. The way back is the button in the back office — the same one the
     * form's own hand-over already answers to, because a thread is a thread whichever of the
     * two switched the bot off in it.
     *
     * The mute is set as well and is not redundant: it is the thing that stops an answer
     * already in flight from landing on top of the agent's words a second later.
     */
    await saveSession("facebook", userHash, session.messages, session.slots, muteFor(), undefined, new Date());
    // the thread is theirs now, so the bot's own follow-up is not wanted — and the id it was
    // holding to send it with goes with it
    await dropFollowup("facebook", userHash);
    // a thread an agent answered by hand is not a thread the bot lost: the report should say
    // a person stepped in, rather than showing a conversation that simply stopped
    await record(session.conversationId, [{ kind: "agent_replied" }], null);
    // what the agent typed is what the daily review learns most from
    await keepTranscript(
      { channel: "facebook", pageId, userHash, conversationId: session.conversationId, product: productOf(session.slots) },
      [{ role: "agent", text: event.message?.text ?? "" }],
    );
    return;
  }

  // a typed message and a tapped button are both the customer's words; an echo is not
  const text = textOf(event);
  if (!text) return;

  // a redelivery of an event already answered must not answer it a second time
  const key = eventKey(event);
  if (key && !(await claimEvent("facebook", key))) return;

  // they are talking, which is the whole of what a follow-up was for
  await dropFollowup("facebook", userHash);

  const session = await loadSession("facebook", userHash);

  /**
   * The conversation this turn belongs to.
   *
   * A session gone stale comes back without one, which is the point: someone writing a week
   * later is a second visit, and carrying the old id into it would report one arrival where
   * there were two.
   */
  const referral = referralOf(event);
  let conversationId = session.conversationId;
  if (!conversationId) {
    conversationId = await openConversation(
      "facebook", pageId ?? "", userHash, referral, event.postback?.payload,
    );
  } else if (referral) {
    // they came back through an advertisement mid-conversation; ins_attribute coalesces, so
    // the advert that found them keeps them
    await attribute(conversationId, referral);
  }
  const ledger: RecordedEvent[] = [{ kind: "message" }];
  const thread = { channel: "facebook" as const, pageId, userHash, conversationId };
  await keepTranscript({ ...thread, product: productOf(session.slots) }, [{ role: "customer", text }]);

  /**
   * A person has the thread: the bot says nothing.
   *
   * Only a person's reply stamps it now. Sending the form used to as well, and the bot went
   * quiet on the customer the moment it had — someone who had only asked which documents to
   * bring was handed a form and then met silence. The owner took that out on 2026-09-26: the
   * bot keeps answering after the form until an agent actually writes in the thread.
   *
   * The message is still recorded, so the report shows a live thread rather than one that
   * stopped. The silence does not expire: `handed_over_at` is read past the session's own
   * staleness. Clearing it (ให้บอทดูแลต่อ on /admin/crm) gives the thread back to the bot.
   */
  if (session.handedOverAt) {
    await record(conversationId, ledger, productOf(session.slots));
    return;
  }

  const wantsIn = text.trim() === WANTS_IN || text.trim() === WANTS_IN_EN;
  const own = ownWordsFor(pageId, text, session.slots);

  /**
   * The agent answering by hand pauses the bot, and this message ends the pause: the customer
   * has written again, so the thread is handed back.
   *
   * It used to be a day of silence, which is what the owner asked for at first and then
   * watched go wrong — an agent said hello to a lead from the advertisement, the lead gave
   * her age, and the bot sat on the answer it had ready. What the pause still has to stop is
   * the bot talking over an agent who types in the seconds the model takes, so the mark on
   * the thread is remembered here and compared with the one that is there when the answer is
   * ready.
   */
  const markedBefore = session.mutedUntil;

  if (!allow(`fb:${userHash}`)) {
    await sendMessage(psid, own.busy, undefined, { pageId });
    return;
  }

  const history: ChatMessage[] = [...session.messages, { role: "user", content: text }];

  /**
   * The plan the advertisement was about, worked out once and only while it can still matter.
   *
   * Looked up only on a turn that carries a referral — the first message of a conversation
   * that began at an advertisement — because after that the conversation itself is the better
   * evidence of what the customer wants.
   */
  const cameFor = referral || event.postback?.payload
    ? await productFromAd(referral, event.postback?.payload)
    : undefined;
  if (cameFor) console.info(`[ad] ${userHash.slice(0, 8)} มาจากโฆษณา ${cameFor.product} (${cameFor.from})`);

  await showTyping(psid, pageId).catch(() => {});
  try {
    const answer = await answered(history, session.slots, cameFor?.product, turnBudgetMs(opts.startedAt), pageId);
    // the model takes seconds, and an agent watching the thread answers inside them. Their
    // words are already in the customer's phone by now, so the bot says nothing and records
    // nothing — a mark that was not there when this answer began is theirs, just now.
    const marked = (await loadSession("facebook", userHash)).mutedUntil;
    if (marked !== markedBefore && isMuted(marked)) return;
    for (const [i, said] of answer.messages.entries()) {
      // a second bubble arrives the way a person's would: after the dots, and after a pause
      // that scales with how much there was to type
      if (i > 0) {
        await showTyping(psid, pageId).catch(() => {});
        await pause(Math.min(2500, 400 + said.text.length * 15));
      }
      // the buttons ride on whatever lands last, because anything sent after them clears them
      const last = i === answer.messages.length - 1;
      // a bubble with no words is a picture or a file on its own: a couple's second card, their
      // second PDF, whose words were said once before the first
      if (said.text) {
        await sendMessage(psid, said.text, last && !said.card && !said.file ? answer.replies : undefined, { pageId });
      }
      // the card follows its own words, so the customer reads the quote before the picture of
      // it — and a couple priced together gets the pair in the order they were named
      if (said.card) await sendCard(psid, siteUrl(said.card), last ? answer.replies : undefined, pageId, own.cardUnsent);
      if (said.file) await sendPdf(psid, said.file, last ? answer.replies : undefined, pageId, own);
    }
    await keepTranscript({ ...thread, product: productOf(answer.slots) }, [botTurn(answer.messages, answer.replies)]);
    const spoken = answer.messages.map((m) => m.text).join("\n\n");
    // the turn that hands the form over is counted, but no longer silences the bot: only an
    // agent's own reply does (owner, 2026-09-26)
    const justSent = handedOver(answer.slots) && !handedOver(session.slots);
    // the mute and the agent's stamp are none of this save's business; and a second message
    // from the same customer answered beside this one is merged with, not written over
    await saveTurn("facebook", userHash, {
      base: session,
      added: [{ role: "user", content: text }, { role: "assistant", content: spoken }],
      slots: answer.slots,
      conversationId,
    });
    /**
     * A quotation is where the conversation used to stop, so it is where the bot now arms one
     * question five minutes out. Armed after the session is written, because the follow-up
     * only goes if nothing has touched the thread since.
     *
     * The life plan alone for now: its words offer a shorter term and a lighter sum, which
     * the health contract does not have.
     */
    // a would-be agent is filed under หาทีม, whatever plan the thread was about before
    const product = answer.recruit ? RECRUIT_PRODUCT : (answer.slots as { product?: string }).product ?? null;
    if (answer.priced && product === "lifeprotect") {
      await armFollowup("facebook", userHash, psid, pageId)
        .catch((e) => console.error("followup:", e));
    }

    if (answer.priced) ledger.push({ kind: "quoted", data: { ...answer.quote } });
    if (wantsIn) ledger.push({ kind: "handover" });
    // the form is sent once, and the turn that sends it is the one where the flag turns over
    const formSent = handedOver(answer.slots);
    if (justSent) ledger.push({ kind: "form_sent" });
    if (answer.formDone) ledger.push({ kind: "form_done" });
    if (answer.recruit) ledger.push({ kind: "recruit_interest" });

    // written last, and its failure is its own: the customer has already been answered
    await record(conversationId, ledger, product);
    if (answer.recruit) {
      await openLead(conversationId, psid, "interested", product);
    } else if (wantsIn || formSent || answer.formDone) {
      const stage = answer.formDone ? "form_done" : formSent ? "form_sent" : "interested";
      await openLead(conversationId, psid, stage, product);
    }
  } catch (e) {
    // the apology first: it is the one thing that has to be out before the function's limit
    await sendMessage(psid, e instanceof BudgetExceeded ? own.outOfBudget : own.broken, undefined, { pageId })
      .catch((err) => console.error("apology not sent:", err));
    ledger.push({ kind: "failed" });
    await record(conversationId, ledger, null);
    throw e;
  }
}
