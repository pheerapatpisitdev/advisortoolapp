import type { Availability, BasePackage, DeathBenefit, MaturityBenefit, PlanRates, QuoteInput, QuoteItem, PlanRules, QuoteResult, RiderInput, Warning } from "./types";
import { getPlan, productLabel } from "./plans/registry";
import { hasExpired } from "./calendar";
import { basePremium, type BasePremiumResult } from "./base-premium";
import { sumAssuredFromPremium } from "./sa-from-premium";
import { BY_OCCUPATION_CLASS, OCCUPATION_NOTE, ratePerThousandRiderPremium } from "./riders/rate-per-thousand";
import { fixedPlanRiderPremium } from "./riders/fixed-by-plan";
import { variantRiderPremium } from "./riders/variant-rate";
import { payorBenefitPremium } from "./riders/payor-benefit";
import { premiumBasedRiderPremium } from "./riders/premium-based";
import { fixedByKeyAgePremium } from "./riders/fixed-by-key-age";
import { compositeCIPremium } from "./riders/composite-ci";
import {
  CANNOT_BUY, NOT_COVERED, baseAgeRange, baseSumAssuredLimits, checkCombined, checkMonthlyMinimum,
  checkRiderInput, checkRiderRelations, disabledRiders, packageExactSumAssured, packageSeq,
  requiredRiders, riderAvailability,
} from "./rules";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Premium-paying term in years. A "to age 99" package pays until that age, so the term
 * depends on the insured's age (Excel: the package table's Payment Year cell is =99-age).
 */
function payTermFor(rates: PlanRates, variant: string, age: number): number {
  const toAge = rates.base.payTermToAge?.[variant];
  if (toAge !== undefined) return Math.max(0, toAge - age);
  return rates.base.payTerm?.[variant] ?? 0;
}

/** Resolve the sum assured to quote on, emitting min/max warnings. Returns 0 when premium-basis SA is out of range (Excel D26). */
function resolveSumAssured(
  input: QuoteInput, rates: PlanRates, saMin: number, saMax: number | undefined, exact: boolean, warnings: Warning[],
): number {
  const minMsg = exact
    ? { level: "error" as const, code: "BASE_SA_EXACT", message: `จำนวนเงินเอาประกันภัยต้องเป็น ${fmt(saMin)} บาทเท่านั้น` }
    : { level: "error" as const, code: "BASE_SA_MIN", message: `จำนวนเงินเอาประกันภัยขั้นต่ำ ${fmt(saMin)} บาท` };
  const maxMsg = saMax === undefined ? undefined
    : { level: "error" as const, code: "BASE_SA_MAX", message: `จำนวนเงินเอาประกันภัยสูงสุด ${saMax / 1_000_000} ล้านบาท` };
  if (input.basis === "premium") {
    const sa = sumAssuredFromPremium(rates, { variant: input.variant, sex: input.sex, age: input.age, mode: input.mode, targetPremium: input.targetPremium ?? 0 }) ?? 0;
    if (sa < saMin) { warnings.push(minMsg); return 0; }
    if (maxMsg && saMax !== undefined && sa > saMax) { warnings.push(maxMsg); return 0; }
    return sa;
  }
  const belowMin = exact ? input.sumAssured !== saMin : input.sumAssured < saMin;
  if (belowMin) warnings.push(minMsg);
  if (maxMsg && saMax !== undefined && input.sumAssured > saMax) warnings.push(maxMsg);
  // Plans that void the quote for an un-issuable base plan do the same for a sum assured below
  // the package minimum (Excel F19 → "ไม่คุ้มครอง", total 0). PLB/iShield only warn.
  if (belowMin && rates.base.packages) return 0;
  return input.sumAssured;
}

interface RiderPremium { annual: number; modal: number; name?: string; amountLabel?: string; extraRows?: QuoteItem[] }

function riderPremium(
  rates: PlanRates, code: string, ri: RiderInput, input: QuoteInput, sa: number, bp: BasePremiumResult | undefined,
): RiderPremium | undefined | typeof NOT_COVERED {
  const rider = rates.riders[code];
  switch (rider.kind) {
    case "ratePerThousandByAgeClass":
    case "flatRateByClass":
      return ratePerThousandRiderPremium(rates, code, { age: input.age, sumAssured: ri.sumAssured ?? 0, mode: input.mode });
    case "fixedByAgePlan":
      return fixedPlanRiderPremium(rates, code, { age: input.age, plan: ri.plan ?? 0, mode: input.mode });
    case "ratePerThousandByVariantAgeSex":
      return variantRiderPremium(rates, code, {
        variant: ri.option ?? rider.variants[0], sex: input.sex, age: input.age,
        sumAssured: ri.sumAssured ?? 0, mode: input.mode,
      });
    case "payorBenefit": {
      if (!bp || !input.payer) return NOT_COVERED;
      const r = payorBenefitPremium(rates, code, {
        option: ri.option ?? "", insuredAge: input.age, payer: input.payer,
        payTerm: payTermFor(rates, input.variant, input.age), baseAnnual: bp.annual, mode: input.mode,
      });
      if (!r) return undefined;
      return { ...r, name: rider.options[ri.option ?? ""]?.name, amountLabel: payerLabel(input) };
    }
    case "premiumBased": {
      if (!bp) return NOT_COVERED;
      if (rider.by === "payer" && !input.payer) return NOT_COVERED;
      const r = premiumBasedRiderPremium(rates, code, {
        option: ri.option ?? "", insuredAge: input.age, insuredSex: input.sex, payer: input.payer,
        payTerm: payTermFor(rates, input.variant, input.age), baseAnnual: bp.annual, mode: input.mode,
      });
      if (!r) return undefined;
      return {
        ...r,
        name: rider.options[ri.option ?? ""]?.name,
        amountLabel: rider.by === "payer" ? payerLabel(input) : `ยกเว้นเบี้ย ${r.period} ปี`,
      };
    }
    case "fixedByKeyAge": {
      const r = fixedByKeyAgePremium(rates, code, {
        age: input.age, sex: input.sex, mode: input.mode,
        selection: { option: ri.option, territory: ri.territory, coverage: ri.coverage },
      });
      if (!r) return undefined;
      const label = rider.keyBy === "plan" ? `แผน ${r.key}` : [ri.option, ri.territory, ri.coverage].filter(Boolean).join(" · ");
      return { ...r, amountLabel: label };
    }
    case "compositeCI": {
      const r = compositeCIPremium(rates, code, {
        age: input.age, sex: input.sex, sumAssured: ri.sumAssured ?? 0, mode: input.mode,
      });
      if (!r) return undefined;
      if (r.belowMinimum) return NOT_COVERED;
      // The workbook shows the main benefit on its own row and the endorsements underneath.
      const [main, ...rest] = r.components;
      const extraRows: QuoteItem[] = rest.map((c) => ({
        code: `${code}:${c.key}`, name: `บันทึกฯ ${c.key}`, amount: c.sumAssured,
        annual: c.annual, modal: c.modal, eligible: true,
      }));
      return { annual: main.annual, modal: main.modal, extraRows };
    }
  }
}

function payerLabel(input: QuoteInput): string | undefined {
  if (!input.payer) return undefined;
  return `ผู้ชำระเบี้ย ${input.payer.sex === "M" ? "ชาย" : "หญิง"} ${input.payer.age} ปี`;
}

/** Pure function: QuoteInput → QuoteResult. `today` is injectable for tests. */
export function quote(input: QuoteInput, today: Date = new Date()): QuoteResult {
  const plan = getPlan(input.planCode);
  if (!plan) throw new Error(`Unknown plan: ${input.planCode}`);
  const { rates, rules } = plan;
  const warnings: Warning[] = [];
  const items: QuoteItem[] = [];

  // ---- sum assured & base ----
  const pkg = rates.base.packages?.find((p) => p.code === input.variant);
  // ไลฟ์ โพรเทค+ ships one Thai name in the workbook header (the "+100" one) but sells two
  // products, so name the row from the package's own product when it has one.
  const planName = plan.planLabel ?? rates.planName;
  const baseName = pkg
    ? `${productLabel(pkg) ?? planName} — ${pkg.name}`
    : plan.variantLabels[input.variant] ?? `${planName} ${input.variant}`;
  const ageRange = baseAgeRange(rules, input.variant, rates);
  const inAgeRange = input.age >= ageRange.min && input.age <= ageRange.max;
  const saLimits = baseSumAssuredLimits(rules, input.variant);
  // Excel D26: an un-issuable base plan zeroes the sum assured, so nothing is covered and the total is 0.
  const sa = !inAgeRange && rules.base.saZeroWhenIneligible
    ? 0
    : resolveSumAssured(input, rates, saLimits.min, saLimits.max, saLimits.exact, warnings);
  const bp = inAgeRange && sa > 0
    ? basePremium(rates, { variant: input.variant, sex: input.sex, age: input.age, sumAssured: sa, mode: input.mode })
    : undefined;
  if (!bp) {
    items.push({ code: input.variant, name: baseName, amount: sa, annual: 0, modal: 0, eligible: false, message: sa > 0 ? CANNOT_BUY : NOT_COVERED });
    if (!inAgeRange) warnings.push({ level: "error", code: "BASE_AGE", message: `อายุรับประกัน ${ageRange.min} - ${ageRange.max} ปี` });
  } else {
    items.push({ code: input.variant, name: baseName, amount: sa, annual: bp.annual, modal: bp.modal, eligible: true });
  }

  // ---- riders ----
  const ctx = { age: input.age, baseSumAssured: sa };
  const seq = packageSeq(input.variant, rates);
  const disabled = disabledRiders(rules, seq);
  const chosen = new Set(input.riders.filter((r) => !disabled.has(r.code)).map((r) => r.code));
  const combined = checkCombined(rules, sa, input.riders);
  for (const c of combined) warnings.push({ level: "error", code: c.code, message: c.message });
  // Two passes: the first settles conflicts and exclusions, the second checks requirements
  // against what is still standing — a rider blocked by a conflict cannot satisfy one.
  const firstPass = checkRiderRelations({ ...rules, requires: [] }, chosen);
  const standing = new Set([...chosen].filter((c) => !firstPass.some((r) => r.riders.includes(c))));
  const relations = [...firstPass, ...checkRiderRelations({ ...rules, exclusive: [], conflicts: [] }, standing)];
  for (const r of relations) warnings.push({ level: "error", code: r.code, message: r.message });

  const missing = requiredRiders(rules, seq).filter((c) => !chosen.has(c));
  for (const code of missing) {
    const rule = (rules.packages ?? []).find((p) => seq !== undefined && p.seq.includes(seq) && (p.require ?? []).includes(code));
    warnings.push({ level: "error", code: `PACKAGE_REQUIRES_${code}`, message: rule?.requiredMessage ?? `แพ็กเกจนี้ต้องซื้อ ${code}` });
  }

  for (const code of plan.riderOrder) {
    const ri = input.riders.find((r) => r.code === code);
    if (!ri) continue;
    const rule = rules.riders[code];
    const amount = ri.plan ?? ri.sumAssured ?? 0;
    const name = ri.option && rates.riders[code].kind === "ratePerThousandByVariantAgeSex" && rates.riders[code].variants.length > 1
      ? `${rule.name} (${ri.option})`
      : rule.name;
    const packageMessage = disabled.has(code)
      ? (rules.packages ?? []).find((p) => seq !== undefined && p.seq.includes(seq) && (p.disable ?? []).includes(code))?.disabledMessage ?? CANNOT_BUY
      : undefined;
    const excludedBy = combined.find((c) => c.codes.includes(code));
    const relation = relations.find((r) => r.riders.includes(code));
    const exact = packageExactSumAssured(rules, seq, code);
    const exactMessage = exact && (ri.sumAssured ?? 0) !== exact.amount ? exact.message : undefined;
    const message = packageMessage ?? excludedBy?.message ?? relation?.message ?? exactMessage
      ?? checkRiderInput(rules, rates, code, ctx, ri, input.payer);
    if (message) {
      items.push({ code, name, amount, annual: 0, modal: 0, eligible: false, message });
      continue;
    }
    const premium = riderPremium(rates, code, ri, input, sa, bp);
    if (premium === NOT_COVERED || !premium) {
      items.push({ code, name, amount, annual: 0, modal: 0, eligible: false, message: premium === NOT_COVERED ? NOT_COVERED : CANNOT_BUY });
      continue;
    }
    items.push({ code, name: premium.name ?? name, amount, amountLabel: premium.amountLabel, annual: premium.annual, modal: premium.modal, eligible: true });
    for (const extra of premium.extraRows ?? []) items.push(extra);
  }

  /**
   * AP and ECARE are priced at occupation class 1, which nobody was told (review 2026-10-01).
   * Said once, as a note rather than an error: the figure is right for the class it names.
   */
  const byClass = items.filter((i) => i.eligible && BY_OCCUPATION_CLASS.has(rates.riders[i.code]?.kind ?? ""));
  if (byClass.length) {
    warnings.push({
      level: "warn",
      code: "OCCUPATION_CLASS",
      message: `เบี้ย ${byClass.map((i) => i.code).join(" / ")} ${OCCUPATION_NOTE} — อาชีพชั้นอื่นเบี้ยสูงกว่านี้`,
    });
  }

  // A package whose mandatory rider is missing quotes nothing (Excel F37/F38).
  const voided = missing.length > 0;

  // ---- totals & global checks (Excel: total is 0 when no sum assured) ----
  const live = sa > 0 && !voided;
  const totalAnnual = live ? items.reduce((s, i) => s + i.annual, 0) : 0;
  const totalModal = live ? items.reduce((s, i) => s + i.modal, 0) : 0;
  // Excel E65 flags the monthly minimum from the total alone, even when nothing is covered.
  const mm = checkMonthlyMinimum(rules, input.mode, totalModal);
  if (mm) warnings.push(mm);

  const availability: Availability[] = plan.riderOrder.map((code) => {
    const a = riderAvailability(rules, rates, code, ctx);
    if (!disabled.has(code)) return a;
    const msg = (rules.packages ?? []).find((p) => seq !== undefined && p.seq.includes(seq) && (p.disable ?? []).includes(code))?.disabledMessage;
    return { ...a, eligible: false, reason: msg ?? CANNOT_BUY };
  });
  const expired = hasExpired(today, rates.expiresOn);

  // Riders that pay out on death add their sum assured to what the family receives.
  const riderDeathCover = items
    .filter((i) => i.eligible && rules.riders[i.code]?.paysOnDeath)
    .reduce((sum, i) => sum + i.amount, 0);

  return {
    items, totalAnnual, totalModal, warnings, availability, sumAssured: sa,
    deathBenefit: deathBenefitFor(
      rules, pkg, input.age, sa, live ? riderDeathCover : 0, live ? riderCoverEndingAt(rules, items) : undefined,
    ),
    maturityBenefit: maturityBenefitFor(rules, input.age, sa),
    meta: { planName: rates.planName, version: rates.version, expiresOn: rates.expiresOn, expired, minMonthlyTotal: rules.minMonthlyTotal },
  };
}

/**
 * Excel สรุปผลประโยชน์ K7/K8: the sum assured is payable on death at any time, and death
 * before the anniversary at `extraDeathBenefitBeforeAge` pays an extra `booster × sum
 * assured` on top. An insured already at that age gets the plain sum assured only.
 */
function deathBenefitFor(
  rules: PlanRules, pkg: BasePackage | undefined, age: number, sa: number, riderCover: number,
  ending: { age: number; amount: number } | undefined,
): DeathBenefit | undefined {
  const beforeAge = rules.base.extraDeathBenefitBeforeAge;
  if (beforeAge === undefined || sa <= 0) return undefined;
  const booster = pkg?.booster ?? 0;
  const alreadyPastAge = age >= beforeAge;
  const sumFrom = sa + riderCover;
  // The booster multiplies the base plan only; a rider adds its own sum assured to both figures.
  return {
    beforeAge,
    sumBefore: (alreadyPastAge ? sa : sa + Math.round(sa * booster)) + riderCover,
    sumFrom,
    alreadyPastAge,
    // an insured already past the ending has no band left to warn about
    ...(ending && age < ending.age
      ? { riderCoverEnds: { age: ending.age, sum: sumFrom - ending.amount } }
      : {}),
  };
}

/**
 * The first age at which rider death cover drops away, and how much drops with it. Riders
 * that run as long as the plan are not an ending and are left out; where several end, the
 * earliest wins and only the cover ending exactly then is counted, so the figure quoted for
 * that band is the one actually payable in it.
 */
function riderCoverEndingAt(
  rules: PlanRules, items: QuoteItem[],
): { age: number; amount: number } | undefined {
  const ending = items
    .filter((i) => i.eligible && rules.riders[i.code]?.paysOnDeath)
    .map((i) => ({ amount: i.amount, at: rules.riders[i.code]?.coverToAge }))
    .filter((r): r is { amount: number; at: number } => r.at !== undefined);
  if (ending.length === 0) return undefined;
  const age = Math.min(...ending.map((r) => r.at));
  return { age, amount: ending.filter((r) => r.at === age).reduce((sum, r) => sum + r.amount, 0) };
}

/**
 * Excel ตารางแสดงผลประโยชน์: the last policy year pays a percentage of the sum assured, and
 * the plans with a yearly survival benefit pay one in every year before it (ไอสมาร์ท 80/6:
 * 1% of the sum assured in policy years 1-5, 2% from year 6 to the year before maturity,
 * then 200% at the anniversary at age 80). Each year is rounded on its own, as the sheet does.
 */
function maturityBenefitFor(rules: PlanRules, age: number, sa: number): MaturityBenefit | undefined {
  const rule = rules.base.maturity;
  if (!rule || sa <= 0) return undefined;
  const years = rule.age - age; // policy years, the last of which ends at maturity
  if (years <= 0) return undefined;
  const share = (percent: number) => Math.round((sa * percent) / 100);
  const amount = share(rule.percentOfSumAssured);
  if (!rule.survivalPayout) return { age: rule.age, amount };
  let survivalTotal = 0;
  let year = 1;
  for (const band of rule.survivalPayout) {
    const last = Math.min(band.throughPolicyYear ?? years - 1, years - 1);
    if (last < year) continue;
    survivalTotal += share(band.percentOfSumAssured) * (last - year + 1);
    year = last + 1;
  }
  return { age: rule.age, amount, survivalTotal, total: amount + survivalTotal };
}
