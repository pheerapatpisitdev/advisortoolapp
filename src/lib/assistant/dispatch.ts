import type { ChatMessage } from "@/lib/ai/types";
import { aboutAGroup, askWhich, askWhichAgain, pickedFromMenu, productByTopic, productNamedIn, type Product } from "./choose";
import {
  aboutCompany, ageIn, asksAboutCompany, handOverForm, handOverGroup, peopleIn, tookUpTheOffer,
  wantsToBuy, type Reply,
} from "./common";
import { answerHealth } from "./ihealthy/answer";
import { answerLegacy, type LegacySlots } from "./legacy/answer";
import { answerIShield, type IShieldSlots } from "./ishield/answer";
import type { HealthSlots } from "./ihealthy/route";
import { answerQuestion } from "./lifeprotect/answer";
import type { Routed } from "./lifeprotect/route";
import type { AnySlots, Undecided, WithPdf } from "./slots";
import { cleanPdfMemory, pdfTurn, withPdfOffer } from "./pdf";
import { planNamedIn, priceNamedPlan } from "@/lib/copilot/price";
import { asksPensionPrice, pensionNamedIn, pricePension } from "@/lib/copilot/pension-price";
import { asksCi123Price, ci123NamedIn, priceCi123 } from "@/lib/copilot/ci123-price";
import { asksCancerPrice, cancerNamedIn, priceCancer } from "@/lib/copilot/cancer-price";
import type { GuideItem } from "@/lib/copilot/guide";
import { writtenFor, type Channel } from "./channel";
import { answerFromLibrary } from "@/lib/copilot/library";
import { recruitReply } from "./recruit";

/** The last line of the menu, which is how a turn knows the menu was the last thing said. */
const ASKED_WHICH = "สนใจแบบไหนครับ";

/** One answer, and everything the bot should remember about this customer next turn. */
export type AnyAnswer = Reply & {
  slots: AnySlots;
  /**
   * Set when the words came out of the library rather than a brain.
   *
   * It saves the website asking the same question twice: it used to answer anything the
   * dispatcher could not place by calling the library itself, which is now where the
   * dispatcher sends it too — so without this the question would be paid for twice and
   * answered once.
   */
  fromLibrary?: true;
  /**
   * What to offer next, for the plans priced here rather than by a brain.
   *
   * The page draws them as buttons and the inbox has no use for them, but they belong to the
   * answer rather than to the page: it is this code that knows a PLB quotation has three
   * other paying terms worth comparing, and the page that used to know it no longer prices
   * anything itself.
   */
  guide?: GuideItem[];
  /** someone who wants to join the team, handed to the owner (recruit.ts) — never a customer */
  recruit?: true;
};

/** A message that asks something, as against one that announces an interest. */
const ASKS_SOMETHING = /ไหม|มั้ย|หรือเปล่า|รึเปล่า|อะไร|เท่าไหร่|เท่าไร|กี่|ยังไง|อย่างไร|ทำไม|ที่ไหน|\?/;

/** Words that make a question about a plan a question about its price. */
const asksAboutMoney = (text: string) => /เบี้ย|ราคา|กี่บาท|ค่างวด|จ่ายเดือนละ|จ่ายปีละ|จ่ายเท่าไหร่|คิดให้|premium/i.test(text);

/** What of a person is worth carrying from one contract to the other: not much, and not more. */
interface Person {
  age?: number;
  sex?: "M" | "F";
  /**
   * Everyone the message named, when it named more than one.
   *
   * Carried because it was not: a family of three wrote "ช 23 / ญ 25 / ช 53" before saying
   * which plan, and only the first of them survived the question — the other two were asked
   * for again, given again, and never priced.
   */
  people?: { age: number; sex: "M" | "F" }[];
}

/**
 * Which plan a stored session was about.
 *
 * A row with no `product` was written before there was more than one plan to be about, so it
 * can only have been the life one. Guessing anything else would take a customer mid-quotation
 * and start them over.
 */
function settled(slots: AnySlots | null): Product | "undecided" | undefined {
  if (!slots) return undefined;
  if ("product" in slots && slots.product) return slots.product;
  return "lifeprotect";
}

/** The age and the sex, whichever kind of slots they are in. */
function personIn(slots: AnySlots | null): Person {
  if (!slots) return {};
  const { age, sex } = slots as Routed | HealthSlots | Undecided;
  const { people } = slots as Routed | Undecided;
  return {
    ...(age !== undefined ? { age } : {}),
    ...(sex ? { sex } : {}),
    ...(people?.length ? { people } : {}),
  };
}

/**
 * The one door the webhook knocks on.
 *
 * Which plan the message is about is decided before any model is paid, and from the strongest
 * evidence available: a plan named outright can turn a conversation around; a subject can only
 * settle one that has not begun; and where neither says anything, the customer is asked with
 * two buttons rather than guessed at.
 */
export async function answerAny(
  history: ChatMessage[], stored: AnySlots | null, channel: Channel = "web",
  /**
   * What the advertisement that sent this customer was selling, where one did.
   *
   * The weakest of the three signals on purpose, and last of them: what the customer says now
   * outranks what they clicked, and a subject they raise outranks it too. Someone who came
   * through a Life Protect advertisement and opens with "ค่าห้องเท่าไหร่" is asking about
   * health cover, whatever they pressed to get here.
   */
  cameFor?: Product,
): Promise<AnyAnswer> {
  const asked = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const lastSaid = [...history].reverse().find((m) => m.role === "assistant")?.content;

  /**
   * The PDF's memory is the conversation's, not any one plan's: it is taken off the slots
   * before a brain sees them and written back onto whatever the brain returns, so a brain that
   * rebuilds its slots from scratch cannot drop it, and none has to know it exists.
   */
  const memory = cleanPdfMemory((stored as WithPdf<AnySlots> | null)?.pdf);
  const slots = stored && "pdf" in stored ? withoutPdf(stored as WithPdf<AnySlots>) : stored;

  /**
   * A request for the file, or a no to the offer of one, answered before anything else.
   *
   * Ahead of the form on purpose: the quote that offered the file also invited the customer to
   * apply, and a bare "เอาครับ" after the offer is about the file. And ahead of the brains, which
   * have nothing to add — the file is the last quote's, and the conversation is carried through
   * untouched.
   */
  const turn = pdfTurn(asked, lastSaid, memory, channel);
  if (turn) {
    return { ...turn.reply, slots: { ...(slots ?? { product: "undecided" }), pdf: turn.memory } as WithPdf<AnySlots> };
  }
  return withPdfOffer(await routeAny(history, slots, channel, cameFor), memory);
}

/** The slots as a brain knows them; a session with no PDF memory is passed on as it is. */
function withoutPdf(stored: WithPdf<AnySlots>): AnySlots {
  const slots = { ...stored };
  delete slots.pdf;
  return slots;
}

/** Every turn that is not about the PDF: which plan, and which brain answers it. */
async function routeAny(
  history: ChatMessage[], stored: AnySlots | null, channel: Channel, cameFor: Product | undefined,
): Promise<AnyAnswer> {
  const asked = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const now = settled(stored);
  const named = productNamedIn(asked);

  /**
   * A company asking about cover for its staff, answered before anything else happens.
   *
   * First, and ahead of a settled conversation, because this is the one subject that is not a
   * change of plan but a change of product: an employer who has been pricing their own life
   * cover and then asks about the payroll is asking a question none of the four brains below
   * can take. Answering it early costs the conversation nothing — the slots are carried
   * through untouched, so the quotation they were building is still there on the next turn.
   *
   * Three fixed bubbles, no model. The owner's decision is that group cover is sold by a
   * person, so the chat's whole job here is the link and the handover — and the version that
   * asked a model to do that was watched leaving the link out with the instruction in front
   * of it. There is nothing here for a model to get wrong because there is no model.
   *
   * `aboutAGroup` is deliberately narrow — "กลุ่มโรค" and "กลุ่มอาการ" are not this — and
   * every case it does and does not catch is written down in `group-knowledge.test.ts`.
   */
  if (aboutAGroup(asked)) {
    return { ...handOverGroup(), slots: stored ?? { product: "undecided", ...personIn(stored) } };
  }

  /**
   * Someone who wants to become an agent, from a หาทีม post. First of all, for the reason the
   * group question above is early: it is not a plan question, and any brain would answer it
   * with a plan. Fixed words, no model; the slots ride through untouched.
   */
  const joining = recruitReply(asked, [...history].reverse().find((m) => m.role === "assistant")?.content);
  if (joining) return { ...joining, slots: stored ?? { product: "undecided", ...personIn(stored) } };

  /**
   * The pension plan, priced whatever conversation it interrupts.
   *
   * Ahead of a settled conversation, unlike the plans below, because most of the inbox is
   * settled on Life Protect by the advertisement that brought it — and "บำนาญ ชาย 40 เดือนละ
   * 10,000" read by the life brain is a life quote for a sum nobody asked about. The name is
   * distinctive enough to act on, and the conversation's slots ride through untouched.
   */
  if (pensionNamedIn(asked) && asksPensionPrice(asked)) {
    const priced = pricePension(asked);
    return {
      messages: [{ text: writtenFor(channel, priced.text) }],
      priced: priced.priced,
      ...(priced.guide?.length ? { guide: priced.guide } : {}),
      slots: stored ?? { product: "undecided", ...personIn(stored) },
    };
  }

  /**
   * CI 123, priced the same way and for the same reason as the pension plan above: its name is
   * distinctive, a settled Life Protect or legacy conversation would read "CI123 ทุน 1 ล้าน"
   * as its own sum, and nothing about the conversation it interrupts has to change.
   */
  if (ci123NamedIn(asked) && asksCi123Price(asked)) {
    const priced = priceCi123(asked);
    // "CI123 ชาย 35 ทุน 1 ล้าน บริษัทอะไร" is two questions, and the second is not left unanswered
    const company = asksAboutCompany(asked) ? [{ text: writtenFor(channel, aboutCompany(asked)) }] : [];
    return {
      messages: [
        { text: writtenFor(channel, priced.text), ...(priced.cards?.[0] ? { card: priced.cards[0] } : {}) },
        ...company,
      ],
      priced: priced.priced,
      ...(priced.guide?.length ? { guide: priced.guide } : {}),
      slots: stored ?? { product: "undecided", ...personIn(stored) },
    };
  }

  /**
   * The cancer set, by the owner's rule: "ประกันมะเร็ง" or "แพ็กเกจมะเร็ง" is the set on /cancer,
   * priced here for the same reason CI 123 is — a settled Life Protect conversation would read
   * "ประกันมะเร็ง ทุน 1 ล้าน" as its own sum. The /cancer page's own chat message lands here.
   */
  if (cancerNamedIn(asked) && asksCancerPrice(asked)) {
    const priced = priceCancer(asked);
    const company = asksAboutCompany(asked) ? [{ text: writtenFor(channel, aboutCompany(asked)) }] : [];
    return {
      messages: [
        { text: writtenFor(channel, priced.text), ...(priced.cards?.[0] ? { card: priced.cards[0] } : {}) },
        ...company,
      ],
      priced: priced.priced,
      ...(priced.guide?.length ? { guide: priced.guide } : {}),
      slots: stored ?? { product: "undecided", ...personIn(stored) },
    };
  }

  if (now === "lifeprotect" || now === "ihealthy" || now === "legacy" || now === "ishield") {
    // the customer has named the other plan: only the person travels, because the sum, the
    // plan, the territory and any offer on the table all belong to the contract being left
    if (named && named !== now) return run(named, history, personIn(stored), true, channel);
    return run(now, history, stored, false, channel);
  }

  /**
   * A plan with no brain, named outright and asked about money.
   *
   * It lives here rather than in the page that first needed it, because the answer must not
   * depend on which door the customer came through: the same question about a PLB premium
   * gets the same figure from the website and from the page's inbox, drawn on the same card.
   * Checked before the topic, since "PLB ทุน 1 ล้าน" reads as a life-insurance subject and
   * would otherwise be quoted as the plan that owns that subject.
   */
  const other = planNamedIn(asked);
  /**
   * iShield is in that list of names and is not brainless: it has a brain of its own, which
   * takes a monthly saving and answers with the cover it buys. Caught here, it was answered
   * with the brainless path's apology — "this chat can't, use the other page" — which was
   * the most common unanswered question on the website (16 in a fortnight), from a button
   * the page itself offered. Named, it goes to its brain below.
   */
  if (other && other.code !== "ISHIELD" && asksAboutMoney(asked)) {
    const priced = priceNamedPlan(asked, other.code, other.label);
    return {
      messages: [
        // the same words, written for wherever they are about to be read
        {
          text: writtenFor(channel, priced.text),
          ...(priced.cards?.[0] ? { card: priced.cards[0] } : {}),
          // beside the card it prints, where it is remembered for a later "ขอไฟล์ PDF"
          ...(priced.pdfPath ? { pdfPath: priced.pdfPath } : {}),
        },
        ...(priced.cards?.slice(1) ?? []).map((card) => ({ text: "", card })),
      ],
      priced: priced.priced,
      ...(priced.guide?.length ? { guide: priced.guide } : {}),
      // a plan without a brain carries no conversation, so nothing is held between turns
      slots: { product: "undecided", ...personIn(stored) },
    };
  }

  // nothing settled yet: the name first, then the subject, then the advertisement they came through
  const product = named ?? productByTopic(asked) ?? cameFor;
  if (product) return run(product, history, personIn(stored), true, channel);

  // the customer has not said, so the customer is asked — and what they did say is kept,
  // all of it: everyone they named, not only whoever they named first
  const here = peopleIn(asked);
  const carriedPerson = personIn(stored);
  // an age with no sex beside it is still an age: it decides which doors can be opened at all
  const alone = here.length ? undefined : ageIn(asked);
  const undecided: Undecided = {
    product: "undecided",
    ...(here.length
      ? { age: here[0].age, sex: here[0].sex, ...(here.length > 1 ? { people: here } : {}) }
      : { ...carriedPerson, ...(alone !== undefined ? { age: alone } : {}) }),
  };
  /**
   * A question the dispatcher cannot place, but the library can answer.
   *
   * "HIC ซื้อคู่กับ MEB ได้ไหม" names no plan and is about no one plan's subject, so this used
   * to be met with "สวัสดีครับ สนใจแบบไหนครับ" — a question answered with a question, in an
   * inbox paid for by advertising. The rules of all five plans are in the library, so it is
   * asked before the customer is.
   *
   * Only for something actually asked. "สนใจประกันชีวิต" is a lead, not a question, and the
   * two buttons are the right answer to it — which is why they are still attached below.
   */
  /**
   * Someone asking to apply, who was never placed on a plan.
   *
   * Both halves of this were the four buttons until now. "สนใจสมัคร" is the words the bot
   * itself hands out and the title of the button under every follow-up, and typed by a
   * customer with no plan on their session it was read as nothing at all; "สนใจ", from a
   * customer the bot had just invited to apply, was read as no better. Neither is a question
   * about which plan they came for, and both are the message this whole campaign is for.
   *
   * The form does not need a plan — it asks for what the agency needs and a person reads it —
   * and it says the premium is a message away, which is the invitation the menu was trying
   * to make.
   */
  const lastSaid = [...history].reverse().find((m) => m.role === "assistant")?.content;

  /**
   * "2", from a customer looking at a numbered list.
   *
   * Read only where the list was actually put up. The same two characters mean nothing on
   * their own, and a conversation that never saw the menu should not have a stray digit
   * turned into a plan — so the history is asked whether the question was ever put, rather
   * than the digit being trusted on its own.
   *
   * Not just the turn before: the bot answers a second silence with a person and leaves the
   * buttons up, and a customer who scrolls back and types the number then has still chosen.
   */
  const putUp = history.some((m) => m.role === "assistant" && m.content.includes(ASKED_WHICH));
  const picked = putUp ? pickedFromMenu(asked) : undefined;
  if (picked) return run(picked, history, personIn(stored), true, channel);

  if (wantsToBuy(asked, false) || tookUpTheOffer(asked, lastSaid)) {
    const form = handOverForm(false);
    return {
      ...form,
      messages: form.messages.map((m) => ({ ...m, text: writtenFor(channel, m.text) })),
      slots: { ...undecided, formSent: true },
    };
  }

  // a question they asked on the way in is answered before the question they are asked back
  const lead = asksAboutCompany(asked) ? aboutCompany(asked) : undefined;

  /**
   * Checked after the company's own answer, which is free and is the better one: "ของอะไร"
   * asks which insurer, and the library would spend a model call arriving somewhere worse.
   */
  if (!lead && ASKS_SOMETHING.test(asked)) {
    const answer = await answerFromLibrary(history, asked, channel);
    if (answer) {
      return {
        messages: [{ text: answer }], replies: askWhich().replies,
        slots: undecided, fromLibrary: true,
      };
    }
  }

  /**
   * The same menu twice is a dead end.
   *
   * A man of sixty-eight gave his age, was shown four arrangements, wrote "ขอดูทั้ง2แบบ", and
   * was shown the same four again — two of which no company would have issued him. The age
   * narrows the list below; a second pass at the same list does not need narrowing, it needs
   * a person, and the agency is watching this inbox.
   */
  if (!lead && lastSaid?.includes(ASKED_WHICH)) {
    return { ...askWhichAgain(), slots: undecided };
  }

  return { ...askWhich(lead), slots: undecided };
}

/**
 * Hand the turn to one brain.
 *
 * `fresh` says the slots being passed are a person and not a conversation — a switch of plan,
 * or a first turn — so the brain starts over with an age and a sex rather than inheriting
 * fields that were about something else.
 */
async function run(
  product: Product, history: ChatMessage[], carried: AnySlots | Person | null, fresh: boolean,
  channel: Channel = "web",
): Promise<AnyAnswer> {
  if (product === "legacy" || product === "ishield") {
    /**
     * The one brain that is given the message rather than the conversation.
     *
     * It reads two things — a person and a sum — and both are said in the turn being answered.
     * Handing it the history would be handing it turns it has no use for, and a shape it would
     * then have to be kept in step with.
     */
    const asked = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
    if (product === "ishield") {
      const previous = fresh ? startIShield(carried as Person) : (carried as IShieldSlots);
      return answerIShield(asked, previous, channel);
    }
    const previous = fresh ? startLegacy(carried as Person) : (carried as LegacySlots);
    return answerLegacy(asked, previous, channel);
  }
  if (product === "ihealthy") {
    const previous = fresh
      ? startHealth(carried as Person)
      : (carried as HealthSlots);
    const answer = await answerHealth(history, previous);
    return { ...answer, slots: answer.slots };
  }
  const previous = fresh ? startLife(carried as Person) : (carried as Routed);
  const answer = await answerQuestion(history, previous);
  return { ...answer, slots: { ...answer.slots, product: "lifeprotect" } };
}

/**
 * A legacy conversation begun from whatever the last one knew about the person.
 *
 * The tier is left behind with everything else, because a sum chosen on another contract is
 * not a sum chosen on this one: "ทุน 1 ล้าน" on the life plan is what the family receives,
 * and a million of this arrangement is a different arrangement entirely.
 */
function startLegacy({ age, sex }: Person): LegacySlots | null {
  if (age === undefined && sex === undefined) return null;
  return { product: "legacy", ...(age !== undefined ? { age } : {}), ...(sex ? { sex } : {}) };
}

/**
 * The same for iShield, and the sum is left behind for the same reason as the tier.
 *
 * A million of this contract is not a million of either other one — it is a paying term, a
 * maturity and a list of illnesses besides — so a sum decided elsewhere decides nothing here.
 */
function startIShield({ age, sex }: Person): IShieldSlots | null {
  if (age === undefined && sex === undefined) return null;
  return { product: "ishield", ...(age !== undefined ? { age } : {}), ...(sex ? { sex } : {}) };
}

/** A health conversation begun from whatever the last one knew about the person. */
function startHealth({ age, sex }: Person): HealthSlots | null {
  // the group is left behind on purpose: the health contract is priced one person at a time
  if (age === undefined && sex === undefined) return null;
  return { product: "ihealthy", intent: "quote", ...(age !== undefined ? { age } : {}), ...(sex ? { sex } : {}) };
}

/** The same, the other way round. */
function startLife(person: Person): Routed | null {
  if (person.age === undefined && person.sex === undefined) return null;
  return { intent: "quote", product: "lifeprotect", ...person };
}
