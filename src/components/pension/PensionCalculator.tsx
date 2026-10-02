"use client";
import { useMemo, useState } from "react";
import { MoneyInput } from "@/components/MoneyInput";
import { InsuredFields } from "@/components/InsuredFields";
import {
  availablePensionAges, DCI_LIMITS, MODE_LABEL, PENSION_LIMITS, quotePension,
  type PensionBasis, type PensionMode, type PensionPay, type PensionRiders, type WaiverOption,
} from "@/calc/pension/engine";
import { ContactButtons } from "@/components/sales/ContactButtons";
import { pensionQuoteText } from "@/lib/pension-cta";
import { Highlighted } from "@/components/Highlighted";

/**
 * บำนาญ สมาร์ท 95's calculator, on its own sales page — the main contract worked from
 * whichever figure the customer has in mind, the riders, and the yearly table.
 *
 * Three ways in because customers arrive with three different numbers: a sum they were told
 * about, a premium they can afford, or the monthly income they want at sixty. The last is the
 * one this plan is sold on, so it is where the page starts.
 */

const BASIS_LABEL: Record<PensionBasis, string> = {
  monthlyPension: "บำนาญที่อยากได้ต่อเดือน",
  premium: "เบี้ยที่จ่ายได้ต่องวด",
  sumAssured: "ทุนประกัน",
};

// the three ways in, as buttons: a dropdown hid the premium one from the owner
const BASIS_TAB: Record<PensionBasis, string> = {
  monthlyPension: "จากบำนาญ",
  premium: "จากเบี้ย",
  sumAssured: "จากทุน",
};

const BASIS_HINT: Record<PensionBasis, string> = {
  monthlyPension: "ระบบจะหาทุนและเบี้ยที่ให้บำนาญเท่านี้",
  premium: "ระบบจะหาทุนและบำนาญที่เบี้ยนี้ซื้อได้ (เบี้ยสัญญาหลัก ไม่รวมสัญญาเพิ่มเติม)",
  sumAssured: "75,000–20,000,000 บาท",
};

// dropped, not rounded — the rule every premium in this app is shown by
const baht = (n: number) => Math.floor(n).toLocaleString("en-US");
const baht2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const field = "mt-1 w-full rounded border px-3 py-2";

export function PensionCalculator({ sticky = false }: { sticky?: boolean }) {
  const [age, setAge] = useState<number | "">(40);
  const [sex, setSex] = useState<"M" | "F">("M");
  const [pay, setPay] = useState<PensionPay>("untilAnnuity");
  const [annuityAge, setAnnuityAge] = useState<number>(60);
  const [mode, setMode] = useState<PensionMode>("annual");
  const [basis, setBasis] = useState<PensionBasis>("monthlyPension");
  const [amount, setAmount] = useState<number | "">(10_000);
  // riders: WP and PB are one or the other, so they share a single choice
  const [waiver, setWaiver] = useState<"none" | "WP" | "PB">("none");
  const [waiverOption, setWaiverOption] = useState<WaiverOption>("FIT");
  const [payerAge, setPayerAge] = useState<number | "">(40);
  const [payerSex, setPayerSex] = useState<"M" | "F">("F");
  const [dciOn, setDciOn] = useState(false);
  const [dciSum, setDciSum] = useState<number | "">(1_000_000);

  const riders: PensionRiders = {
    ...(waiver === "WP" ? { wp: { option: waiverOption } } : {}),
    ...(waiver === "PB" && payerAge !== "" ? { pb: { option: waiverOption, payerAge, payerSex } } : {}),
    ...(dciOn && dciSum !== "" ? { dci: { sumAssured: dciSum } } : {}),
  };
  const ridersKey = JSON.stringify(riders);

  const ages = age === "" ? [] : availablePensionAges(age, pay);
  // a pension age this person can no longer choose falls back to the nearest one they can
  const chosenAge = ages.includes(annuityAge as never) ? annuityAge : ages[ages.length - 1] ?? annuityAge;

  const result = useMemo(
    () => (age === "" || amount === "" ? null
      : quotePension({ age, sex, annuityAge: chosenAge, pay, mode, basis, amount, riders })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [age, sex, chosenAge, pay, mode, basis, amount, ridersKey],
  );
  const q = result?.ok ? result.quote : null;
  const who = { age: age === "" ? PENSION_LIMITS.ageMin : age, sex };
  const copyText = q ? pensionQuoteText(who, q) : undefined;

  // switching keeps the same plan on screen: the new box starts at the figure the old one came to
  function switchBasis(next: PensionBasis) {
    if (next === basis) return;
    if (q) {
      setAmount(next === "sumAssured" ? q.sumAssured
        : next === "premium" ? Math.ceil(q.modePremium)
        : q.monthlyPension);
    }
    setBasis(next);
  }

  return (
    <div className="pension-tool space-y-6">
        <div className="grid gap-6">
          <div className="space-y-4 rounded-lg border border-[var(--op-line)] bg-[var(--op-panel)] p-4">
            <InsuredFields age={age} sex={sex} ageRange={{ min: PENSION_LIMITS.ageMin, max: PENSION_LIMITS.ageMax }}
                           onChange={(p) => { if (p.age !== undefined) setAge(p.age); if (p.sex) setSex(p.sex); }} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">ชำระเบี้ย</label>
                <select className={field} value={pay} onChange={(e) => setPay(e.target.value as PensionPay)}>
                  <option value="untilAnnuity">จนถึงอายุรับบำนาญ</option>
                  <option value="6">6 ปี</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">เริ่มรับบำนาญอายุ</label>
                <select className={field} value={chosenAge} disabled={!ages.length}
                        onChange={(e) => setAnnuityAge(Number(e.target.value))}>
                  {ages.map((a) => <option key={a} value={a}>{a} ปี</option>)}
                </select>
              </div>
            </div>
            <div>
              <span className="block text-sm font-medium">คำนวณจาก</span>
              <div role="radiogroup" aria-label="คำนวณจาก" className="mt-1 grid grid-cols-3 gap-1 rounded-lg border border-[var(--op-line)] p-1">
                {(Object.keys(BASIS_TAB) as PensionBasis[]).map((b) => (
                  <button key={b} type="button" role="radio" aria-checked={basis === b} onClick={() => switchBasis(b)}
                          className={`rounded-md px-2 py-2 text-sm font-medium ${basis === b
                            ? "bg-[var(--op-accent)] text-[var(--op-panel)]"
                            : "text-[var(--op-mute)] hover:bg-[var(--op-figure-bg)]"}`}>
                    {BASIS_TAB[b]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">{BASIS_LABEL[basis]} (บาท)</label>
                <MoneyInput value={amount} onChange={setAmount} className={field} hint={BASIS_HINT[basis]} />
              </div>
              <div>
                <label className="block text-sm font-medium">งวดชำระ</label>
                <select className={field} value={mode} onChange={(e) => setMode(e.target.value as PensionMode)}>
                  {(Object.keys(MODE_LABEL) as PensionMode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
                </select>
              </div>
            </div>

            <fieldset className="space-y-3 border-t border-[var(--op-line)] pt-4">
              <legend className="text-sm font-semibold">สัญญาเพิ่มเติม</legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">ยกเว้นเบี้ย</label>
                  <select className={field} value={waiver} onChange={(e) => setWaiver(e.target.value as typeof waiver)}>
                    <option value="none">ไม่ซื้อ</option>
                    <option value="WP">WP — ผู้เอาประกันเป็นอะไรไป</option>
                    <option value="PB">PB — ผู้ชำระเบี้ยเป็นอะไรไป</option>
                  </select>
                </div>
                {waiver !== "none" && (
                  <div>
                    <label className="block text-sm font-medium">แผน</label>
                    <select className={field} value={waiverOption} onChange={(e) => setWaiverOption(e.target.value as WaiverOption)}>
                      <option value="FIT">Fit (เสียชีวิต/ทุพพลภาพ)</option>
                      <option value="BEYOND">Beyond (+โรคร้ายแรง)</option>
                    </select>
                  </div>
                )}
              </div>
              {waiver === "PB" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium">อายุผู้ชำระเบี้ย</label>
                    <input type="number" inputMode="numeric" min={20} max={70} className={field} value={payerAge}
                           onChange={(e) => setPayerAge(e.target.value === "" ? "" : Number(e.target.value))} />
                    <p className="mt-1 text-xs text-[var(--op-mute)]">20–70 ปี</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">เพศผู้ชำระเบี้ย</label>
                    <select className={field} value={payerSex} onChange={(e) => setPayerSex(e.target.value as "M" | "F")}>
                      <option value="M">ชาย</option>
                      <option value="F">หญิง</option>
                    </select>
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={dciOn} onChange={(e) => setDciOn(e.target.checked)} />
                DCI — โรคร้ายแรง
              </label>
              {dciOn && (
                <div>
                  <label className="block text-sm font-medium">ทุน DCI (บาท)</label>
                  <MoneyInput value={dciSum} onChange={setDciSum} className={field}
                              hint={`${DCI_LIMITS.saMin.toLocaleString("en-US")}–${DCI_LIMITS.saMax.toLocaleString("en-US")} บาท · อายุ ${DCI_LIMITS.ageMin}–${DCI_LIMITS.ageMax} ปี · คุ้มครองถึงอายุ ${DCI_LIMITS.coverToAge}`} />
                </div>
              )}
            </fieldset>
          </div>

          <div className="space-y-4 rounded-lg border border-[var(--op-line)] bg-[var(--op-panel)] p-4">
            {result && !result.ok && (
              <div className="rounded-lg bg-[var(--op-error-bg)] p-4">
                <div className="text-lg font-semibold text-[var(--op-error-strong)]">คิดแบบนี้ไม่ได้</div>
                <div className="mt-1 text-sm text-[var(--op-error)]">{result.error}</div>
              </div>
            )}
            {!result && <p className="text-sm text-[var(--op-mute)]">กรอกอายุและจำนวนเงินเพื่อคำนวณ</p>}
            {q && (
              <>
                <div className="rounded-lg bg-[var(--op-figure-bg)] p-4">
                  <div className="text-sm text-[var(--op-accent)]">
                    เบี้ยประกัน{q.riders.length ? "รวม" : ""} ({MODE_LABEL[q.mode]})
                  </div>
                  <div className="text-2xl font-semibold tabular-nums text-[var(--op-figure)]">{baht2(q.totalModePremium)} บาท</div>
                  <div className="mt-1 text-xs text-[var(--op-accent)]">
                    {/* the yearly figure, marked as every quote card marks its price lines */}
                    <Highlighted>ปีละ {baht2(q.totalAnnualPremium)} บาท</Highlighted> · ชำระ {q.payYears} ปี
                  </div>
                  {q.riders.length > 0 && (
                    <table className="mt-3 w-full text-sm">
                      <tbody>
                        <tr className="border-t border-[var(--op-line)]">
                          <td className="py-1.5">สัญญาหลัก</td>
                          <td className="py-1.5 text-right tabular-nums">{baht2(q.modePremium)}</td>
                        </tr>
                        {q.riders.map((r) => (
                          <tr key={r.code} className="border-t border-[var(--op-line)]">
                            <td className="py-1.5">
                              {r.label}
                              {r.error && <div className="text-xs text-[var(--op-error)]">{r.error}</div>}
                              {!r.error && r.code === "DCI" && <div className="text-xs text-[var(--op-mute)]">เบี้ยปีแรก ปรับขึ้นตามอายุทุกปี</div>}
                            </td>
                            <td className="py-1.5 text-right tabular-nums">{r.error ? "–" : baht2(r.modePremium)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[var(--op-mute)]">ทุนประกัน</dt>
                    <dd className="text-lg font-semibold tabular-nums">{baht(q.sumAssured)} บาท</dd>
                  </div>
                  <div>
                    {/* what a pension is bought for: the monthly income it starts paying */}
                    <dt className="text-[var(--op-mute)]"><Highlighted>บำนาญช่วงแรก (รับรายเดือน)</Highlighted></dt>
                    <dd className="text-lg font-semibold tabular-nums"><Highlighted>{baht(q.monthlyPension)} บาท/เดือน</Highlighted></dd>
                  </div>
                </dl>
                <table className="w-full text-sm [&_td+td]:border-l [&_th+th]:border-l [&_td+td]:border-[var(--op-line)] [&_th+th]:border-[var(--op-line)] [&_td]:px-2 [&_th]:px-2">
                  <thead>
                    <tr className="border-b border-[var(--op-line)] text-left text-[var(--op-mute)]">
                      <th className="py-2">อายุ</th>
                      <th className="py-2 text-right">% ของทุน</th>
                      <th className="py-2 text-right">บำนาญต่อปี</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.bands.map((b) => (
                      <tr key={b.fromAge} className="border-b border-[var(--op-line)]">
                        <td className="py-2">{b.fromAge}–{b.toAge}</td>
                        <td className="py-2 text-right tabular-nums">{Math.round(b.percent * 100)}%</td>
                        <td className="py-2 text-right tabular-nums">{baht(b.annual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-sm">
                  รับบำนาญรวมถึงอายุ 95 <span className="font-semibold tabular-nums">{baht(q.totalPension)} บาท</span>
                  {" "}จากเบี้ยสัญญาหลักรวม {baht(q.totalPremium)} บาท
                  {q.irr !== null && <> · IRR ≈ {(q.irr * 100).toFixed(2)}%</>}
                </p>
                <p className="text-xs text-[var(--op-mute)]">
                  รับประกันจ่ายบำนาญ 15 ปีแรก · เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน · ตารางรายปีและเบี้ยรวมตลอดสัญญาคิดเฉพาะสัญญาหลัก
                </p>
              </>
            )}
          </div>
        </div>

        {q && (
          <section className="mt-6 rounded-lg border border-[var(--op-line)] bg-[var(--op-panel)] p-4">
            {/* open by default: the owner wants the year-by-year figures in view, not behind a press */}
            <h3 className="text-sm font-semibold">ตารางผลประโยชน์รายปี</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm tabular-nums [&_td+td]:border-l [&_th+th]:border-l [&_td+td]:border-[var(--op-line)] [&_th+th]:border-[var(--op-line)] [&_td]:px-2 [&_th]:px-2">
                  <thead>
                    <tr className="border-b border-[var(--op-line)] text-right text-[var(--op-mute)]">
                      <th className="py-2 text-left">อายุ</th>
                      <th className="py-2">ปีที่</th>
                      <th className="py-2">เบี้ย</th>
                      <th className="py-2">เบี้ยสะสม</th>
                      <th className="py-2">มูลค่าเวนคืน</th>
                      <th className="py-2">คุ้มครองชีวิต</th>
                      <th className="py-2">บำนาญ</th>
                      <th className="py-2">บำนาญสะสม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.illustration.map((y) => (
                      <tr key={y.age} className={`border-b border-[var(--op-line)] text-right ${y.pension ? "bg-[var(--op-figure-bg)]" : ""}`}>
                        <td className="py-1.5 text-left">{y.age}</td>
                        <td className="py-1.5">{y.policyYear}</td>
                        <td className="py-1.5">{y.premium ? baht(y.premium) : "–"}</td>
                        {/* only while premiums are still being paid; after that it is one number repeated */}
                        <td className="py-1.5">{y.premium ? baht(y.cumPremium) : "–"}</td>
                        <td className="py-1.5">{y.cashValue ? baht(y.cashValue) : "–"}</td>
                        <td className="py-1.5">{baht(y.deathBenefit)}</td>
                        <td className="py-1.5">{y.pension ? baht(y.pension) : "–"}</td>
                        <td className="py-1.5">{y.cumPension ? baht(y.cumPension) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </section>
        )}

        <ContactButtons copyText={copyText} />
        {sticky && copyText && (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden">
            <ContactButtons copyText={copyText} compact />
          </div>
        )}
    </div>
  );
}
