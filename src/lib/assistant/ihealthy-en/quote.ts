import { formatBaht } from "@/calc/money";
import type { Sex } from "@/calc/types";
import { iHealthyQuoteText } from "@/lib/ihealthy-cta";
import { iHealthyFacts, planLabel } from "@/lib/ihealthy-facts";
import { IHEALTHY_OPENING, type IHealthyInitial } from "@/lib/ihealthy-choice";
import { cardPath, cardQuery, queryFrom } from "@/lib/ihealthy-link";
import { phoneColumns } from "@/lib/ihealthy-phone";
import { deathBenefitOf, iHealthyPricing, plansFor, shownAt, territoriesFor } from "@/lib/ihealthy-quote";
import { iHealthyTable, type IHealthyTable } from "@/lib/ihealthy-table";
import { baseWords, WORDS } from "@/lib/ihealthy-words";
import { siteUrl } from "@/lib/site-url";
import { quotePdfPath } from "@/lib/quote-pdf/link";
import { baht, one, type QuoteFigures, type Reply } from "../common";
import { arrangementFor } from "../ihealthy/quote";
import type { HealthSlots } from "../ihealthy/route";
import {
  FULL_TABLE_EN, HAND_OVER_EN, NO_PRICE_EN, OUT_OF_RANGE_EN, PLAN_BENEFITS_EN, RATES_EXPIRED_EN,
  SEE_OTHER_PLANS_EN, SHARE_OF_BILL_EN, WANTS_IN_EN,
} from "./words";

/**
 * The Thai brain's quote, menu and plan answers (ihealthy/quote.ts, ihealthy/menu.ts) said in
 * English. Same branches, same engine calls, same arrangement — only the words differ, so a
 * customer who switches language mid-conversation is quoted the same figure.
 */

export { HAND_OVER_EN };

const W = WORDS.en;

const withPdf = (pdfPath: string | undefined) => (pdfPath ? { pdfPath } : {});
const QUOTE_REPLIES = [SEE_OTHER_PLANS_EN, PLAN_BENEFITS_EN, WANTS_IN_EN];

/** Why there is no price, or nothing when there can be one. */
function unpriceable(table: IHealthyTable, age: number): string | undefined {
  if (age < table.ageMin || age > table.ageMax) return OUT_OF_RANGE_EN(table.ageMin, table.ageMax, age);
  if (table.expired) return RATES_EXPIRED_EN;
  return undefined;
}

function baseNameOf(table: IHealthyTable, v: IHealthyInitial): string {
  const row = table.bases.find((b) => b.variant === v.base);
  return row ? baseWords(W, row.variant, row).label : v.base;
}

export function healthQuoteEn(
  slots: HealthSlots & { age: number; sex: Sex; plan: string }, today: Date = new Date(),
): Reply {
  const table = iHealthyTable(today);
  const { age, sex } = slots;
  const no = unpriceable(table, age);
  if (no) return one(no);

  const sellable = plansFor(table, age);
  const chosen = sellable.find((p) => p.code === slots.plan);
  if (!chosen) {
    const names = sellable.map((p) => planLabel(p.code));
    return {
      ...one(`At age ${age} the company offers ${names.join(" · ")}. Which plan would you like to see?`),
      replies: names,
    };
  }

  const territories = territoriesFor(table, chosen.code, age);
  const territory = slots.territory && territories.includes(slots.territory)
    ? slots.territory
    : IHEALTHY_OPENING.territory;
  const v = arrangementFor({ age, sex, plan: chosen.code, territory });
  const priced = iHealthyPricing(table, {
    base: v.base, sex, age, sumAssured: v.sumAssured,
    plan: v.plan, territory: v.territory, coverage: v.coverage,
  });
  const facts = iHealthyFacts();
  const standardPlan = table.standard.plan[age - table.ageMin];
  const text = iHealthyQuoteText({
    arrangement: {
      planName: planLabel(chosen.code),
      annualMax: chosen.annualMax,
      deductible: chosen.deductible,
      territory: v.territory,
      coverage: v.coverage,
    },
    copayPercent: facts.copayPercent,
    age,
    sex,
    baseLabel: baseNameOf(table, v),
    ...(standardPlan !== null && standardPlan !== undefined ? { standardLabel: W.dailyCash(standardPlan) } : {}),
    sumAssured: v.sumAssured,
    death: deathBenefitOf(table, v.base, age, v.sumAssured),
    mode: v.mode,
    minMonthly: table.minMonthly,
    shown: shownAt(priced, v.mode),
  }, W);
  if (!text) return one(NO_PRICE_EN);

  const annual = priced?.total.find((m) => m.mode === "annual");
  return {
    messages: [{
      text,
      card: `${cardPath(table, v, "en")}&fit=phone`,
      // the same proposal the page prints, printed in English (/api/quote-pdf?…&l=en)
      ...withPdf(quotePdfPath({ kind: "ihealthy", query: queryFrom(table, v), lang: "en" })),
    }],
    priced: true,
    ...(annual
      ? {
          quote: {
            age, sex, plan: chosen.code, sumAssured: v.sumAssured,
            annual: baht(annual.total), territory: v.territory,
          } satisfies QuoteFigures,
        }
      : {}),
    replies: QUOTE_REPLIES,
  };
}

/** A plan's yearly total in baht, as the Thai menu prices it. */
function yearly(table: IHealthyTable, age: number, sex: Sex, plan: string): string | undefined {
  const v = arrangementFor({ age, sex, plan });
  const priced = iHealthyPricing(table, {
    base: v.base, sex, age, sumAssured: v.sumAssured,
    plan, territory: v.territory, coverage: v.coverage,
  });
  const annual = priced?.total.find((m) => m.mode === "annual");
  return annual ? formatBaht(annual.total) : undefined;
}

function pricedPlans(table: IHealthyTable, age: number, sex: Sex, codes: string[]) {
  return codes
    .map((code) => ({ code, amount: yearly(table, age, sex, code) }))
    .filter((row): row is { code: string; amount: string } => row.amount !== undefined);
}

const lines = (priced: { code: string; amount: string }[]) =>
  priced.map((row) => `${planLabel(row.code)} ${row.amount} THB`).join("\n");

export function healthMenuEn(age: number, sex: Sex, today: Date = new Date()): Reply {
  const table = iHealthyTable(today);
  const no = unpriceable(table, age);
  if (no) return one(no);

  const sellable = plansFor(table, age).map((p) => p.code);
  const order = table.plans.map((p) => p.code);
  const priced = pricedPlans(table, age, sex, phoneColumns(order, sellable));
  if (priced.length === 0) return one(NO_PRICE_EN);

  const v = arrangementFor({ age, sex, plan: priced[0].code });
  const inIt = `(Includes the base policy ${baseNameOf(table, v)}, sum assured ${v.sumAssured.toLocaleString("en-US")}, `
    + "and the daily cash benefit · treatment costs paid as charged on every plan)";
  return {
    messages: [{
      text: `${W.sex[sex]}, age ${age} — yearly premium 🏥\n${lines(priced)}\n${inIt}`,
      card: `/api/ihealthy-card/table?${cardQuery(table, v)}&l=en&fit=phone`,
    }],
    replies: priced.map((row) => planLabel(row.code)),
  };
}

export function otherPlansEn(age: number, sex: Sex, today: Date = new Date()): Reply {
  const table = iHealthyTable(today);
  if (unpriceable(table, age)) return healthMenuEn(age, sex, today);

  const sellable = plansFor(table, age).map((p) => p.code);
  const order = table.plans.map((p) => p.code);
  const inMenu = phoneColumns(order, sellable);
  const rest = sellable.filter((code) => !inMenu.includes(code));
  if (rest.length === 0) {
    return {
      ...one(`At age ${age} the company offers these ${sellable.length} plans — ${sellable.map(planLabel).join(" and ")}.`),
      replies: sellable.map(planLabel),
    };
  }
  const priced = pricedPlans(table, age, sex, rest);
  return {
    ...one(`${priced.length} more plans, yearly premium:\n${lines(priced)}`),
    replies: priced.map((row) => planLabel(row.code)),
  };
}

export function cheaperEn(age: number, sex: Sex, plan?: string): Reply {
  if (!plan) return healthMenuEn(age, sex);
  const table = iHealthyTable();
  const sellable = plansFor(table, age).map((p) => p.code);
  const below = sellable.slice(0, sellable.indexOf(plan));
  if (below.length === 0) {
    return one(`${planLabel(plan)} is already the lowest-priced plan.\n${SHARE_OF_BILL_EN}`);
  }
  const next = below[below.length - 1];
  return {
    ...one(`For something lighter there's ${planLabel(next)} — a lower yearly limit for a lower premium. Would you like to see it?`),
    replies: [planLabel(next), SEE_OTHER_PLANS_EN],
  };
}

export function territoryAnswerEn(
  slots: HealthSlots & { age: number; sex: Sex; plan: string }, wanted: string,
): Reply & { slots: HealthSlots } {
  const table = iHealthyTable();
  if (territoriesFor(table, slots.plan, slots.age).includes(wanted)) {
    const next = { ...slots, territory: wanted };
    return { ...healthQuoteEn(next), slots: next };
  }
  const name = W.territory[wanted] ?? wanted;
  const sold = plansFor(table, slots.age)
    .map((p) => p.code)
    .filter((code) => territoriesFor(table, code, slots.age).includes(wanted));
  if (sold.length === 0) {
    return { ...one(`${name} cover isn't offered on this policy. ${HAND_OVER_EN}`), slots };
  }
  return {
    ...one(`${name} cover is written only on ${sold.map(planLabel).join(" and ")}. Which one would you like priced?`),
    replies: sold.map(planLabel),
    slots,
  };
}

export function fullTableLinkEn(slots: HealthSlots & { age: number; sex: Sex }): Reply {
  const table = iHealthyTable();
  const sellable = plansFor(table, slots.age).map((p) => p.code);
  const plan = slots.plan && sellable.includes(slots.plan) ? slots.plan : sellable[sellable.length - 1];
  const query = queryFrom(table, arrangementFor({
    age: slots.age, sex: slots.sex, plan, territory: slots.territory,
  }));
  return {
    messages: [{ text: FULL_TABLE_EN }, { text: siteUrl(`/ihealthy-ultra?${query}`) }],
    replies: [SEE_OTHER_PLANS_EN, WANTS_IN_EN],
  };
}
