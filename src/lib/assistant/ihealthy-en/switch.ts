import type { ChatMessage } from "@/lib/ai/types";
import type { Sex } from "@/calc/types";
import type { AnyAnswer } from "../dispatch";
import type { Channel } from "../channel";
import { askWhich, CHOOSE_HEALTH, CHOOSE_ISHIELD, CHOOSE_LEGACY, CHOOSE_LIFE, productNamedIn } from "../choose";
import { affirms, ageIn, ASK_FOR_TABLE, one, peopleIn, sexIn, WANTS_IN, wantsToBuy, type Reply } from "../common";
import { asksForEnglish, asksForThai } from "../expat";
import { asksFullTable, planNamedIn, type HealthSlots } from "../ihealthy/route";
import { healthMenu } from "../ihealthy/menu";
import { hasHealthQuote, healthQuote } from "../ihealthy/quote";
import { pdfTurn, PDF_YES, PDF_YES_EN, withPdfOffer } from "../pdf";
import type { AnySlots, PdfMemory, WithPdf } from "../slots";
import { answerHealthEn } from "./answer";
import { personOf, withoutLang } from "./door";
import { fullTableEn, healthMenuEn, healthQuoteEn } from "./quote";
import { personInEn } from "./route";
import { ASK_AGE_EN, ASK_DETAILS_EN, ASK_SEX_EN, CHECK_PREMIUMS_EN, WANTS_IN_EN } from "./words";

/**
 * English on LINE and the Thai Pages, for a customer who asks for it (owner chose ก,
 * 2026-11-03; mockup https://claude.ai/artifact/JjML2k86GveY4cbd7Eikp8).
 *
 * Only on request: "ภาษาอังกฤษ", "English please", or the word beside what is wanted. From then
 * on the conversation is the English health brain's, as on the Expat Pages, until the customer
 * asks for Thai (owner chose ก again, 2026-11-04, mockup
 * https://claude.ai/artifact/7g9JroHnGZSpkfc6t7HCZW): an agent writes Thai and wants the papers
 * in English for a foreign client, so Thai words alone do not end it. A woman of 69 asked for
 * English after her Thai quote and was sent the same Thai quote again (LINE, 2026-11-03).
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

/** The person and plan the message names, in either script, over what is already known. */
function withWhatIsNamed(asked: string, before: HealthSlots): HealthSlots {
  const en = personInEn(asked);
  const pair = peopleIn(asked)[0];
  const age = ageIn(asked) ?? pair?.age ?? en.age;
  const sex = sexIn(asked) ?? pair?.sex ?? en.sex;
  const plan = planNamedIn(asked);
  return { ...before, ...(age !== undefined ? { age } : {}), ...(sex ? { sex } : {}), ...(plan ? { plan } : {}) };
}

/** What a message asks to have drawn up, when it says enough; undefined leaves it to the brain. */
function drawnUp(asked: string, before: HealthSlots, known: HealthSlots): Reply | undefined {
  const { age, sex, plan } = known;
  if (age === undefined || sex === undefined) return undefined;
  const who = { ...known, age, sex: sex as Sex };
  const moved = age !== before.age || sex !== before.sex || plan !== before.plan;
  const premium = moved ? (plan ? healthQuoteEn({ ...who, plan }) : healthMenuEn(age, sex as Sex)) : undefined;
  if (!asksFullTable(asked)) return premium;
  const table = fullTableEn(who);
  if (!premium) return table;
  // a new person: the sheet, and their premium under it. The file has gone, so nothing offers it again
  const { text, card } = premium.messages[0];
  return { ...premium, messages: [...table.messages, { text, ...(card ? { card } : {}) }] };
}

/** "ภาษาอังกฤษ": the premium again, or what the message asked for, without asking for the person twice. */
export function toEnglish(asked: string, stored: AnySlots | null, memory: PdfMemory | undefined): AnyAnswer {
  const settled = stored ? ("product" in stored && stored.product ? stored.product : "lifeprotect") : undefined;
  const product = productNamedIn(asked) ?? settled;
  if (product && product !== "ihealthy" && product !== "undecided") {
    const kept = stored ?? { product: "undecided" as const };
    return { ...one(ONLY_PERSON_EN), slots: (memory ? { ...kept, pdf: memory } : kept) as AnySlots };
  }
  const health = settled === "ihealthy" ? stored as HealthSlots : personOf(stored);
  const before: HealthSlots = { ...(health ?? { product: "ihealthy", intent: "other" }), lang: "en" };
  const known = withWhatIsNamed(asked, before);
  const reply = drawnUp(asked, before, known) ?? premiumEn(known);
  return withPdfOffer({ ...lead(reply, SWITCHED_EN), slots: known }, memory, "en");
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

/** One turn of a conversation the customer asked to have in English. */
export async function answerInEnglish(
  history: ChatMessage[], stored: HealthSlots, lastSaid: string | undefined, memory: PdfMemory | undefined,
  channel: Channel,
): Promise<AnyAnswer> {
  const asked = [...history].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
  if (asksForThai(asked)) return toThai(stored, memory);
  if (OTHER_PLANS.has(asked)) {
    return { ...one(ONLY_PERSON_EN), slots: (memory ? { ...stored, pdf: memory } : stored) as AnySlots };
  }
  // the menu under the chat stays Thai: its buttons are read as their English words
  const buys = THAI.test(asked) && wantsToBuy(asked, hasHealthQuote(stored)) && !affirms(asked);
  const meant = BUTTONS_EN.get(asked) ?? (buys ? WANTS_IN_EN : asked);
  // a person, a plan or the sheet asked for in Thai: the English brain reads none of them
  if (THAI.test(meant) || asksForEnglish(meant)) {
    const known = withWhatIsNamed(meant, stored);
    const reply = drawnUp(meant, stored, known) ?? (asksForEnglish(meant) ? premiumEn(known) : undefined);
    if (reply) return withPdfOffer({ ...reply, slots: known }, memory, "en");
  }

  const asks = pdfTurn(meant, lastSaid, memory, channel, "en");
  if (asks) return { ...asks.reply, slots: { ...stored, pdf: asks.memory } as WithPdf<AnySlots> };
  const said = [...history];
  const at = said.map((m) => m.role).lastIndexOf("user");
  if (at >= 0) said[at] = { ...said[at], content: meant };
  const answer = await answerHealthEn(said, stored);
  return withPdfOffer(answer, memory, "en");
}
