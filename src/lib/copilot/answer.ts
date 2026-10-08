import type { ChatMessage } from "@/lib/ai/types";
import { answerAny } from "@/lib/assistant/dispatch";
import { productByTopic, productNamedIn } from "@/lib/assistant/choose";
import {
  asksAboutDeathBenefit, asksForPrice, asksPayTerm, asksValueTable,
} from "@/lib/assistant/lifeprotect/route";
import { asksFullTable, asksOtherPlans, asksShareOfBill } from "@/lib/assistant/ihealthy/route";
import { asksCheaper } from "@/lib/assistant/common";
import { PDF_ASKED } from "@/lib/assistant/pdf";
import type { AnySlots } from "@/lib/assistant/slots";
import { askLibrary } from "./library";
import { asksPensionPrice, pensionNamedIn } from "./pension-price";
import { asksCi123Price, ci123NamedIn } from "./ci123-price";
import { asksCancerPrice, cancerNamedIn } from "./cancer-price";
import { PRICED_FOLLOW_UPS, type GuideItem } from "./guide";
import { noteAfterAnswer } from "@/lib/assistant/unanswered";
import { forTheWebsite } from "@/lib/assistant/channel";
import { healthTopicsFor } from "@/lib/health-knowledge";

/**
 * The assistant that answers out of this system's own knowledge, and out of nothing else.
 *
 * Two things can be asked of it and they are answered by two different machines.
 *
 * A question about money goes to `answerAny` — the same dispatcher the Messenger bot runs on,
 * which reads the message, fills what it can, asks for what it cannot, and prices through the
 * engine. Reusing it rather than calling `quote()` here is the whole point: the figure this
 * page gives and the figure the bot gives are then the same figure by construction, and the
 * trap that lies between them is not stepped in — on the life plan "ทุน 1 ล้าน" is what the
 * family receives and the sum assured behind it is half that before the booster age, a
 * distinction that doubles a premium if it is got wrong.
 *
 * A question about a rule goes to a model with every rule in the system in front of it. That
 * model is told, at length, that it may claim nothing which is not there.
 */

/** What the customer sees when even the library cannot be reached. */
const BROKEN = "ขออภัยครับ ระบบขัดข้องชั่วคราว ลองถามใหม่อีกครั้งนะครับ";

/**
 * Money words, as a net under the brains' own readers.
 *
 * "เท่าไหร่" was in this list and had to come out. It is the Thai for "how much" of anything
 * at all — how old, how large a sum, how many days — so the very first suggestion on the
 * page, "DCI ซื้อได้ถึงอายุเท่าไหร่", was sent down the pricing path. A money word has to be
 * present: the question is about the premium or it is not.
 */
const ASKS_PRICE = /เบี้ย|ราคา|กี่บาท|ค่างวด|จ่ายเดือนละ|จ่ายปีละ|จ่ายเท่าไหร่|คิดให้|premium/i;

/**
 * Whether the dispatcher should take this, rather than a model with the rule book.
 *
 * The brains already know how to recognise what they answer, and asking them is the only way
 * this stays right as they grow. Hand-rolling the test here got the premium and missed
 * everything else the engine draws: "ขอดูตารางมูลค่า" went to a model with no ability to
 * draw a table, and the customer got prose where the bot would have sent the picture.
 */
function forTheEngine(text: string): boolean {
  // a request for the file goes to the dispatcher even before a quote exists, which asks which
  // plan as it would in the inbox — the quote that follows offers the file — rather than to the
  // library, which has no file to give
  return PDF_ASKED.test(text)
    || asksForPrice(text)
    || asksValueTable(text)
    || asksPayTerm(text)
    || asksAboutDeathBenefit(text)
    || asksFullTable(text)
    || asksOtherPlans(text)
    || asksShareOfBill(text)
    || asksCheaper(text)
    || ASKS_PRICE.test(text)
    // "บำนาญ ชาย 40 เดือนละ 10,000" has no money word in it and is nothing but a price
    || (pensionNamedIn(text) && asksPensionPrice(text))
    // "CI123 ชาย 35 ทุน 1 ล้าน" likewise
    || (ci123NamedIn(text) && asksCi123Price(text))
    // "ประกันมะเร็ง ชาย 35 ทุน 1 ล้าน" likewise
    || (cancerNamedIn(text) && asksCancerPrice(text));
}

export interface CopilotAnswer {
  text: string;
  /** which model answered, or the engine's own name when no model was asked */
  model: string;
  /** the premium came from the engine, so the page may say so */
  priced?: boolean;
  /**
   * What the pricing brain now knows about this person, handed back so the next question can
   * carry on from it — "ชาย 35" and then "ทุน 1 ล้าน" is two messages about one quotation.
   */
  slots?: AnySlots | null;
  /**
   * The pictures the engine drew, in the order it drew them.
   *
   * A list rather than one: a couple priced together — "ผญ 32 ผช 33" — is two quotations and
   * two cards, and keeping only the first is quietly losing one of them.
   */
  cards?: string[];
  /**
   * The next questions, offered as buttons under the answer.
   *
   * Only where they are known to lead somewhere: after a quotation, and after a refusal that
   * named exactly what was missing. A rule answered out of the knowledge gets none, because
   * what follows from it is the reader's business and a guessed button is a dead end with a
   * page's authority behind it.
   */
  guide?: GuideItem[];
  /**
   * The quotes' PDFs, paths the page links to — one for one person, one each for a couple. The
   * bot's channels deliver the same files their own way.
   */
  pdfs?: string[];
  /**
   * Nothing was answered — the system was busy or broken — and the same question asked again
   * may well get through. The page offers "ลองอีกครั้ง" on it, and leaves the apology out of
   * what the model is shown next time: it is not something anybody said about insurance.
   */
  failed?: true;
}

/** The name shown under an answer the engine produced, where a model name would go. */
const ENGINE = "เครื่องคิดเบี้ยของระบบ";
/** and where the library wrote it but the model's own name did not come back with it */
const LIBRARY = "คลังความรู้ของระบบ";

/**
 * The line under an answer: which machine wrote it.
 *
 * An answer the library wrote is not the engine's, and neither is one a brain handed to a
 * model — a question about the plan, or small talk. Those were all signed ENGINE until the
 * review of 2026-10-01, which put "เครื่องคิดเบี้ยของระบบ" under free model prose: a reader
 * takes that line to mean the figures above it were computed. A model's answer is signed
 * with the model's name, the way the library's own answers are below; ENGINE is kept for the
 * words the engine and this code produced.
 */
function whoWrote(answer: { fromLibrary?: true; writtenBy?: string }): string {
  if (answer.fromLibrary) return LIBRARY;
  if (answer.writtenBy !== undefined) return answer.writtenBy || LIBRARY;
  return ENGINE;
}

/**
 * The plans without a brain are priced by `./price`, not turned away.
 *
 * For a while the gap was answered by refusing: a question about iShield was stopped rather
 * than quoted as Life Protect, which it had been. Refusing was right and was not the end of
 * it — `quote()` prices every plan in the registry and `/api/card` draws every one, so what
 * was missing was wiring and not ability.
 */
export async function answerFromKnowledge(
  question: string,
  history: ChatMessage[] = [],
  slots: AnySlots | null = null,
): Promise<CopilotAnswer> {
  /**
   * Anything about money, and anything asked while a quotation is already half-built.
   *
   * The second half matters: after "Life Protect ชาย 35" the next message is "ทุน 1 ล้าน",
   * which names no money word at all and would otherwise be read as a question about rules.
   *
   * A plan with no brain — PLB, iSmart, Life Treasure — used to be priced here, by this page,
   * before the dispatcher was asked, and a question the dispatcher could not place was
   * answered here too. Both happen inside the dispatcher now, so the page's inbox gets the
   * same figure from the same code and the same words from the same library. This file no
   * longer knows anything the bot does not.
   */
  /**
   * A message that names a plan belongs to that plan's brain, money or no money.
   *
   * "มีประกันสุขภาพไหม" was answered here out of the library, which listed the rider codes —
   * IHU, MEB, MEX, HIC — with their age ranges. True, and a catalogue: the same question in
   * the page's inbox got "ขออายุกับเพศหน่อยครับ เดี๋ยวดูเบี้ยให้เลย", which is an answer that
   * goes somewhere. Two doors, one question, two different kinds of reply — the split the
   * owner asked to be rid of, still standing because this gate only ever asked about money.
   *
   * It is the dispatcher's own first test, so asking it here makes the two doors agree by
   * construction rather than by both being kept in step.
   *
   * The subject as well as the name, because the dispatcher reads both. On 2026-10-08
   * "มีประกันโรคร้ายแรงไหม" (iShield by subject, no plan named) went to the library here, came
   * back with no conversation, and the ten turns after it — age, sex, sum, "ขอดูตาราง" —
   * followed it there: a premium in prose and never a card, where the inbox had quoted.
   *
   * Except a question the library holds a block for — "นอนโรงพยาบาลแบบไหนถึงเคลมได้" reads
   * as health cover by subject, and is answered by the admission criteria, not by a brain
   * that wants an age before it says anything.
   */
  const bySubject = Boolean(productByTopic(question)) && healthTopicsFor(question).length === 0;
  if (forTheEngine(question) || productNamedIn(question) || bySubject || slots) {
    const turns: ChatMessage[] = [...history.slice(-6), { role: "user", content: question }];
    // said outright, because the wording depends on it: this side renders markdown
    const answer = await answerAny(turns, slots, "web");
    // the inbox's words, less its promises that a person reads this chat — nobody does here
    const text = forTheWebsite(answer.messages.map((m) => m.text).filter(Boolean).join("\n\n"));
    const cards = answer.messages.map((m) => m.card).filter((c): c is string => Boolean(c));
    const files = answer.messages.map((m) => m.file).filter((f): f is string => Boolean(f));

    /**
     * Written down when the calculator did not answer this.
     *
     * A priced answer with a card is the engine's, is covered by the test suite, and teaches
     * nothing by being collected. Everything else was worded by a model or ended in a question
     * back to the customer, and those are the two shapes that go wrong: the day a customer was
     * told there was no picture of the comparison table, this was the path that told them.
     *
     * Handed to `after`, not fired and forgotten. A floating promise in a server action is
     * not a background task: the response goes back, the serverless function is frozen, and
     * the insert never lands — which is exactly what happened on the first attempt, silently
     * and with nothing in the log to say so. `after` runs it once the response has been sent
     * and keeps the function alive until it finishes, so the customer waits for nothing and
     * the note is still taken.
     */
    if (!answer.priced && cards.length === 0) {
      const productAsked = answer.slots?.product;
      noteAfterAnswer({
        question,
        route: answer.fromLibrary ? "library" : "brain",
        product: productAsked,
      });
    }

    return {
      text,
      model: whoWrote(answer),
      priced: Boolean(answer.priced),
      slots: answer.slots,
      ...(cards.length ? { cards } : {}),
      ...(files.length ? { pdfs: files } : {}),
      /**
       * The plan's own next questions where the dispatcher sent some — the other paying
       * terms of the contract just quoted — and otherwise the two the brains recognise.
       * Offering a brain's questions after a PLB quotation would be offering buttons that
       * lead back to a plan the customer did not ask about.
       */
      ...(answer.guide?.length
        ? { guide: answer.guide }
        /**
         * The buttons the bot offered the inbox, offered to the page as well.
         *
         * They are the same offer — "🛡 มรดก+โรคร้ายแรง" is a whole message either way — and
         * the page was dropping them on the floor, so a customer who asked the same thing here
         * was told to choose between two things and given nothing to choose with.
         */
        : answer.replies?.length
          ? { guide: answer.replies.map((label) => ({ label, ask: label })) }
          : answer.priced ? { guide: PRICED_FOLLOW_UPS } : {}),
    };
  }

  const reply = await askLibrary(history, question);
  if (!reply) return { text: BROKEN, model: "—", slots, failed: true };
  // the library wrote this one too, and by the same argument it is worth knowing about
  noteAfterAnswer({ question, route: "library" });
  return { text: forTheWebsite(reply.text), model: reply.model, slots };
}
