"use client";
import { AppShell } from "@/components/shell/AppShell";
import { useMemo, useState } from "react";
import { quote } from "@/calc/quote";
import { getPlan, listPlans } from "@/calc/plans/registry";
import { baseAgeRange, baseSumAssuredLimits, packageSeq, requiredRiders } from "@/calc/rules";
import type { QuoteInput, RiderInput } from "@/calc/types";
import { getBundle, listBundles } from "@/calc/bundles/registry";
import { bundleAgeRange, bundleModePremiums, bundleQuoteInput, quoteBundle } from "@/calc/bundles/quote";
import { QuoteForm, type FormState } from "@/components/QuoteForm";
import { BundleForm } from "@/components/BundleForm";
import { BUNDLE_PREFIX } from "@/components/PlanSelect";
import { QuoteResultPanel } from "@/components/QuoteResultPanel";
import { ExpiryBanner } from "@/components/ExpiryBanner";
import { quoteModePremiums } from "@/calc/mode-premiums";

/**
 * The picker's names, in the menu's one convention. The registries keep อีซี่ โพรเทค 6 and
 * มรดกเพื่อครอบครัว because the chat recognises a customer's typing from them and the quote
 * cards print them; only this page, which an agent reads beside the English menu, takes the
 * English.
 */
const PICKER_NAME: Record<string, string> = { EASYPROTECT: "Easy Protect 6" };
const BUNDLE_PICKER_NAME: Record<string, string> = { LEGACY_FAMILY: "Family Legacy", CI123_SET: "CI 123", CANCER_SET: "Cancer" };
const pickerPlans = () => listPlans().map((p) => ({ ...p, name: PICKER_NAME[p.code] ?? p.name }));
const pickerBundles = () => listBundles().map((b) => ({ ...b, name: BUNDLE_PICKER_NAME[b.code] ?? b.name }));

/** Life Protect x 2 paid to age 99 is the plan agents quote most, so start there. */
const INITIAL: FormState = {
  planCode: "LIFEPROTECT", bundleCode: null, tier: 1, variant: "WLF99H", age: 35, sex: "M", mode: "annual",
  basis: "sumAssured", sumAssured: 1_000_000, targetPremium: "",
  riders: {},
};

/** Build engine input; riders the current age cannot buy are dropped even if still ticked. */
function toQuoteInput(s: FormState, eligibleCodes: Set<string>): QuoteInput | null {
  const plan = getPlan(s.planCode);
  if (!plan || s.age === "") return null;
  const premiumBasis = s.basis === "premium" && plan.rules.base.premiumBasis;
  if (premiumBasis ? s.targetPremium === "" : s.sumAssured === "") return null;
  const riders: RiderInput[] = [];
  const required = new Set(requiredRiders(plan.rules, packageSeq(s.variant, plan.rates)));
  for (const code of plan.riderOrder) {
    const r = s.riders[code];
    const on = (r?.enabled ?? false) || required.has(code);
    if (!on || !eligibleCodes.has(code)) continue;
    const rider = plan.rates.riders[code];
    const kind = rider?.kind;
    const value = r?.value ?? "";
    const option = r?.option || undefined;
    if (kind === "payorBenefit" || kind === "premiumBased") riders.push({ code, option });
    else if (kind === "fixedByKeyAge") riders.push({ code, option, territory: r?.territory, coverage: r?.coverage });
    else if (value === "") continue;
    else if (kind === "fixedByAgePlan") riders.push({ code, plan: value });
    else if (kind === "ratePerThousandByVariantAgeSex") riders.push({ code, option, sumAssured: value });
    else riders.push({ code, sumAssured: value });
  }
  return {
    planCode: s.planCode, variant: s.variant, age: s.age, sex: s.sex, mode: s.mode,
    sumAssured: premiumBasis ? 0 : (s.sumAssured as number),
    basis: premiumBasis ? "premium" : "sumAssured",
    targetPremium: premiumBasis ? (s.targetPremium as number) : undefined,
    // PB is written with the insured paying their own premiums, so it is rated on that person
    payer: { age: s.age, sex: s.sex },
    riders,
  };
}

/** Opened in a new tab so a half-finished quotation is still there when the agent comes back. */

export default function Home() {
  const [state, setStateRaw] = useState<FormState>(INITIAL);
  const plan = getPlan(state.planCode)!;

  /**
   * Switching plan resets variant and riders so stale codes never leak across plans, and
   * either switch clamps the age and the sum assured into what the new variant sells — so
   * arriving at ไลฟ์เทรเชอร์ from a one-million quote lands on its ten-million minimum
   * instead of on a figure it cannot issue.
   */
  const setState = (next: FormState) => {
    if (next.bundleCode) {
      const b = getBundle(next.bundleCode)!;
      const range = bundleAgeRange(b);
      const age = next.age === "" ? "" : Math.min(Math.max(next.age, range.min), range.max);
      setStateRaw({ ...next, planCode: b.planCode, variant: b.variant, age });
      return;
    }
    if (next.planCode !== state.planCode) {
      const p = getPlan(next.planCode)!;
      next = { ...next, variant: p.rates.base.variants[0], riders: {}, basis: "sumAssured" };
    }
    if (next.planCode !== state.planCode || next.variant !== state.variant) {
      const p = getPlan(next.planCode)!;
      if (next.age !== "") {
        const range = baseAgeRange(p.rules, next.variant, p.rates);
        next = { ...next, age: Math.min(Math.max(next.age, range.min), range.max) };
      }
      const sa = baseSumAssuredLimits(p.rules, next.variant);
      if (sa.exact) next = { ...next, sumAssured: sa.min };
      else if (next.sumAssured !== "" && next.sumAssured < sa.min) next = { ...next, sumAssured: sa.min };
    }
    setStateRaw(next);
  };

  /** The picker offers plans and bundles in one list; a bundle value carries the prefix. */
  const onPlanChange = (value: string) => {
    if (!value.startsWith(BUNDLE_PREFIX)) {
      setState({ ...state, bundleCode: null, planCode: value });
      return;
    }
    setState({ ...state, bundleCode: value.slice(BUNDLE_PREFIX.length), tier: 1, riders: {}, basis: "sumAssured" });
  };

  // availability for the form must exist even when the input is incomplete
  const availability = useMemo(() => {
    const probe: QuoteInput = {
      planCode: state.planCode, variant: state.variant, sex: state.sex, mode: state.mode,
      age: state.age === "" ? plan.rules.base.ageMin : state.age,
      sumAssured: state.sumAssured === "" ? plan.rules.base.saMin : state.sumAssured,
      riders: [],
    };
    return quote(probe).availability;
  }, [state, plan]);
  const eligibleCodes = useMemo(() => new Set(availability.filter((a) => a.eligible).map((a) => a.code)), [availability]);
  const bundle = state.bundleCode ? getBundle(state.bundleCode) : undefined;
  // A bundle prices every mode, so its own quote is taken on the annual basis and the picker is gone.
  const who = state.age === "" ? undefined : { age: state.age, sex: state.sex, mode: bundle ? ("annual" as const) : state.mode };
  const input = useMemo(
    () => (bundle && who ? bundleQuoteInput(bundle, state.tier, who) ?? null : bundle ? null : toQuoteInput(state, eligibleCodes)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, eligibleCodes, bundle],
  );
  const result = useMemo(
    () => (bundle ? (who ? quoteBundle(bundle, state.tier, who) ?? null : null) : input ? quote(input) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, bundle, state.tier, state.age, state.sex, state.mode],
  );
  // Every plan quotes all three instalments, not only the one the picker is showing.
  const modePremiums = useMemo(
    () => {
      if (bundle) return who ? bundleModePremiums(bundle, state.tier, { age: who.age, sex: who.sex }) : undefined;
      return input ? quoteModePremiums(input) : undefined;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle, state.tier, state.age, state.sex, input],
  );

  return (
    <AppShell>
    <main className="mx-auto max-w-5xl p-4 pt-16 sm:p-6 sm:pt-16 lg:pt-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">คำนวณเบี้ยประกัน</h1>
        {/* The way into the back office is to type /admin, which the owner asked for: this
            page is what an agent shows a customer across a table, and a link on it labelled
            หลังบ้าน is an invitation to press it. The door is unchanged — /admin still asks
            for the PIN — only the sign is gone. */}
      </div>
      <p className="mb-4 text-sm text-[var(--op-mute)]">{bundle ? BUNDLE_PICKER_NAME[bundle.code] ?? `ชุด${bundle.name}` : PICKER_NAME[state.planCode] ?? plan.planLabel ?? plan.rates.planName}</p>
      <ExpiryBanner expired={result?.meta.expired ?? false} expiresOn={plan.rates.expiresOn} />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--op-line)] bg-[var(--op-panel)] p-4">
          {bundle ? (
            <BundleForm state={state} bundle={bundle} plans={pickerPlans()} bundles={pickerBundles()}
                        onChange={setState} onPlanChange={onPlanChange} />
          ) : (
            <QuoteForm state={state} plan={plan} plans={pickerPlans()} bundles={pickerBundles()}
                       availability={availability} onChange={setState} onPlanChange={onPlanChange} />
          )}
        </div>
        <div className="rounded-lg border border-[var(--op-line)] bg-[var(--op-panel)] p-4">
          {result && input ? (
            <QuoteResultPanel result={result} mode={input.mode}
                              derivedSumAssured={input.basis === "premium"} modePremiums={modePremiums} />
          ) : (
            <p className="text-sm text-[var(--op-mute)]">กรอกอายุและจำนวนเงินเอาประกันภัย (หรือเบี้ยที่ต้องการ) เพื่อคำนวณ</p>
          )}
        </div>
      </div>
    </main>
    </AppShell>
  );
}
