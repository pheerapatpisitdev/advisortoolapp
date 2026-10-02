import { formatBaht } from "@/calc/money";
import type { PayMode } from "@/calc/types";
import { benefitCell } from "@/components/ihealthy/BenefitTable";
import { PHONE_ROW_LABEL, phoneColumns } from "@/lib/ihealthy-phone";
import { iHealthyFacts, isHeading, planLabel } from "@/lib/ihealthy-facts";
import { deathBenefitRows, type BenefitRow as DeathRow } from "@/lib/death-benefit";
import { initialFrom, ridersFrom } from "@/lib/ihealthy-link";
import { iHealthyTable } from "@/lib/ihealthy-table";
import {
  MODES, dailyCashLabel, deathBenefitOf, iHealthyPricing, plansFor,
} from "@/lib/ihealthy-quote";
import { priceRiders } from "@/lib/ihealthy-rider-quote";
import { parseLang, type Lang } from "@/lib/ihealthy-lang";
import { baseWords, WORDS, type IHealthyWords } from "@/lib/ihealthy-words";
import { translateFacts } from "@/lib/ihealthy-translate";

/**
 * The health quote as a picture: the card a customer is looking at, and the table under it,
 * in one file they can keep.
 *
 * The page already hands its quote over three ways — an address, a printed sheet, and the
 * figures as text — and every one of them needs the reader to still have the page, a printer
 * or a chat that keeps formatting. A picture needs none of those, which is what makes it the
 * thing that actually reaches the person the customer has to talk it over with.
 *
 * Described here and drawn in the route, so that every figure on it is the engine's and can
 * be tested without rendering anything. And priced here from the arrangement the link names,
 * never from figures carried in the link: an address that could set a premium would be an
 * address that could make the agency advertise one it never quoted.
 */

/** A plan's column: what it is called, what it pays in a year, and whether it is on offer. */
export interface CardColumn {
  name: string;
  /** the annual ceiling in the company's own round millions, e.g. "10 ล้าน" */
  ceiling: string;
  /** the plan the card above is pricing */
  selected: boolean;
  /** the company does not write this plan at the age on the card */
  sold: boolean;
}

export interface CardCell {
  text: string;
  /** a column the company will not sell at this age; the figure is withheld, not the row */
  dim: boolean;
}

export interface CardTableRow {
  label: string;
  /** one per column, or empty where `span` says the same thing across all of them */
  cells: CardCell[];
  /** one answer for every plan, because it is the same cover whichever is bought */
  span?: string;
}

export interface IHealthyCard {
  /** the language the page was read in when the picture was asked for; `l` in the link */
  lang: Lang;
  /** "iHealthy Ultra Gold" */
  planLine: string;
  /** who it is for, e.g. "ชาย 35 ปี"; drawn large in the corner */
  insuredWho: string;
  /** what it rides on: the base plan, its sum, the territory */
  insuredLine: string;
  /**
   * The instalment the card headlines; absent where no price may be quoted. The other two
   * are not here: the table below prices all three under every plan, and a card that listed
   * them again would be saying the same thing twice on the same picture.
   */
  premium?: { amount: string; per: string };
  /**
   * What the headline is made of: the base plan, the health cover, the riders attached.
   *
   * Names only. Each line used to carry its own premium beside it, and on this arrangement
   * that put 710 next to 43,800 — a reader asked what the cover costs and was shown, instead,
   * which half of it to argue with. The total is the price; this is what the price is for.
   */
  lines: { label: string }[];
  /** the company will not take the monthly instalment this arrangement comes to */
  belowMinimum?: string;
  /**
   * What the family receives, band by band. Bands rather than a sentence because a rider
   * attached in the fold can pay on death too and can stop paying before the base does — a
   * hand-written line said "ตั้งแต่อายุ 60 คุ้มครองเท่าทุน" over a figure half again the sum
   * assured, and never mentioned the age it falls back at.
   */
  death: DeathRow[];
  columns: CardColumn[];
  rows: CardTableRow[];
  /** what the whole arrangement costs under each plan, one instalment to a row */
  premiumRows: { label: string; cells: CardCell[] }[];
}

const DASH = "-";
/** A yearly ceiling in the unit the reader counts large sums in, e.g. "10 ล้าน". */
const millions = (w: IHealthyWords, baht: number) => {
  const big = w.big(baht);
  return `${big.num} ${big.unit}`;
};

/**
 * What the attached riders are called on one line.
 *
 * The same rule the card on the page follows: one rider gets its own name, more than one is
 * a count — a card that listed them would be the agent's fold written out twice, on a
 * picture the customer is meant to be able to read at a glance.
 *
 * The name is built from the plan actually attached. Reading it off the agency's standard
 * instead is how this came to promise a thousand baht a day over a five-thousand premium,
 * two inches above its own table row saying five thousand.
 */
function extrasLabel(codes: string[], standardCode: string, attachedPlan: number | null): string {
  if (codes.length === 1 && codes[0] === standardCode && attachedPlan !== null) {
    return dailyCashLabel(attachedPlan);
  }
  return `สัญญาเพิ่มเติม ${codes.length} รายการ`;
}

/** The same name in the reader's language: the Thai above is what the engine is handed. */
function extrasWords(
  w: IHealthyWords, codes: string[], standardCode: string, attachedPlan: number | null,
): string {
  if (codes.length === 1 && codes[0] === standardCode && attachedPlan !== null) {
    return w.dailyCash(attachedPlan);
  }
  return w.riderCount(codes.length);
}

/**
 * The quote a link asks for, drawn from the rate tables as they stand today.
 *
 * Nothing is refused: `initialFrom` walks any query at all — including none — to an
 * arrangement the company sells, so a card is always an answer about something real. The one
 * thing it may not have is a price, which a lapsed rate table takes away and the picture
 * says so in place of.
 */
export function iHealthyCard(query: URLSearchParams, today: Date = new Date()): IHealthyCard {
  const table = iHealthyTable(today);
  // `l` is the page's language; a link without one — the bot's, every old one — is Thai
  const lang = parseLang(query.get("l") ?? undefined);
  const w = WORDS[lang];
  const facts = translateFacts(iHealthyFacts(), lang);
  const v = initialFrom(table, Object.fromEntries(query));
  const asked = ridersFrom(query.getAll("r"));

  const sellable = plansFor(table, v.age).map((p) => p.code);
  /**
   * The plans this picture has room for.
   *
   * `fit=phone` is asked for by the bot and never by the page: six columns of Thai on a
   * canvas a chat scales to the width of a phone is a table nobody reads without pinching.
   * The plan being priced is always among them, so the column the headline belongs to is
   * never the one left out.
   */
  const order = facts.plans.map((p) => p.code);
  const shown = query.get("fit") === "phone" ? phoneColumns(order, sellable, v.plan) : order;
  const drawn = facts.plans.filter((p) => shown.includes(p.code));
  const arrangement = {
    base: v.base, age: v.age, sex: v.sex, sumAssured: v.sumAssured,
    plan: v.plan, territory: v.territory, coverage: v.coverage,
  };

  // The riders go to the engine rather than to the slim table: their eligibility rules and
  // their rate tables are the reason the page asks a server for them at all, and a picture
  // drawn from a link is exactly the case where the codes were not typed by the fold.
  const priced = priceRiders({ ...arrangement, mode: v.mode, riders: asked });
  /** The daily-cash plan the engine actually priced, or nothing where it priced none. */
  const attachedDailyCash = priced.extraCodes.includes(table.standard.code)
    ? asked.find((r) => r.code === table.standard.code)?.plan ?? null
    : null;
  /**
   * Whether the agent's fold has spoken at all. A link with no `r` in it comes from a page
   * whose fold was never opened, and is priced the way that page prices itself: with the
   * agency's standard daily cash on. A link carrying an empty `r` is a fold that was opened
   * and emptied, which is a different answer and gets a different price.
   */
  const extras = query.has("r")
    ? {
        label: extrasLabel(priced.extraCodes, table.standard.code, attachedDailyCash),
        premiums: priced.extras,
      }
    : undefined;

  const byPlan = new Map(facts.plans.map((p) => [
    p.code,
    table.expired ? undefined : iHealthyPricing(table, { ...arrangement, plan: p.code }, extras),
  ]));
  const here = byPlan.get(v.plan);
  const at = (mode: PayMode) => here?.total.find((m) => m.mode === mode);
  const headline = at(v.mode);

  const columns: CardColumn[] = drawn.map((p) => ({
    name: planLabel(p.code),
    ceiling: millions(w, p.annualMax),
    selected: p.code === v.plan,
    sold: sellable.includes(p.code),
  }));
  const cellsOf = (get: (code: string) => string): CardCell[] =>
    drawn.map((p) => ({ text: get(p.code), dim: !sellable.includes(p.code) }));

  /**
   * The ceiling first and the company's categories under it, in the sheet's own order.
   *
   * The same handful of rows a phone shows, from the same map, so the picture and the page
   * are condensed to the same thing rather than to two different opinions of what matters.
   * Only the phone's marks are left behind: an emoji is a font the drawing library would have
   * to fetch at render time, and these rows have the width here to be read by their names.
   */
  const rows: CardTableRow[] = [
    { label: w.annualLimit, cells: cellsOf((code) => {
      const plan = drawn.find((p) => p.code === code)!;
      return millions(w, plan.annualMax);
    }) },
  ];
  for (const entry of facts.rows) {
    if (isHeading(entry) || entry.no === null) continue;
    const short = PHONE_ROW_LABEL[entry.no];
    if (short === undefined) continue;
    rows.push({
      label: w.phoneRow[entry.no] ?? short.label,
      cells: cellsOf((code) => benefitCell(entry, code, v.age, sellable).text),
    });
  }
  // Last, and outside the company's own categories: a second contract the agency sells
  // alongside this one, which the premium rows below already count.
  const standardPlan = table.standard.plan[v.age - table.ageMin];
  if (standardPlan !== null) {
    // What is actually attached: the agent's own plan where the fold has spoken, and the
    // agency's standard where it has not — which is the plan the price above was worked out
    // on either way.
    const attached = extras === undefined ? standardPlan : attachedDailyCash;
    rows.push({
      label: w.dailyCashRow,
      cells: [],
      span: attached === null ? DASH : `${attached.toLocaleString("en-US")} ${w.perDay} · ${w.samePlans}`,
    });
  }

  const premiumRows = table.expired ? [] : MODES.map((mode) => ({
    label: w.mode[mode],
    cells: cellsOf((code) => {
      // A dash where the company refuses the instalment: its monthly floor is judged on the
      // total, and a picture that printed the figure anyway would be offering a way of
      // paying that cannot be bought.
      const total = byPlan.get(code)?.total.find((m) => m.mode === mode);
      return total === undefined || total.belowMinimum ? DASH : formatBaht(total.total);
    }),
  }));

  // The engine's answer where it has one: a rider that pays on death adds its sum to what
  // the family receives, which `deathBenefitOf` knows nothing about — its own comment says
  // it answers for a contract with no such rider attached.
  const death = priced.deathBenefit ?? deathBenefitOf(table, v.base, v.age, v.sumAssured);
  // Full Coverage is the contract as the page describes it, so the card does not name it
  const cover = v.coverage === "Full Coverage" ? "" : w.coverage[v.coverage] ?? v.coverage;
  const baseRow = table.bases.find((b) => b.variant === v.base);
  const baseName = baseRow ? baseWords(w, baseRow.variant, baseRow).label : v.base;
  const territory = w.territory[v.territory] ?? v.territory;
  const standardLabel = extras === undefined
    ? standardPlan !== null ? w.dailyCash(standardPlan) : undefined
    : extrasWords(w, priced.extraCodes, table.standard.code, attachedDailyCash);

  return {
    lang,
    planLine: `iHealthy Ultra ${planLabel(v.plan)}`,
    insuredWho: `${w.sex[v.sex]} ${w.years(v.age)}`,
    insuredLine: `${w.baseWithSum(baseName, v.sumAssured)} ${w.baht} · ${territory}${cover ? ` · ${cover}` : ""}`,
    ...(headline ? { premium: { amount: formatBaht(headline.total), per: w.share.per[v.mode] } } : {}),
    lines: here === undefined ? [] : [
      { label: w.baseWithSum(baseName, v.sumAssured) },
      { label: `iHealthy Ultra ${planLabel(v.plan)}` },
      // An emptied fold is not on the arrangement at all, so it is not named. Its premium is
      // still what says so, which is the one thing a premium is still read for here.
      ...(here.standard && (here.standard.premiums.find((m) => m.mode === v.mode)?.total ?? 0) > 0
        ? [{ label: standardLabel ?? here.standard.label }]
        : []),
    ],
    ...(headline?.belowMinimum
      ? { belowMinimum: w.belowMinimum(table.minMonthly) }
      : {}),
    // The rider covers the illness; this is what the base plan under it is for, and the one
    // figure on the card that the table below has no column for. The same helper writes the
    // page's card and the copied quote, so the three cannot drift apart.
    // Health Ultra Package is the fixed 50,000-baht health vehicle. Its card should not
    // advertise the package's underlying life-death benefit; that line belongs to the
    // selectable life base, while DCI remains described separately when it is attached.
    death: v.base === "WLF99HX" ? [] : deathBenefitRows(death, w.death),
    columns,
    rows,
    premiumRows,
  };
}

/**
 * The comparison table with nothing over it.
 *
 * The quote card answers "what does this plan cost me"; this answers the question before it,
 * "which of these am I buying" — so it carries no headline premium, no death benefit and no
 * highlighted column, and its premium rows are the whole of its point rather than a footnote
 * under one.
 *
 * Every figure is `iHealthyCard`'s, taken from the same call: two pictures sent one after the
 * other that disagreed about a premium would be worse than sending neither.
 */
export interface IHealthyTableCard {
  headLine: string;
  /** who it is for, e.g. "ชาย 35 ปี"; drawn large in the corner */
  insuredWho: string;
  /** what it rides on: the base plan, its sum, the territory */
  insuredLine: string;
  columns: CardColumn[];
  rows: CardTableRow[];
  premiumRows: { label: string; cells: CardCell[] }[];
}

export function iHealthyTableCard(query: URLSearchParams, today: Date = new Date()): IHealthyTableCard {
  const card = iHealthyCard(query, today);
  return {
    // the bot sends this one in English on the Expat Pages; the other languages have no caller
    headLine: card.lang === "en" ? "iHealthy Ultra · Compare plans" : "iHealthy Ultra · เปรียบเทียบแผน",
    insuredWho: card.insuredWho,
    insuredLine: card.insuredLine,
    // nothing is chosen yet, so nothing is lit
    columns: card.columns.map((c) => ({ ...c, selected: false })),
    rows: card.rows,
    premiumRows: card.premiumRows,
  };
}
