"use client";
import { useEffect, useMemo, useState } from "react";
import { markPdfReady } from "@/lib/quote-pdf/prepare";
import type { Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
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

/** How each instalment reads on the card, where it labels a figure rather than follows it. */
const PER_LABEL = { annual: "ต่อปี", semi: "ต่อ 6 เดือน", monthly: "ต่อเดือน" } as const;

const SUM_START_INDEX = ISHIELD_SUMS.indexOf(1_000_000);
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
  const sumAssured = ISHIELD_SUMS[sumIndex];
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
  const who = inRange ? { sex, age: ageNum, sumAssured } : undefined;

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
    if (!who || table.expired) return undefined;
    const yearly = iShieldModes(table, termAt(table, variant), who)?.find((m) => m.mode === "annual");
    return yearly ? `${formatBaht(yearly.total)}${PER.annual}` : undefined;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
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

      {!inRange || !modes ? (
        <div className="rounded-sm border border-[var(--lg-gold)] bg-[var(--lg-panel)] px-5 py-7 text-center text-sm leading-relaxed text-[var(--lg-white)]">
          แบบนี้รับถึงอายุ {table.ageMax} ปี ทักมาให้เราช่วยหาแบบที่เหมาะกับคุณ
        </div>
      ) : (
        <div className="relative space-y-5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] p-5">
          <PanelPhoto />
          {headline && annual ? (
            <div>
              <div className="text-sm text-[var(--lg-mute)]">เบี้ยประกัน · {term.label}</div>
              <div className="lg-figure mt-1 text-[2.6rem] leading-none tabular-nums">
                <span className="lg-metal-text">{formatBaht(headline.total)}</span>
                <span className="ml-2 text-base text-[var(--lg-mute)]">บาท {PER_LABEL[headline.mode]}</span>
              </div>
              {/* What the headline did not take, one instalment a line and smallest first.
                  Muted labels with the figures in white on the display face: an agent
                  reading a yearly premium off the screen should not have to lean in. */}
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
              <div className="pt-4 text-sm text-[var(--lg-mute)]">มูลค่าเงินสดสะสม (หากเวนคืน)</div>
              <dl className="mt-2 space-y-2">
                {cash.map((row) => (
                  <div key={row.age} className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-[var(--lg-mute)]">อายุ {row.age} ปี</dt>
                    <dd className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">
                      {row.amount.toLocaleString("en-US")} บาท
                    </dd>
                  </div>
                ))}
              </dl>

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
            โรคร้ายแรงคุ้มครองหลังกรมธรรม์มีผลบังคับ {table.illness.waitingDays} วัน · เมื่อรับผลประโยชน์ระยะเริ่มต้นแล้ว
            ทุนประกันจะลดลงตามสัดส่วนที่จ่ายไป · เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน
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
