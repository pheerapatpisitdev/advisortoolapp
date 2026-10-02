"use client";
import { useEffect, useMemo, useState } from "react";
import { markPdfReady } from "@/lib/quote-pdf/prepare";
import type { Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { PER, displayPremium, perDayText } from "@/lib/legacy-cta";
import { cashProjection } from "@/lib/cash-projection";
import type { EasyProtectTable } from "@/lib/easyprotect-table";
import {
  cashAt, deathBenefitOf, easyProtectModes, leverage, payYears, termAt, totalPaid,
} from "@/lib/easyprotect-quote";
import { easyProtectQuoteText, type EasyProtectAge } from "@/lib/easyprotect-cta";
import { cardPath, valueTablePath } from "@/lib/card-link";
import { ageWord } from "@/lib/lifeprotect-cta";
import { CashValueChart } from "@/components/lifeprotect/CashValueChart";
import { CashValueTable } from "@/components/lifeprotect/CashValueTable";
import { ContactButtons } from "@/components/sales/ContactButtons";
import { EASYPROTECT_SUMS, planInitialFromTable } from "@/lib/quote-pdf/pages";
import { getPlan } from "@/calc/plans/registry";
import { Highlighted } from "@/components/Highlighted";

/** How each instalment reads on the card, where it labels a figure rather than follows it. */
const PER_LABEL = { annual: "ต่อปี", semi: "ต่อ 6 เดือน", monthly: "ต่อเดือน" } as const;

/** The page opens on one million: the sum this plan is most often written at. */
const SUM_START_INDEX = 5;
/** The age the page opens on — a real price before a visitor touches anything. */
const AGE_START = 35;

export interface EasyProtectCalculatorProps {
  /** the rates and factors the browser prices from; the engine never leaves the server */
  table: EasyProtectTable;
  /** pin a copy of the contact buttons to the bottom of a phone screen */
  sticky?: boolean;
}

/**
 * The customer's calculator for the base plan on its own. Three choices — sum, age, sex —
 * because the plan sells one arrangement and there is no term to pick.
 *
 * What it puts in front of the reader, in this order: the instalment, what six years of it
 * adds up to, and the cover that total buys for the rest of a life. That middle figure is
 * the one this plan is decided on: it is a number with an end to it, which is not true of
 * any plan paid to ninety-nine.
 */
export function EasyProtectCalculator({ table, sticky = false }: EasyProtectCalculatorProps) {
  const AGES = useMemo(
    () => Array.from({ length: table.ageMax - table.ageMin + 1 }, (_, i) => table.ageMin + i),
    [table.ageMin, table.ageMax],
  );
  const [sumIndex, setSumIndex] = useState(SUM_START_INDEX);
  const sumAssured = EASYPROTECT_SUMS[sumIndex];
  const [age, setAge] = useState<EasyProtectAge>(AGE_START);
  const [sex, setSex] = useState<Sex>("M");
  // the PDF print waits for this: it is true once the link's figures (if any) are in state
  const [seeded, setSeeded] = useState(false);

  // A link from the chat opens the figures it quotes. Read here, in the browser, so the page
  // itself stays static; no query, or one this page cannot show, leaves the start values.
  useEffect(() => {
    const initial = planInitialFromTable(new URLSearchParams(window.location.search), {
      sums: EASYPROTECT_SUMS, variants: [table.terms[0].variant], ageMin: table.ageMin, ageMax: table.ageMax,
    });
    if (initial) {
      setSumIndex(EASYPROTECT_SUMS.indexOf(initial.sumAssured));
      setAge(initial.age as typeof age);
      setSex(initial.sex);
    }
    setSeeded(true);
  }, [table]);
  useEffect(() => {
    if (seeded) markPdfReady();
  }, [seeded]);

  const term = termAt(table, table.terms[0].variant);
  const ageNum = typeof age === "number" ? age : undefined;
  const who = ageNum !== undefined ? { sex, age: ageNum, sumAssured } : undefined;

  const modes = who ? easyProtectModes(table, term, who) : undefined;
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
    ? cardPath({
      kind: "plan", planCode: table.planCode, variant: term.variant,
      age: who.age, sex, sumAssured, mode: headline.mode,
    })
    : undefined;
  // the value table drawn the same way, from the same arrangement — and offered only where
  // there is a table to draw, so a button never points at a picture the engine would refuse
  const tableCard = who && projection
    ? valueTablePath({ kind: "plan", planCode: table.planCode, variant: term.variant, age: who.age, sex, sumAssured })
    : undefined;
  const quoteText = who && headline && total !== null
    ? easyProtectQuoteText({
      sumAssured, age: who.age, sex, years: term.payTerm,
      coverToAge: table.coverToAge, modes: [headline, ...others], total, leverage: times,
      cash, premiumFloorPercent: table.topUp.premiumPercent,
    })
    : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-6 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
        <div>
          <label htmlFor="ep-sum" className="block text-sm text-[var(--lg-mute)]">ทุนประกัน</label>
          <div className="lg-figure mt-1.5 text-3xl tabular-nums">
            <span className="lg-metal-text">{sumAssured.toLocaleString("en-US")}</span>{" "}
            <span className="text-lg text-[var(--lg-mute)]">บาท</span>
          </div>
          <input
            id="ep-sum" type="range" min={0} max={EASYPROTECT_SUMS.length - 1} step={1} value={sumIndex}
            onChange={(e) => setSumIndex(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--lg-gold)]"
          />
          <div className="mt-1 flex justify-between text-xs text-[var(--lg-mute)] opacity-70">
            <span>5 แสน</span>
            <span>10 ล้าน</span>
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ep-age" className="block text-sm text-[var(--lg-mute)]">อายุ</label>
            <select
              id="ep-age" value={age}
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
        <div className="space-y-5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] p-5">
          {headline && annual ? (
            <div>
              <div className="text-sm text-[var(--lg-mute)]">เบี้ยประกัน · {term.label}</div>
              <div className="lg-figure mt-1 text-[2.6rem] leading-none tabular-nums">
                <span className="lg-metal-text">{formatBaht(headline.total)}</span>
                <span className="ml-2 text-base text-[var(--lg-mute)]">บาท {PER_LABEL[headline.mode]}</span>
              </div>
              <div className="mt-2.5 space-y-1 text-sm text-[var(--lg-mute)]">
                {/* highlighted, as on the quote card: what the premium comes to by the day and per instalment */}
                <div>
                  <Highlighted>
                    ตกวันละ{" "}
                    <span className="lg-figure tabular-nums">{perDayText(annual.total)}</span> บาท
                  </Highlighted>
                </div>
                {others.map((m) => (
                  <div key={m.mode}>
                    <Highlighted>
                      {PAY_MODE_LABEL[m.mode]}{" "}
                      <span className="lg-figure tabular-nums">{formatBaht(m.total)}</span> บาท
                    </Highlighted>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm font-medium text-[var(--lg-gold)]">ขอราคาปัจจุบันได้ทางแชทด้านล่าง</div>
          )}

          {/* The plan's whole argument, and the reason this block sits above the death
              benefit rather than below it: the premium has a last year, and the cover does
              not. A reader who takes one number away from the page should take this one. */}
          {total !== null && (
            <div className="pt-1">
              <hr className="lg-rule" />
              <div className="pt-4 text-sm text-[var(--lg-mute)]">จ่ายทั้งหมดเท่านี้ แล้วจบ</div>
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
                    <dt className="text-sm text-[var(--lg-mute)]">คุ้มครองเป็น</dt>
                    <dd className="lg-figure shrink-0 whitespace-nowrap text-lg tabular-nums text-[var(--lg-gold)]">
                      {times.toFixed(1)} เท่าของเบี้ยที่จ่าย
                    </dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm text-[var(--lg-mute)]">ปีที่ {term.payTerm + 1} เป็นต้นไป</dt>
                  <dd className="lg-figure shrink-0 whitespace-nowrap text-lg tabular-nums text-[var(--lg-white)]">
                    ไม่ต้องจ่ายอีก
                  </dd>
                </div>
              </dl>
            </div>
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

          {cash.length > 0 && (
            <div className="pt-1">
              <hr className="lg-rule" />
              <div className="pt-4 text-sm text-[var(--lg-mute)]">มูลค่าเงินสดสะสม (หากเวนคืน)</div>
              <dl className="mt-2 space-y-2">
                {cash.map((row) => (
                  <div key={row.age} className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-[var(--lg-mute)]">อายุ {row.age} ปี</dt>
                    <dd className="lg-figure shrink-0 whitespace-nowrap text-lg tabular-nums text-[var(--lg-white)]">
                      {row.amount.toLocaleString("en-US")} บาท
                    </dd>
                  </div>
                ))}
              </dl>

              {projection && (
                <>
                  {/* a new age or sex is a different contract, so the readout goes back to its
                      break-even year; dragging the sum alone keeps the year in view */}
                  <CashValueChart key={`${sex}-${who.age}`} projection={projection} age={who.age} />
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
              ✦ เบี้ยล็อกที่อายุ{ageNum === 0 ? "" : " "}{ageWord(ageNum)} ตลอด {term.payTerm} ปีที่ชำระ ยิ่งเริ่มเร็วยิ่งถูก
            </p>
          )}

          <p className="border-t border-[var(--lg-panel-line)] pt-4 text-xs leading-[1.8] text-[var(--lg-mute)] opacity-80">
            เบี้ยคงที่ตลอดระยะเวลาชำระ · ทุนขั้นต่ำ {table.saMin.toLocaleString("en-US")} บาท ·
            เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน
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
