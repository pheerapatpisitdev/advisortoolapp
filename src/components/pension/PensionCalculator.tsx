"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { readCalcStart } from "@/lib/calc-start";
import { MoneyInput } from "@/components/MoneyInput";
import { InsuredFields } from "@/components/InsuredFields";
import {
  availablePensionAges, DCI_LIMITS, MODE_LABEL, PENSION_LIMITS, quotePension,
  type PensionBasis, type PensionMode, type PensionPay, type PensionRiders, type WaiverOption,
} from "@/calc/pension/engine";
import { ContactButtons } from "@/components/sales/ContactButtons";
import { videoStartHref } from "@/lib/quote-video/link";
import { pensionTablePath } from "@/lib/card-link";
import { pensionQuoteText } from "@/lib/pension-cta";
import { Highlighted } from "@/components/Highlighted";
import { Circled } from "@/components/Circled";
import { PenLayer } from "@/components/PenLayer";
import { SiteCredit } from "@/components/sales/SiteCredit";
import { Watermark } from "@/components/sales/Watermark";
import { PensionBandChart } from "./PensionBandChart";
import {
  PENSION_CELL_PAD, PENSION_COLUMNS, PENSION_PEN_SCALE, pensionBraceRoom, pensionCells, pensionMarks,
  pensionPenNotes, pensionRings, type PensionColumn,
} from "@/lib/pension-pen-notes";

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
/** the yearly table's columns after the first, each ruled off from the one before it as the other plans' tables are */
const COL = "border-l border-[var(--op-line)] px-[5px]";
/** the long headings, which take two lines when the pen's room leaves the table short of width */
const WRAPS = new Set<string>(["มูลค่าเวนคืน", "บำนาญสะสม", "คุ้มครองชีวิต"]);

export function PensionCalculator({ sticky = false }: { sticky?: boolean }) {
  const [age, setAge] = useState<number | "">(40);
  const [sex, setSex] = useState<"M" | "F">("M");
  const [pay, setPay] = useState<PensionPay>("untilAnnuity");
  const [annuityAge, setAnnuityAge] = useState<number>(60);
  const [mode, setMode] = useState<PensionMode>("annual");
  const [basis, setBasis] = useState<PensionBasis>("monthlyPension");
  const [amount, setAmount] = useState<number | "">(10_000);

  // สำรวจความคุ้มครอง's summary opens this with the customer's age, sex and yearly budget (owner, 2026-10-22)
  useEffect(() => {
    const s = readCalcStart(window.location.search, { min: PENSION_LIMITS.ageMin, max: PENSION_LIMITS.ageMax }, { min: 1, max: 20_000_000 });
    if (s.age !== undefined) setAge(s.age);
    if (s.sex) setSex(s.sex);
    if (s.premium !== undefined) { setMode("annual"); setBasis("premium"); setAmount(s.premium); }
  }, []);
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
  // the yearly table as the chat sends it: the main contract only, priced from the sum
  const tableCard = q && age !== "" ? pensionTablePath({ age, sex, start: chosenAge, pay, sumAssured: q.sumAssured }) : undefined;

  // the yearly table's pen notes (pension-pen-notes.ts): what is ringed, and the room the braces need
  const tableRef = useRef<HTMLTableElement>(null);
  const rows = q?.illustration ?? [];
  const marks = pensionMarks(rows);
  const rings = pensionRings(rows);
  const ringed = (n: number, c: PensionColumn) => rings.some((g) => g.row === n && g.column === c);
  // room left of the figures for the braces, on the rows a ring has not already widened:
  // the premium brace and its word, and the guarantee's brace clear of the pension's rings
  const braceRoom = pensionBraceRoom(rows);
  const pensionRoom = marks.start >= 0;

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
    <div className="pension-tool calc-split flex flex-col gap-6">
        {/* contents: its two panels are items of the calculator itself, so the inputs can join the left column */}
        <div className="contents">
          {/* the left column on a wide screen (calc-side); on one column it dissolves (contents) */}
          <div className="calc-side contents">
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
            {/* on a phone the buttons follow the result (order-2); beside it they sit under the inputs */}
            <div className="order-2">
              <ContactButtons
                copyText={copyText} tableCardPath={tableCard} tableLabel="ตารางรายปี"
                videoHref={q && age !== "" ? videoStartHref({ product: "PENSION", sex, age, sumAssured: q.sumAssured, annuityAge: chosenAge, pay }) : undefined}
              />
            </div>
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
                <PensionBandChart bands={q.bands} />
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
          <section className="rounded-lg border border-[var(--op-line)] bg-[var(--op-panel)] p-4">
            {/* open by default: the owner wants the year-by-year figures in view, not behind a press */}
            <h3 className="text-sm font-semibold">ตารางผลประโยชน์รายปี</h3>
              <Watermark>
              <div className="mt-3 overflow-x-auto">
                {/* the pen notes are drawn over the table and scroll with it */}
                <div className="relative min-w-full">
                  <table ref={tableRef} className="w-full text-sm tabular-nums">
                    <thead>
                      <tr className="text-right">
                        {PENSION_COLUMNS.map((h, i) => (
                          <th
                            key={h}
                            scope="col"
                            /* white on navy, as the other plans' tables (owner picked ก, 2026-10-11);
                               paper drops the fill (globals.css .print-table th), so there it prints black */
                            className={`bg-[var(--bot-navy)] px-[5px] py-2 align-bottom font-semibold text-white print:!text-black
                              ${i === 0 ? "text-left" : "border-l border-l-white/35"}
                              ${WRAPS.has(h) ? "" : "whitespace-nowrap"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {q.illustration.map((y, n) => {
                        const cells = pensionCells(y);
                        return (
                          <tr key={y.age} className={`border-b border-[var(--op-line)] text-right ${y.pension ? "bg-[var(--op-figure-bg)]" : ""}`}>
                            {PENSION_COLUMNS.map((c, i) => (
                              <td
                                key={c}
                                className={`whitespace-nowrap py-1.5 ${i === 0 ? "px-[5px] text-left" : COL}
                                  ${!ringed(n, c) && c === "เบี้ย" && braceRoom ? "!pl-[50px]" : ""}
                                  ${!ringed(n, c) && c === "บำนาญ" && pensionRoom ? "!pl-[44px]" : ""}
                                  `}
                              >
                                {ringed(n, c) ? <Circled>{cells[c]}</Circled> : cells[c]}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {/* after the table, so the table is there to be measured when the layer first draws */}
                  <PenLayer
                    table={tableRef}
                    figures={q.illustration.flatMap((y) => Object.values(pensionCells(y)))}
                    notes={(g) => pensionPenNotes(q.illustration, q.sumAssured, g)}
                    scale={PENSION_PEN_SCALE} caption={0} cellPad={PENSION_CELL_PAD}
                  />
                </div>
              </div>
              </Watermark>
              <SiteCredit />
          </section>
        )}

        {sticky && copyText && (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden">
            <ContactButtons copyText={copyText} tableCardPath={tableCard} compact />
          </div>
        )}
    </div>
  );
}
