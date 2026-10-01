import type { Availability, PayMode, Payer, PlanRates, PlanRules, RiderInput, RiderRule, Warning } from "./types";
import { BY_OCCUPATION_CLASS, OCCUPATION_NOTE } from "./riders/rate-per-thousand";

export interface RiderContext {
  age: number;
  baseSumAssured: number;
}

export const CANNOT_BUY = "ไม่สามารถซื้อได้";
export const NOT_COVERED = "ไม่คุ้มครอง";
export const CHOOSE_OPTION = "กรุณาเลือกแบบ";
export const PAYER_MISSING = "กรอกอายุผู้ชำระเบี้ย";
export const PAYER_AGE = "อายุผู้ชำระเบี้ยไม่อยู่ในเกณฑ์";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Issue-age range of the base plan for a variant: from the package table when the plan sells
 * packages (the W family), else from the rules (iShield's per-variant maximum, PLB's global one).
 */
export function baseAgeRange(rules: PlanRules, variant: string, rates?: PlanRates): { min: number; max: number } {
  const pkg = rates?.base.packages?.find((p) => p.code === variant);
  if (pkg) return { min: pkg.ageMin, max: pkg.ageMax };
  return { min: rules.base.ageMin, max: rules.base.ageMaxByVariant?.[variant] ?? rules.base.ageMax };
}

/** Minimum sum assured for a variant, and whether that minimum is the only value allowed. */
export function baseSumAssuredLimits(rules: PlanRules, variant: string): { min: number; exact: boolean; max?: number } {
  const min = rules.base.saMinByVariant?.[variant] ?? rules.base.saMin;
  return { min, exact: rules.base.saExactVariants?.includes(variant) ?? false, max: rules.base.saMax };
}

/** Package sequence number of a variant, used by the package rules. */
export function packageSeq(variant: string, rates: PlanRates): number | undefined {
  return rates.base.packages?.find((p) => p.code === variant)?.seq;
}

/** Riders the chosen package does not sell. */
export function disabledRiders(rules: PlanRules, seq: number | undefined): Set<string> {
  const out = new Set<string>();
  if (seq === undefined) return out;
  for (const p of rules.packages ?? []) {
    if (p.seq.includes(seq)) for (const c of p.disable ?? []) out.add(c);
  }
  return out;
}

/** A sum assured the chosen package pins a rider to, if any. */
export function packageExactSumAssured(rules: PlanRules, seq: number | undefined, code: string): { amount: number; message: string } | undefined {
  if (seq === undefined) return undefined;
  for (const p of rules.packages ?? []) {
    const amount = p.seq.includes(seq) ? p.exactSumAssured?.[code] : undefined;
    if (amount !== undefined) {
      return { amount, message: p.exactMessage ?? `ต้องระบุทุน ${code} ${amount.toLocaleString("en-US")} บาทเท่านั้น` };
    }
  }
  return undefined;
}

/** Riders the chosen package makes mandatory. */
export function requiredRiders(rules: PlanRules, seq: number | undefined): string[] {
  if (seq === undefined) return [];
  return (rules.packages ?? []).filter((p) => p.seq.includes(seq)).flatMap((p) => p.require ?? []);
}

export interface RiderConflict {
  code: string;
  riders: string[];
  message: string;
}

/**
 * Rider-to-rider rules that do not depend on sums assured: mutually exclusive pairs,
 * riders that require a companion, and riders that conflict with others.
 */
export function checkRiderRelations(rules: PlanRules, chosen: Set<string>): RiderConflict[] {
  const out: RiderConflict[] = [];
  for (const e of rules.exclusive ?? []) {
    if (e.riders.every((c) => chosen.has(c))) out.push({ code: e.code, riders: [...e.riders], message: e.message });
  }
  for (const r of rules.requires ?? []) {
    if (chosen.has(r.rider) && !r.needs.every((c) => chosen.has(c))) {
      out.push({ code: `${r.rider}_REQUIRES`, riders: [r.rider], message: r.message });
    }
  }
  for (const c of rules.conflicts ?? []) {
    const clash = c.with.filter((w) => chosen.has(w));
    if (chosen.has(c.rider) && clash.length > 0) {
      out.push({ code: `${c.rider}_CONFLICT`, riders: [c.rider], message: c.message });
    }
  }
  return out;
}

function allowedPlans(rates: PlanRates, rules: PlanRules, code: string, age: number): number[] | undefined {
  const rule = rules.riders[code];
  const rider = rates.riders[code];
  if (!rule?.planMaxByAge || !rider || rider.kind !== "fixedByAgePlan") return undefined;
  const band = rule.planMaxByAge.find((b) => age <= b.ageMax);
  if (!band) return [];
  return rider.plans.filter((p) => p <= band.planMax);
}

function riderOptions(rates: PlanRates, code: string): { code: string; name: string }[] | undefined {
  const rider = rates.riders[code];
  if (!rider) return undefined;
  if (rider.kind === "payorBenefit" || rider.kind === "premiumBased") {
    return Object.entries(rider.options).map(([c, o]) => ({ code: c, name: o.name }));
  }
  if (rider.kind === "ratePerThousandByVariantAgeSex") {
    return rider.variants.length > 1 ? rider.variants.map((v) => ({ code: v, name: v })) : undefined;
  }
  if (rider.kind === "fixedByKeyAge") {
    if (rider.keyBy === "plan") return (rider.plans ?? []).map((p) => ({ code: p, name: p }));
    return Object.keys(rider.planNo ?? {}).map((p) => ({ code: p, name: p }));
  }
  return undefined;
}

function saMaxFor(rule: RiderRule, ctx: RiderContext): number | undefined {
  const j = rule.juvenile;
  if (j && ctx.age <= j.ageMax) return Math.min(j.saMaxMultipleOfBase * ctx.baseSumAssured, j.saMaxCap);
  if (rule.saMaxMultipleOfBase === undefined) return undefined;
  const byMultiple = rule.saMaxMultipleOfBase * ctx.baseSumAssured;
  return rule.saMaxCap === undefined ? byMultiple : Math.min(byMultiple, rule.saMaxCap);
}

/** What the UI needs to enable/disable a rider and bound its input. */
export function riderAvailability(rules: PlanRules, rates: PlanRates, code: string, ctx: RiderContext): Availability {
  const rule = rules.riders[code];
  const eligible = ctx.age >= rule.ageMin && ctx.age <= rule.ageMax;
  return {
    code,
    name: rule.name,
    eligible,
    ageRange: `${rule.ageMin} - ${rule.ageMax} ปี`,
    saMin: rule.saMin,
    saMax: saMaxFor(rule, ctx),
    plans: allowedPlans(rates, rules, code, ctx.age),
    options: riderOptions(rates, code),
    needsPayer: rates.riders[code]?.kind === "payorBenefit"
      || (rates.riders[code]?.kind === "premiumBased" && (rates.riders[code] as { by: string }).by === "payer") || undefined,
    reason: eligible ? undefined : CANNOT_BUY,
    // AP and ECARE are priced at one occupation class, and the row says which (review 2026-10-01)
    note: BY_OCCUPATION_CLASS.has(rates.riders[code]?.kind ?? "") ? OCCUPATION_NOTE : undefined,
  };
}

/** Per-rider input check. Returns the Excel-style message, or undefined when OK. */
export function checkRiderInput(
  rules: PlanRules,
  rates: PlanRates,
  code: string,
  ctx: RiderContext,
  input: RiderInput,
  payer?: Payer,
): string | undefined {
  const a = riderAvailability(rules, rates, code, ctx);
  if (!a.eligible) return CANNOT_BUY;
  if (a.options && a.options.length > 0 && (!input.option || !a.options.some((o) => o.code === input.option))) return CHOOSE_OPTION;
  if (a.needsPayer) {
    const p = rules.riders[code].payer;
    if (!payer) return PAYER_MISSING;
    if (p && (payer.age < p.ageMin || payer.age > p.ageMax)) return PAYER_AGE;
    return undefined;
  }
  if (input.plan !== undefined) {
    if (!a.plans || !a.plans.includes(input.plan)) return `${code} เกินกว่าที่กำหนด`;
    return undefined;
  }
  const label = input.option ?? code;
  const sa = input.sumAssured ?? 0;
  if (a.saMin !== undefined && sa < a.saMin) return `${label} ต่ำกว่าขั้นต่ำ ${fmt(a.saMin)}`;
  if (a.saMax !== undefined && sa > a.saMax) return `${label} เกินกว่าที่กำหนด`;
  return undefined;
}

export interface CombinedViolation {
  code: string;
  codes: string[];
  message: string;
}

/** e.g. AP_SA + ECARE_SA > MIN(5*base, 10,000,000). */
export function checkCombined(rules: PlanRules, baseSumAssured: number, riders: RiderInput[]): CombinedViolation[] {
  const out: CombinedViolation[] = [];
  for (const c of rules.combined) {
    const total = riders.filter((r) => c.riders.includes(r.code)).reduce((s, r) => s + (r.sumAssured ?? 0), 0);
    const limit = c.maxMultipleOfBase === undefined ? c.cap : Math.min(c.maxMultipleOfBase * baseSumAssured, c.cap);
    if (total > limit) out.push({ code: c.code, codes: [...c.riders], message: c.message });
  }
  return out;
}

/** totalModal in satang. */
export function checkMonthlyMinimum(rules: PlanRules, mode: PayMode, totalModal: number): Warning | undefined {
  if (mode !== "monthly") return undefined;
  if (totalModal >= rules.minMonthlyTotal * 100) return undefined;
  return { level: "error", code: "MIN_MONTHLY", message: `เบี้ยประกันภัยรายเดือนต่ำกว่า ${fmt(rules.minMonthlyTotal)} บาท` };
}
