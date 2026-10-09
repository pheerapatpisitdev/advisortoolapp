"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { markPdfReady } from "@/lib/quote-pdf/prepare";
import type { Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht, formatSatang } from "@/calc/money";
import { PER, displayPremium, perDayText } from "@/lib/legacy-cta";
import type { LifeProtectRider, LifeProtectTable } from "@/lib/lifeprotect-table";
import {
  addModes, cashAt, deathBenefitOf, riderDueByYear, lifeProtectModes, medicalModes, medicalPlansAt, needsParent, payYears, pickedRider, riderModes, riderSoldAt,
  riderWaiveYears, termAt, totalModes, type Payer, type RiderPick,
} from "@/lib/lifeprotect-quote";
import { cashProjection } from "@/lib/cash-projection";
import { CashValueChart } from "@/components/lifeprotect/CashValueChart";
import { CashValueTable } from "@/components/lifeprotect/CashValueTable";
import {
  childPriceNote, lifeProtectCashText, lifeProtectFootnote, lifeProtectQuoteText, payerWords as payerWordsFor,
  riderWords, waiverNote, type LifeProtectAge,
} from "@/lib/lifeprotect-cta";
import { cardPath, valueTablePath, type CardRiders } from "@/lib/card-link";
import { deathBenefitRows } from "@/lib/death-benefit";
import { ContactButtons } from "@/components/sales/ContactButtons";
import { LIFEPROTECT_LINK_SUMS, LIFEPROTECT_SUMS, lifeProtectSumNear, planInitialFromTable } from "@/lib/quote-pdf/pages";
import { getPlan } from "@/calc/plans/registry";
import { Highlighted } from "@/components/Highlighted";
import { largestAt } from "@/lib/highlighter";
import { PanelPhoto } from "@/components/sales/PanelPhoto";
import { BudgetBox, BudgetOutcome, BudgetSwitch } from "@/components/sales/BudgetBox";
import { budgetFit, type PageBudget } from "@/lib/budget-sum";
import { LegacyHeadline, PremiumSummary } from "@/components/sales/PremiumSummary";
import { legacyFromDeath } from "@/lib/legacy-headline";

// the nearest stop to a million, which is no longer one itself
const SUM_START_INDEX = LIFEPROTECT_SUMS.indexOf(950_000);
/** The budget the field opens on when a visitor switches to naming one: the figure the agency hears most. */
const BUDGET_START: PageBudget = { baht: 100_000, per: "year" };
/** A sum on a term button, short enough for a third of a phone screen: "5.8 ล้าน", "8.5 แสน". */
const sumShort = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(2)} ล้าน` : `${+(n / 100_000).toFixed(1)} แสน`);
/**
 * The term the page opens on: the one that puts the smallest number in front of a stranger.
 * The other two are a tap away with their own prices already on them, so opening cheap costs
 * nothing — and the figure the hero quotes comes from this term too, so the page does not
 * promise one price above the fold and show another below it.
 */
const TERM_START = "WLF99H";
/**
 * The age the page opens on. A visitor arriving from an ad sees a real price before touching
 * anything — an empty card asking to be filled in is one more thing to do before the number
 * they came for. 35 is the age the hero already quotes and the middle of who buys this.
 */
const AGE_START = 35;
/** The parent the page opens on when a child's rider needs one: the age the page opens on itself. */
const PAYER_START: Payer = { sex: "M", age: AGE_START };

/**
 * The ages a rider is sold at, as the button and its popup say them. A rider a parent can
 * also buy for a child has two windows with a gap between them, and both are said.
 */
function riderAges(r: LifeProtectRider): string {
  return r.child ? `0-${r.child.ageMax}, ${r.ageMin}-${r.ageMax} ปี` : `${r.ageMin}-${r.ageMax} ปี`;
}

/** A flavour's name with the contract's own name taken off the front: "ฟิต", "บียอนด์". */
function optionWord(riderName: string, optionName: string): string {
  return optionName.replace(riderName.split(" (")[0], "").trim() || optionName;
}

/**
 * What a button means, shown while the pointer rests on it.
 *
 * A rider's name is four syllables that tell a stranger nothing, and the panel has no room
 * for the sentence that would. On a mouse there is a spare gesture for exactly this, so the
 * explanation lives here rather than as prose nobody reads before they have a question.
 *
 * From `sm` up only: a phone has no hover, and a popup opened by the tap that picks the
 * rider would cover the flavours it is asking about. A phone is left with the line under the
 * price, which says the one thing it would be costly to assume — that none of this money
 * reaches the family.
 *
 * It is anchored to whichever edge of the button keeps it inside the panel, and takes no
 * pointer events, so it can never sit between the cursor and the button underneath it.
 */
function Hint({ align, children }: { align: "left" | "right"; children: ReactNode }) {
  return (
    <span
      role="tooltip"
      className={`pointer-events-none absolute top-full z-20 mt-2 hidden w-64 rounded-sm border border-[var(--lg-hair)]
        bg-[var(--lg-raise)] p-3 text-left shadow-xl sm:group-hover:block sm:group-focus-within:block ${
        align === "left" ? "left-0" : "right-0"
      }`}
    >
      {children}
    </span>
  );
}

export interface LifeProtectCalculatorProps {
  /** the rates and factors the browser prices from; the engine never leaves the server */
  table: LifeProtectTable;
  /** pin a copy of the contact buttons to the bottom of a phone screen */
  sticky?: boolean;
}

/**
 * The customer's calculator for the base plan on its own. Four choices — sum, term, age, sex —
 * and every figure on the card follows from them at once, in the browser, from the table.
 */
export function LifeProtectCalculator({ table, sticky = false }: LifeProtectCalculatorProps) {
  const AGES = useMemo(
    () => Array.from({ length: table.ageMax - table.ageMin + 1 }, (_, i) => table.ageMin + i),
    [table.ageMin, table.ageMax],
  );
  // the slider's stops; a link from the chat can add one more, a sum the steps skip (a million)
  const [sums, setSums] = useState<readonly number[]>(LIFEPROTECT_SUMS);
  const [sumIndex, setSumIndex] = useState(SUM_START_INDEX);
  // by what the visitor can pay instead of by a sum: the page finds the biggest sum that fits
  const [byBudget, setByBudget] = useState(false);
  const [budget, setBudget] = useState<PageBudget>(BUDGET_START);
  // the sum as it is being typed; null once it has landed on a step
  const [sumTyped, setSumTyped] = useState<string | null>(null);
  const settleSum = () => {
    const digits = sumTyped?.replace(/\D/g, "") ?? "";
    if (digits !== "") setSumIndex(sums.indexOf(lifeProtectSumNear(Number(digits))));
    setSumTyped(null);
  };
  const [variant, setVariant] = useState(TERM_START);
  const [age, setAge] = useState<LifeProtectAge>(AGE_START);
  const [sex, setSex] = useState<Sex>("M");
  // the PDF print waits for this: it is true once the link's figures (if any) are in state
  const [seeded, setSeeded] = useState(false);

  // A link from the chat opens the figures it quotes. Read here, in the browser, so the page
  // itself stays static; no query, or one this page cannot show, leaves the start values.
  useEffect(() => {
    const initial = planInitialFromTable(new URLSearchParams(window.location.search), {
      sums: LIFEPROTECT_LINK_SUMS, variants: table.terms.map((t) => t.variant), ageMin: table.ageMin, ageMax: table.ageMax,
    });
    if (initial) {
      const stops = LIFEPROTECT_SUMS.includes(initial.sumAssured)
        ? LIFEPROTECT_SUMS
        : [...LIFEPROTECT_SUMS, initial.sumAssured].sort((a, b) => a - b);
      setSums(stops);
      setSumIndex(stops.indexOf(initial.sumAssured));
      setVariant(initial.variant);
      setAge(initial.age as typeof age);
      setSex(initial.sex);
    }
    setSeeded(true);
  }, [table]);
  useEffect(() => {
    if (seeded) markPdfReady();
  }, [seeded]);
  /** the one rider the page is quoting beside the plan, or none — the company sells one or the other */
  const [pick, setPick] = useState<RiderPick | null>(null);
  /** the parent paying for a child, asked only when a child's rider is priced off them */
  const [payer, setPayer] = useState<Payer>(PAYER_START);
  /** the medical plan quoted beside the plan, or none; it stacks with either waiver */
  const [medicalPlan, setMedicalPlan] = useState<number | null>(null);

  const term = termAt(table, variant);
  // the picker only offers ages the plan takes, so a number here is always one of them
  const ageNum = typeof age === "number" ? age : undefined;
  const inRange = ageNum !== undefined;
  /**
   * What the budget buys on a term: the biggest sum on the slider's list that fits, priced
   * forwards by the page's own function. Undefined is a budget under the plan's smallest sum,
   * which is said in words and never lifted to it.
   */
  const budgetOn = (variantCode: string) =>
    byBudget && ageNum !== undefined && !table.expired
      ? budgetFit(sums, (s) => lifeProtectModes(table, termAt(table, variantCode), { sex, age: ageNum, sumAssured: s }), budget)
      : undefined;
  const fit = budgetOn(variant);
  const budgetShort = byBudget && ageNum !== undefined && !table.expired && !fit;
  const sumAssured = fit ? fit.sum : sums[sumIndex];
  const who = ageNum !== undefined && !budgetShort ? { sex, age: ageNum, sumAssured } : undefined;

  const modes = who ? lifeProtectModes(table, term, who) : undefined;
  const annual = modes?.find((m) => m.mode === "annual");

  /**
   * A rider is written over its own ages, which are narrower than the plan's. An age outside
   * them leaves the choice standing but unquoted rather than silently switching it off: the
   * button greys out and says so, and moving the age picker back restores it.
   */
  const riderOffered = (r: LifeProtectRider) => ageNum !== undefined && riderSoldAt(r, ageNum);
  const chosen = pickedRider(table, pick ?? undefined);
  const picked = chosen && riderOffered(chosen.rider) ? chosen : undefined;
  // a child's พีบี is priced off the parent paying, so the page asks for them
  const askPayer = picked !== undefined && ageNum !== undefined && needsParent(picked.rider, ageNum);
  const payerFor = askPayer ? payer : undefined;
  const riderPrice = who && picked && annual && !table.expired
    ? riderModes(table, term, who, picked, annual.total, payerFor)
    : undefined;

  /**
   * The medical rider's plans are capped by age, so a plan picked at one age may be more than
   * the next age may buy. It walks down to the largest the age may have rather than dropping
   * out, and moving the age back restores the plan that was picked.
   */
  const medical = table.medical;
  const medicalPlans = medical && ageNum !== undefined ? medicalPlansAt(table, medical, ageNum) : [];
  const medicalAt = medicalPlan === null ? undefined : [...medicalPlans].reverse().find((p) => p <= medicalPlan);
  const medicalPrice = medical && ageNum !== undefined && medicalAt !== undefined && !table.expired
    ? medicalModes(table, medical, ageNum, medicalAt)
    : undefined;
  const medicalName = medical && medicalAt !== undefined
    ? `${medical.name} แผน ${medicalAt.toLocaleString("en-US")}`
    : undefined;

  /**
   * What the customer actually pays, plan and riders together. The instalment is settled on
   * this rather than on the plan alone, because the company's monthly floor is a floor on
   * the whole premium — a plan just under it becomes payable monthly once a rider is added.
   */
  const paid = modes ? totalModes(table, modes, addModes(riderPrice, medicalPrice)) : undefined;
  const headline = displayPremium(paid, table.expired);
  const paidAnnual = paid?.find((m) => m.mode === "annual");
  // the figure in the largest type stays the plan's own price; what the rider adds and the
  // two together are spelled out under it
  const basePart = headline && modes ? modes.find((m) => m.mode === headline.mode) : undefined;
  const riderPart = headline && riderPrice ? riderPrice.find((m) => m.mode === headline.mode) : undefined;
  const medicalPart = headline && medicalPrice ? medicalPrice.find((m) => m.mode === headline.mode) : undefined;
  /** each rider's share of the headline, one line apiece under the plan's own price */
  const riderLines = [
    ...(picked && riderPart ? [{ name: picked.option.name, own: riderPart }] : []),
    ...(medicalName && medicalPart ? [{ name: medicalName, own: medicalPart }] : []),
  ];
  // smallest instalment upward, so the block under the headline reads day, half-year, year
  const others = (paid ?? [])
    .filter((m) => m.mode !== headline?.mode && !m.belowMinimum)
    .sort((a, b) => a.total - b.total);
  const death = who ? deathBenefitOf(table, who.age, sumAssured) : undefined;
  const cash = who ? cashAt(term, sex, who.age, sumAssured, table.ageMin) : [];
  /**
   * Every figure below scales straight off the sum assured, so dragging the slider redraws
   * the chart and the table without asking the server for anything.
   */
  const factors = who ? term.schedule[sex][who.age - table.ageMin] : null;
  const riderAnnual = riderPrice?.find((m) => m.mode === "annual")?.total;
  const projection = who && death && factors
    ? cashProjection({
        factors, age: who.age, sumAssured,
        annualSatang: table.expired || !annual ? null : annual.total,
        payYears: payYears(term, who.age), death, topUp: table.topUp,
        // the riders' premium, which the table shows in a column of its own (owner, 2026-10-06)
        riderDue: riderDueByYear(
          table, term, who.age, factors.length,
          picked && riderAnnual !== undefined ? { rider: picked.rider, annual: riderAnnual } : undefined,
          medicalPrice && medicalAt !== undefined ? { plan: medicalAt } : undefined,
        ),
      })
    : undefined;
  const tableCaption = who
    ? `ทุนประกัน ${sumAssured.toLocaleString("en-US")} บาท · ${sex === "M" ? "ชาย" : "หญิง"} `
      + `${who.age === 0 ? "แรกเกิด" : `${who.age} ปี`} · ${term.short}`
      + (annual && paidAnnual && !table.expired
        ? ` · เบี้ย ${formatBaht(annual.total)} บาท/ปี`
          // a rider's premium can move or stop from one year to the next, so the caption
          // says which year its figure is; the table carries it in a column of its own
          + (paidAnnual.total > annual.total
            ? ` · สัญญาเพิ่มเติมปีแรก ${formatBaht(paidAnnual.total - annual.total)} บาท` : "")
          + (medicalPrice ? " · เบี้ย MEB ตามอัตราปัจจุบันของแต่ละอายุ" : "")
        : "")
    : "";

  /**
   * The riders the price includes, written into the card links so the pictures show what the
   * page shows (owner, 2026-10-06). Only priced ones: a rider picked at an age it is not sold
   * at is not in the figures, so it is not in the picture either.
   */
  const cardRiders: CardRiders | undefined = picked && riderPart || medicalPart
    ? {
        ...(picked && riderPart ? { waiver: { code: picked.rider.code, option: picked.option.code } } : {}),
        ...(picked && riderPart && payerFor ? { payer: payerFor } : {}),
        ...(medicalPart && medicalAt !== undefined ? { medical: medicalAt } : {}),
      }
    : undefined;
  // the same figures the card is showing, or nothing: a copied quote must never say more than the page
  const card = who && headline
    ? cardPath({
        kind: "plan", planCode: table.planCode, variant, age: who.age, sex, sumAssured, mode: headline.mode,
        ...(cardRiders ? { riders: cardRiders } : {}),
      })
    : undefined;
  // the value table drawn the same way, from the same arrangement — and offered only where
  // there is a table to draw, so a button never points at a picture the engine would refuse
  const tableCard = who && projection
    ? valueTablePath({
        kind: "plan", planCode: table.planCode, variant: variant, age: who.age, sex, sumAssured,
        ...(cardRiders ? { riders: cardRiders } : {}),
      })
    : undefined;
  // who the rider's price was read off, said beside its name wherever the price is shown
  const payerWords = payerWordsFor(payerFor);
  const quoteText = who && headline && death
    ? lifeProtectQuoteText({
      sumAssured, termLabel: term.label, age: who.age, sex, modes: [headline, ...others], death, cash,
      parts: basePart && riderLines.length > 0
        ? {
            base: basePart,
            riders: riderLines.map((l, i) => (i === 0 && picked && riderPart ? { ...l, name: l.name + payerWords } : l)),
          }
        : undefined,
    })
    : undefined;
  const cashText = quoteText ? lifeProtectCashText(cash) : undefined;
  const secondCopy = cashText ? { text: cashText, full: "คัดลอกมูลค่าขายคืน", compact: "ขายคืน" } : undefined;

  /**
   * The figure on a term button: that term's yearly premium, once there is an age. Yearly on
   * every button, whatever the card headlines — a row that mixed months and years (because
   * one term fell under the monthly floor) could not be compared at a glance.
   */
  const buttonPrice = (v: string): string | undefined => {
    // naming a budget, the button says what that money buys on the term
    if (byBudget && ageNum !== undefined && !table.expired) {
      const f = budgetOn(v);
      return f ? `ทุน ${sumShort(f.sum)}` : "ไม่ถึงทุนต่ำสุด";
    }
    if (!who || table.expired) return undefined;
    const other = termAt(table, v);
    const yearly = lifeProtectModes(table, other, who)?.find((m) => m.mode === "annual");
    if (!yearly) return undefined;
    // a rider is priced off the plan's premium and off the term's own paying years, so a
    // button that quoted the plan alone would not be the two terms' prices side by side
    const withRider = picked ? riderModes(table, other, who, picked, yearly.total, payerFor) : undefined;
    // the medical premium is the same on every term, but leaving it off would make the
    // button disagree with the total under it
    const total = yearly.total + (withRider?.find((m) => m.mode === "annual")?.total ?? 0)
      + (medicalPrice?.find((m) => m.mode === "annual")?.total ?? 0);
    return `${formatBaht(total)}${PER.annual}`;
  };

  /**
   * How many years of premium a rider would take over, for the note in its popup: the term's
   * paying years, or for a child's พีบี only until the child turns 25.
   */
  const waiveYears = (r: LifeProtectRider) => (ageNum !== undefined ? riderWaiveYears(r, term, ageNum) : undefined);


  /**
   * What is paid, in the box every sales calculator shares (owner, 2026-10-06), with what
   * the headline instalment is made of at its foot when riders are part of it: contract by
   * contract, to the satang so the lines add up. The contract's full name is long enough to
   * wrap on a phone; the figure beside it never should, so it keeps the width it needs.
   */
  const summary = paid && headline ? (
    <PremiumSummary modes={paid} main={headline.mode}>
      {basePart && riderLines.length > 0 && (
        <>
          <div className="text-xs text-[var(--bot-navy)] opacity-80">แยกตามสัญญา · {PAY_MODE_LABEL[headline.mode]}</div>
          <div className="mt-1.5 space-y-1">
            {[{ name: "สัญญาหลัก", own: basePart }, ...riderLines].map((l, i) => (
              <div key={l.name} className="flex items-baseline justify-between gap-3 text-sm text-[var(--bot-navy)]">
                <span className="min-w-0">{l.name}{i === 1 && picked && riderPart ? payerWords : ""}</span>
                <span className="shrink-0 whitespace-nowrap tabular-nums">
                  {i > 0 ? "+" : ""}{formatSatang(l.own.total)} บาท
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </PremiumSummary>
  ) : null;

  return (
    <div className="space-y-6">
      <div className="space-y-6 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
        <BudgetSwitch
          byBudget={byBudget}
          onChange={(on) => {
            // leaving the budget keeps the sum it bought, so the sum field does not jump back
            if (!on && fit) setSumIndex(sums.indexOf(fit.sum));
            setByBudget(on);
          }}
        />
        {byBudget && (
          <div>
            <BudgetBox id="lp-budget" budget={budget} onChange={setBudget} />
            {ageNum !== undefined && (
              <BudgetOutcome
                budget={budget} fit={fit} minMonthly={table.minMonthly}
                least={(() => {
                  const m = lifeProtectModes(table, term, { sex, age: ageNum, sumAssured: LIFEPROTECT_SUMS[0] })
                    ?.find((x) => x.mode === (budget.per === "month" ? "monthly" : "annual"));
                  return m ? { sum: LIFEPROTECT_SUMS[0], total: m.total } : undefined;
                })()}
              />
            )}
          </div>
        )}
        {!byBudget && (
        <div>
          <label htmlFor="lp-sum-typed" className="block text-sm text-[var(--lg-mute)]">ทุนประกัน</label>
          {/* the figure itself is the field: the slider goes near, typing lands on the exact sum */}
          <div className="lg-figure mt-1.5 flex items-baseline gap-2 text-3xl tabular-nums">
            <input
              id="lp-sum-typed" type="text" inputMode="numeric" autoComplete="off"
              value={sumTyped ?? sumAssured.toLocaleString("en-US")}
              // a tap starts a fresh number (a click's mouseup undoes select(), so typing would
              // land after the old digits); leaving it empty puts the old sum back
              placeholder={sumAssured.toLocaleString("en-US")}
              onFocus={() => setSumTyped("")}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                setSumTyped(digits === "" ? "" : Number(digits).toLocaleString("en-US"));
              }}
              onBlur={settleSum}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              className="lg-metal-text w-[11ch] border-b border-dashed border-[var(--lg-hair)] bg-transparent outline-none focus:border-[var(--lg-gold)]"
            />
            <span className="text-lg text-[var(--lg-mute)]">บาท</span>
          </div>
          <p className="mt-1 text-xs text-[var(--lg-mute)] opacity-70">แตะตัวเลขเพื่อพิมพ์ทุน · ขั้นละ 150,000</p>
          <input
            id="lp-sum" aria-label="ทุนประกัน" type="range" min={0} max={sums.length - 1} step={1} value={sumIndex}
            onChange={(e) => setSumIndex(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--lg-gold)]"
          />
          <div className="mt-1 flex justify-between text-xs text-[var(--lg-mute)] opacity-70">
            <span>5 แสน</span>
            <span>50 ล้าน</span>
          </div>
          {/* the doubled sum sits under the sum being chosen, because it is the reason to choose
              it; once the insured is past the booster age the line tells the plain truth instead */}
          {ageNum !== undefined && ageNum >= table.boosterBeforeAge ? (
            <p className="mt-4 text-sm leading-relaxed text-[var(--lg-mute)]">
              ครอบครัวได้รับ{" "}
              <span className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">{sumAssured.toLocaleString("en-US")}</span> บาท
              {" "}· ตั้งแต่อายุ {table.boosterBeforeAge} คุ้มครองเท่าทุน
            </p>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-[var(--lg-mute)]">
              เสียชีวิตก่อนอายุ {table.boosterBeforeAge} ครอบครัวได้{" "}
              <span className="lg-figure text-lg tabular-nums text-[var(--lg-gold)]">
                {deathBenefitOf(table, 0, sumAssured).sumBefore.toLocaleString("en-US")}
              </span>{" "}
              บาท <span className="opacity-70">(2 เท่าของทุน)</span>
            </p>
          )}
        </div>
        )}

        <div>
          <span className="block text-sm text-[var(--lg-mute)]">งวดชำระเบี้ย</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {table.terms.map((t) => {
              const on = t.variant === variant;
              const price = buttonPrice(t.variant);
              return (
                <button
                  key={t.variant} type="button" onClick={() => setVariant(t.variant)} aria-pressed={on}
                  className={`rounded-sm border px-2 py-2.5 text-center transition-colors ${
                    on ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                  }`}
                >
                  <span className="block text-sm">{t.short}</span>
                  {price && <span className="mt-0.5 block text-xs tabular-nums opacity-80">{price}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="lp-age" className="block text-sm text-[var(--lg-mute)]">อายุ</label>
            {/* a picker rather than a number field: on a phone it opens the wheel instead of
                the keypad, and there is no way to arrive at an age nobody is */}
            <select
              id="lp-age" value={age}
              onChange={(e) => setAge(e.target.value === "over" ? "over" : Number(e.target.value))}
              className="mt-1.5 w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-lg tabular-nums text-[var(--lg-white)]"
            >
              {AGES.map((a) => <option key={a} value={a}>{a === 0 ? "แรกเกิด" : `${a} ปี`}</option>)}
              <option value="over">{table.ageMax + 1} ปีขึ้นไป</option>
            </select>
          </div>
          <div>
            <span className="block text-sm text-[var(--lg-mute)]">เพศ</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["M", "F"] as Sex[]).map((s) => (
                <button
                  key={s} type="button" onClick={() => setSex(s)} aria-pressed={sex === s}
                  className={`rounded-sm border py-2.5 text-sm transition-colors ${
                    sex === s ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                  }`}
                >
                  {s === "M" ? "ชาย" : "หญิง"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {table.riders.length > 0 && (
          <div>
            <span className="block text-sm text-[var(--lg-mute)]">สัญญาเพิ่มเติม · เลือกได้อย่างใดอย่างหนึ่ง</span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <button
                type="button" onClick={() => setPick(null)} aria-pressed={pick === null}
                className={`rounded-sm border px-2 py-2.5 text-center transition-colors ${
                  pick === null ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                }`}
              >
                <span className="block text-sm">ไม่เอา</span>
                <span className="mt-0.5 block text-xs opacity-70">เฉพาะแบบหลัก</span>
              </button>
              {table.riders.map((r, i) => {
                const on = pick?.code === r.code;
                const offered = riderOffered(r);
                const words = riderWords(r.name);
                return (
                  <div key={r.code} className="group relative">
                    <button
                      type="button" disabled={!offered} aria-pressed={on}
                      onClick={() => setPick({ code: r.code, option: r.options[0].code })}
                      className={`h-full w-full rounded-sm border px-2 py-2.5 text-center transition-colors ${
                        on ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                      }${offered ? "" : " opacity-40"}`}
                    >
                      <span className="block text-sm">{words.short}</span>
                      {/* what the contract does, or the ages it is written over when this one is not */}
                      <span className="mt-0.5 block text-xs opacity-70">
                        {offered ? words.what : riderAges(r)}
                      </span>
                    </button>
                    <Hint align={i === 0 ? "left" : "right"}>
                      <span className="block text-sm font-medium text-[var(--lg-white)]">{r.name}</span>
                      {r.what && (
                        <span className="mt-1 block text-xs leading-relaxed text-[var(--lg-mute)]">{r.what}</span>
                      )}
                      {r.options.map((o) => o.covers && (
                        <span key={o.code} className="mt-1.5 block text-xs leading-relaxed text-[var(--lg-mute)]">
                          <span className="text-[var(--lg-gold)]">{optionWord(r.name, o.name)}</span> · {o.covers}
                        </span>
                      ))}
                      <span className="mt-2 block border-t border-[var(--lg-panel-line)] pt-2 text-xs text-[var(--lg-mute)]">
                        รับอายุ {riderAges(r)}
                        {offered && waiveYears(r) ? ` · ยกเว้นเบี้ยที่เหลืออีก ${waiveYears(r)} ปี` : ""}
                      </span>
                      <span className="mt-1 block text-xs text-[var(--lg-mute)] opacity-75">
                        ช่วยเรื่องการชำระเบี้ย ไม่ได้เพิ่มทุนที่ครอบครัวได้รับ
                      </span>
                    </Hint>
                  </div>
                );
              })}
            </div>
            {chosen && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {chosen.rider.options.map((o, i) => {
                  const on = pick?.option === o.code;
                  return (
                    <div key={o.code} className="group relative">
                      <button
                        type="button" aria-pressed={on}
                        onClick={() => setPick({ code: chosen.rider.code, option: o.code })}
                        className={`h-full w-full rounded-sm border px-2 py-2 text-center text-sm transition-colors ${
                          on ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                        }`}
                      >
                        {optionWord(chosen.rider.name, o.name)}
                      </button>
                      {o.covers && (
                        <Hint align={i === 0 ? "left" : "right"}>
                          <span className="block text-sm font-medium text-[var(--lg-white)]">{o.name}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-[var(--lg-mute)]">คุ้มครอง{o.covers}</span>
                        </Hint>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {askPayer && picked.rider.child && (
              <div className="mt-3">
                <label htmlFor="lp-payer-age" className="block text-sm text-[var(--lg-mute)]">
                  ผู้ชำระเบี้ย (พ่อหรือแม่)
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-3">
                  <select
                    id="lp-payer-age" value={payer.age}
                    onChange={(e) => setPayer({ ...payer, age: Number(e.target.value) })}
                    className="w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-lg tabular-nums text-[var(--lg-white)]"
                  >
                    {Array.from(
                      { length: picked.rider.child.payerMax - picked.rider.child.payerMin + 1 },
                      (_, i) => picked.rider.child!.payerMin + i,
                    ).map((a) => <option key={a} value={a}>{a} ปี</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    {(["M", "F"] as Sex[]).map((s) => (
                      <button
                        key={s} type="button" onClick={() => setPayer({ ...payer, sex: s })} aria-pressed={payer.sex === s}
                        className={`rounded-sm border py-2.5 text-sm transition-colors ${
                          payer.sex === s ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                        }`}
                      >
                        {s === "M" ? "ชาย" : "หญิง"}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--lg-mute)] opacity-80">
                  ราคาพีบีคิดจากอายุและเพศของผู้ชำระเบี้ย · ยกเว้นเบี้ยจนเด็กอายุ 25
                </p>
              </div>
            )}
            {chosen && !picked && (
              <p className="mt-2 text-sm leading-relaxed text-[var(--lg-gold)]">
                {riderWords(chosen.rider.name).short} รับอายุ {riderAges(chosen.rider)}
                {" "}· อายุนี้จึงยังไม่ได้รวมอยู่ในราคา
              </p>
            )}
          </div>
        )}

        {medical && (
          <div>
            <span className="block text-sm text-[var(--lg-mute)]">ค่ารักษาพยาบาล (MEB) · เลือกแผน</span>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {[null, ...medical.plans].map((p) => {
                const on = p === null ? medicalPlan === null : medicalAt === p;
                const offered = p === null || medicalPlans.includes(p);
                return (
                  <button
                    key={p ?? "none"} type="button" disabled={!offered} aria-pressed={on}
                    onClick={() => setMedicalPlan(p)}
                    className={`rounded-sm border px-1 py-2.5 text-center text-sm tabular-nums transition-colors ${
                      on ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                    }${offered ? "" : " opacity-40"}`}
                  >
                    {p === null ? "ไม่เอา" : p.toLocaleString("en-US")}
                  </button>
                );
              })}
            </div>
            {medicalPlan !== null && medicalAt === undefined && (
              <p className="mt-2 text-sm leading-relaxed text-[var(--lg-gold)]">
                MEB รับอายุ {medical.ageMin} - {medical.ageMax} ปี · อายุนี้จึงยังไม่ได้รวมอยู่ในราคา
              </p>
            )}
            {medicalAt !== undefined && medicalAt !== medicalPlan && (
              <p className="mt-2 text-sm leading-relaxed text-[var(--lg-gold)]">
                อายุนี้ซื้อได้สูงสุดแผน {medicalAt.toLocaleString("en-US")}
              </p>
            )}
            {medicalAt !== undefined && (
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--lg-mute)] opacity-80">
                เบี้ย MEB เป็นเบี้ยปีนี้ ต่ออายุปีต่อปีและปรับตามอายุ
              </p>
            )}
          </div>
        )}
      </div>

      {budgetShort ? null : !inRange || !modes ? (
        <div className="rounded-sm border border-[var(--lg-gold)] bg-[var(--lg-panel)] px-5 py-7 text-center text-sm leading-relaxed text-[var(--lg-white)]">
          แบบนี้รับถึงอายุ {table.ageMax} ปี ทักมาให้เราช่วยหาแบบที่เหมาะกับคุณ
        </div>
      ) : (
        <div className="relative space-y-5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] p-5">
          <PanelPhoto />
          {headline && annual && basePart ? (
            <div>
              {/* led by what the family inherits; the premium, riders and all, is the box's (owner, 2026-10-06) */}
              <LegacyHeadline legacy={legacyFromDeath(death!, sumAssured)} perDay={paidAnnual ? perDayText(paidAnnual.total) : undefined} />
              <div className="mt-3">{summary}</div>
              {/* neither waiver pays a baht to the family; they carry on paying the
                  premium. Said here so the block below is not read as theirs */}
              {picked && riderPart && (
                <p className="mt-2.5 text-xs leading-relaxed text-[var(--lg-mute)] opacity-80">
                  {waiverNote(picked.rider.name)}
                </p>
              )}
            </div>
          ) : (
            <div className="text-sm font-medium text-[var(--lg-gold)]">ขอราคาปัจจุบันได้ทางแชทด้านล่าง</div>
          )}

          {death && (
            <div className="pt-1">
              <hr className="lg-rule" />
              <div className="pt-4 text-sm text-[var(--lg-mute)]">ครอบครัวได้รับเมื่อเสียชีวิต</div>
              <dl className="mt-2 space-y-2">
                {/* the most the family can receive is marked, as on the quote card */}
                {deathBenefitRows(death).map((row, at, all) => {
                  const mark = at === largestAt(all.map((r) => r.amount));
                  const amount = `${row.amount.toLocaleString("en-US")} บาท`;
                  return (
                    <div key={row.label} className="flex items-baseline justify-between gap-3">
                      <dt className="text-sm text-[var(--lg-mute)]">{mark ? <Highlighted>{row.label}</Highlighted> : row.label}</dt>
                      <dd className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">
                        {mark ? <Highlighted>{amount}</Highlighted> : amount}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}

          {/* the milestone list of surrender values is gone (owner, 2026-10-06): the chart
              and the year-by-year table already carry every one of them */}
          {projection && (
            <div className="pt-1">
              <hr className="lg-rule" />
              {/* a new term, age or sex is a different contract, so the readout goes back
                  to its break-even year; dragging the sum alone keeps the year in view */}
              <CashValueChart key={`${variant}-${sex}-${who!.age}`} projection={projection} age={who!.age} />
              <CashValueTable
                projection={projection}
                caption={tableCaption}
                cardPath={tableCard}
                planName={getPlan(table.planCode)?.planLabel}
              />
            </div>
          )}

          {ageNum !== undefined && childPriceNote(ageNum) && (
            <p className="text-sm leading-relaxed text-[var(--lg-gold)]">{childPriceNote(ageNum)}</p>
          )}

          <p className="border-t border-[var(--lg-panel-line)] pt-4 text-xs leading-[1.8] text-[var(--lg-mute)] opacity-80">
            {lifeProtectFootnote(Boolean(medicalPart))}
          </p>
        </div>
      )}

      <ContactButtons copyText={quoteText} secondCopy={secondCopy} cardPath={card} tableCardPath={tableCard} />

      {sticky && (quoteText || card) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden">
          <ContactButtons copyText={quoteText} secondCopy={secondCopy} cardPath={card} tableCardPath={tableCard} compact />
        </div>
      )}
    </div>
  );
}
