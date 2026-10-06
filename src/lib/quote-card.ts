import { quote } from "@/calc/quote";
import { quoteModePremiums, type ModePremium } from "@/calc/mode-premiums";
import { cashValueSchedule, maturityValue, type CashValueRow } from "@/calc/cash-value";
import { getPlan, type PlanBundle } from "@/calc/plans/registry";
import { getBundle } from "@/calc/bundles/registry";
import { bundleModePremiums, quoteBundle } from "@/calc/bundles/quote";
import { formatBaht } from "@/calc/money";
import { coverRows } from "@/lib/cover-rows";
import { PAY_MODE_LABEL, type DeathBenefit, type PayMode, type QuoteInput, type QuoteResult, type Sex } from "@/calc/types";
import type { BundleCardInput, CardInput, CardRiders, PlanCardInput } from "@/lib/card-link";
import { deathBenefitRows } from "@/lib/death-benefit";
import { cashProjection, type Projection } from "@/lib/cash-projection";
import { ageTicks } from "@/lib/age-ticks";
import { iShieldTable } from "@/lib/ishield-table";
import { illnessBenefit } from "@/lib/ishield-quote";
import { plbTable } from "@/lib/plb-table";
import { coverEndsAt } from "@/lib/plb-quote";
import { lifeTreasureTable } from "@/lib/lifetreasure-table";
import { easyProtectTable } from "@/lib/easyprotect-table";
import { displayPremium, perDayText } from "@/lib/legacy-cta";
import { FIRST_MONTHLY_INSTALMENTS, firstMonthlyPayment } from "@/lib/first-payment";
import { LIFEPROTECT_PLAN, lifeProtectPriced, type SplitRow } from "@/lib/lifeprotect-card";
import { riderDiseases } from "@/calc/riders/diseases";
import { ci123Stages } from "@/lib/ci123-table";
import { stagePays } from "@/lib/ci123-cta";
import {
  CANCER_DAILY_RIDER, CANCER_RIDER, CPR_STAGES, HIC_INVASIVE_EXTRA_DAYS, HIC_MAX_DAYS, cancerDeathTotals,
  cprStagePays, deathTotalsTitle,
} from "@/lib/cancer-benefits";

/**
 * The quote as a picture: what a customer can keep, and what a chat can send them.
 *
 * A card is described here and drawn in the route, so the figures on it are the engine's and
 * can be tested without rendering anything. It is also why the card is asked for by the
 * quote's own inputs rather than by its numbers — the price is recomputed from the rate
 * tables at draw time, so a link that has been edited by hand cannot make the company
 * advertise a premium it never quoted.
 */
export interface CardRow {
  label: string;
  /** already grouped, e.g. "2,000,000" */
  amount: string;
  /** drawn with a highlighter stroke behind it */
  mark?: boolean;
}

/**
 * A titled block of figures. Cards carry a list of these rather than a field per block,
 * because what a card has to show depends on what is being sold: a plan states a death
 * benefit and a surrender value, a bundle also has to say what it is made of and what it
 * pays on a diagnosis. The drawing routine reads the list and never names a block.
 */
export interface CardSection {
  title: string;
  /** Amount rows, retained for every section so existing card consumers stay simple. */
  rows: CardRow[];
  /** A compact numbered list for content such as covered diseases. */
  items?: string[];
}

/**
 * The chart as the drawing routine needs it: geometry only, in the viewBox's own units, with
 * the colours left to the drawing. Worked out here so the picture is the engine's answer and
 * can be tested without rendering anything, the same way every figure on the card is.
 */
export interface CardChart {
  title: string;
  width: number;
  height: number;
  /** polyline point strings */
  cover: string;
  premium: string | null;
  cash: string;
  /** the sum assured's own height, when it sits clear of the scale's top and floor */
  grid: { y: number; label: string } | null;
  /** ages along the bottom */
  ticks: { x: number; label: string }[];
  /** what the top of the scale is worth */
  topLabel: string;
  /** where the surrender value overtakes the premiums paid */
  breakEven: { x: number; y: number; label: string } | null;
  legend: { label: string; kind: "cash" | "premium" | "cover" }[];
}

export interface QuoteCard {
  /** the product and its payment term, e.g. "Life Protect x 2 · ชำระเบี้ย 19 ปี" */
  planLine: string;
  /**
   * Who the quote is for, e.g. "ชาย 35 ปี". Kept apart from the sum because it is the one
   * thing an agent has to check before forwarding a card — it is set large in the corner,
   * where a glance finds it without reading the card.
   */
  insuredWho: string;
  /** what was bought, e.g. "ทุน 1,000,000 บาท" — the insured is in insuredWho */
  insuredLine: string;
  /** the instalment in the largest type; null when no price may be shown */
  premium: { amount: string; per: string } | null;
  /** "ตกวันละ 48 บาท" */
  perDay: string | null;
  /**
   * Every instalment the company will take, in the box the sales pages share
   * (components/sales/PremiumSummary.tsx); null when no price may be shown.
   */
  summary: CardSummary | null;
  /** said right under the box (a waiver adds nothing the family receives) */
  priceNote?: string;
  /** the titled blocks of figures, in the order they are read */
  sections: CardSection[];
  /** the small print under everything, as the page closes its quote */
  footNotes?: string[];
}

/** One instalment in the box: the one the card headlines is set large, the others marked. */
export interface SummaryRow {
  label: string;
  /** "17,200" */
  amount: string;
  main: boolean;
  /** "ชำระเบี้ยครั้งแรก 2 งวด 3,096 บาท", under the monthly row */
  after?: string;
}

/** The sales pages' "เบี้ยประกันที่ต้องชำระ" box, as the card draws it. */
export interface CardSummary {
  title: string;
  /** largest instalment first */
  rows: SummaryRow[];
  /** what the headline instalment is made of, at the foot of the box, when riders are part of it */
  split?: { title: string; rows: SplitRow[] };
}

/** How each instalment reads after the figure on the card. */
const PER_LABEL: Record<PayMode, string> = { annual: "ต่อปี", semi: "ต่อ 6 เดือน", monthly: "ต่อเดือน" };
const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };

/** The ages a card quotes a surrender value at, plus whatever the schedule ends on. */
const CASH_AGES = [60, 70, 80];

const money = (baht: number) => baht.toLocaleString("en-US");

export type { BundleCardInput, CardInput, PlanCardInput } from "@/lib/card-link";
export { cardPath, cardUrl } from "@/lib/card-link";

/** The instalment named in a query, or undefined when it is one the company does not sell. */
function modeFrom(params: URLSearchParams): PayMode | undefined {
  const raw = params.get("mode");
  return raw === "annual" || raw === "semi" || raw === "monthly" ? raw : undefined;
}

/** The insured named in a query, or undefined when either half is missing or impossible. */
function insuredFrom(params: URLSearchParams): { age: number; sex: Sex } | undefined {
  const age = Number(params.get("age"));
  if (!Number.isInteger(age) || age < 0 || age > 99) return undefined;
  const sex = params.get("sex");
  if (sex !== "M" && sex !== "F") return undefined;
  return { age, sex };
}

function bundleInputFrom(code: string, params: URLSearchParams): BundleCardInput | undefined {
  const bundle = getBundle(code);
  if (!bundle) return undefined;
  const tier = Number(params.get("tier"));
  if (!bundle.tiers.some((t) => t.no === tier)) return undefined;
  const who = insuredFrom(params);
  if (!who) return undefined;
  return { kind: "bundle", bundleCode: code, tier, ...who, mode: modeFrom(params) };
}

function planInputFrom(params: URLSearchParams): PlanCardInput | undefined {
  const planCode = params.get("plan") ?? "";
  const plan = getPlan(planCode);
  if (!plan) return undefined;
  const variant = params.get("variant") ?? plan.defaultVariant ?? "";
  if (!(variant in plan.variantLabels)) return undefined;
  const who = insuredFrom(params);
  if (!who) return undefined;
  const sumAssured = Number(params.get("sum"));
  if (!Number.isInteger(sumAssured) || sumAssured <= 0) return undefined;
  const riders = ridersFrom(params);
  if (riders === null || (riders && planCode !== LIFEPROTECT_PLAN)) return undefined;
  return { kind: "plan", planCode, variant, ...who, sumAssured, mode: modeFrom(params), ...(riders ? { riders } : {}) };
}

/**
 * The Life Protect page's riders named in a query: undefined when there are none, null when
 * one is written in a shape no link of ours has. Whether they can be priced on this insured
 * is the card's question (lib/lifeprotect-card.ts), not the reader's.
 */
function ridersFrom(params: URLSearchParams): CardRiders | undefined | null {
  const rider = params.get("rider");
  const payer = params.get("payer");
  const meb = params.get("meb");
  if (rider === null && payer === null && meb === null) return undefined;
  const out: CardRiders = {};
  if (rider !== null) {
    const m = /^([A-Z0-9]+)\.([A-Z0-9_]+)$/.exec(rider);
    if (!m) return null;
    out.waiver = { code: m[1], option: m[2] };
  }
  if (payer !== null) {
    const m = /^([MF])(\d{1,2})$/.exec(payer);
    if (!m) return null;
    out.payer = { sex: m[1] as Sex, age: Number(m[2]) };
  }
  if (meb !== null) {
    const plan = Number(meb);
    if (!Number.isInteger(plan) || plan <= 0) return null;
    out.medical = plan;
  }
  return out;
}

/**
 * A card's parameters, read from a URL. Everything is checked against the registry, so a
 * hand-edited link either names a real arrangement or gets nothing at all.
 */
export function cardInputFrom(params: URLSearchParams): CardInput | undefined {
  const bundleCode = params.get("bundle");
  return bundleCode ? bundleInputFrom(bundleCode, params) : planInputFrom(params);
}


function quoteInput(input: PlanCardInput, mode: PayMode): QuoteInput {
  return {
    planCode: input.planCode,
    variant: input.variant,
    age: input.age,
    sex: input.sex,
    mode,
    sumAssured: input.sumAssured,
    riders: [],
  };
}

const CASH_TITLE = "มูลค่าเงินสดสะสม (หากเวนคืน)";

/**
 * The death benefit as a card block. Shared rather than written per card, because the bands
 * come from deathBenefitRows and a second hand-written copy is a second chance to promise
 * cover that has ended.
 */
function deathSection(db: DeathBenefit): CardSection {
  return {
    title: "ครอบครัวได้รับเมื่อเสียชีวิต",
    rows: deathBenefitRows(db).map((r) => ({ label: r.label, amount: money(r.amount) })),
  };
}

/**
 * The one figure on a card drawn with a highlighter stroke, beside the price lines every card
 * marks. Picked per product for what it is bought for, as the owner asked:
 *
 * - a life plan: the most the family can receive on death (Life Protect's doubled sum before
 *   60; the single figure of a plan that never steps down)
 * - iSmart, whose card has no death block: what the policy is worth when it ends at 80
 * - iShield: the lump sum on a severe critical illness
 * - CI 123: the severe stage, which pays the whole sum
 * - the cancer set: the total after an invasive cancer (see `cancerDeathTotals`)
 * - the legacy set: the most the family receives on death
 *
 * One per card, because a page of yellow is a page with nothing marked.
 */
function markRow(section: CardSection, pick: "largest" | "first" | "last"): CardSection {
  if (!section.rows.length) return section;
  const amount = (r: CardRow) => Number(r.amount.replace(/,/g, ""));
  const at = pick === "first" ? 0
    : pick === "last" ? section.rows.length - 1
      : section.rows.reduce((best, r, i) => (amount(r) > amount(section.rows[best]) ? i : best), 0);
  return { ...section, rows: section.rows.map((r, i) => (i === at ? { ...r, mark: true } : r)) };
}

/** The surrender values still ahead of this insured, plus whatever the schedule ends on. */
function cashRowsFor(
  planCode: string, variant: string, sex: Sex, age: number, sumAssured: number,
): CardRow[] {
  const schedule = cashValueSchedule(planCode, variant, sex, age, sumAssured);
  const end = maturityValue(schedule);
  return [
    ...CASH_AGES
      .filter((at) => at > age)
      .map((at) => ({ at, row: schedule.find((r) => r.age === at) }))
      .filter((x): x is { at: number; row: CashValueRow } => !!x.row && x.row.amount > 0)
      .map((x) => ({ label: `อายุ ${x.at} ปี`, amount: money(x.row.amount) })),
    ...(end && end.age > age && end.amount > 0
      ? [{ label: `อายุ ${end.age} ปี`, amount: money(end.amount) }]
      : []),
  ];
}

/**
 * The premium as a card states it: one instalment in the largest type, the day rate under it,
 * and the sales pages' box of every instalment the company will take.
 *
 * Shared by both kinds of card because a card's price lines are the same question whatever is
 * being priced — and because when they were written twice, only one of the two remembered to
 * withhold the other instalments once the rate table had lapsed.
 */
function premiumLines(
  modes: ModePremium[] | undefined, expired: boolean, split?: CardSummary["split"],
): {
  premium: QuoteCard["premium"];
  perDay: string | null;
  summary: CardSummary | null;
} {
  const headline = displayPremium(modes, expired);
  const annual = modes?.find((m) => m.mode === "annual");
  // a lapsed table has no price to show, and the other instalments are prices too.
  // Largest first, as the box on the page lists them.
  const payable = expired || !headline ? [] : (modes ?? [])
    .filter((m) => !m.belowMinimum)
    .sort((a, b) => b.total - a.total);
  const first = modes && payable.length ? firstMonthlyPayment(modes) : undefined;
  return {
    premium: headline ? { amount: formatBaht(headline.total), per: PER_LABEL[headline.mode] } : null,
    perDay: headline && annual && !expired ? `ตกวันละ ${perDayText(annual.total)} บาท` : null,
    summary: payable.length
      ? {
          title: "เบี้ยประกันที่ต้องชำระ",
          rows: payable.map((m) => ({
            label: PAY_MODE_LABEL[m.mode], amount: formatBaht(m.total), main: m.mode === headline!.mode,
            ...(m.mode === "monthly" && first !== undefined
              ? { after: `ชำระเบี้ยครั้งแรก ${FIRST_MONTHLY_INSTALMENTS} งวด ${formatBaht(first)} บาท` } : {}),
          })),
          ...(split ? { split } : {}),
        }
      : null,
  };
}

/** 1,112,000 → "1.1 ล้าน", for the two labels the chart's vertical scale carries. */
function shortBaht(baht: number): string {
  if (baht >= 1_000_000) {
    const m = baht / 1_000_000;
    return `${m % 1 ? m.toFixed(1) : m.toFixed(0)} ล้าน`;
  }
  if (baht >= 100_000) return `${Math.round(baht / 100_000)} แสน`;
  return money(baht);
}

/** How many years the premium is paid, whichever way the plan's tables state it. */
function payYearsFor(plan: PlanBundle, variant: string, age: number): number {
  const pkg = plan.rates.base.packages?.find((p) => p.code === variant);
  if (pkg?.payTermToAge !== undefined) return Math.max(0, pkg.payTermToAge - age);
  if (pkg?.payTerm !== undefined) return pkg.payTerm;
  return plan.rates.base.payTerm?.[variant] ?? 0;
}

const CHART_LEFT = 86, CHART_RIGHT = 14, CHART_TOP = 18, CHART_BOTTOM = 44;

/** the least room between two ages under the card's drawing, in its own pixels */
const TICK_GAP = 46;

/**
 * The contract drawn as three lines: what the family would receive, what has been paid in,
 * and what surrendering would return. It is the one thing on the card that answers "and
 * then what" without the customer having to read a column of figures.
 *
 * Only for a plan whose cover rule has been read off its own benefit sheet — without that
 * rule the cover line would be a guess, and a guess drawn in gold is still a guess.
 */
function chartFor(
  plan: PlanBundle, input: PlanCardInput, death: DeathBenefit, annualSatang: number | null,
  riderDue: ((years: number) => number[]) | undefined, width: number,
): CardChart | undefined {
  const CHART_W = width;
  // as tall as a third of its width, so a table-wide drawing does not flatten its lines; never
  // shorter than the 300 the card's 888-wide drawing had
  const CHART_H = Math.max(300, Math.round(width / 3));
  if (!plan.coverTopUp) return undefined;
  const factors = cashValueSchedule(input.planCode, input.variant, input.sex, input.age, 1000).map((r) => r.amount);
  if (factors.length < 2) return undefined;

  const p: Projection = cashProjection({
    factors, age: input.age, sumAssured: input.sumAssured, annualSatang,
    payYears: payYearsFor(plan, input.variant, input.age), death, topUp: plan.coverTopUp,
    // the riders' premium is paid in too, as the page's drawing counts it
    ...(riderDue ? { riderDue: riderDue(factors.length) } : {}),
  });

  const top = Math.max(...p.rows.map((r) => Math.max(r.cover, r.cashValue, r.premiumPaid ?? 0))) || 1;
  const x = (at: number) => CHART_LEFT + ((at - input.age) / (p.maturityAge - input.age)) * (CHART_W - CHART_LEFT - CHART_RIGHT);
  const y = (satang: number) => CHART_H - CHART_BOTTOM - (satang / top) * (CHART_H - CHART_BOTTOM - CHART_TOP);
  const line = (pick: (r: Projection["rows"][number]) => number) =>
    p.rows.map((r) => `${x(r.age).toFixed(1)},${y(pick(r)).toFixed(1)}`).join(" ");

  // the cover holds all year and drops on one birthday, so it steps rather than slopes
  const cover = p.rows
    .flatMap((r) => [`${x(r.age).toFixed(1)},${y(r.cover).toFixed(1)}`, `${x(r.age + 1).toFixed(1)},${y(r.cover).toFixed(1)}`])
    .join(" ");

  const grid = p.coverFloor < top * 0.92 && p.coverFloor > top * 0.08
    ? { y: Number(y(p.coverFloor).toFixed(1)), label: shortBaht(Math.round(p.coverFloor / 100)) }
    : null;

  return {
    title: "ความคุ้มครอง เบี้ย และมูลค่าเงินสด",
    width: CHART_W,
    height: CHART_H,
    cover,
    premium: p.rows[0].premiumPaid === null ? null : line((r) => r.premiumPaid!),
    cash: line((r) => r.cashValue),
    grid,
    ticks: ageTicks(input.age, p.maturityAge, x, TICK_GAP)
      .map((a) => ({ x: Number(x(a).toFixed(1)), label: String(a) })),
    topLabel: shortBaht(Math.round(top / 100)),
    breakEven: p.breakEven
      ? {
        x: Number(x(p.breakEven.age).toFixed(1)),
        y: Number(y(p.breakEven.cashValue).toFixed(1)),
        label: `เท่าทุนอายุ ${p.breakEven.age}`,
      }
      : null,
    legend: [
      { label: "มูลค่าเวนคืน", kind: "cash" },
      { label: "เบี้ยสะสม (รายปี)", kind: "premium" },
      { label: "ความคุ้มครอง", kind: "cover" },
    ],
  };
}

/**
 * What a plan pays where the engine has no field for it. iShield's illnesses are a property
 * of the base contract rather than of a rider, and neither plan here has a booster for
 * `deathBenefitFor` to find, so that function returns nothing at all for them — without this
 * a PLB card would carry a price and not one word about what it buys.
 *
 * Written out per plan rather than inferred. "This contract pays X" is a claim about a
 * specific policy, and a plan whose benefit sheet has not been read gets no sentence put in
 * its mouth.
 */
function planBenefitSection(input: PlanCardInput): CardSection | undefined {
  if (input.planCode === "ISHIELD") {
    const table = iShieldTable();
    const benefit = illnessBenefit(table, input.sumAssured);
    const rows: CardRow[] = [
      { label: `ตรวจพบโรคร้ายแรงระยะรุนแรง (${table.illness.majorCount} โรค)`, amount: money(benefit.major) },
      { label: `ตรวจพบระยะเริ่มต้น (${table.illness.earlyCount} โรค) ต่อโรค`, amount: money(benefit.early) },
      { label: "เสียชีวิต", amount: money(input.sumAssured) },
    ];
    if (input.age < table.maturityAge) {
      rows.push({ label: `อยู่ครบสัญญาอายุ ${table.maturityAge} ปี`, amount: money(input.sumAssured) });
    }
    return { title: "รับเงินก้อนเมื่อ", rows };
  }
  if (input.planCode === "LIFETREASURE") {
    const table = lifeTreasureTable();
    return {
      title: "ครอบครัวได้รับเมื่อเสียชีวิต",
      rows: [{ label: `ทุกช่วงอายุ ถึงอายุ ${table.coverToAge}`, amount: money(input.sumAssured) }],
    };
  }
  if (input.planCode === "EASYPROTECT") {
    const table = easyProtectTable();
    return {
      title: "ครอบครัวได้รับเมื่อเสียชีวิต",
      rows: [{ label: `ทุกช่วงอายุ ถึงอายุ ${table.coverToAge}`, amount: money(input.sumAssured) }],
    };
  }
  if (input.planCode === "PLB") {
    const table = plbTable();
    const term = table.terms.find((t) => t.variant === input.variant);
    if (!term) return undefined;
    return {
      title: "ครอบครัวได้รับเมื่อเสียชีวิต",
      rows: [{
        label: `ตลอด ${term.years} ปีที่คุ้มครอง (ถึงอายุ ${coverEndsAt(term, input.age)})`,
        amount: money(input.sumAssured),
      }],
    };
  }
  return undefined;
}

/**
 * The card for an arrangement, or undefined when the company would not issue it — a card
 * that says nothing is worse than no card, and the chat still has its own words for why.
 */
export function quoteCard(input: CardInput, today: Date = new Date()): QuoteCard | undefined {
  return input.kind === "bundle" ? bundleCard(input, today) : planCard(input, today);
}

/**
 * The card for an arrangement, or undefined when the plan cannot be issued to that insured
 * at that sum — a card that says nothing is worse than no card, and the chat still has its
 * own words for why.
 */
function planCard(input: PlanCardInput, today: Date): QuoteCard | undefined {
  const plan = getPlan(input.planCode);
  if (!plan) return undefined;
  // priced yearly for the check, whatever instalment the customer is thinking in: the monthly
  // floor is a warning about an instalment, not about the arrangement, and the card answers it
  // by headlining the yearly figure instead
  const result = quote(quoteInput(input, "annual"), today);
  const base = result.items[0];
  if (!base?.eligible || result.sumAssured <= 0) return undefined;
  // a sum above the plan's maximum is only flagged by the engine, and a picture of a price
  // the company would refuse to issue is worse than no picture
  if (result.warnings.some((w) => w.level === "error")) return undefined;

  // Life Protect is priced as its page prices it, so its riders are in the figures too
  const lifeProtect = input.planCode === LIFEPROTECT_PLAN ? lifeProtectPriced(input, today) : undefined;
  if (input.planCode === LIFEPROTECT_PLAN && !lifeProtect) return undefined;
  const modes = quoteModePremiums(quoteInput(input, "annual"), today);
  const { premium, perDay: perDayLine, summary } = premiumLines(
    lifeProtect ? lifeProtect.paid : modes, result.meta.expired, lifeProtect?.split,
  );

  const sections: CardSection[] = [];
  const ownBenefits = planBenefitSection(input);
  // a plan's own benefit block leads with what it is bought for; otherwise it is the death benefit
  if (ownBenefits) sections.push(markRow(ownBenefits, "first"));
  if (result.deathBenefit) {
    const death = deathSection(result.deathBenefit);
    sections.push(ownBenefits ? death : markRow(death, "largest"));
  }
  // the Life Protect page dropped its milestone list (owner, 2026-10-06) — the chart and the
  // year-by-year table carry every one of them — so its card drops it too
  const cashRows = lifeProtect ? [] : cashRowsFor(input.planCode, input.variant, input.sex, input.age, input.sumAssured);
  if (cashRows.length) {
    const cash = { title: CASH_TITLE, rows: cashRows };
    // a savings plan with no death block of its own (iSmart) is bought for what it ends on
    sections.push(ownBenefits || result.deathBenefit ? cash : markRow(cash, "last"));
  }

  // the W-family labels its packages "<product> · <term>" already, and a plan label in front
  // of that reads "Life Protect x 1.5 / x 2 · Life Protect x 2 · ชำระเบี้ย…"
  const variantLabel = plan.variantLabels[input.variant];
  const planLabel = plan.planLabel ?? result.meta.planName;
  return {
    planLine: variantLabel.includes("·") ? variantLabel : `${planLabel} · ${variantLabel}`,
    insuredWho: `${SEX_WORD[input.sex]} ${input.age} ปี`,
    insuredLine: `ทุน ${money(result.sumAssured)} บาท`,
    premium,
    perDay: perDayLine,
    summary,
    ...(lifeProtect?.priceNote && summary ? { priceNote: lifeProtect.priceNote } : {}),
    sections,
    ...(lifeProtect ? { footNotes: lifeProtect.footNotes } : {}),
  };
}

/** One policy year, as the value table states it. */
export interface ValueTableRow {
  year: number;
  age: number;
  /** the premium falling due that year, or "—" once the paying term is over */
  due: string;
  /** what the riders cost that year, or "—"; present only on a table quoted with riders */
  rider?: string;
  /** every premium paid up to and including this year; null when no price may be shown */
  paid: string | null;
  /** what surrendering returns; absent for a plan whose surrender table the company has not published */
  cash?: string;
  cover: string;
  /** the money handed back that year, for a plan that pays one; absent elsewhere */
  payout?: string;
  /** the first year the policy is worth what has gone into it */
  breakEven?: boolean;
  /** a year that would return nothing at all on surrender */
  empty?: boolean;
}

export interface ValueTableCard {
  planLine: string;
  /** who the quote is for, e.g. "ชาย 35 ปี"; drawn large in the corner */
  insuredWho: string;
  /** what was bought, e.g. "ทุน 1,000,000 บาท" */
  insuredLine: string;
  /** "เบี้ย 23,200 บาทต่อปี · ชำระ 53 ปี" */
  premiumLine: string;
  columns: string[];
  rows: ValueTableRow[];
}

/** The same headings as the table on the sales page, in the same order. */
const VALUE_COLUMNS = ["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"];
/** the same, with the riders' premium in a column of its own, as the Life Protect page has it */
const RIDER_COLUMNS = ["ปีที่", "อายุ", "เบี้ย/ปี", "สัญญาเพิ่มเติม", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"];
/**
 * A plan that is protection and nothing else, which has no surrender column to show.
 *
 * PLB is the one here: its cover runs exactly as long as its premium is paid, five, ten,
 * twelve or fifteen years, and then it is over. What the customer needs from a table of it
 * is not what it is worth — it is what they pay, what it covers, and the year it ends.
 */
const COVER_COLUMNS = ["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "คุ้มครอง"];
/**
 * The same table for a plan that pays money back while it runs.
 *
 * The payout goes next to the premium rather than at the end, because the two are read
 * against each other: what went out that year, and what came back.
 */
const PAYOUT_COLUMNS = ["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "จ่ายคืน", "เวนคืนได้", "คุ้มครอง"];

/**
 * Whole baht, dropped rather than rounded — the same ROUNDDOWN the premiums themselves are
 * built on, and the same rule `formatBaht` follows everywhere else a price is printed.
 *
 * It rounded, and the quotation card beside it did not. An iShield premium of 54,996.80 was
 * "54,996 บาท" on the quote and "54,997 บาทต่อปี" on the table of the very same arrangement,
 * sent one after the other into the same inbox. A baht is nothing; two figures for one
 * premium, in two pictures the customer keeps, is not nothing.
 *
 * Only premiums move. Cash values and cover reach this already whole, so the two roundings
 * never differed on them.
 */
const baht = (satang: number) => formatBaht(satang);

/**
 * The same contract for a plan that is protection and nothing else.
 *
 * PLB has no surrender column because PLB has no surrender value — คุ้มครองล้วน ไม่มีมูลค่า
 * เวนคืนและไม่มีเงินคืนเมื่อครบสัญญา, which is the note the quote card has carried all along.
 * Its workbook is no help either: the CV sheets in that file belong to PR60, a retirement
 * plan it was copied from, and the summary sheet still answers #REF! where PR60's savings
 * figures used to be. Borrowing a neighbouring product's numbers to fill the column is the
 * one thing that must never happen here.
 *
 * What the table has instead is the thing customers of a term plan most often get wrong: the
 * year the cover stops. สรุปผลประโยชน์!D36 and E36 are the same formula, so cover and premium
 * run together — five, ten, twelve or fifteen years, and then it is over.
 */
function coverTableCard(
  plan: PlanBundle, input: PlanCardInput, result: QuoteResult, today: Date,
): ValueTableCard | undefined {
  const years = plan.rates.base.coverTerm?.[input.variant];
  if (!years) return undefined;

  const annual = quoteModePremiums(quoteInput(input, "annual"), today)?.find((m) => m.mode === "annual");
  const annualSatang = result.meta.expired || !annual ? null : annual.total;
  const payYears = payYearsFor(plan, input.variant, input.age);
  const cover = (result.deathBenefit?.sumFrom ?? result.sumAssured) * 100;

  // built by the same function the page's own table is built by, so the picture a customer
  // saves and the table they are looking at cannot come to differ by a baht or a year
  const rows: ValueTableRow[] = coverRows({
    years, payYears, age: input.age, annualSatang, coverSatang: cover,
  });

  const variantLabel = plan.variantLabels[input.variant];
  const planLabel = plan.planLabel ?? result.meta.planName;
  return {
    planLine: variantLabel.includes("·") ? variantLabel : `${planLabel} · ${variantLabel}`,
    insuredWho: `${SEX_WORD[input.sex]} ${input.age} ปี`,
    insuredLine: `ทุน ${money(result.sumAssured)} บาท`,
    premiumLine: annualSatang === null
      ? "ขอราคาปัจจุบันได้ทางแชท"
      : `เบี้ย ${baht(annualSatang)} บาทต่อปี · ชำระ ${payYears} ปี`,
    columns: COVER_COLUMNS,
    rows,
  };
}

/**
 * Every year of the contract as a picture: what has been paid in by then, what surrendering
 * would return, and what the family would receive.
 *
 * The sales page shows this table and customers ask the chat for it by name. The quote card
 * carries four milestone ages, which answers "is it worth anything" but not "worth what, in
 * the year I retire" — and a customer who wants that wants all of it, not a better-chosen
 * four.
 *
 * Undefined for a plan whose cover rule has not been read off its own benefit sheet: the
 * cover column would be a guess, and a guess in a table reads as a fact.
 */
export function valueTableCard(input: PlanCardInput, today: Date = new Date()): ValueTableCard | undefined {
  const plan = getPlan(input.planCode);
  if (!plan) return undefined;

  const result = quote(quoteInput(input, "annual"), today);
  const base = result.items[0];
  if (!base?.eligible || result.sumAssured <= 0) return undefined;
  if (result.warnings.some((w) => w.level === "error")) return undefined;

  const lifeProtect = input.planCode === LIFEPROTECT_PLAN ? lifeProtectPriced(input, today) : undefined;
  if (input.planCode === LIFEPROTECT_PLAN && !lifeProtect) return undefined;
  const factors = cashValueSchedule(input.planCode, input.variant, input.sex, input.age, 1000).map((r) => r.amount);
  if (!plan.coverTopUp || factors.length < 2) return coverTableCard(plan, input, result, today);

  const annual = quoteModePremiums(quoteInput(input, "annual"), today)?.find((m) => m.mode === "annual");
  const annualSatang = result.meta.expired || !annual ? null : annual.total;
  const riderDue = annualSatang === null ? undefined : lifeProtect?.riderDue?.(factors.length);
  const payYears = payYearsFor(plan, input.variant, input.age);
  const death = result.deathBenefit
    ?? { beforeAge: 0, sumBefore: result.sumAssured, sumFrom: result.sumAssured, alreadyPastAge: true };
  const payout = plan.rules.base.maturity?.survivalPayout;
  const p = cashProjection({
    factors, age: input.age, sumAssured: input.sumAssured, annualSatang, payYears, death,
    topUp: plan.coverTopUp, payout,
    ...(payout?.length ? { maturityPercent: plan.rules.base.maturity?.percentOfSumAssured } : {}),
    ...(riderDue ? { riderDue } : {}),
  });

  const variantLabel = plan.variantLabels[input.variant];
  const planLabel = plan.planLabel ?? result.meta.planName;
  return {
    planLine: variantLabel.includes("·") ? variantLabel : `${planLabel} · ${variantLabel}`,
    insuredWho: `${SEX_WORD[input.sex]} ${input.age} ปี`,
    insuredLine: `ทุน ${money(result.sumAssured)} บาท`,
    premiumLine: annualSatang === null
      ? "ขอราคาปัจจุบันได้ทางแชท"
      : `เบี้ย ${baht(annualSatang)} บาทต่อปี · ชำระ ${payYears} ปี`
        // as the page's caption says it: a rider's premium can move from year to year
        + (riderDue?.[0] ? ` · สัญญาเพิ่มเติมปีแรก ${baht(riderDue[0])} บาท` : ""),
    columns: riderDue ? RIDER_COLUMNS : payout?.length ? PAYOUT_COLUMNS : VALUE_COLUMNS,
    rows: p.rows.map((r) => ({
      year: r.policyYear,
      age: r.age,
      // a dash rather than a nought: the year is not worth nothing, there is nothing to pay
      due: r.premiumDue ? baht(r.premiumDue) : "—",
      ...(riderDue ? { rider: r.riderDue ? baht(r.riderDue) : "—" } : {}),
      paid: r.premiumPaid === null ? null : baht(r.premiumPaid),
      cash: baht(r.cashValue),
      cover: baht(r.cover),
      // a dash in the last year: what maturity pays is the surrender column's own last figure
      ...(payout?.length ? { payout: r.payout ? baht(r.payout) : "—" } : {}),
      ...(p.breakEven?.policyYear === r.policyYear ? { breakEven: true } : {}),
      ...(r.cashValue === 0 ? { empty: true } : {}),
    })),
  };
}

/**
 * The contract drawn as three lines, `width` pixels across, for the value table's picture —
 * the chart moved there off the quote card (owner, 2026-10-06), as the page sets its chart
 * over its table. Asked for apart from the table because the picture's width is the route's
 * to decide, from the table's own rows and columns.
 *
 * The same figures the table carries: a cover the plan does not step down from is still a
 * line, a picture with no price still shows what the policy is worth, and Life Protect's
 * riders are in what is paid in, as on its page.
 */
export function valueTableChart(input: PlanCardInput, width: number, today: Date = new Date()): CardChart | undefined {
  const plan = getPlan(input.planCode);
  if (!plan) return undefined;
  const result = quote(quoteInput(input, "annual"), today);
  if (!result.items[0]?.eligible || result.sumAssured <= 0) return undefined;
  if (result.warnings.some((w) => w.level === "error")) return undefined;
  const lifeProtect = input.planCode === LIFEPROTECT_PLAN ? lifeProtectPriced(input, today) : undefined;
  if (input.planCode === LIFEPROTECT_PLAN && !lifeProtect) return undefined;
  const annual = quoteModePremiums(quoteInput(input, "annual"), today)?.find((m) => m.mode === "annual");
  const death = result.deathBenefit
    ?? { beforeAge: 0, sumBefore: result.sumAssured, sumFrom: result.sumAssured, alreadyPastAge: true };
  return chartFor(
    plan, input, death, result.meta.expired || !annual ? null : annual.total, lifeProtect?.riderDue, width,
  );
}

/**
 * The rider a bundle pays a critical-illness lump sum through. Named here rather than
 * inferred, because "what this pays on a diagnosis" is a claim about a specific contract and
 * a bundle built on some other rider must not inherit the sentence. In practice: a bundle
 * built on some other critical-illness rider comes out with no diagnosis section and no
 * rate-rises note, silently — whoever adds such a bundle has to notice that and decide then
 * whether the rider should declare this itself, in its own data, instead of here.
 */
const CI_RIDER = "DCI";

/**
 * CI 123, which pays by the stage of an illness rather than once, so it is drawn as the six
 * amounts a diagnosis can pay instead of the single lump sum DCI's section says.
 */
const STAGED_CI_RIDER = "CI123";

/**
 * Bundles whose base is only there to carry a rider, so its surrender value is not the point.
 * The cancer set is not one: its base rises with CPR to a million, most of what its larger
 * tiers cost, and what that buys back on surrender is part of the answer.
 */
const NO_CASH_BUNDLES = new Set(["LEGACY_FAMILY", "CI123_SET"]);

/**
 * The card for one tier of an agency bundle.
 *
 * A bundle is sold whole, so it is drawn whole: what it is made of, what the family receives,
 * what a diagnosis pays, and what surrender would return. The premium is priced from the rate
 * tables at draw time exactly as a plan's is, so the link cannot make the company advertise a
 * figure it never quoted.
 */
function bundleCard(input: BundleCardInput, today: Date): QuoteCard | undefined {
  const bundle = getBundle(input.bundleCode);
  const tier = bundle?.tiers.find((t) => t.no === input.tier);
  if (!bundle || !tier) return undefined;

  const who = { age: input.age, sex: input.sex };
  const result = quoteBundle(bundle, input.tier, { ...who, mode: "annual" }, today);
  if (!result) return undefined;
  // a bundle that cannot be issued whole is no longer the arrangement the agency designed,
  // and a picture of it would be a picture of something nobody can buy. MIN_MONTHLY is not
  // that: it is a fact about one instalment, and the card answers it by headlining the year.
  if (result.warnings.some((w) => w.level === "error" && w.code !== "MIN_MONTHLY")) return undefined;

  const modes = bundleModePremiums(bundle, input.tier, who, today);
  const { premium, perDay: perDayLine, summary } = premiumLines(modes, result.meta.expired);

  // CI 123's benefit components are rows of the quote (the workbook itemises them) but not
  // contracts of their own, so "what this is made of" names the rider once
  const covered = result.items.filter((it) => it.eligible && !it.code.includes(":"));
  const ci = covered.find((it) => it.code === CI_RIDER);
  const staged = covered.find((it) => it.code === STAGED_CI_RIDER);
  const cancer = covered.find((it) => it.code === CANCER_RIDER);
  const cancerDaily = covered.find((it) => it.code === CANCER_DAILY_RIDER);

  const sections: CardSection[] = [];
  if (covered.length) {
    sections.push({
      title: "ชุดนี้ประกอบด้วย",
      // HIC's sum is a daily amount, and a bare "3,000 บาท" beside a lump sum reads as one
      rows: covered.map((it) => ({
        label: it.code === CANCER_DAILY_RIDER ? `${it.name} ต่อวัน` : it.name, amount: money(it.amount),
      })),
    });
  }
  // what a diagnosis pays is what this set is bought for, so it comes before the death benefit
  if (staged) {
    sections.push({
      title: "ตรวจพบโรคร้ายแรง รับเงินก้อนตามระยะของโรค",
      rows: ci123Stages().map((st) => ({ label: st.label, amount: money(stagePays(st, staged.amount)) })),
    });
    // the severe stage is last, and it is the one that pays the whole sum
    sections[sections.length - 1] = markRow(sections[sections.length - 1], "last");
  }
  if (cancer) {
    sections.push({
      title: "ตรวจพบมะเร็ง รับเงินก้อนตามระยะ",
      rows: CPR_STAGES.map((st) => ({ label: st.label, amount: money(cprStagePays(st, cancer.amount)) })),
    });
  }
  if (cancerDaily) {
    sections.push({
      title: "นอนโรงพยาบาลเพราะมะเร็ง รับรายวัน",
      rows: [
        { label: `ต่อวัน สูงสุด ${HIC_MAX_DAYS} วัน`, amount: money(cancerDaily.amount) },
        { label: `ระยะลุกลาม ขยายอีก ${HIC_INVASIVE_EXTRA_DAYS} วัน`, amount: money(cancerDaily.amount) },
      ],
    });
  }
  if (result.deathBenefit) {
    const death = deathSection(result.deathBenefit);
    // the legacy set is bought for what the family receives; the other two mark a diagnosis
    sections.push(!staged && !cancer ? markRow(death, "largest") : death);
  }
  // the cancer set adds up what the family receives across all three contracts
  if (cancer && result.deathBenefit) {
    const totals = cancerDeathTotals(cancer.amount, result.deathBenefit, input.age);
    sections.push({
      title: deathTotalsTitle(totals),
      rows: totals.rows.map((r) => ({ label: r.label, amount: money(r.amount), ...(r.mark ? { mark: true } : {}) })),
    });
  }
  if (ci) {
    sections.push({
      title: "ตรวจพบโรคร้ายแรง รับเงินก้อน",
      rows: [{ label: "จ่ายครั้งเดียว", amount: money(ci.amount) }],
    });
    const diseases = riderDiseases(ci.code)?.diseases ?? [];
    if (diseases.length) {
      sections.push({
        title: `คุ้มครองโรคร้ายแรง ${diseases.length} โรค`,
        rows: [],
        items: diseases,
      });
    }
  }
  const cashRows = cashRowsFor(bundle.planCode, bundle.variant, input.sex, input.age, tier.sumAssured);
  // The Legacy sales card is about the immediate family and critical-illness protection.
  // Its surrender figures are not part of the shared quote, while other bundle cards may
  // still use the common cash-value block.
  // The CI 123 set is the same: its base is the smallest Life Protect x 2, there to carry the rider.
  if (!NO_CASH_BUNDLES.has(input.bundleCode) && cashRows.length) {
    sections.push({ title: CASH_TITLE, rows: cashRows });
  }

  return {
    planLine: `ชุด${bundle.name}`,
    insuredWho: `${SEX_WORD[input.sex]} ${input.age} ปี`,
    insuredLine: tier.name,
    premium,
    perDay: perDayLine,
    summary,
    sections,
  };
}
