"use client";
import { useEffect, useMemo, useState } from "react";
import { markPdfReady } from "@/lib/quote-pdf/prepare";
import type { Sex } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { PER, displayPremium, perDayText } from "@/lib/legacy-cta";
import { cashProjection } from "@/lib/cash-projection";
import type { LifeTreasureTable } from "@/lib/lifetreasure-table";
import {
  cashAt, deathBenefitOf, leverage, lifeTreasureModes, payYears, termAt, totalPaid,
} from "@/lib/lifetreasure-quote";
import { lifeTreasureQuoteText, type LifeTreasureAge } from "@/lib/lifetreasure-cta";
import { cardPath, valueTablePath } from "@/lib/card-link";
import { CashValueChart } from "@/components/lifeprotect/CashValueChart";
import { CashValueTable } from "@/components/lifeprotect/CashValueTable";
import { ContactButtons } from "@/components/sales/ContactButtons";
import { LIFETREASURE_SUMS, planInitialFromTable } from "@/lib/quote-pdf/pages";
import { getPlan } from "@/calc/plans/registry";
import { Highlighted } from "@/components/Highlighted";
import { PanelPhoto } from "@/components/sales/PanelPhoto";
import { LegacyHeadline, PremiumSummary } from "@/components/sales/PremiumSummary";
import { legacyLevel } from "@/lib/legacy-headline";
import { priceLockNote, levelPremiumFootnote } from "@/lib/plan-notes";

const SUM_START_INDEX = 0;
/** The term the page opens on: eighteen years puts the smallest number in front of a stranger. */
const TERM_START = "H99F18A";
/** The age the page opens on — a real price before a visitor touches anything. */
const AGE_START = 45;

export interface LifeTreasureCalculatorProps {
  /** the rates and factors the browser prices from; the engine never leaves the server */
  table: LifeTreasureTable;
  /** pin a copy of the contact buttons to the bottom of a phone screen */
  sticky?: boolean;
}

/**
 * The customer's calculator for the base plan on its own. Four choices — sum, term, age, sex.
 *
 * What this panel has that the other three do not is the cost of the whole thing beside what
 * it pays: an estate buyer is not deciding whether they can afford a monthly instalment,
 * they are deciding whether the money is better left here than anywhere else, and that is a
 * comparison between two totals.
 */
export function LifeTreasureCalculator({ table, sticky = false }: LifeTreasureCalculatorProps) {
  const AGES = useMemo(
    () => Array.from({ length: table.ageMax - table.ageMin + 1 }, (_, i) => table.ageMin + i),
    [table.ageMin, table.ageMax],
  );
  const [sumIndex, setSumIndex] = useState(SUM_START_INDEX);
  const sumAssured = LIFETREASURE_SUMS[sumIndex];
  const [variant, setVariant] = useState(TERM_START);
  const [age, setAge] = useState<LifeTreasureAge>(AGE_START);
  const [sex, setSex] = useState<Sex>("M");
  // the PDF print waits for this: it is true once the link's figures (if any) are in state
  const [seeded, setSeeded] = useState(false);

  // A link from the chat opens the figures it quotes. Read here, in the browser, so the page
  // itself stays static; no query, or one this page cannot show, leaves the start values.
  useEffect(() => {
    const initial = planInitialFromTable(new URLSearchParams(window.location.search), {
      sums: LIFETREASURE_SUMS, variants: table.terms.map((t) => t.variant), ageMin: table.ageMin, ageMax: table.ageMax,
    });
    if (initial) {
      setSumIndex(LIFETREASURE_SUMS.indexOf(initial.sumAssured));
      setVariant(initial.variant);
      setAge(initial.age as typeof age);
      setSex(initial.sex);
    }
    setSeeded(true);
  }, [table]);
  useEffect(() => {
    if (seeded) markPdfReady();
  }, [seeded]);

  const term = termAt(table, variant);
  const ageNum = typeof age === "number" ? age : undefined;
  const who = ageNum !== undefined ? { sex, age: ageNum, sumAssured } : undefined;

  const modes = who ? lifeTreasureModes(table, term, who) : undefined;
  const headline = displayPremium(modes, table.expired);
  const annual = modes?.find((m) => m.mode === "annual");
  // smallest instalment upward, so the block under the headline reads day, half-year, year
  const others = (modes ?? [])
    .filter((m) => m.mode !== headline?.mode && !m.belowMinimum)
    .sort((a, b) => a.total - b.total);
  const cash = who ? cashAt(term, sex, who.age, sumAssured, table.ageMin) : [];
  const total = annual && !table.expired ? totalPaid(annual.total, term) : null;
  const times = total !== null ? leverage(sumAssured, total) : null;

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
    ? cardPath({ kind: "plan", planCode: table.planCode, variant, age: who.age, sex, sumAssured, mode: headline.mode })
    : undefined;
  // the value table drawn the same way, from the same arrangement — and offered only where
  // there is a table to draw, so a button never points at a picture the engine would refuse
  const tableCard = who && projection
    ? valueTablePath({ kind: "plan", planCode: table.planCode, variant: variant, age: who.age, sex, sumAssured })
    : undefined;
  const quoteText = who && headline && total !== null
    ? lifeTreasureQuoteText({
      sumAssured, termLabel: term.label, age: who.age, sex, years: term.payTerm,
      coverToAge: table.coverToAge, modes: [headline, ...others], total, leverage: times,
      cash, premiumFloorPercent: table.topUp.premiumPercent,
    })
    : undefined;

  /** The figure on a term button: that term's yearly premium, once there is an age. */
  const buttonPrice = (v: string): string | undefined => {
    if (!who || table.expired) return undefined;
    const yearly = lifeTreasureModes(table, termAt(table, v), who)?.find((m) => m.mode === "annual");
    return yearly ? `${formatBaht(yearly.total)}${PER.annual}` : undefined;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
        <div>
          <label htmlFor="lt-sum" className="block text-sm text-[var(--lg-mute)]">ทุนประกัน</label>
          <div className="lg-figure mt-1.5 text-3xl tabular-nums">
            <span className="lg-metal-text">{sumAssured.toLocaleString("en-US")}</span>{" "}
            <span className="text-lg text-[var(--lg-mute)]">บาท</span>
          </div>
          <input
            id="lt-sum" type="range" min={0} max={LIFETREASURE_SUMS.length - 1} step={1} value={sumIndex}
            onChange={(e) => setSumIndex(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--lg-gold)]"
          />
          <div className="mt-1 flex justify-between text-xs text-[var(--lg-mute)] opacity-70">
            <span>10 ล้าน</span>
            <span>50 ล้าน</span>
          </div>
          {/* what the family receives sits under the sum being chosen, because for this plan
              the two are the same number at every age — there is no booster to explain */}
          <p className="mt-4 text-sm leading-relaxed text-[var(--lg-mute)]">
            ครอบครัวได้รับ{" "}
            <span className="lg-figure text-lg tabular-nums text-[var(--lg-gold)]">
              {sumAssured.toLocaleString("en-US")}
            </span>{" "}
            บาท <span className="opacity-70">· ทุกช่วงอายุ จนถึงอายุ {table.coverToAge}</span>
          </p>
        </div>

        <div>
          <span className="block text-sm text-[var(--lg-mute)]">ระยะเวลาชำระเบี้ย</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {table.terms.map((t) => {
              const on = t.variant === term.variant;
              const price = buttonPrice(t.variant);
              return (
                <button
                  key={t.variant} type="button" aria-pressed={on}
                  onClick={() => setVariant(t.variant)}
                  className={`rounded-sm border px-2 py-2.5 text-center transition-colors ${
                    on ? "lg-metal-face border-[var(--lg-gold)] font-medium"
                      : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
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
            <label htmlFor="lt-age" className="block text-sm text-[var(--lg-mute)]">อายุ</label>
            <select
              id="lt-age" value={age}
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

      {!who || !modes ? (
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
              <LegacyHeadline legacy={legacyLevel(sumAssured, `ทุกช่วงอายุ ถึงอายุ ${table.coverToAge}`)} perDay={perDayText(annual.total)} />
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
            <div className="pt-4 text-sm text-[var(--lg-mute)]">ครอบครัวได้รับเมื่อเสียชีวิต</div>
            <dl className="mt-2 space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                {/* the one figure this plan is bought for, marked as on the quote card */}
                <dt className="text-sm text-[var(--lg-mute)]"><Highlighted>ทุกช่วงอายุ ถึงอายุ {table.coverToAge}</Highlighted></dt>
                <dd className="lg-figure shrink-0 whitespace-nowrap text-lg tabular-nums text-[var(--lg-white)]">
                  <Highlighted>{sumAssured.toLocaleString("en-US")} บาท</Highlighted>
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs leading-[1.8] text-[var(--lg-mute)] opacity-80">
              และไม่น้อยกว่า {table.topUp.premiumPercent}% ของเบี้ยที่ชำระมาแล้ว หรือมูลค่าเวนคืน
              แล้วแต่จำนวนใดจะมากกว่า
            </p>
          </div>

          {total !== null && (
            <div className="pt-1">
              <hr className="lg-rule" />
              <div className="pt-4 text-sm text-[var(--lg-mute)]">ต้นทุนของมรดกก้อนนี้</div>
              <dl className="mt-2 space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm text-[var(--lg-mute)]">เบี้ยรวมตลอด {term.payTerm} ปี</dt>
                  <dd className="lg-figure shrink-0 whitespace-nowrap text-lg tabular-nums text-[var(--lg-white)]">
                    {formatBaht(total)} บาท
                  </dd>
                </div>
                {/* the multiple disappears rather than dips under one: past a certain age the
                    premiums add up to more than the sum, and the plan is then bought for the
                    certainty, not for the multiple */}
                {times !== null && (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-[var(--lg-mute)]">ส่งต่อเป็น</dt>
                    <dd className="lg-figure shrink-0 whitespace-nowrap text-lg tabular-nums text-[var(--lg-gold)]">
                      {times.toFixed(1)} เท่าของเบี้ยที่จ่าย
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {cash.length > 0 && (
            <div className="pt-1">
              <hr className="lg-rule" />
              {/* the milestone list is gone (owner, 2026-10-10): the chart and the year-by-year table under it carry every age */}
              {projection && (
                <>
                  {/* a new term, age or sex is a different contract, so the readout goes back
                      to its break-even year; dragging the sum alone keeps the year in view */}
                  <CashValueChart key={`${variant}-${sex}-${who.age}`} projection={projection} age={who.age} />
                  <CashValueTable
                    projection={projection}
                    caption={tableCaption}
                    cardPath={tableCard}
                    planName={getPlan(table.planCode)?.planLabel}
                  />
                </>
              )}
            </div>
          )}

          {ageNum !== undefined && (
            <p className="text-sm leading-relaxed text-[var(--lg-gold)]">
              {priceLockNote(ageNum)}
            </p>
          )}

          <p className="border-t border-[var(--lg-panel-line)] pt-4 text-xs leading-[1.8] text-[var(--lg-mute)] opacity-80">
            {levelPremiumFootnote(table.saMin)}
          </p>
        </div>
      )}

      <ContactButtons copyText={quoteText} cardPath={card} tableCardPath={tableCard} />

      {sticky && (quoteText || card) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden">
          <ContactButtons copyText={quoteText} cardPath={card} tableCardPath={tableCard} compact />
        </div>
      )}
    </div>
  );
}
