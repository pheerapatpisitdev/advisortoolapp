"use client";
import { useMemo, useState } from "react";
import type { ModePremium } from "@/calc/mode-premiums";
import type { PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { displayPremium, perDayText } from "@/lib/legacy-cta";
import { sumWords } from "@/lib/ci123-cta";
import { cancerQuoteText, type CancerAge } from "@/lib/cancer-cta";
import {
  CPR_STAGES, HIC_INVASIVE_EXTRA_DAYS, HIC_MAX_DAYS, cancerDeathTotals, cprStagePays, deathTotalsTitle,
} from "@/lib/cancer-benefits";
import { Highlighted } from "@/components/Highlighted";
import { cardPath } from "@/lib/card-link";
import { ContactButtons } from "@/components/sales/ContactButtons";
import type { CancerTable } from "@/lib/cancer-table";
import { PanelPhoto } from "@/components/sales/PanelPhoto";

const PER_LABEL: Record<PayMode, string> = { annual: "ต่อปี", semi: "ต่อ 6 เดือน", monthly: "ต่อเดือน" };
const ROW_MODES: PayMode[] = ["annual", "semi", "monthly"];

/**
 * Opens on a woman of 35 with a million baht of CPR: breast cancer is the commonest cancer in
 * Thai women, and a million is the first tier with a base above the minimum.
 */
const AGE_START = 35;
const SEX_START: Sex = "F";
const TIER_START = 4;

function rowToModes(row: readonly number[] | null | undefined): ModePremium[] | undefined {
  if (!row) return undefined;
  return ROW_MODES.map((mode, i) => ({ mode, total: row[i], belowMinimum: mode === "monthly" && row[3] === 1 }));
}

/**
 * The customer's calculator: a tier, an age and a sex, everything else settled when the
 * arrangement was designed. Every tier is priced for the same person underneath, because
 * "and how much for two million?" is the question that always comes next.
 */
export function CancerCalculator({ table, sticky = false }: { table: CancerTable; sticky?: boolean }) {
  const RANGE = { min: table.ageMin, max: table.ageMax };
  const AGES = useMemo(
    () => Array.from({ length: RANGE.max - RANGE.min + 1 }, (_, i) => RANGE.min + i),
    [RANGE.min, RANGE.max],
  );
  const [tier, setTier] = useState(Math.min(TIER_START, table.tiers.length));
  const [age, setAge] = useState<CancerAge>(AGE_START);
  const [sex, setSex] = useState<Sex>(SEX_START);

  const t = table.tiers[tier - 1];
  const at = typeof age === "number" ? age - table.ageMin : -1;
  const modes = at >= 0 ? rowToModes(table.premiums[sex][tier - 1][at]) : undefined;
  const headline = displayPremium(modes, table.expired);
  const annual = modes?.find((m) => m.mode === "annual");
  const others = (modes ?? [])
    .filter((m) => m.mode !== headline?.mode && !m.belowMinimum)
    .sort((a, b) => a.total - b.total);
  const parts = at >= 0 ? table.parts[sex][tier - 1][at] : null;

  const card = typeof age === "number" && headline
    ? cardPath({ kind: "bundle", bundleCode: table.bundleCode, tier, age, sex, mode: headline.mode })
    : undefined;
  const quoteText = typeof age === "number" && modes && headline
    ? cancerQuoteText({ cpr: t.cpr, hic: t.hic, baseSum: t.baseSum, age, sex, modes, minMonthly: table.minMonthlyTotal })
    : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-6 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
        <div>
          <span className="block text-sm text-[var(--lg-mute)]">ทุนคุ้มครองโรคมะเร็ง</span>
          <div className="lg-figure mt-1.5 text-3xl tabular-nums">
            <span className="lg-metal-text">{t.cpr.toLocaleString("en-US")}</span>{" "}
            <span className="text-lg text-[var(--lg-mute)]">บาท</span>
          </div>
          <div className="mt-1 text-sm text-[var(--lg-mute)]">
            + ชดเชยนอนโรงพยาบาล{" "}
            <span className="lg-figure tabular-nums text-[var(--lg-white)]">วันละ {t.hic.toLocaleString("en-US")}</span> บาท
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {table.tiers.map((x, i) => (
              <button
                key={x.cpr + "-" + x.hic} type="button" onClick={() => setTier(i + 1)} aria-pressed={tier === i + 1}
                className={`rounded-sm border py-2 text-sm leading-tight tabular-nums transition-colors ${
                  tier === i + 1
                    ? "lg-metal-face border-[var(--lg-gold)] font-medium"
                    : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                }`}
              >
                {sumWords(x.cpr)}
                <span className="block text-[0.68rem] opacity-80">วันละ {x.hic.toLocaleString("en-US")}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cancer-age" className="block text-sm text-[var(--lg-mute)]">อายุ</label>
            <select
              id="cancer-age" value={age}
              onChange={(e) => setAge(e.target.value === "" || e.target.value === "other"
                ? (e.target.value as CancerAge)
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
          ชุดนี้รับอายุ {RANGE.min === 0 ? "แรกเกิด" : RANGE.min}–{RANGE.max} ปี ทักมาให้เราช่วยหาแบบที่เหมาะกับคุณ
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
                {/* highlighted, as on the card: the owner's pick of what to read after the headline */}
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
              {/* the three contracts itemised, so the customer sees what the cancer cover alone costs */}
              {parts && (
                <dl className="mt-4 space-y-1.5 border-t border-[var(--lg-panel-line)] pt-3 text-xs text-[var(--lg-mute)]">
                  <div className="flex justify-between gap-3">
                    <dt>คุ้มครองมะเร็ง (CPR) ทุน {t.cpr.toLocaleString("en-US")}</dt>
                    <dd className="tabular-nums">{formatBaht(parts[1])} บาท/ปี</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>ชดเชยรายวัน (HIC) วันละ {t.hic.toLocaleString("en-US")}</dt>
                    <dd className="tabular-nums">{formatBaht(parts[2])} บาท/ปี</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Life Protect x 2 ทุน {t.baseSum.toLocaleString("en-US")}</dt>
                    <dd className="tabular-nums">{formatBaht(parts[0])} บาท/ปี</dd>
                  </div>
                </dl>
              )}
            </div>
          ) : (
            <div className="text-sm font-medium text-[var(--lg-gold)]">ขอราคาปัจจุบันได้ทางแชทด้านล่าง</div>
          )}

          <div className="pt-1">
            <hr className="lg-rule" />
            <div className="pt-4 text-sm text-[var(--lg-mute)]">ตรวจพบมะเร็ง รับเงินก้อนตามระยะ</div>
            <dl className="mt-2 space-y-2">
              {CPR_STAGES.map((s) => (
                <div key={s.label} className="flex items-baseline justify-between gap-3">
                  <dt className={`text-sm ${s.major ? "text-[var(--lg-white)]" : "text-[var(--lg-mute)]"}`}>{s.label}</dt>
                  <dd className={`lg-figure tabular-nums ${s.major ? "text-xl text-[var(--lg-gold)]" : "text-base text-[var(--lg-white)]"}`}>
                    {cprStagePays(s, t.cpr).toLocaleString("en-US")}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="pt-1">
            <hr className="lg-rule" />
            <div className="pt-4 text-sm text-[var(--lg-mute)]">นอนโรงพยาบาลเพราะมะเร็ง รับรายวัน</div>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <span className="text-sm text-[var(--lg-mute)]">
                สูงสุด {HIC_MAX_DAYS} วัน · ระยะลุกลามขยายอีก {HIC_INVASIVE_EXTRA_DAYS} วัน
              </span>
              <span className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">วันละ {t.hic.toLocaleString("en-US")}</span>
            </div>
          </div>

          <div className="pt-1">
            <hr className="lg-rule" />
            <div className="pt-4 text-sm text-[var(--lg-mute)]">เสียชีวิต ครอบครัวได้รับจาก Life Protect x 2</div>
            <dl className="mt-2 space-y-2">
              {(age as number) < t.death.beforeAge && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm text-[var(--lg-mute)]">ก่อนอายุ {t.death.beforeAge} ปี</dt>
                  <dd className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">{t.death.sumBefore.toLocaleString("en-US")} บาท</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-[var(--lg-mute)]">
                  {(age as number) < t.death.beforeAge ? `ตั้งแต่อายุ ${t.death.beforeAge} ปี` : "ตลอดสัญญา"}
                </dt>
                <dd className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">{t.death.sumFrom.toLocaleString("en-US")} บาท</dd>
              </div>
            </dl>
          </div>

          {/* the family's total from all three contracts, the same helper the shared card uses */}
          {(() => {
            const totals = cancerDeathTotals(t.cpr, t.death, age as number);
            return (
              <div className="pt-1">
                <hr className="lg-rule" />
                <div className="pt-4 text-sm text-[var(--lg-mute)]">{deathTotalsTitle(totals)}</div>
                <dl className="mt-2 space-y-2">
                  {totals.rows.map((r) => (
                    <div key={r.label} className="flex items-baseline justify-between gap-3">
                      <dt className="text-sm text-[var(--lg-mute)]">
                        {r.mark ? <Highlighted>{r.label}</Highlighted> : r.label}
                      </dt>
                      <dd className="lg-figure text-lg tabular-nums text-[var(--lg-gold)]">
                        {r.mark
                          ? <Highlighted>{r.amount.toLocaleString("en-US")} บาท</Highlighted>
                          : <>{r.amount.toLocaleString("en-US")} บาท</>}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-xs text-[var(--lg-mute)] opacity-80">
                  เงินมะเร็งจ่ายเมื่อตรวจพบ ไม่ได้จ่ายเมื่อเสียชีวิต · ยังไม่รวมค่าชดเชยรายวัน
                </p>
              </div>
            );
          })()}

          <p className="border-t border-[var(--lg-panel-line)] pt-4 text-xs leading-[1.8] text-[var(--lg-mute)] opacity-80">
            เบี้ยปีแรก ส่วน CPR และ HIC เป็นสัญญาปีต่อปี เบี้ยปรับตามอายุ · โรคมะเร็งเป็นไปตามคำนิยามในกรมธรรม์
          </p>
        </div>
      )}

      {typeof age === "number" && !table.expired && (
        <AllTiers table={table} age={age} sex={sex} tier={tier} onPick={setTier} />
      )}

      <ContactButtons copyText={quoteText} cardPath={card} />

      {sticky && (quoteText || card) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden">
          <ContactButtons copyText={quoteText} cardPath={card} compact />
        </div>
      )}
    </div>
  );
}

/** Every tier for the same person, a row each; tapping a row makes it the one above. */
function AllTiers(
  { table, age, sex, tier, onPick }: { table: CancerTable; age: number; sex: Sex; tier: number; onPick: (t: number) => void },
) {
  const at = age - table.ageMin;
  if (at < 0 || at > table.ageMax - table.ageMin) return null;
  return (
    <div className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
      <div className="text-sm text-[var(--lg-mute)]">
        เบี้ยทุกแพ็ก · {sex === "M" ? "ชาย" : "หญิง"} อายุ {age} ปี
      </div>
      <table className="mt-3 w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-[var(--lg-mute)]">
            <th className="py-1.5 text-left font-normal">ทุน / ต่อวัน</th>
            <th className="py-1.5 text-right font-normal">รายปี</th>
            <th className="py-1.5 text-right font-normal">ราย 6 เดือน</th>
            <th className="py-1.5 text-right font-normal">รายเดือน</th>
          </tr>
        </thead>
        <tbody>
          {table.tiers.map((x, i) => {
            const row = table.premiums[sex][i][at];
            const picked = tier === i + 1;
            return (
              <tr
                key={x.cpr + "-" + x.hic} onClick={() => onPick(i + 1)} aria-selected={picked}
                className={`cursor-pointer border-t border-[var(--lg-panel-line)] ${picked ? "text-[var(--lg-gold)]" : "text-[var(--lg-white)]"}`}
              >
                <td className="py-2">
                  {sumWords(x.cpr)}
                  <span className="ml-1 text-xs opacity-70">/ {x.hic.toLocaleString("en-US")}</span>
                </td>
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
        รวมเบี้ย Life Protect x 2 ของแต่ละแพ็กแล้ว · รายเดือนต้องไม่ต่ำกว่า{" "}
        {table.minMonthlyTotal.toLocaleString("en-US")} บาท (—)
      </p>
    </div>
  );
}
