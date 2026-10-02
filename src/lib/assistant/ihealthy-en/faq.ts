import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { translateFacts } from "@/lib/ihealthy-translate";

/**
 * The Thai health FAQ (ihealthy/faq.ts) for a foreign customer, plus the two questions only a
 * foreigner asks: a visa, and cover back home.
 *
 * Order matters for the same reason it does in Thai: a message that mentions a condition is,
 * above everything else, a message that must not be told it will be accepted.
 */
interface Entry {
  key: string;
  match: RegExp;
  answer: () => string;
}

export const HEALTH = /pre-?existing|condition|diabetes|blood pressure|hypertension|cancer|heart|surgery|asthma|thyroid|medication|sick|illness|disease/i;

export const FAQ_EN: Entry[] = [
  {
    key: "health",
    match: HEALTH,
    answer: () =>
      "You can still apply with a health condition — you just need to declare your health truthfully on the application, "
      + "and the insurer reviews each case: standard terms, an extra premium, or an exclusion for that condition.\n"
      + "We can't answer for the insurer's decision, so an agent will help you here in this chat 🙏\n"
      // the owner's choice (2026-10-02): most expats arrive with a condition, and the agent
      // can only pre-check one they have been told about
      + "To help the agent check, could you share a bit more about the condition you have now, "
      + "the treatment you've had, and any medication you take?",
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
      + "What's required depends on your situation and can change, so an agent will check what your application needs.",
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
    key: "rises",
    match: /premium[^\n]{0,20}(?:go(?:es)? up|increase|rise)|every year|fixed premium|price change/i,
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
      + "An agent can explain how it works in your case.",
  },
];

/** The written answer for a message, or undefined when it asks none of these. */
export function healthFaqAnswerEn(text: string): string | undefined {
  return FAQ_EN.find((e) => e.match.test(text))?.answer();
}
