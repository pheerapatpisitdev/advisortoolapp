import { iHealthyFacts, isHeading, planLabel, type BenefitRow } from "@/lib/ihealthy-facts";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { translateFacts } from "@/lib/ihealthy-translate";
import { asksShareOfBill } from "../ihealthy/route";

/**
 * The Thai health FAQ (ihealthy/faq.ts) for a foreign customer, plus the questions only a
 * foreigner asks: a visa, cover back home, paying at the hospital, the policy's own papers.
 *
 * Order matters. A message that mentions a condition must not be told it will be accepted, so
 * the health declaration comes before every general answer. Three benefit questions come
 * before it, because their words are its words too: "sublimits for surgery", "outpatient
 * medication", "if I have an accident or only when I'm sick" were each met with the health
 * declaration and nothing else (daily chat review, 2026-11).
 *
 * Every figure is read from the benefit sheet or the rate table, never written here.
 */
interface Entry {
  key: string;
  match: RegExp;
  answer: () => string;
}

export const HEALTH = /pre-?existing|condition|diabetes|blood pressure|hypertension|cancer|heart|surgery|asthma|thyroid|medication|sick|illness|disease/i;

/**
 * The phrases that carry the health words without telling of a condition: the policy's own
 * terms and conditions, and being ill in general.
 */
const NOT_A_CONDITION = /terms (?:and|&) conditions|conditions? of (?:the )?(?:policy|cover(?:age)?|contract)|(?:only )?when (?:i'?m|im|i am|i get|you(?:'re| are)) (?:sick|ill)|(?:get|getting|fall|falling|become) (?:sick|ill)/gi;

/** The message speaks of a condition the customer has, not of being ill in general. */
export function mentionsCondition(text: string): boolean {
  return HEALTH.test(text.replace(NOT_A_CONDITION, " "));
}

const ACCIDENT = /(?:cover|include|pay|claim)[^.?!\n]{0,40}\baccident|\baccidents?\b[^.?!\n]{0,40}(?:covered|included|too|as well|also)|\bif i (?:have|get|had) (?:an? )?accident|accident or (?:only )?|only (?:for |when )?(?:illness|sickness)/i;
const OUTPATIENT = /out-?patient|\bOPD\b|doctor'?s? (?:visits?|consultations?)|clinic visits?|\bconsultations?\b/i;
const DEDUCTIBLE = /\bdeductibles?\b|co-?pay(?:ments?)?|sub-?limits?|individual limits|\bexcess\b|out[- ]of[- ]pocket|limits? (?:for|per|on) (?:surgery|rooms?|treatment|each)/i;
/** a deductible asked for to pay less: the versions that share the bill, not a limit on this one */
const FOR_LESS = /cheaper|lower|reduce|save|less\b|version|option|discount|afford/i;
export const DOCUMENTS = /terms (?:and|&) conditions|policy (?:wording|documents?|terms|booklet)|\bexclusions?\b|full (?:policy )?benefits|brochure|what(?:'s| is) not covered|contract document/i;
export const RISES = /premium[^\n]{0,20}(?:go(?:es)? up|increase|rise)|every year|fixed premium|price change|as i (?:get|grow) older|(?:cost|premium|price|pay)[^.?!\n]{0,40}\bat (?:the )?(?:ages?\s+)?\d{2}\b|when i(?:'m| am) \d{2}/i;
const DIRECT = /direct (?:billing|pay(?:ment)?|settlement)|cashless|pay (?:up ?front|first|in advance)|fax claim|reimburs|guarantee of payment|\bGOP\b/i;
const NO_CLAIM = /no[- ]?claims?(?: bonus| discount)?\b|claim[- ]free|(?:discount|bonus)[^.?!\n]{0,30}(?:no|without|don'?t) claim/i;
const AGES = /how old|age limit|max(?:imum)? age|min(?:imum)? age|(?:up to|until|till) what age|renew(?:able|al)? (?:until|up to|to)\b|how long can i (?:keep|renew)|too old|(?:what|which) ages?\b/i;

/** "1,500 ต่อวัน" → 1500; the number a cell starts with. */
const firstNumber = (cell: string) => Number((/[\d,]+/.exec(cell)?.[0] ?? "").replace(/,/g, ""));
const AS_CHARGED = /ตามที่จ่ายจริง|as charged/i;
const NONE = /^\s*(?:-|ไม่คุ้มครอง|not covered)\s*$/i;

function row(no: number): BenefitRow | undefined {
  return iHealthyFacts().rows.find((r): r is BenefitRow => !isHeading(r) && r.no === no);
}
function subRow(prefix: string): BenefitRow | undefined {
  return iHealthyFacts().rows.find((r): r is BenefitRow => !isHeading(r) && r.title.startsWith(prefix));
}
const everyPlanPaysAsCharged = (r: BenefitRow | undefined) =>
  r !== undefined && iHealthyFacts().plans.every((p) => AS_CHARGED.test(r.adult[p.code] ?? ""));

const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]);

/** Outpatient visits by plan — row 18 of the sheet — and the two outpatient cover every plan has. */
export function outpatientEn(): string {
  const { plans } = iHealthyFacts();
  const opd = row(18);
  if (!opd) return "";
  const none: string[] = [];
  const parts: string[] = [];
  const yearly: string[] = [];
  for (const p of plans) {
    const cell = opd.adult[p.code] ?? "";
    const name = planLabel(p.code);
    if (NONE.test(cell)) none.push(name);
    else if (AS_CHARGED.test(cell)) {
      if (yearly.length) parts.push(`${yearly.splice(0).join(", ")} baht a year`);
      parts.push(`${name} as charged`);
    } else yearly.push(`${name} ${firstNumber(cell).toLocaleString("en-US")}`);
  }
  if (yearly.length) parts.push(`${yearly.join(", ")} baht a year`);
  const head = none.length ? [`${list(none)} don't include them`, ...parts] : parts;
  const also = everyPlanPaysAsCharged(row(7)) && everyPlanPaysAsCharged(subRow("หมวดย่อยที่ 6.2"))
    ? " Every plan covers outpatient care within 24 hours of an accident and follow-up within 30 days of an admission."
    : "";
  return `Outpatient visits depend on the plan: ${head.join(", ")}.${also}`;
}

/** No deductible on the version quoted here; the room is the one daily limit (row 1). */
export function limitsEn(): string {
  const { plans } = iHealthyFacts();
  const room = row(1);
  const low = plans[0];
  const high = plans[plans.length - 1];
  const rooms = room
    ? ` The one daily limit is the standard room: ${firstNumber(room.adult[low.code] ?? "").toLocaleString("en-US")} baht on `
      + `${planLabel(low.code)} up to ${firstNumber(room.adult[high.code] ?? "").toLocaleString("en-US")} on ${planLabel(high.code)}.`
    : "";
  return "The standard version has no deductible. Doctor's fees, surgery, medicines and ICU are paid as charged "
    + `within the yearly limit.${rooms}`;
}

const termsEn = () => translateFacts(iHealthyFacts(), "en").terms;

/** How many exclusions the rider has, as its own wording counts them. */
export function exclusionCount(): number | undefined {
  const n = /(\d+) exclusions/.exec(termsEn().exclusions)?.[1];
  return n ? Number(n) : undefined;
}

export function exclusionsLineEn(): string {
  const n = exclusionCount();
  return `The policy has ${n ? `${n} exclusions` : "a list of exclusions"} — I'll send you the full list right here in this chat.`;
}

export const FAQ_EN: Entry[] = [
  {
    key: "deductible",
    match: DEDUCTIBLE,
    answer: () => limitsEn(),
  },
  {
    key: "outpatient",
    match: OUTPATIENT,
    answer: () => outpatientEn(),
  },
  {
    key: "accident",
    match: ACCIDENT,
    answer: () => {
      const { terms } = iHealthyFacts();
      return "Both. Accidents are covered straight away, with no waiting period. "
        + `Illness is covered after the ${terms.waitingDays}-day waiting period.`
        + (everyPlanPaysAsCharged(row(7)) ? " Outpatient treatment within 24 hours of an accident is covered too." : "");
    },
  },
  {
    key: "health",
    match: HEALTH,
    answer: () =>
      "You can still apply with a health condition — you just need to declare your health truthfully on the application, "
      + "and the insurer reviews each case: standard terms, an extra premium, or an exclusion for that condition.\n"
      + "I can't answer for the insurer's decision, but I'll help you with it right here in this chat 🙏\n"
      // the owner's choice (2026-10-02): most expats arrive with a condition, and the agent
      // can only pre-check one they have been told about
      + "To help me check, could you share a bit more about the condition you have now, "
      + "the treatment you've had, and any medication you take?",
  },
  {
    // the PDF goes with it once the person is known (answer.ts); this is the words before that
    key: "documents",
    match: DOCUMENTS,
    answer: () => "I can send you the full benefit table as a PDF — could you tell me your age and gender (e.g. \"35 male\")? "
      + exclusionsLineEn(),
  },
  {
    /**
     * Said broadly, never with a visa's name and never as a promise — the owner's rule for the
     * Studio's expat posts (2026-10-02), and the same customer reads both.
     */
    key: "visa",
    match: /visa|immigration|extension of stay|\bnon-?o\b|\bO-?A\b|\bO-?X\b|\bLTR\b/i,
    answer: () =>
      "Many expats use this policy as proof of health insurance for their stay in Thailand. "
      + "What's required depends on your situation and can change, so let me check what your application needs.",
  },
  {
    key: "abroad",
    match: /abroad|overseas|travel|outside (?:of )?thailand|home country|go(?:ing)? home/i,
    answer: () => {
      const { terms } = iHealthyFacts();
      return "Your main cover is in the territory you choose. Outside it, you're covered for emergencies only, "
        + `within ${terms.outOfTerritoryDays} days of each trip.`;
    },
  },
  {
    key: "waiting",
    match: /waiting|when does (?:it|the cover|cover) start|start(?:s)? cover/i,
    answer: () => {
      const { terms } = translateFacts(iHealthyFacts(), "en");
      return `There's a ${terms.waitingDays}-day waiting period from the start date.\n`
        + `These conditions wait ${terms.specialWaitingDays} days — ${terms.specialWaitingDiseases.join(" · ")}\n`
        + "Accidents are covered straight away, with no waiting period.";
    },
  },
  {
    // the figures at each age go out instead once the person is known (topics.ts, owner chose ข)
    key: "rises",
    match: RISES,
    answer: () =>
      "The medical part of the premium goes up with age each year — the figure we quote is the first year.\n"
      + "The base life policy's premium stays level.",
  },
  {
    key: "monthly",
    match: /monthly|instal?ments?|pay (?:by|with) card|how (?:do|can) i pay/i,
    answer: () =>
      "Yes, you can pay monthly — the first payment covers 2 months, then it's charged automatically from month 3.\n"
      + "Semi-annual and annual payments are available too.",
  },
  {
    key: "tax",
    match: /\btax\b/i,
    answer: () =>
      "Health premiums can reduce Thai personal income tax for people who file tax in Thailand. "
      + "I can check how it works in your case if you'd like.",
  },
  {
    // the province question goes with it (answer.ts sets `hospitalAsked`), so "Phuket" is its reply
    key: "direct",
    match: DIRECT,
    answer: () =>
      "At hospitals in Krungthai-AXA's network you can use Fax Claim once your policy has been in force for 90 days, "
      + "so you don't pay upfront for covered treatment. Tell me your province and I'll show you the hospitals near you.",
  },
  {
    key: "noclaim",
    match: NO_CLAIM,
    answer: () => {
      const terms = termsEn();
      const years = /(\d+) consecutive/.exec(terms.noClaimDiscount)?.[1] ?? "3";
      return `Yes — a ${terms.noClaimDiscountPercent}% discount on the renewal premium after ${years} consecutive policy years with no claim.`;
    },
  },
  {
    key: "ages",
    match: AGES,
    answer: () => {
      const table = iHealthyTable();
      return `You can apply from age ${table.ageMin} to ${table.ageMax}, and renew up to age ${iHealthyFacts().terms.renewalToAge}.`;
    },
  },
];

/** Whether this entry is what the message asks — the health one read past the policy's "conditions". */
export function faqMatches(entry: Entry, text: string): boolean {
  if (entry.key === "health") return mentionsCondition(text);
  if (entry.key === "deductible") return entry.match.test(text) && !(asksShareOfBill(text) && FOR_LESS.test(text));
  return entry.match.test(text);
}

/** The entry a message asks, first in the order above. */
export function faqFor(text: string): Entry | undefined {
  return FAQ_EN.find((e) => faqMatches(e, text));
}

/** The written answer for a message, or undefined when it asks none of these. */
export function healthFaqAnswerEn(text: string): string | undefined {
  return faqFor(text)?.answer();
}
