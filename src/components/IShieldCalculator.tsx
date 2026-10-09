"use client";
import { useEffect, useMemo, useState } from "react";
import { markPdfReady } from "@/lib/quote-pdf/prepare";
import type { Sex } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { PER, displayPremium, perDayText } from "@/lib/legacy-cta";
import { cashProjection } from "@/lib/cash-projection";
import type { IShieldTable } from "@/lib/ishield-table";
import {
  cashAt, deathBenefitOf, iShieldModes, illnessBenefit, payYears, termAt, termTakes,
} from "@/lib/ishield-quote";
import { iShieldQuoteText, type IShieldAge } from "@/lib/ishield-cta";
import { cardPath, diseaseCardPath, valueTablePath } from "@/lib/card-link";
import { CashValueChart } from "@/components/lifeprotect/CashValueChart";
import { CashValueTable } from "@/components/lifeprotect/CashValueTable";
import { ContactButtons } from "@/components/sales/ContactButtons";
import { ISHIELD_SUMS, planInitialFromTable } from "@/lib/quote-pdf/pages";
import { getPlan } from "@/calc/plans/registry";
import { Highlighted } from "@/components/Highlighted";
import { PanelPhoto } from "@/components/sales/PanelPhoto";
import { BudgetBox, BudgetOutcome, BudgetSwitch } from "@/components/sales/BudgetBox";
import { budgetFit, type PageBudget } from "@/lib/budget-sum";
import { LegacyHeadline, PremiumSummary } from "@/components/sales/PremiumSummary";
import { legacyLevel } from "@/lib/legacy-headline";
import { iShieldFootnote } from "@/lib/plan-notes";

const SUM_START_INDEX = ISHIELD_SUMS.indexOf(1_000_000);
/** The budget the field opens on when a visitor switches to naming one. */
const BUDGET_START: PageBudget = { baht: 5_000, per: "month" };
/** A sum on a term button, short enough for a quarter of a phone screen: "1.5 ล้าน", "8 แสน". */
const sumShort = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(2)} ล้าน` : `${+(n / 100_000).toFixed(1)} แสน`);
/** The term the page opens on: ten years is the one the company's own proposal illustrates. */
const TERM_START = "WLCI10";
/** The age the page opens on — a real price before a visitor touches anything. */
const AGE_START = 35;

export interface IShieldCalculatorProps {
  /** the rates and factors the browser prices from; the engine never leaves the server */
  table: IShieldTable;
  /** pin a copy of the contact buttons to the bottom of a phone screen */
  sticky?: boolean;
}

/**
 * The customer's calculator for the base plan on its own. Four choices — sum, term, age, sex.
 *
 * Unlike Life Protect, a term can be unavailable at an age while others are still sold: the
 * ten-year stops at 51, the fifteen-year runs to 56. A button for a term the customer cannot
 * buy is disabled rather than hidden, so the row does not reshuffle under a thumb, and the
 * selection moves to a term they can.
 */
export function IShieldCalculator({ table, sticky = false }: IShieldCalculatorProps) {
  const AGES = useMemo(
    () => Array.from({ length: table.ageMax - table.ageMin + 1 }, (_, i) => table.ageMin + i),
    [table.ageMin, table.ageMax],
  );
  const [sumIndex, setSumIndex] = useState(SUM_START_INDEX);
  // by what the visitor can pay instead of by a sum: the page finds the biggest sum that fits
  const [byBudget, setByBudget] = useState(false);
  const [budget, setBudget] = useState<PageBudget>(BUDGET_START);
  const [wanted, setWanted] = useState(TERM_START);
  const [age, setAge] = useState<IShieldAge>(AGE_START);
  const [sex, setSex] = useState<Sex>("M");
  // the PDF print waits for this: it is true once the link's figures (if any) are in state
  const [seeded, setSeeded] = useState(false);

  // A link from the chat opens the figures it quotes. Read here, in the browser, so the page
  // itself stays static; no query, or one this page cannot show, leaves the start values.
  useEffect(() => {
    const initial = planInitialFromTable(new URLSearchParams(window.location.search), {
      sums: ISHIELD_SUMS, variants: table.terms.map((t) => t.variant), ageMin: table.ageMin, ageMax: table.ageMax,
    });
    if (initial) {
      setSumIndex(ISHIELD_SUMS.indexOf(initial.sumAssured));
      setWanted(initial.variant);
      setAge(initial.age as typeof age);
      setSex(initial.sex);
    }
    setSeeded(true);
  }, [table]);
  useEffect(() => {
    if (seeded) markPdfReady();
  }, [seeded]);

  const ageNum = typeof age === "number" ? age : undefined;
  const available = table.terms.filter((t) => ageNum !== undefined && termTakes(table, t, ageNum));
  // the wanted term when this age can have it, otherwise the nearest one it can
  const term = termAt(table, available.some((t) => t.variant === wanted) ? wanted : available[0]?.variant ?? wanted);
  const inRange = ageNum !== undefined && available.length > 0;
  /**
   * What the budget buys on a term: the biggest sum on the slider's list, within the plan's
   * limits, that fits — priced forwards by the page's own function. Undefined is a budget under
   * the plan's smallest sum, which is said in words and never lifted to it.
   */
  const budgetSums = ISHIELD_SUMS.filter((s) => s >= table.saMin && s <= table.saMax);
  const budgetOn = (variantCode: string) =>
    byBudget && ageNum !== undefined && !table.expired
      && termTakes(table, termAt(table, variantCode), ageNum)
      ? budgetFit(budgetSums, (s) => iShieldModes(table, termAt(table, variantCode), { sex, age: ageNum, sumAssured: s }), budget)
      : undefined;
  const fit = inRange ? budgetOn(term.variant) : undefined;
  const budgetShort = byBudget && inRange && !table.expired && !fit;
  const sumAssured = fit ? fit.sum : ISHIELD_SUMS[sumIndex];
  const who = inRange && !budgetShort ? { sex, age: ageNum, sumAssured } : undefined;

  const modes = who ? iShieldModes(table, term, who) : undefined;
  const headline = displayPremium(modes, table.expired);
  const annual = modes?.find((m) => m.mode === "annual");
  // smallest instalment upward, so the block under the headline reads day, half-year, year
  const others = (modes ?? [])
    .filter((m) => m.mode !== headline?.mode && !m.belowMinimum)
    .sort((a, b) => a.total - b.total);
  const benefit = illnessBenefit(table, sumAssured);
  const cash = who ? cashAt(term, sex, who.age, sumAssured, table.ageMin) : [];

  /**
   * Every figure below scales straight off the sum assured, so dragging the slider redraws
   * the chart and the table without asking the server for anything.
   */
  const factors = who ? term.schedule[sex][who.age - table.ageMin] : null;
  const projection = who && factors
    ? cashProjection({
        factors, age: who.age, sumAssured,
        annualSatang: table.expired || !annual ? null : annual.total,
        payYears: payYears(term), death: deathBenefitOf(sumAssured), topUp: table.topUp,
      })
    : undefined;
  const tableCaption = who
    ? `ทุนประกัน ${sumAssured.toLocaleString("en-US")} บาท · ${sex === "M" ? "ชาย" : "หญิง"} `
      + `${who.age === 0 ? "แรกเกิด" : `${who.age} ปี`} · ${term.label}`
      + (annual && !table.expired ? ` · เบี้ย ${formatBaht(annual.total)} บาท/ปี` : "")
    : "";

  // the same figures the card is showing, or nothing: a copied quote must never say more than the page
  const card = who && headline
    ? cardPath({ kind: "plan", planCode: table.planCode, variant: term.variant, age: who.age, sex, sumAssured, mode: headline.mode })
    : undefined;
  // the value table drawn the same way, from the same arrangement — and offered only where
  // there is a table to draw, so a button never points at a picture the engine would refuse
  const tableCard = who && projection
    ? valueTablePath({ kind: "plan", planCode: table.planCode, variant: term.variant, age: who.age, sex, sumAssured })
    : undefined;
  const quoteText = who && headline
    ? iShieldQuoteText({
        sumAssured, termLabel: term.label, age: who.age, sex, modes: [headline, ...others],
        illness: benefit, counts: table.illness, maturityAge: table.maturityAge, cash,
      })
    : undefined;

  /** The figure on a term button: that term's yearly premium, once there is an age. */
  const buttonPrice = (variant: string): string | undefined => {
    // naming a budget, the button says what that money buys on the term
    if (byBudget && ageNum !== undefined && !table.expired) {
      const f = budgetOn(variant);
      return f ? `ทุน ${sumShort(f.sum)}` : "ไม่ถึงทุนต่ำสุด";
    }
    if (!who || table.expired) return undefined;
    const yearly = iShieldModes(table, termAt(table, variant), who)?.find((m) => m.mode === "annual");
    return yearly ? `${formatBaht(yearly.total)}${PER.annual}` : undefined;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
        <BudgetSwitch
          byBudget={byBudget}
          onChange={(on) => {
            // leaving the budget keeps the sum it bought, so the sum field does not jump back
            if (!on && fit) setSumIndex(ISHIELD_SUMS.indexOf(fit.sum));
            setByBudget(on);
          }}
        />
        {byBudget && (
          <div>
            <BudgetBox id="is-budget" budget={budget} onChange={setBudget} />
            {inRange && (
              <BudgetOutcome
                budget={budget} fit={fit} minMonthly={table.minMonthly}
                least={(() => {
                  const floor = budgetSums[0];
                  const m = floor === undefined ? undefined : iShieldModes(table, term, { sex, age: ageNum, sumAssured: floor })
                    ?.find((x) => x.mode === (budget.per === "month" ? "monthly" : "annual"));
                  return m ? { sum: floor, total: m.total } : undefined;
                })()}
              />
            )}
          </div>
        )}
        {!byBudget && (
        <div>
          <label htmlFor="is-sum" className="block text-sm text-[var(--lg-mute)]">ทุนประกัน</label>
          <div className="lg-figure mt-1.5 text-3xl tabular-nums">
            <span className="lg-metal-text">{sumAssured.toLocaleString("en-US")}</span>{" "}
            <span className="text-lg text-[var(--lg-mute)]">บาท</span>
          </div>
          <input
            id="is-sum" type="range" min={0} max={ISHIELD_SUMS.length - 1} step={1} value={sumIndex}
            onChange={(e) => setSumIndex(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--lg-gold)]"
          />
          <div className="mt-1 flex justify-between text-xs text-[var(--lg-mute)] opacity-70">
            <span>1 แสน</span>
            <span>5 ล้าน</span>
          </div>
          {/* what a diagnosis pays sits under the sum being chosen, because it is the reason
              to choose it — this plan is bought for the illness, not for the funeral */}
          <p className="mt-4 text-sm leading-relaxed text-[var(--lg-mute)]">
            ตรวจพบโรคร้ายแรงระยะรุนแรง รับ{" "}
            <span className="lg-figure text-lg tabular-nums text-[var(--lg-gold)]">
              {benefit.major.toLocaleString("en-US")}
            </span>{" "}
            บาท <span className="opacity-70">· ระยะเริ่มต้น {benefit.early.toLocaleString("en-US")} บาทต่อโรค</span>
          </p>
        </div>
        )}

        <div>
          <span className="block text-sm text-[var(--lg-mute)]">ระยะเวลาชำระเบี้ย</span>
          <div className="mt-1.5 grid grid-cols-4 gap-2">
            {table.terms.map((t) => {
              const takes = ageNum !== undefined && termTakes(table, t, ageNum);
              const on = t.variant === term.variant && takes;
              const price = takes ? buttonPrice(t.variant) : undefined;
              return (
                <button
                  key={t.variant} type="button" disabled={!takes} aria-pressed={on}
                  onClick={() => setWanted(t.variant)}
                  className={`rounded-sm border px-1 py-2.5 text-center transition-colors ${
                    on ? "lg-metal-face border-[var(--lg-gold)] font-medium"
                      : takes ? "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                        : "border-[var(--lg-panel-line)] text-[var(--lg-mute)] opacity-35"
                  }`}
                >
                  <span className="block text-sm">{t.short}</span>
                  {price
                    ? <span className="mt-0.5 block text-[11px] tabular-nums opacity-80">{price}</span>
                    : !takes && <span className="mt-0.5 block text-[11px] opacity-80">ถึง {t.ageMax}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="is-age" className="block text-sm text-[var(--lg-mute)]">อายุ</label>
            <select
              id="is-age" value={age}
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
      </div>

      {budgetShort ? null : !inRange || !modes ? (
        <div className="rounded-sm border border-[var(--lg-gold)] bg-[var(--lg-panel)] px-5 py-7 text-center text-sm leading-relaxed text-[var(--lg-white)]">
          แบบนี้รับถึงอายุ {table.ageMax} ปี ทักมาให้เราช่วยหาแบบที่เหมาะกับคุณ
        </div>
      ) : (
        <div className="relative space-y-5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] p-5">
          <PanelPhoto />
          {headline && annual ? (
            <div>
              {/* as tall as the family photo in the corner, so the box after it never runs under the picture */}
              {/* led by what the family inherits; the premium is the box's (owner, 2026-10-06) */}
              <LegacyHeadline legacy={legacyLevel(sumAssured)} perDay={perDayText(annual.total)} />
              {/* every instalment in the back-office calculator's box (owner, 2026-10-06) */}
              <div className="mt-3">
                <PremiumSummary modes={modes} main={headline.mode} />
              </div>
            </div>
          ) : (
            <div className="text-sm font-medium text-[var(--lg-gold)]">ขอราคาปัจจุบันได้ทางแชทด้านล่าง</div>
          )}

          <div className="pt-1">
            <hr className="lg-rule" />
            <div className="pt-4 text-sm text-[var(--lg-mute)]">รับเงินก้อนเมื่อ</div>
            <dl className="mt-2 space-y-2">
              {[
                [`ตรวจพบโรคร้ายแรงระยะรุนแรง (${table.illness.majorCount} โรค)`, benefit.major],
                [`ตรวจพบระยะเริ่มต้น (${table.illness.earlyCount} โรค) ต่อโรค`, benefit.early],
                ["เสียชีวิต", sumAssured],
                [`อยู่ครบสัญญาอายุ ${table.maturityAge} ปี`, sumAssured],
              ].map(([label, amount], at) => (
                <div key={label as string} className="flex items-baseline justify-between gap-3">
                  {/* the severe-illness lump sum leads, and is marked as on the quote card */}
                  <dt className="text-sm text-[var(--lg-mute)]">
                    {at === 0 ? <Highlighted>{label as string}</Highlighted> : label}
                  </dt>
                  <dd className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">
                    {at === 0
                      ? <Highlighted>{(amount as number).toLocaleString("en-US")} บาท</Highlighted>
                      : <>{(amount as number).toLocaleString("en-US")} บาท</>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {cash.length > 0 && (
            <div className="pt-1">
              <hr className="lg-rule" />
              {/* the milestone list is gone (owner, 2026-10-10): the chart and the year-by-year table under it carry every age */}
              {projection && (
                <>
                  {/* a new term, age or sex is a different contract, so the readout goes back
                      to its break-even year; dragging the sum alone keeps the year in view */}
                  <CashValueChart key={`${term.variant}-${sex}-${who!.age}`} projection={projection} age={who!.age} />
                  <CashValueTable
                    projection={projection}
                    caption={tableCaption}
                    cardPath={tableCard}
                    planName={getPlan(table.planCode)?.planLabel}
                    notes={false}
                  />
                </>
              )}
            </div>
          )}

          <p className="border-t border-[var(--lg-panel-line)] pt-4 text-xs leading-[1.8] text-[var(--lg-mute)] opacity-80">
            {iShieldFootnote(table.illness.waitingDays)}
          </p>
        </div>
      )}

      {/* the illness list goes out with or without a price: "โรคอะไรบ้าง" is asked before
          anyone has given an age. Not in the sticky bar — five buttons do not fit a phone */}
      <ContactButtons copyText={quoteText} cardPath={card} tableCardPath={tableCard} diseaseCardPath={diseaseCardPath("ISHIELD")} />

      {sticky && (quoteText || card) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden">
          <ContactButtons copyText={quoteText} cardPath={card} tableCardPath={tableCard} compact />
        </div>
      )}
    </div>
  );
}
