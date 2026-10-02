"use client";
import { useEffect, useMemo, useState } from "react";
import { markPdfReady } from "@/lib/quote-pdf/prepare";
import type { Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { PER, displayPremium, perDayText } from "@/lib/legacy-cta";
import type { PlbTable } from "@/lib/plb-table";
import { coverEndsAt, perMillion, plbModes, termAt, totalPaid } from "@/lib/plb-quote";
import { plbQuoteText, type PlbAge } from "@/lib/plb-cta";
import { cardPath, valueTablePath } from "@/lib/card-link";
import { coverRows } from "@/lib/cover-rows";
import { CoverTable } from "@/components/plb/CoverTable";
import { ContactButtons } from "@/components/sales/ContactButtons";
import { PLB_SUMS, planInitialFromTable } from "@/lib/quote-pdf/pages";
import { Highlighted } from "@/components/Highlighted";

/** How each instalment reads on the card, where it labels a figure rather than follows it. */
const PER_LABEL = { annual: "ต่อปี", semi: "ต่อ 6 เดือน", monthly: "ต่อเดือน" } as const;

const SUM_START_INDEX = PLB_SUMS.indexOf(1_000_000);
/** The term the page opens on: twelve years is the one the company's own proposal illustrates. */
const TERM_START = "PLB12";
/** The age the page opens on — a real price before a visitor touches anything. */
const AGE_START = 35;

export interface PlbCalculatorProps {
  /** the rates and factors the browser prices from; the engine never leaves the server */
  table: PlbTable;
  /** pin a copy of the contact buttons to the bottom of a phone screen */
  sticky?: boolean;
}

/**
 * The customer's calculator for the base plan on its own. Four choices — sum, term, age, sex.
 *
 * Simpler than the other three pages, because the contract is: every term is sold at every
 * age the plan takes, there is no surrender table to draw, and the whole of what the policy
 * pays is one figure on one day. What the panel spends its room on instead is what the cover
 * costs — the day rate, the total over the term, and the price per million, which is the only
 * way the sum-assured discount is visible.
 */
export function PlbCalculator({ table, sticky = false }: PlbCalculatorProps) {
  const AGES = useMemo(
    () => Array.from({ length: table.ageMax - table.ageMin + 1 }, (_, i) => table.ageMin + i),
    [table.ageMin, table.ageMax],
  );
  const [sumIndex, setSumIndex] = useState(SUM_START_INDEX);
  const sumAssured = PLB_SUMS[sumIndex];
  const [variant, setVariant] = useState(TERM_START);
  const [age, setAge] = useState<PlbAge>(AGE_START);
  const [sex, setSex] = useState<Sex>("M");
  // the PDF print waits for this: it is true once the link's figures (if any) are in state
  const [seeded, setSeeded] = useState(false);

  // A link from the chat opens the figures it quotes. Read here, in the browser, so the page
  // itself stays static; no query, or one this page cannot show, leaves the start values.
  useEffect(() => {
    const initial = planInitialFromTable(new URLSearchParams(window.location.search), {
      sums: PLB_SUMS, variants: table.terms.map((t) => t.variant), ageMin: table.ageMin, ageMax: table.ageMax,
    });
    if (initial) {
      setSumIndex(PLB_SUMS.indexOf(initial.sumAssured));
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

  const modes = who ? plbModes(table, term, who) : undefined;
  const headline = displayPremium(modes, table.expired);
  const annual = modes?.find((m) => m.mode === "annual");
  // smallest instalment upward, so the block under the headline reads day, half-year, year
  const others = (modes ?? [])
    .filter((m) => m.mode !== headline?.mode && !m.belowMinimum)
    .sort((a, b) => a.total - b.total);

  // the same figures the card is showing, or nothing: a copied quote must never say more than the page
  const card = who && headline
    ? cardPath({ kind: "plan", planCode: table.planCode, variant: term.variant, age: who.age, sex, sumAssured, mode: headline.mode })
    : undefined;
  /**
   * The year-by-year sheet, which for this plan is a table of cover rather than of value:
   * PLB is protection only, so what it has to show is the premium, the cover, and the year
   * the contract ends.
   */
  const tableCard = who
    ? valueTablePath({ kind: "plan", planCode: table.planCode, variant: term.variant, age: who.age, sex, sumAssured })
    : undefined;
  /**
   * The same years the card draws, for the page to show.
   *
   * Built by the shared loop rather than a second one: two places computing one table
   * eventually disagree by a baht or a year, and nothing says which is right. Cover is flat
   * on this plan — no booster, no top-up for premiums paid — so the sum assured is the whole
   * of it, and the premium falls due in every year because the paying term and the cover term
   * are the same formula in the company's own sheet.
   */
  const rows = who && annual && !table.expired
    ? coverRows({
      years: term.years,
      payYears: term.years,
      age: who.age,
      annualSatang: annual.total,
      // flat: this plan has no booster and no top-up for premiums paid, so the sum assured
      // the customer chose is the whole of what the family receives, in every year of it
      coverSatang: sumAssured * 100,
    })
    : [];

  const quoteText = who && headline && annual
    ? plbQuoteText({
        sumAssured, termLabel: term.label, age: who.age, sex, years: term.years,
        endsAtAge: coverEndsAt(term, who.age), modes: [headline, ...others],
        total: totalPaid(annual.total, term),
      })
    : undefined;

  /** The figure on a term button: that term's yearly premium, once there is an age. */
  const buttonPrice = (code: string): string | undefined => {
    if (!who || table.expired) return undefined;
    const yearly = plbModes(table, termAt(table, code), who)?.find((m) => m.mode === "annual");
    return yearly ? `${formatBaht(yearly.total)}${PER.annual}` : undefined;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
        <div>
          <label htmlFor="plb-sum" className="block text-sm text-[var(--lg-mute)]">ทุนประกัน</label>
          <div className="lg-figure mt-1.5 text-3xl tabular-nums">
            <span className="lg-metal-text">{sumAssured.toLocaleString("en-US")}</span>{" "}
            <span className="text-lg text-[var(--lg-mute)]">บาท</span>
          </div>
          <input
            id="plb-sum" type="range" min={0} max={PLB_SUMS.length - 1} step={1} value={sumIndex}
            onChange={(e) => setSumIndex(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--lg-gold)]"
          />
          <div className="mt-1 flex justify-between text-xs text-[var(--lg-mute)] opacity-70">
            <span>3 แสน</span>
            <span>5 ล้าน</span>
          </div>
          {/* what the family receives sits under the sum being chosen, because for this plan
              the two are the same number — and saying so here is the whole contract */}
          <p className="mt-4 text-sm leading-relaxed text-[var(--lg-mute)]">
            เสียชีวิตระหว่างสัญญา ครอบครัวรับ{" "}
            <span className="lg-figure text-lg tabular-nums text-[var(--lg-gold)]">
              {sumAssured.toLocaleString("en-US")}
            </span>{" "}
            บาท <span className="opacity-70">· ทุกสาเหตุ ตามเงื่อนไขกรมธรรม์</span>
          </p>
        </div>

        <div>
          <span className="block text-sm text-[var(--lg-mute)]">คุ้มครองและชำระเบี้ยกี่ปี</span>
          <div className="mt-1.5 grid grid-cols-4 gap-2">
            {table.terms.map((t) => {
              const on = t.variant === term.variant;
              const price = buttonPrice(t.variant);
              return (
                <button
                  key={t.variant} type="button" aria-pressed={on}
                  onClick={() => setVariant(t.variant)}
                  className={`rounded-sm border px-1 py-2.5 text-center transition-colors ${
                    on ? "lg-metal-face border-[var(--lg-gold)] font-medium"
                      : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                  }`}
                >
                  <span className="block text-sm">{t.short}</span>
                  {price && <span className="mt-0.5 block text-[11px] tabular-nums opacity-80">{price}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="plb-age" className="block text-sm text-[var(--lg-mute)]">อายุ</label>
            <select
              id="plb-age" value={age}
              onChange={(e) => setAge(e.target.value === "over" ? "over" : Number(e.target.value))}
              className="mt-1.5 w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-lg tabular-nums text-[var(--lg-white)]"
            >
              {AGES.map((a) => <option key={a} value={a}>{a} ปี</option>)}
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
          แบบนี้รับอายุ {table.ageMin}–{table.ageMax} ปี ทักมาให้เราช่วยหาแบบที่เหมาะกับคุณ
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
            <div className="pt-4 text-sm text-[var(--lg-mute)]">สัญญานี้จ่ายอะไร</div>
            <dl className="mt-2 space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                {/* what the family receives inside the term, marked as on the quote card */}
                <dt className="text-sm text-[var(--lg-mute)]"><Highlighted>เสียชีวิตภายใน {term.years} ปี</Highlighted></dt>
                <dd className="lg-figure shrink-0 whitespace-nowrap text-lg tabular-nums text-[var(--lg-white)]">
                  <Highlighted>{sumAssured.toLocaleString("en-US")} บาท</Highlighted>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-[var(--lg-mute)]">อยู่ครบสัญญา (อายุ {coverEndsAt(term, who.age)})</dt>
                <dd className="shrink-0 text-sm text-[var(--lg-mute)]">ไม่มีเงินคืน</dd>
              </div>
            </dl>
          </div>

          {annual && !table.expired && (
            <div className="pt-1">
              <hr className="lg-rule" />
              <div className="pt-4 text-sm text-[var(--lg-mute)]">ราคาของความคุ้มครองนี้</div>
              <dl className="mt-2 space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm text-[var(--lg-mute)]">เบี้ยรวมตลอด {term.years} ปี</dt>
                  <dd className="lg-figure shrink-0 whitespace-nowrap text-lg tabular-nums text-[var(--lg-white)]">
                    {formatBaht(totalPaid(annual.total, term))} บาท
                  </dd>
                </div>
                {/* the only place the sum-assured discount is visible: the same cover costs
                    less per million once the sum clears a threshold */}
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm text-[var(--lg-mute)]">คิดเป็นทุน 1 ล้าน ปีละ</dt>
                  <dd className="lg-figure shrink-0 whitespace-nowrap text-lg tabular-nums text-[var(--lg-white)]">
                    {perMillion(annual.total, sumAssured).toLocaleString("en-US")} บาท
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {rows.length > 0 && who && (
            <CoverTable
              rows={rows}
              caption={`ทุนประกัน ${sumAssured.toLocaleString("en-US")} บาท · ${sex === "M" ? "ชาย" : "หญิง"} ${who.age} ปี · ${term.label}`}
              endsNote={`คุ้มครอง ${term.years} ปี ถึงอายุ ${coverEndsAt(term, who.age)} ปี แล้วสัญญาสิ้นสุด`}
              cardPath={tableCard}
              planName="Protection Life"
            />
          )}

          <p className="border-t border-[var(--lg-panel-line)] pt-4 text-xs leading-[1.8] text-[var(--lg-mute)] opacity-80">
            เบี้ยคงที่ตลอดสัญญา · ทุนยิ่งสูง เบี้ยต่อพันยิ่งลด ลองเลื่อนทุนดูราคาต่อล้าน ·
            เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน
          </p>
        </div>
      )}

      <ContactButtons copyText={quoteText} cardPath={card} tableCardPath={tableCard} tableLabel={{ full: "บันทึกตารางความคุ้มครอง", compact: "ตาราง" }} />

      {sticky && (quoteText || card) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden">
          <ContactButtons copyText={quoteText} cardPath={card} tableCardPath={tableCard} tableLabel={{ full: "บันทึกตารางความคุ้มครอง", compact: "ตาราง" }} compact />
        </div>
      )}
    </div>
  );
}
