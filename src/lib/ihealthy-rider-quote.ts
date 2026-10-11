/**
 * What the agent's fold costs, worked out by the engine.
 *
 * Everything the customer sees on the page is priced in the browser from the slim table in
 * ihealthy-table.ts. This is the rest of the bill: the riders the company sells alongside the
 * health cover, which carry eligibility rules — age bands, plan caps, sums the package pins —
 * that the browser has no business keeping a second copy of, and whose rate tables it would
 * have to download to price.
 */
import { quote } from "@/calc/quote";
import { getPlan, type PlanBundle } from "@/calc/plans/registry";
import {
  CANNOT_BUY, disabledRiders, packageExactSumAssured, packageSeq, requiredRiders, riderAvailability,
} from "@/calc/rules";
import { iHealthyTable } from "@/lib/ihealthy-table";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";

const PLAN_CODE = "LIFEPROTECT";
/** The health rider is the page's whole subject; it is never one of the extras. */
const THE_HEALTH_RIDER = "IHU";
/**
 * The riders the company will never put on the same contract as the health cover.
 *
 * Every other rider the base plan sells is offered here, the way the back-office calculator
 * offers them — the agency used to keep this page to two, and the owner opened it to all of
 * them on 2026-10-12. A rider whose own rules refuse iHealthy Ultra outright (HIC today) is
 * not greyed with a reason but left off, because no tick and no age could ever make it
 * attachable on a page that always carries iHealthy Ultra. Read from the rules rather than
 * listed, so a conflict the company adds later leaves the fold on its own.
 */
function neverWithHealth(plan: PlanBundle): Set<string> {
  return new Set((plan.rules.conflicts ?? [])
    .filter((c) => c.with.includes(THE_HEALTH_RIDER))
    .map((c) => c.rider));
}

/**
 * The riders priced on somebody other than the insured — PB, which keeps the premiums paid if
 * the parent or spouse paying them dies or is disabled.
 *
 * The page asks for one person. Handed that person as their own payer, the engine prices PB on
 * the insured's age and sex, which is a figure for a contract nobody can buy: PB is written on
 * a parent or a spouse. Left off until the page asks who pays, rather than quoted wrong.
 */
function pricedOnAnotherPayer(plan: PlanBundle): Set<string> {
  return new Set(Object.entries(plan.rates.riders)
    .filter(([, r]) => r.kind === "premiumBased" && r.by === "payer")
    .map(([code]) => code));
}

export interface AttachedRider {
  code: string;
  sumAssured?: number;
  plan?: number;
  option?: string;
}

export interface RiderQuoteInput {
  base: string;
  age: number;
  sex: Sex;
  sumAssured: number;
  mode: PayMode;
  plan: string;
  territory: string;
  coverage: string;
  riders: AttachedRider[];
}

/** The request as it was read: the riders that could be read, and how many could not. */
type ParsedRequest = RiderQuoteInput & { unreadable: number[] };

export interface RiderChoice {
  code: string;
  name: string;
  ageRange: string;
  /** false for a rider this age cannot buy: shown, greyed, and not attachable */
  eligible: boolean;
  /** why not, in the company's own words */
  reason?: string;
  saMin?: number;
  saMax?: number;
  /** the fixed plan amounts this rider sells, when it sells plans rather than sums */
  plans?: number[];
  /** the named variants this rider sells */
  options?: { code: string; name: string }[];
  /** the package pins this rider's sum assured here, and says so in these words */
  exactSumAssured?: number;
  exactMessage?: string;
}

/**
 * One priced line of the arrangement.
 *
 * Mapped from the engine's own `QuoteItem` rather than being it: this is a public POST
 * endpoint, and what crosses the wire is decided here, so a field added to the engine's
 * display type later does not start shipping to the browser on its own. Two of its fields
 * are deliberately left behind — the annual premium, because the fold prices the instalment
 * on screen and a second price for the same thing only invites quoting the wrong one, and
 * the sums assured, because the fold's own controls are where they were typed.
 */
export interface RiderQuoteRow {
  code: string;
  name: string;
  /** satang, in the mode that was asked for */
  modal: number;
  eligible: boolean;
  message?: string;
}

export interface RiderQuoteResult {
  available: RiderChoice[];
  items: RiderQuoteRow[];
  /** the whole arrangement in this mode, in satang */
  totalModal: number;
  /**
   * What the attached riders cost on their own, in every instalment — everything the engine
   * priced except the base plan and the health cover itself.
   *
   * The page's own arithmetic already knows what the base and the health cover come to under
   * each of the six plans; none of these riders is priced on the health plan, so their
   * subtotal is the one figure the browser is missing and adding it to each column is exact.
   * Sent for all three instalments because the table prints all three.
   */
  extras: { mode: PayMode; total: number }[];
  /** which they are, for a card that names one of them or counts them all in a line */
  extraCodes: string[];
  /**
   * What the family receives once these riders are on the contract.
   *
   * The page works its own out from the base plan alone, which is right until a rider that
   * pays on death is attached — and then the card was charging for cover it did not mention.
   * The engine already adds those sums up, so it is asked rather than repeated.
   */
  deathBenefit?: DeathBenefit;
  warnings: string[];
}

const MODES: PayMode[] = ["annual", "semi", "monthly"];
/** Nobody is older than this, and no rate table in the building reaches it. */
const AGE_MAX = 120;
/** Comfortably above every cap in the rules; a figure past it is not a sum assured. */
const SUM_MAX = 100_000_000;
const BAD_REQUEST = "คำขอไม่ถูกต้อง";

function isCount(v: unknown, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;
}

/** A label the rate tables are keyed by: present, and short enough to be one. */
function isLabel(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 60;
}

function parseRider(raw: unknown, plan: PlanBundle): AttachedRider | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (!isLabel(r.code) || !plan.riderOrder.includes(r.code)) return undefined;
  if (r.sumAssured !== undefined && !isCount(r.sumAssured, SUM_MAX)) return undefined;
  if (r.plan !== undefined && !isCount(r.plan, SUM_MAX)) return undefined;
  if (r.option !== undefined && !isLabel(r.option)) return undefined;
  return {
    code: r.code,
    ...(r.sumAssured === undefined ? {} : { sumAssured: r.sumAssured as number }),
    ...(r.plan === undefined ? {} : { plan: r.plan as number }),
    ...(r.option === undefined ? {} : { option: r.option as string }),
  };
}

/**
 * The request, or nothing at all.
 *
 * A server action is a POST endpoint whose body is whatever the caller cares to send, so the
 * declared parameter type is a promise the client makes and not one it keeps. Everything the
 * engine would index a rate table with is checked here: an age of 500 or a base the table
 * never carried would otherwise reach `quote()` and come back as arithmetic on undefined.
 */
function parseRequest(raw: unknown, plan: PlanBundle, bases: string[]): ParsedRequest | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (!isLabel(r.base) || !bases.includes(r.base)) return undefined;
  if (!isCount(r.age, AGE_MAX)) return undefined;
  if (r.sex !== "M" && r.sex !== "F") return undefined;
  if (!isCount(r.sumAssured, SUM_MAX) || r.sumAssured === 0) return undefined;
  if (!MODES.includes(r.mode as PayMode)) return undefined;
  // Plan, territory and coverage are only checked for being labels at all. Which spellings
  // exist is the rider's own rate table's business, and it already answers for one it does
  // not carry by pricing nothing and saying so — the same answer a withdrawn plan gets.
  if (!isLabel(r.plan) || !isLabel(r.territory) || !isLabel(r.coverage)) return undefined;
  if (!Array.isArray(r.riders) || r.riders.length > plan.riderOrder.length) return undefined;
  // A rider that cannot be read is dropped, not fatal. The riders now travel in the address,
  // so one mangled `r` — a chat client that truncated the link, a figure past the engine's
  // ceiling — used to answer the whole request with nothing: no riders on offer, a total of
  // zero, and a fold the agent could not recover without reloading the page.
  const riders: AttachedRider[] = [];
  const unreadable: number[] = [];
  for (const [i, one] of (r.riders as unknown[]).entries()) {
    const rider = parseRider(one, plan);
    if (rider === undefined) unreadable.push(i);
    else riders.push(rider);
  }
  return {
    base: r.base, age: r.age, sex: r.sex, sumAssured: r.sumAssured, mode: r.mode as PayMode,
    plan: r.plan, territory: r.territory, coverage: r.coverage, riders, unreadable,
  };
}

/**
 * The engine's rows with each rider's endorsements added into the rider's own line.
 *
 * CI 123 is priced as a main benefit plus endorsements, and the engine lists them the way the
 * workbook does: one row each, coded `CI123:<cover>`. Each costs money and is part of the one
 * contract. On this page they read as five more riders — a card counting "สัญญาเพิ่มเติม 6
 * รายการ" for one tick, and rows of English cover names at nought baht in the bill — so the
 * figure goes into the rider's line and the row itself goes.
 */
function withEndorsementsFolded<T extends { code: string; modal: number }>(items: T[]): T[] {
  const parents = new Map(items.filter((i) => !i.code.includes(":")).map((i) => [i.code, { ...i }]));
  const out: T[] = [];
  for (const i of items) {
    const parent = i.code.includes(":") ? parents.get(i.code.slice(0, i.code.indexOf(":"))) : undefined;
    if (parent) parent.modal += i.modal;
    else if (!i.code.includes(":")) out.push(parents.get(i.code)!);
    else out.push(i);
  }
  return out;
}

/**
 * The arrangement priced by the engine itself — the same `quote()` the back-office
 * calculator runs — rather than by the browser's slim table, because the moment a rider is
 * attached the arrangement stops being slim.
 *
 * A plain function and not the action itself: the page reaches it over the wire, and the
 * card route reaches it in the same process to draw the picture. Both have to be quoting the
 * same arrangement, and two copies of a hundred lines of eligibility rules would eventually
 * not be.
 */
export function priceRiders(input: RiderQuoteInput): RiderQuoteResult {
  const plan = getPlan(PLAN_CODE)!;
  const asked = parseRequest(input, plan, iHealthyTable().bases.map((b) => b.variant));
  // Nothing this page can do produces an unparsable request, so the empty quote is for
  // whoever is posting by hand: a harmless answer rather than a stack trace in the log.
  if (asked === undefined) {
    return {
      available: [], items: [], totalModal: 0, extraCodes: [],
      extras: MODES.map((mode) => ({ mode, total: 0 })),
      warnings: [BAD_REQUEST],
    };
  }

  const seq = packageSeq(asked.base, plan.rates);
  const off = disabledRiders(plan.rules, seq);
  // A rider the package makes mandatory is attached below rather than offered: leaving one
  // off voids the whole quote, so it is not the agent's to tick. Here that names only the
  // health rider the page is about, which the customer's own pickers upstairs already set.
  const required = new Set(requiredRiders(plan.rules, seq));
  const never = new Set([...neverWithHealth(plan), ...pricedOnAnotherPayer(plan)]);
  const ctx = { age: asked.age, baseSumAssured: asked.sumAssured };

  // A rider this age cannot buy stays on the list, greyed, carrying its reason. Taking it
  // away answers the agent's question — "can we add the critical-illness cover for him?" —
  // by making the question unaskable, which is the fault this whole page was built to fix.
  // A rider the package does not sell is a different matter: it is not on offer here at all.
  const available: RiderChoice[] = [];
  for (const code of plan.riderOrder) {
    if (code === THE_HEALTH_RIDER || never.has(code) || required.has(code) || off.has(code)) continue;
    const a = riderAvailability(plan.rules, plan.rates, code, ctx);
    const exact = packageExactSumAssured(plan.rules, seq, code);
    available.push({
      code, name: a.name, ageRange: a.ageRange, eligible: a.eligible, reason: a.reason,
      saMin: a.saMin, saMax: a.saMax, plans: a.plans, options: a.options,
      exactSumAssured: exact?.amount, exactMessage: exact?.message,
    });
  }

  // The arrangement can change under an open fold — a package that refuses a rider, an age
  // that puts one out of range — so what was ticked earlier is filtered against what
  // this arrangement offers instead of being sent on to be priced. The fold keeps the tick
  // in case the agent goes back; the total here counts only what is still on offer, and the
  // pinned sums are the package's to set, not the caller's.
  const offered = new Map(available.map((c) => [c.code, c]));
  const attached: AttachedRider[] = [];
  const dropped: string[] = [];
  for (const rider of asked.riders) {
    const choice = offered.get(rider.code);
    if (choice === undefined || !choice.eligible) {
      dropped.push(rider.code);
      continue;
    }
    attached.push(
      choice.exactSumAssured === undefined ? rider : { ...rider, sumAssured: choice.exactSumAssured },
    );
  }

  const result = quote({
    planCode: PLAN_CODE, variant: asked.base, age: asked.age, sex: asked.sex, mode: asked.mode,
    basis: "sumAssured", sumAssured: asked.sumAssured,
    // The page asks for no payer of its own, so the insured is taken to pay their own
    // premiums. A payor rider bought for a child needs a real parent, and the engine says so
    // rather than being handed a guess.
    payer: { age: asked.age, sex: asked.sex },
    riders: [
      { code: THE_HEALTH_RIDER, option: asked.plan, territory: asked.territory, coverage: asked.coverage },
      ...[...required].filter((c) => c !== THE_HEALTH_RIDER).map((code) => ({
        code, sumAssured: packageExactSumAssured(plan.rules, seq, code)?.amount,
      })),
      ...attached,
    ],
  });

  // The same arrangement in the other two instalments, for the subtotal below. The engine
  // rounds each instalment down on its own, so twelve months do not add up to a year and
  // one cannot be scaled from another.
  const byMode = new Map(MODES.map((mode) => [
    mode,
    mode === asked.mode ? result : quote({
      planCode: PLAN_CODE, variant: asked.base, age: asked.age, sex: asked.sex, mode,
      basis: "sumAssured", sumAssured: asked.sumAssured,
      payer: { age: asked.age, sex: asked.sex },
      riders: [
        { code: THE_HEALTH_RIDER, option: asked.plan, territory: asked.territory, coverage: asked.coverage },
        ...[...required].filter((c) => c !== THE_HEALTH_RIDER).map((code) => ({
          code, sumAssured: packageExactSumAssured(plan.rules, seq, code)?.amount,
        })),
        ...attached,
      ],
    }),
  ]));
  /** The base row carries the variant's own code; the health cover carries IHU. */
  const isExtra = (code: string) => code !== asked.base && !code.startsWith(THE_HEALTH_RIDER);
  const extras = MODES.map((mode) => ({
    mode,
    total: byMode.get(mode)!.items.filter((i) => i.eligible && isExtra(i.code))
      .reduce((sum, i) => sum + i.modal, 0),
  }));
  const rows = withEndorsementsFolded(result.items);

  // Why a tick was left out is the engine's to say, and it says two different things: a
  // package does not sell this rider at all, an eight-year-old is too young for that one.
  // Both would otherwise come out as the same shrug.
  const why = new Map(result.availability.map((a) => [a.code, a]));
  return {
    available,
    items: rows.map((i) => ({
      code: i.code, name: i.name, modal: i.modal, eligible: i.eligible, message: i.message,
    })),
    totalModal: result.totalModal,
    extras,
    extraCodes: rows.filter((i) => i.eligible && isExtra(i.code)).map((i) => i.code),
    deathBenefit: result.deathBenefit,
    warnings: [
      ...(asked.unreadable.length > 0 ? [`มีสัญญาเพิ่มเติม ${asked.unreadable.length} รายการที่อ่านไม่ออก จึงไม่ได้คิดเบี้ยให้`] : []),
      ...dropped.map((code) => {
        const a = why.get(code);
        return `${a?.name ?? code} ${a?.reason ?? CANNOT_BUY} จึงไม่ได้คิดเบี้ยให้`;
      }),
      // A rider the age may buy, at a plan the age may not, is neither of the two cases
      // above: it is on offer, it was attached, and the engine priced it at nothing. Said
      // here because it was said nowhere — a ticked daily-cash rider left over from an older
      // age simply vanished out of the quote, and the card went quiet about it too.
      ...result.items
        .filter((i) => !i.eligible && isExtra(i.code) && attached.some((r) => r.code === i.code))
        .map((i) => `${i.name} ${i.message ?? CANNOT_BUY} จึงไม่ได้คิดเบี้ยให้`),
      ...result.warnings.map((w) => w.message),
    ],
  };
}
