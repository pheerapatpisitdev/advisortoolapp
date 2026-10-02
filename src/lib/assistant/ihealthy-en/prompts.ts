import { formatBaht } from "@/calc/money";
import { benefitValue, iHealthyFacts, isHeading, planLabel, type BenefitRow } from "@/lib/ihealthy-facts";
import { PHONE_ROW_LABEL, phoneColumns } from "@/lib/ihealthy-phone";
import { iHealthyPricing, plansFor } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { translateFacts } from "@/lib/ihealthy-translate";
import { WORDS } from "@/lib/ihealthy-words";
import { arrangementFor } from "../ihealthy/quote";
import type { HealthSlots } from "../ihealthy/route";

/**
 * The Thai health prompts (ihealthy/prompts.ts) for a foreign customer: the same prohibitions,
 * the same facts read from the same sheet, plus the expat rules the owner set for the Studio's
 * English posts (2026-10-02).
 */

const W = WORDS.en;

const VOICE_EN = `You are the admin of an insurance Page, replying to a customer in Facebook Messenger.

Reply in English only, whatever language the facts below are in.
Tone: like a real person typing — short, friendly, warm, not formal. Answer the question straight away.
1–3 short sentences per point. No headings, no bullet points, no bold. At most one emoji.
Use plain words, not policy language — most people asking are not insurance people.
Don't end every message with a question.`;

const HEALTH_RULES_EN = `Never say whether any illness, symptom or treatment history will be covered or accepted — that is the insurer's decision.
Never diagnose, never recommend treatment, never recommend a hospital.
For claims, hospital networks and underwriting, say an agent will answer in this chat.
If you mention the premium, say it is the first-year premium and rises with age each year.
Never work out a figure yourself, and never write any figure that is not in the facts below.
Visa: you may say many expats use this policy as proof of health insurance for their stay. Never name a visa type, and never promise or guarantee anything about a visa — an agent checks each case.
Abroad: outside the chosen territory, cover is for emergencies only, within 90 days of each trip. Never say "worldwide" unless the quoted territory is Worldwide.`;

export const HEALTH_PLAN_INFO_SYSTEM_EN = `${VOICE_EN}

${HEALTH_RULES_EN}

Answer only from the facts below. Don't guess.
Don't send the customer to an agent for a premium — this system prices every age and gender itself.
If the customer wants a premium, ask for their age and gender and say you'll work it out.`;

export const HEALTH_SMALL_TALK_SYSTEM_EN = `${VOICE_EN}

${HEALTH_RULES_EN}

Never state a premium or any benefit figure yourself.
On a first greeting: greet back briefly, then ask for their age and gender so you can work out the premium.
If they say thanks, OK, they'll think about it, or they'll come back: reply with one short line and stop.
Never ask again for anything already known (see below, if any).
At most 2 lines.`;

function rowsOf(entries: readonly (BenefitRow | { heading: string })[]): BenefitRow[] {
  return entries.filter((e): e is BenefitRow => !isHeading(e));
}

/** The benefit rows, narrowed the way the Thai prompt narrows them. */
function benefits(slots: HealthSlots, today: Date): string {
  const facts = translateFacts(iHealthyFacts(), "en");
  const table = iHealthyTable(today);
  const known = slots.age !== undefined;
  const age = slots.age ?? table.ageMin;
  const sellable = known ? plansFor(table, age).map((p) => p.code) : table.plans.map((p) => p.code);

  if (slots.plan && sellable.includes(slots.plan)) {
    const plan = facts.plans.find((p) => p.code === slots.plan)!;
    const rows = rowsOf(facts.rows)
      .map((row) => {
        const value = benefitValue(row, slots.plan!, age);
        return value ? `${row.title}: ${value}` : "";
      })
      .filter(Boolean);
    return `Plan ${planLabel(plan.code)} (yearly medical limit ${plan.annualMax.toLocaleString("en-US")} baht)\n${rows.join("\n")}`;
  }

  const shown = known ? phoneColumns(table.plans.map((p) => p.code), sellable) : sellable;
  const headline = rowsOf(facts.rows).filter((row) => row.no !== null && row.no in PHONE_ROW_LABEL);
  const head = shown.map((code) => {
    const plan = facts.plans.find((p) => p.code === code)!;
    const cells = headline.map((row) => `${W.phoneRow[row.no!]} ${benefitValue(row, code, age) ?? "-"}`);
    return `${planLabel(code)} · limit ${plan.annualMax.toLocaleString("en-US")} baht a year · ${cells.join(" · ")}`;
  });
  return known
    ? `Plans on offer\n${head.join("\n")}\nThere are other plans too — if asked, say they can ask to see other plans.`
    : `All plans the company writes\n${head.join("\n")}\n`
      + "Which plans can be bought depends on age, and this customer's age is not known yet. "
      + "Don't say only some plans exist or which can be bought — ask for age and gender first.";
}

/** The premium this customer has already been sent, as the engine computed it. */
function quotedFigures(slots: HealthSlots, today: Date): string | undefined {
  const table = iHealthyTable(today);
  const { age, sex, plan } = slots;
  if (age === undefined || sex === undefined || plan === undefined || table.expired) return undefined;
  if (!plansFor(table, age).some((p) => p.code === plan)) return undefined;
  const v = arrangementFor({ age, sex, plan, territory: slots.territory });
  const priced = iHealthyPricing(table, {
    base: v.base, sex, age, sumAssured: v.sumAssured,
    plan, territory: v.territory, coverage: v.coverage,
  });
  if (!priced) return undefined;
  return priced.total
    .filter((m) => !m.belowMinimum)
    .map((m) => `${W.mode[m.mode]} ${formatBaht(m.total)} baht`)
    .join(" · ");
}

function known(slots: HealthSlots, today: Date): string {
  const bits: string[] = [];
  if (slots.sex) bits.push(W.sex[slots.sex]);
  if (slots.age !== undefined) bits.push(`age ${slots.age}`);
  if (slots.plan) bits.push(`plan ${planLabel(slots.plan)}`);
  if (slots.territory) bits.push(`territory ${W.territory[slots.territory] ?? slots.territory}`);
  if (bits.length === 0) return "";
  const quoted = quotedFigures(slots, today);
  return `\n\nAlready known about this customer: ${bits.join(" · ")}\nNever ask for these again.\n`
    + (quoted
      ? `The premium already sent to them: ${quoted}\n`
        + "If you mention a premium, copy these figures exactly — never calculate, estimate or round.\n"
        + "If they want a premium for another age or plan, don't answer with a number; say you'll work it out."
      : "If they want a premium, ask only for what is still missing; never state a premium yourself.");
}

/** The contract, in English, for the model to answer out of. */
export function healthFactsForEn(slots: HealthSlots, today: Date = new Date()): string {
  const { terms } = translateFacts(iHealthyFacts(), "en");
  const table = iHealthyTable(today);
  const contract = [
    "Policy: iHealthy Ultra — a lump-sum medical rider, paying treatment as charged up to the plan's yearly limit",
    `Ages ${table.ageMin}–${table.ageMax} to apply, renewable up to age ${terms.renewalToAge}`,
    "It is a rider: it is always attached to a life policy",
    "Foreigners living in Thailand can apply; an agent serves them in English",
    `Waiting period ${terms.waitingDays} days · these conditions wait ${terms.specialWaitingDays} days: ${terms.specialWaitingDiseases.join(" · ")}`,
    "Accidents are covered immediately, with no waiting period",
    `No claims in a policy year: ${terms.noClaimDiscountPercent}% discount on the next year's premium`,
    `Outside the chosen territory: emergencies only, up to ${terms.outOfTerritoryDays} days per trip`,
    `The insurer's renewal condition: ${terms.renewalCopay}`,
    "The medical premium rises with age every year; the base life policy premium is level",
  ].join("\n");
  return `\n\nPolicy facts\n${contract}\n\nBenefits\n${benefits(slots, today)}${known(slots, today)}`;
}
