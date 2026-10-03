"use client";
import { useMemo, useState } from "react";
import type { ModePremium } from "@/calc/mode-premiums";
import type { PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { displayPremium, perDayText } from "@/lib/legacy-cta";
import { ci123QuoteText, stagePays, sumWords, type Ci123Age } from "@/lib/ci123-cta";
import { cardPath, diseaseCardPath } from "@/lib/card-link";
import { ContactButtons } from "@/components/sales/ContactButtons";
import type { Ci123Table } from "@/lib/ci123-table";
import { Highlighted } from "@/components/Highlighted";
import { PanelPhoto } from "@/components/sales/PanelPhoto";

const PER_LABEL: Record<PayMode, string> = { annual: "ต่อปี", semi: "ต่อ 6 เดือน", monthly: "ต่อเดือน" };
const ROW_MODES: PayMode[] = ["annual", "semi", "monthly"];

/**
 * Opens on a priced example, as the legacy page does: a woman of 30 on a million baht of
 * CI 123 — the sum most people land on, and an age with a monthly instalment that stands.
 */
const AGE_START = 30;
const SEX_START: Sex = "F";
const SUM_START = 1_000_000;

function rowToModes(row: readonly number[] | null | undefined): ModePremium[] | undefined {
  if (!row) return undefined;
  return ROW_MODES.map((mode, i) => ({ mode, total: row[i], belowMinimum: mode === "monthly" && row[3] === 1 }));
}

/**
 * The customer's calculator. Everything but the CI 123 sum, the age and the sex was settled
 * when the arrangement was designed. Beside the one sum being looked at, every sum is priced
 * in a table for the same person, because "and how much for two million?" is the question
 * that always comes next — the owner's older page was nothing but that table.
 */
export function Ci123Calculator({ table, sticky = false }: { table: Ci123Table; sticky?: boolean }) {
  const RANGE = { min: table.ageMin, max: table.ageMax };
  const AGES = useMemo(
    () => Array.from({ length: RANGE.max - RANGE.min + 1 }, (_, i) => RANGE.min + i),
    [RANGE.min, RANGE.max],
  );
  const [tier, setTier] = useState(Math.max(1, table.sums.indexOf(SUM_START) + 1));
  const [age, setAge] = useState<Ci123Age>(AGE_START);
  const [sex, setSex] = useState<Sex>(SEX_START);

  const sum = table.sums[tier - 1];
  const at = typeof age === "number" ? age - table.ageMin : -1;
  const modes = at >= 0 ? rowToModes(table.premiums[sex][tier - 1][at]) : undefined;
  const headline = displayPremium(modes, table.expired);
  const annual = modes?.find((m) => m.mode === "annual");
  const others = (modes ?? [])
    .filter((m) => m.mode !== headline?.mode && !m.belowMinimum)
    .sort((a, b) => a.total - b.total);
  const base = at >= 0 ? table.basePremiums[sex][at] : null;

  const card = typeof age === "number" && headline
    ? cardPath({ kind: "bundle", bundleCode: table.bundleCode, tier, age, sex, mode: headline.mode })
    : undefined;
  const quoteText = typeof age === "number" && modes && headline
    ? ci123QuoteText({
      sum, baseSum: table.baseSum, age, sex, modes, minMonthly: table.minMonthlyTotal,
      stages: table.stages, diseaseCount: table.diseaseCount,
    })
    : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-6 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
        <div>
          <span className="block text-sm text-[var(--lg-mute)]">ทุนประกันโรคร้ายแรง CI 123</span>
          <div className="lg-figure mt-1.5 text-3xl tabular-nums">
            <span className="lg-metal-text">{sum.toLocaleString("en-US")}</span>{" "}
            <span className="text-lg text-[var(--lg-mute)]">บาท</span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {table.sums.map((s, i) => (
              <button
                key={s} type="button" onClick={() => setTier(i + 1)} aria-pressed={tier === i + 1}
                className={`rounded-sm border py-2 text-sm tabular-nums transition-colors ${
                  tier === i + 1
                    ? "lg-metal-face border-[var(--lg-gold)] font-medium"
                    : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                }`}
              >
                {sumWords(s)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ci123-age" className="block text-sm text-[var(--lg-mute)]">อายุ</label>
            <select
              id="ci123-age" value={age}
              onChange={(e) => setAge(e.target.value === "" || e.target.value === "other"
                ? (e.target.value as Ci123Age)
                : Number(e.target.value))}
              className="mt-1.5 w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-lg tabular-nums text-[var(--lg-white)]"
            >
              <option value="">เลือกอายุ</option>
              {AGES.map((a) => <option key={a} value={a}>{a === 0 ? "ต่ำกว่า 1 ปี" : `${a} ปี`}</option>)}
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
      ) : age === "other" || !modes ? (
        <div className="rounded-sm border border-[var(--lg-gold)] bg-[var(--lg-panel)] px-5 py-7 text-center text-sm leading-relaxed text-[var(--lg-white)]">
          ชุดนี้รับอายุ {RANGE.min}–{RANGE.max} ปี ทักมาให้เราช่วยหาแบบที่เหมาะกับคุณ
        </div>
      ) : (
        <div className="relative space-y-5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] p-5">
          <PanelPhoto />
          {headline && annual ? (
            <div>
              <div className="text-sm text-[var(--lg-mute)]">เบี้ยประกัน</div>
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
              {/* the two contracts itemised: the price is theirs together, and a customer who
                  is told only the total has no way to see what the rider alone costs */}
              {base !== null && (
                <dl className="mt-4 space-y-1.5 border-t border-[var(--lg-panel-line)] pt-3 text-xs text-[var(--lg-mute)]">
                  <div className="flex justify-between gap-3">
                    <dt>CI 123 ทุน {sum.toLocaleString("en-US")}</dt>
                    <dd className="tabular-nums">{formatBaht(annual.total - base)} บาท/ปี</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Life Protect x 2 ทุน {table.baseSum.toLocaleString("en-US")}</dt>
                    <dd className="tabular-nums">{formatBaht(base)} บาท/ปี</dd>
                  </div>
                </dl>
              )}
            </div>
          ) : (
            <div className="text-sm font-medium text-[var(--lg-gold)]">ขอราคาปัจจุบันได้ทางแชทด้านล่าง</div>
          )}

          <div className="pt-1">
            <hr className="lg-rule" />
            <div className="pt-4 text-sm text-[var(--lg-mute)]">ตรวจพบโรคร้ายแรง รับเงินก้อนตามระยะของโรค</div>
            <dl className="mt-2 space-y-2">
              {table.stages.map((s) => (
                <div key={s.key} className="flex items-baseline justify-between gap-3">
                  {/* the severe stage pays the whole sum, and is marked as on the quote card */}
                  <dt className={`text-sm ${s.major ? "text-[var(--lg-white)]" : "text-[var(--lg-mute)]"}`}>
                    {s.major ? <Highlighted>{s.label}</Highlighted> : s.label}
                  </dt>
                  <dd className={`lg-figure tabular-nums ${s.major ? "text-xl text-[var(--lg-gold)]" : "text-base text-[var(--lg-white)]"}`}>
                    {s.major
                      ? <Highlighted>{stagePays(s, sum).toLocaleString("en-US")}</Highlighted>
                      : stagePays(s, sum).toLocaleString("en-US")}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="pt-1">
            <hr className="lg-rule" />
            <div className="pt-4 text-sm text-[var(--lg-mute)]">เสียชีวิต ครอบครัวได้รับจาก Life Protect x 2</div>
            <dl className="mt-2 space-y-2">
              {(age as number) < table.death.beforeAge && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm text-[var(--lg-mute)]">ก่อนอายุ {table.death.beforeAge} ปี</dt>
                  <dd className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">{table.death.sumBefore.toLocaleString("en-US")} บาท</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-[var(--lg-mute)]">
                  {(age as number) < table.death.beforeAge ? `ตั้งแต่อายุ ${table.death.beforeAge} ปี` : "ตลอดสัญญา"}
                </dt>
                <dd className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">{table.death.sumFrom.toLocaleString("en-US")} บาท</dd>
              </div>
            </dl>
          </div>

          <p className="border-t border-[var(--lg-panel-line)] pt-4 text-xs leading-[1.8] text-[var(--lg-mute)] opacity-80">
            เบี้ยปีแรก ส่วน CI 123 คิดตามอายุ จึงปรับขึ้นในปีถัดไป · โรคร้ายแรงเป็นไปตามคำนิยามในกรมธรรม์
          </p>
        </div>
      )}

      {typeof age === "number" && !table.expired && (
        <AllSums table={table} age={age} sex={sex} tier={tier} onPick={setTier} />
      )}

      {/* the illness list goes out with or without a price, as on iShield */}
      <ContactButtons copyText={quoteText} cardPath={card} diseaseCardPath={diseaseCardPath("CI123")} />

      {sticky && (quoteText || card) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden">
          <ContactButtons copyText={quoteText} cardPath={card} compact />
        </div>
      )}
    </div>
  );
}

/** Every sum for the same person, a row each; tapping a row makes it the one above. */
function AllSums(
  { table, age, sex, tier, onPick }: { table: Ci123Table; age: number; sex: Sex; tier: number; onPick: (t: number) => void },
) {
  const at = age - table.ageMin;
  if (at < 0 || at > table.ageMax - table.ageMin) return null;
  return (
    <div className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
      <div className="text-sm text-[var(--lg-mute)]">
        เบี้ยทุกทุน · {sex === "M" ? "ชาย" : "หญิง"} อายุ {age} ปี
      </div>
      <table className="mt-3 w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-[var(--lg-mute)]">
            <th className="py-1.5 text-left font-normal">ทุน CI 123</th>
            <th className="py-1.5 text-right font-normal">รายปี</th>
            <th className="py-1.5 text-right font-normal">ราย 6 เดือน</th>
            <th className="py-1.5 text-right font-normal">รายเดือน</th>
          </tr>
        </thead>
        <tbody>
          {table.sums.map((s, i) => {
            const row = table.premiums[sex][i][at];
            const picked = tier === i + 1;
            return (
              <tr
                key={s} onClick={() => onPick(i + 1)} aria-selected={picked}
                className={`cursor-pointer border-t border-[var(--lg-panel-line)] ${picked ? "text-[var(--lg-gold)]" : "text-[var(--lg-white)]"}`}
              >
                <td className="py-2">{sumWords(s)}</td>
                <td className="py-2 text-right">{row ? formatBaht(row[0]) : "—"}</td>
                <td className="py-2 text-right">{row ? formatBaht(row[1]) : "—"}</td>
                {/* an instalment the company will not take is not a price, so it is not shown as one */}
                <td className="py-2 text-right">{row && row[3] === 0 ? formatBaht(row[2]) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-[var(--lg-mute)] opacity-80">
        รวมเบี้ย Life Protect x 2 ทุน {table.baseSum.toLocaleString("en-US")} แล้ว · รายเดือนต้องไม่ต่ำกว่า{" "}
        {table.minMonthlyTotal.toLocaleString("en-US")} บาท (—)
      </p>
    </div>
  );
}
