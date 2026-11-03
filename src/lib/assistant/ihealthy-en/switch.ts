import type { ChatMessage } from "@/lib/ai/types";
import type { Sex } from "@/calc/types";
import type { AnyAnswer } from "../dispatch";
import type { Channel } from "../channel";
import { askWhich, CHOOSE_HEALTH, CHOOSE_ISHIELD, CHOOSE_LEGACY, CHOOSE_LIFE } from "../choose";
import { ASK_FOR_TABLE, one, WANTS_IN, type Reply } from "../common";
import { asksForThai } from "../expat";
import type { HealthSlots } from "../ihealthy/route";
import { healthMenu } from "../ihealthy/menu";
import { healthQuote } from "../ihealthy/quote";
import { pdfTurn, PDF_YES, PDF_YES_EN, withPdfOffer } from "../pdf";
import type { AnySlots, PdfMemory, WithPdf } from "../slots";
import { answerHealthEn } from "./answer";
import { personOf, withoutLang } from "./door";
import { healthMenuEn, healthQuoteEn } from "./quote";
import { ASK_AGE_EN, ASK_DETAILS_EN, ASK_SEX_EN, CHECK_PREMIUMS_EN, WANTS_IN_EN } from "./words";

/**
 * English on LINE and the Thai Pages, for a customer who asks for it (owner chose ก,
 * 2026-11-03; mockup https://claude.ai/artifact/JjML2k86GveY4cbd7Eikp8).
 *
 * Only on request: "ภาษาอังกฤษ", "English please". From then on the conversation is the
 * English health brain's, as on the Expat Pages, until the customer asks for Thai or writes a
 * Thai sentence. A woman of 69 asked for English after her Thai quote and was sent the same
 * Thai quote again (LINE, 2026-11-03).
 */

export const SWITCHED_EN = "Sure — I'll continue in English 🙏";
/** Only iHealthy has an English brain; anything else is the agent's, in English. */
export const ONLY_PERSON_EN = "Sure 🙏 Let me check that for you — I'll get back to you right here in this chat, in English.";
export const SWITCHED_TH = "ได้ครับ ต่อเป็นภาษาไทยนะครับ 🙏";

/** The conversation is in English on a Page that is not an Expat Page: the customer asked for it. */
export function inEnglish(stored: AnySlots | null): stored is HealthSlots {
  return Boolean(stored && "product" in stored && stored.product === "ihealthy" && stored.lang === "en");
}

/** The Thai menu's buttons, which a customer in English can still tap, in the English brain's words. */
const BUTTONS_EN = new Map([
  [WANTS_IN, WANTS_IN_EN],
  [PDF_YES, PDF_YES_EN],
  [CHOOSE_HEALTH, CHECK_PREMIUMS_EN],
]);
/** The buttons for plans there is no English brain for. */
const OTHER_PLANS = new Set([CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD, ASK_FOR_TABLE]);

const THAI = /[฀-๿]/;

function lead(reply: Reply, first: string): Reply {
  const [head, ...rest] = reply.messages;
  return { ...reply, messages: [{ ...head, text: `${first}\n\n${head.text}` }, ...rest] };
}

/** The person's premium, or the question for what it still needs, in English. */
function premiumEn(known: HealthSlots): Reply {
  const { age, sex, plan } = known;
  if (age !== undefined && sex !== undefined) {
    return plan ? healthQuoteEn({ ...known, age, sex: sex as Sex, plan }) : healthMenuEn(age, sex as Sex);
  }
  if (age !== undefined) return one(ASK_SEX_EN);
  if (sex !== undefined) return one(ASK_AGE_EN);
  return one(ASK_DETAILS_EN);
}

/** "ภาษาอังกฤษ": the same premium again, in English, without asking for the person twice. */
export function toEnglish(stored: AnySlots | null, memory: PdfMemory | undefined): AnyAnswer {
  const product = stored ? ("product" in stored && stored.product ? stored.product : "lifeprotect") : undefined;
  if (product && product !== "ihealthy" && product !== "undecided") {
    const kept = stored as AnySlots;
    return { ...one(ONLY_PERSON_EN), slots: (memory ? { ...kept, pdf: memory } : kept) as AnySlots };
  }
  const health = product === "ihealthy" ? stored as HealthSlots : personOf(stored);
  const known: HealthSlots = { ...(health ?? { product: "ihealthy", intent: "other" }), lang: "en" };
  return withPdfOffer({ ...lead(premiumEn(known), SWITCHED_EN), slots: known }, memory, "en");
}

/** "ภาษาไทย": back to the Thai brain, with the premium in Thai when there is one to show. */
function toThai(stored: HealthSlots, memory: PdfMemory | undefined): AnyAnswer {
  const known = withoutLang(stored);
  const { age, sex, plan } = known;
  if (age === undefined || sex === undefined) {
    return { ...askWhich(SWITCHED_TH), slots: { product: "undecided", ...(age !== undefined ? { age } : {}), ...(sex ? { sex: sex as "M" | "F" } : {}) } };
  }
  const reply = plan ? healthQuote({ ...known, age, sex: sex as Sex, plan }) : healthMenu(age, sex as Sex);
  return withPdfOffer({ ...lead(reply, SWITCHED_TH), slots: known }, memory);
}

/**
 * One turn of a conversation the customer asked to have in English, or undefined when they
 * have written Thai and the Thai doors should take it, in Thai, from the slots returned.
 */
export async function answerInEnglish(
  history: ChatMessage[], stored: HealthSlots, lastSaid: string | undefined, memory: PdfMemory | undefined,
  channel: Channel,
): Promise<AnyAnswer | { thai: HealthSlots }> {
  const asked = [...history].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
  if (asksForThai(asked)) return toThai(stored, memory);
  if (OTHER_PLANS.has(asked)) {
    return { ...one(ONLY_PERSON_EN), slots: (memory ? { ...stored, pdf: memory } : stored) as AnySlots };
  }
  // the menu under the chat stays Thai: its buttons are read as their English words
  const meant = BUTTONS_EN.get(asked) ?? asked;
  if (THAI.test(meant)) return { thai: withoutLang(stored) };

  const asks = pdfTurn(meant, lastSaid, memory, channel, "en");
  if (asks) return { ...asks.reply, slots: { ...stored, pdf: asks.memory } as WithPdf<AnySlots> };
  const said = [...history];
  const at = said.map((m) => m.role).lastIndexOf("user");
  if (at >= 0) said[at] = { ...said[at], content: meant };
  const answer = await answerHealthEn(said, stored);
  return withPdfOffer(answer, memory, "en");
}
