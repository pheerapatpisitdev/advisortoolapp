"use client";
import { useMemo, useState } from "react";
import type { ModePremium } from "@/calc/mode-premiums";
import type { PayMode, Sex } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import type { LegacyAge } from "@/lib/legacy-cta";
import { displayPremium, legacyQuoteText, perDayText } from "@/lib/legacy-cta";
import { cardPath, diseaseCardPath } from "@/lib/card-link";
import { ContactButtons } from "@/components/sales/ContactButtons";
import type { LegacyTable } from "@/lib/legacy-table";
import { deathBenefitRows } from "@/lib/death-benefit";
import { Highlighted } from "@/components/Highlighted";
import { largestAt } from "@/lib/highlighter";
import { PanelPhoto } from "@/components/sales/PanelPhoto";
import { PremiumSummary } from "@/components/sales/PremiumSummary";

/** How each instalment reads on the card, where it labels a figure rather than follows it. */
const PER_LABEL: Record<PayMode, string> = { annual: "ต่อปี", semi: "ต่อ 6 เดือน", monthly: "ต่อเดือน" };

/**
 * The card opens on a priced example rather than empty. A cold visitor should meet a number,
 * not a form: an empty card is one more thing to do before the thing they came for.
 *
 * A woman of 30 on the smallest plan is the cheapest honest opening in the table, and the
 * one the hero already quotes. Anyone whose own figures differ changes two controls to see
 * them.
 */
const AGE_START = 30;
const SEX_START: Sex = "F";

/** The order the server packed each row of prices in. */
const ROW_MODES: PayMode[] = ["annual", "semi", "monthly"];

/** One row of the priced table, back in the shape the rest of the page reads. */
function rowToModes(row: readonly number[] | null): ModePremium[] | undefined {
  if (!row) return undefined;
  return ROW_MODES.map((mode, i) => ({
    mode,
    total: row[i],
    belowMinimum: mode === "monthly" && row[3] === 1,
  }));
}

export interface LegacyCalculatorProps {
  /**
   * Every price the page can show, worked out on the server. The engine and the rate tables
   * it reads never reach the browser.
   */
  table: LegacyTable;
  /**
   * Pin a copy of the contact buttons to the bottom of a phone screen. The bar has to be
   * rendered from here rather than by the page, because this is the only place that knows
   * which sum and age the customer has landed on.
   */
  sticky?: boolean;
}

/**
 * The customer's calculator. It sells one arrangement, so there is nothing to choose but the
 * sum, the age and the sex — every other decision was made when the bundle was designed, and
 * the agent's own calculator is where the rest of them can still be changed.
 */
export function LegacyCalculator({ table, sticky = false }: LegacyCalculatorProps) {
  const RANGE = { min: table.ageMin, max: table.ageMax };
  const AGES = useMemo(
    () => Array.from({ length: RANGE.max - RANGE.min + 1 }, (_, i) => RANGE.min + i),
    [RANGE.min, RANGE.max],
  );
  const [millions, setMillions] = useState(1);
  const [age, setAge] = useState<LegacyAge>(AGE_START);
  const [sex, setSex] = useState<Sex>(SEX_START);

  // The picker only offers ages the bundle takes, so a number here is always one of them;
  // everyone else picks the way out and is answered rather than quoted.
  const inRange = typeof age === "number";

  const modes = useMemo(
    () => (typeof age === "number"
      ? rowToModes(table.premiums[sex][millions - 1][age - table.ageMin] ?? null)
      : undefined),
    [table, age, sex, millions],
  );
  // the bands turn only on whether the insured has reached the booster age
  const death = typeof age === "number"
    ? (age >= table.death[millions - 1].under.beforeAge
      ? table.death[millions - 1].from
      : table.death[millions - 1].under)
    : undefined;

  const headline = displayPremium(modes, table.expired);
  const annual = modes?.find((m) => m.mode === "annual");

  // the same figures the card is showing, or nothing: a copied quote must never say more than the page
  const card = typeof age === "number" && headline
    ? cardPath({ kind: "bundle", bundleCode: table.bundleCode, tier: millions, age, sex, mode: headline.mode })
    : undefined;
  const quoteText = typeof age === "number" && modes && headline && death
    ? legacyQuoteText({ millions, age, sex, modes, minMonthly: table.minMonthlyTotal, critical: table.critical[millions - 1], death, diseaseCount: table.diseaseCount })
    : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-6 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
        <div>
          <label htmlFor="legacy-sum" className="block text-sm text-[var(--lg-mute)]">
            อยากให้ครอบครัวได้รับเท่าไหร่
          </label>
          <div className="lg-figure mt-1.5 text-3xl tabular-nums">
            <span className="lg-metal-text">{(millions * 1_000_000).toLocaleString("en-US")}</span>{" "}
            <span className="text-lg text-[var(--lg-mute)]">บาท</span>
          </div>
          <input
            id="legacy-sum" type="range" min={1} max={table.tiers} step={1} value={millions}
            onChange={(e) => setMillions(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--lg-gold)]"
          />
          <div className="mt-1 flex justify-between text-xs text-[var(--lg-mute)] opacity-70">
            <span>1 ล้าน</span>
            <span>{table.tiers} ล้าน</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="legacy-age" className="block text-sm text-[var(--lg-mute)]">อายุ</label>
            {/* a picker rather than a number field: on a phone it opens the wheel instead of
                the keypad, and there is no way to arrive at an age nobody is */}
            <select
              id="legacy-age" value={age}
              onChange={(e) => setAge(e.target.value === "" || e.target.value === "other"
                ? (e.target.value as LegacyAge)
                : Number(e.target.value))}
              className="mt-1.5 w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-lg tabular-nums text-[var(--lg-white)]"
            >
              <option value="">เลือกอายุ</option>
              {AGES.map((a) => <option key={a} value={a}>{a} ปี</option>)}
              <option value="other">อายุอื่น</option>
            </select>
          </div>
          <div>
            <span className="block text-sm text-[var(--lg-mute)]">เพศ</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["M", "F"] as Sex[]).map((s) => (
                <button
                  key={s} type="button" onClick={() => setSex(s)} aria-pressed={sex === s}
                  className={`rounded-sm border py-2.5 text-sm transition-colors ${
                    sex === s
                      ? "lg-metal-face border-[var(--lg-gold)] font-medium"
                      : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                  }`}
                >
                  {s === "M" ? "ชาย" : "หญิง"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {age === "" ? (
        <p className="rounded-sm border border-dashed border-[var(--lg-panel-line)] px-5 py-7 text-center text-sm text-[var(--lg-mute)]">
          เลือกอายุเพื่อดูเบี้ยของคุณ
        </p>
      ) : !inRange || !modes ? (
        <div className="rounded-sm border border-[var(--lg-gold)] bg-[var(--lg-panel)] px-5 py-7 text-center text-sm leading-relaxed text-[var(--lg-white)]">
          ชุดนี้รับอายุ {RANGE.min}–{RANGE.max} ปี ทักมาให้เราช่วยหาแบบที่เหมาะกับคุณ
        </div>
      ) : (
        <div className="relative space-y-5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] p-5">
          <PanelPhoto />
          {headline && annual ? (
            <div>
              {/* as tall as the family photo in the corner, so the box after it never runs under the picture */}
              <div className="min-h-[5.5rem] sm:min-h-[7.5rem]">
                <div className="text-sm text-[var(--lg-mute)]">เบี้ยประกัน</div>
                <div className="lg-figure mt-1 text-[2.6rem] leading-none tabular-nums">
                  <span className="lg-metal-text">{formatBaht(headline.total)}</span>
                  <span className="ml-2 text-base text-[var(--lg-mute)]">
                    บาท {PER_LABEL[headline.mode]}
                  </span>
                </div>
                <div className="mt-2.5 text-sm text-[var(--lg-mute)]">
                  <Highlighted>
                    ตกวันละ <span className="lg-figure tabular-nums">{perDayText(annual.total)}</span> บาท
                  </Highlighted>
                </div>
              </div>
              {/* every instalment in the back-office calculator's box (owner, 2026-10-06) */}
              <div className="mt-3">
                <PremiumSummary modes={modes} main={headline.mode} />
              </div>
            </div>
          ) : (
            <div className="text-sm font-medium text-[var(--lg-gold)]">ขอราคาปัจจุบันได้ทางแชทด้านล่าง</div>
          )}

          {inRange && (
            <div className="pt-1">
              <hr className="lg-rule" />
              {/* the claim that is paid while the customer is alive to spend it comes first:
                  it is the half of this arrangement people do not expect to exist */}
              <div className="pt-4 text-sm text-[var(--lg-mute)]">
                ตรวจพบโรคร้ายแรง รับเงินสดเอง
              </div>
              <div className="lg-figure mt-1 text-2xl tabular-nums text-[var(--lg-white)]">
                {table.critical[millions - 1].toLocaleString("en-US")} บาท
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--lg-mute)] opacity-80">
                จ่ายครั้งเดียวแล้วสัญญาโรคร้ายแรงสิ้นสุด ประกันชีวิตหลักยังอยู่ต่อให้ครอบครัว
              </p>
            </div>
          )}

          {death && (
            <div className="pt-1">
              <hr className="lg-rule" />
              <div className="pt-4 text-sm text-[var(--lg-mute)]">ครอบครัวได้รับเมื่อเสียชีวิต</div>
              {/* every band at the same size: the one that shrinks is the one a customer
                  most needs to see, so it does not get to be the small print */}
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

          <p className="border-t border-[var(--lg-panel-line)] pt-4 text-xs leading-[1.8] text-[var(--lg-mute)] opacity-80">
            เบี้ยปีแรก ส่วนสัญญาโรคร้ายแรงคิดตามอายุ จึงปรับขึ้นในปีถัดไป · โรคร้ายแรงเป็นไปตาม
            คำนิยาม 1 ใน {table.diseaseCount} โรคในกรมธรรม์
          </p>
        </div>
      )}

      {/* the illness list goes out with or without a price, as on iShield */}
      <ContactButtons copyText={quoteText} cardPath={card} diseaseCardPath={diseaseCardPath("DCI")} />

      {sticky && (quoteText || card) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden">
          <ContactButtons copyText={quoteText} cardPath={card} compact />
        </div>
      )}
    </div>
  );
}
