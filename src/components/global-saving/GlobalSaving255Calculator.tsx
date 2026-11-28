"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { readCalcStart } from "@/lib/calc-start";
import { MoneyInput } from "@/components/MoneyInput";
import { Highlighted } from "@/components/Highlighted";
import { Watermark } from "@/components/sales/Watermark";
import { boxIn, GsPens, textIn } from "@/components/global-saving/GsPens";
import { barPens, GS25_TABLE_COLUMNS, tablePens } from "@/lib/global-saving-pens";
import { BLUE_PEN } from "@/lib/card-theme";
import { ContactButtons } from "@/components/sales/ContactButtons";
import { videoStartHref } from "@/lib/quote-video/link";
import { gsaving255CardPath } from "@/lib/global-saving-card";
import { gs255QuoteText } from "@/lib/global-saving-text";
import {
  GS25_AGE_MAX, GS25_AGE_MIN, GS25_CODE, GS25_MAX_SA, GS25_MIN_SA, GS25_PREM_YEARS, GS25_TAX_CAP, GS25_TERM,
  quoteGlobalSaving255, type Gs25Basis,
} from "@/calc/global-saving/engine-25-5";

/**
 * Global Savings Plus 25/5's calculator, laid out as 15/8's is (GlobalSavingCalculator.tsx): age
 * and a premium or a sum on the left; on the right the guaranteed total and five index returns as
 * stacked bars (owner, 2026-11-16: +2% and +4% beside the company's own −1%, 3% and 5%, as on
 * 15/8); under both, the overview against a bank and the year-by-year table, with 15/8's red
 * and blue pen notes on the bars and the table (owner, 2026-11-16). This plan pays its index
 * bonus four times and the table carries the surrender value, so the two pages do not share a
 * component. ส่งให้ลูกค้า sends the whole page as one picture and the quote as text, as 15/8's
 * does, and สร้างวิดีโอ opens วิดีโอนำเสนอ on this plan (owner, 2026-11-16).
 */

const baht = (n: number) => Math.round(n).toLocaleString("en-US");
/** a premium worked back from a sum keeps its satang, as the company's own quote does */
const premium = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const pct = (r: number) => `${r >= 0 ? "+" : "−"}${+(Math.abs(r) * 100).toFixed(2)}%`;
/** Table 1 shows the +4% index alone beside the banks (owner chose ก ก, 2026-11-27); the chart and Table 2 keep all five. */
const onlyPlus4 = (s: { rate: number }) => Math.abs(s.rate - 0.04) < 1e-9;
const field = "mt-1 w-full rounded border px-3 py-2";

/** the bonus part of each bar, lighter for a weak index and deeper for a strong one, all on the page's navy */
const BONUS_FILL = ["var(--gs-b1)", "var(--gs-b2)", "var(--gs-b3)", "var(--gs-b4)", "var(--gs-b5)"];
const BONUS_INK = ["var(--lg-white)", "var(--lg-white)", "var(--lg-white)", "#fff", "#fff"];

const TH = "bg-[var(--bot-navy)] px-2 py-2 text-right align-bottom font-semibold text-white print:!text-black border-l border-l-white/35";
const TD = "whitespace-nowrap px-2 py-1.5 text-right";

function Tag({ guaranteed }: { guaranteed: boolean }) {
  return (
    <span className={`ml-1.5 inline-block rounded px-1.5 text-[11px] font-semibold align-[1px]
      ${guaranteed ? "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]" : "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]"}`}>
      {guaranteed ? "การันตี" : "ไม่การันตี"}
    </span>
  );
}

export function GlobalSaving255Calculator() {
  const [age, setAge] = useState(35);
  const [basis, setBasis] = useState<Gs25Basis>("premium");
  const [amount, setAmount] = useState<number | "">(100_000);
  /**
   * Table 2's five index columns show either the bonus paid in years 10, 15, 20 and 25, or the
   * surrender value with the index share riding on it, from a switch above the table (owner chose
   * ข, 2026-11-28). Printing gives whichever is showing.
   */
  const [bonusView, setBonusView] = useState<"paid" | "surrender">("paid");

  // a link may open this with the customer's age and yearly budget, as it does 15/8 (src/lib/calc-start.ts)
  useEffect(() => {
    const s = readCalcStart(window.location.search, { min: GS25_AGE_MIN, max: GS25_AGE_MAX }, { min: GS25_MIN_SA, max: GS25_MAX_SA });
    if (s.age !== undefined) setAge(s.age);
    if (s.premium !== undefined) { setBasis("premium"); setAmount(s.premium); }
  }, []);

  const q = useMemo(() => (amount === "" || amount <= 0 ? null : quoteGlobalSaving255({ basis, amount, age })), [basis, amount, age]);

  // switching keeps the same plan on screen: the new box starts at the figure the old one came to
  function switchBasis(next: Gs25Basis) {
    if (next === basis) return;
    if (q) setAmount(next === "premium" ? Math.ceil(q.premium) : q.sa);
    setBasis(next);
  }

  // ส่งให้ลูกค้า: the whole page as one picture and the quote as text, only for a quote the plan allows
  const sendable = q && !q.warnings.length ? q : null;
  const copyText = sendable ? gs255QuoteText(age, sendable) : undefined;
  const tableCard = sendable && amount !== "" ? gsaving255CardPath({ age, basis, amount }) : undefined;
  const videoHref = sendable ? videoStartHref({ product: "GSAVING", gsPlan: "25/5", age, premium: Math.ceil(sendable.premium) }) : undefined;

  const top = q ? Math.max(...q.scenarios.map((s) => s.total)) * 1.12 : 1;
  const bonusYears = q ? q.scenarios[0].bonuses.map((b) => b.year) : [];

  // the pen notes (lib/global-saving-pens.ts), aimed by measuring the table and the bars as drawn
  const yearly = useRef<HTMLTableElement>(null);
  const bars = useRef<HTMLDivElement>(null);
  const penKey = q ? `${q.sa}|${q.premium}|${age}|${bonusView}` : "";
  const drawTable = (el: HTMLElement) => {
    const rows = (el as HTMLTableElement).tBodies[0]?.rows;
    if (!q || !rows || rows.length < GS25_TERM) return null;
    return tablePens(
      { cell: (y, c) => boxIn(rows[y - 1].cells[c], el), text: (y, c) => textIn(rows[y - 1].cells[c], el) },
      { premYears: GS25_PREM_YEARS, term: GS25_TERM, payback: q.scenarios[0].rows[0].payback, maturity: q.scenarios[0].maturity,
        // the bonus notes name a payout, so they are left off when the columns hold surrender values
        bonusYears: bonusView === "paid" ? bonusYears : [], maturityPct: 501, columns: GS25_TABLE_COLUMNS },
    );
  };
  const drawBars = (el: HTMLElement) => {
    const cols = [...el.querySelectorAll("[data-bar]")];
    if (!q || !cols.length) return null;
    const last = cols[cols.length - 1].querySelector("[data-bonus]");
    return barPens({
      guaranteed: cols.map((c) => boxIn(c.querySelector("[data-guaranteed]")!, el)),
      totals: cols.map((c) => boxIn(c.querySelector("[data-total]")!, el)),
      topBonus: last ? boxIn(last, el) : null,
    }, q.guaranteed);
  };

  return (
    <div className="gs-tool flex flex-col gap-8">
      <div className="calc-split flex flex-col gap-6">
        <div className="calc-side contents">
          <div className="space-y-4 rounded-lg border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] p-4">
            <div>
              <label htmlFor="gs25-age" className="block text-sm font-medium">อายุ</label>
              <select id="gs25-age" className={field} value={age} onChange={(e) => setAge(Number(e.target.value))}>
                {Array.from({ length: GS25_AGE_MAX - GS25_AGE_MIN + 1 }, (_, i) => GS25_AGE_MIN + i).map((a) => (
                  <option key={a} value={a}>{a} ปี</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--lg-mute)]">อายุ 66 ปีขึ้นไปเบี้ยสูงขึ้น · อายุมีผลกับมูลค่าเวนคืน</p>
            </div>
            <div>
              <span className="block text-sm font-medium">คำนวณจาก</span>
              <div role="radiogroup" aria-label="คำนวณจาก" className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-[var(--lg-panel-line)] p-1">
                {(["premium", "sumAssured"] as const).map((b) => (
                  <button key={b} type="button" role="radio" aria-checked={basis === b} onClick={() => switchBasis(b)}
                          className={`rounded-md px-2 py-2 text-sm font-medium ${basis === b
                            ? "bg-[var(--bot-navy)] text-white" : "text-[var(--lg-white)]"}`}>
                    {b === "premium" ? "เบี้ยต่อปี" : "ทุนประกัน"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium">{basis === "premium" ? "เบี้ยต่อปี" : "ทุนประกัน"} (บาท)</label>
              <MoneyInput value={amount} onChange={setAmount} className={field} max={GS25_MAX_SA}
                          hint={`ทุนประกัน ${GS25_MIN_SA.toLocaleString("en-US")} – ${GS25_MAX_SA.toLocaleString("en-US")} บาท`} />
            </div>
            {q && (
              <div className="rounded-md bg-[var(--lg-panel)] px-3 py-2 text-sm">
                {basis === "premium"
                  ? <>ได้ทุนประกัน <b className="text-base tabular-nums">{baht(q.sa)}</b> บาท</>
                  : <>เบี้ยต่อปี <b className="text-base tabular-nums">{premium(q.premium)}</b> บาท</>}
              </div>
            )}
            {q?.warnings.map((w) => (
              <div key={w} role="alert" className="rounded-md bg-[var(--bot-red-soft)] px-3 py-2 text-sm text-[var(--bot-red-ink)]">{w}</div>
            ))}
            {q?.notes.map((n) => (
              <div key={n} className="rounded-md bg-[var(--bot-sand-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--bot-sand-ink)]">{n}</div>
            ))}
            {q ? <ContactButtons copyText={copyText} tableCardPath={tableCard} tableLabel="ตาราง + ดัชนี" videoHref={videoHref} /> : null}
            <div className="space-y-0.5 border-t border-[var(--lg-hair)] pt-3 text-xs leading-relaxed text-[var(--lg-mute)]">
              <div>รหัสแบบ {GS25_CODE} · กรุงไทย-แอกซา</div>
              <div>เงินคืน 1% ของทุนทุกปี · ครบสัญญา 501% ของทุน</div>
              <div>โบนัสดัชนี (ไม่การันตี) จ่ายสิ้นปี 10, 15, 20 และครบสัญญา</div>
            </div>
          </div>
        </div>

        {!q && <p className="text-sm text-[var(--lg-mute)]">กรอกจำนวนเงินเพื่อคำนวณ</p>}
        {q && (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-x-6 gap-y-4 rounded-lg bg-[var(--lg-panel)] p-4">
              <div>
                <div className="text-sm text-[var(--lg-mute)]">เงินการันตีรวม (เงินคืน + ครบสัญญา)</div>
                <div className="whitespace-nowrap text-2xl font-semibold tabular-nums sm:text-3xl"><Highlighted>{baht(q.guaranteed)} บาท</Highlighted></div>
                <div className="text-xs text-[var(--lg-mute)]">จากเบี้ยรวม {baht(GS25_PREM_YEARS * q.premium)} บาท · ได้แน่นอน</div>
              </div>
              <Figure label="ทุนประกัน" value={baht(q.sa)} note="บาท" />
              <Figure label={`เบี้ยต่อปี × ${GS25_PREM_YEARS} ปี`} value={premium(q.premium)}
                      note={`ลดหย่อนภาษีได้ ${baht(Math.min(q.premium, GS25_TAX_CAP))} บาท/ปี`} />
              <Figure label="คุ้มครองชีวิต" value={baht(q.scenarios[0].rows[0].death)}
                      note={`ปีแรก → สูงสุด ${baht(q.scenarios[0].rows[GS25_PREM_YEARS - 1].death)}`} />
            </div>

            <section>
              <h2 className="text-base font-semibold">
                เงินรับรวมเมื่อถือครบ {GS25_TERM} ปี <span className="ml-1 text-sm font-normal text-[var(--lg-mute)]">แยกตามผลตอบแทนดัชนีต่อปี</span>
              </h2>
              <div className="relative mt-3">
              <div ref={bars} className="grid h-56 grid-cols-5 items-end gap-1.5 border-b border-[var(--lg-panel-line)] pt-12 sm:h-64 sm:gap-2.5" aria-hidden>
                {q.scenarios.map((s, i) => {
                  const bonus = s.total - q.guaranteed;
                  return (
                    <div key={s.rate} data-bar className="flex h-full flex-col justify-end text-center">
                      <div data-total className="mb-1 text-xs font-semibold tabular-nums sm:text-sm">{baht(s.total)}</div>
                      {bonus > 0 && (
                        <div data-bonus className="flex justify-center rounded-t pt-0.5 text-[10px] tabular-nums sm:text-xs"
                             style={{ height: `${bonus / top * 100}%`, background: BONUS_FILL[i], color: BONUS_INK[i] }}>
                          +{baht(bonus)}
                        </div>
                      )}
                      <div data-guaranteed className="flex items-center justify-center bg-[var(--bot-navy)] text-[10px] text-white sm:text-xs"
                           style={{ height: `${q.guaranteed / top * 100}%` }}>
                        {i === 0 ? "การันตี" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
              <GsPens over={bars} draw={drawBars} deps={penKey} />
              </div>
              <div className="mt-1.5 grid grid-cols-5 gap-1.5 text-center text-xs text-[var(--lg-mute)] sm:gap-2.5 sm:text-sm">
                {q.scenarios.map((s) => (
                  <div key={s.rate}>ดัชนี {pct(s.rate)}<br /><b className="text-[var(--lg-white)]">IRR {s.irr.toFixed(2)}%</b></div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--lg-mute)]">
                <span><i className="mr-1.5 inline-block h-2.5 w-2.5 bg-[var(--bot-navy)] align-[-1px]" />เงินการันตี เท่ากันทุกแท่ง</span>
                <span><i className="mr-1.5 inline-block h-2.5 w-2.5 bg-[var(--gs-b3)] align-[-1px]" />โบนัสดัชนี ไม่การันตี</span>
              </div>
            </section>
          </>
        )}
      </div>

      {q && (
        <>
          <section>
            <h2 className="text-base font-semibold">
              ตารางที่ 1 · ภาพรวมผลประโยชน์ <span className="ml-1 text-sm font-normal text-[var(--lg-mute)]">เมื่ออยู่ครบสัญญา {GS25_TERM} ปี เทียบกับฝากธนาคาร</span>
            </h2>
            <Watermark>
            <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--lg-panel-line)]">
              <table className="print-table w-full text-sm tabular-nums">
                <thead>
                  <tr>
                    <th scope="col" className={`${TH} !border-l-0 !text-left`}>รายการผลประโยชน์</th>
                    {q.scenarios.filter(onlyPlus4).map((s) => <th key={s.rate} scope="col" className={`${TH} whitespace-nowrap`}>ดัชนี {pct(s.rate)}</th>)}
                    {q.banks.map((b) => <th key={b.rate} scope="col" className={`${TH} gs-bank whitespace-nowrap`}>ฝากธนาคาร {+(b.rate * 100).toFixed(2)}%</th>)}
                  </tr>
                </thead>
                <tbody>
                  <Row label={<>เงินคืนรายปี (สิ้นปี 1–{GS25_TERM - 1})<Tag guaranteed /></>}
                       cells={q.scenarios.filter(onlyPlus4).map((s) => baht(s.paybackTotal))} banks={q.banks.map(() => "—")} />
                  <Row label={<>เงินครบสัญญา (สิ้นปี {GS25_TERM})<Tag guaranteed /></>}
                       cells={q.scenarios.filter(onlyPlus4).map((s) => baht(s.maturity))} banks={q.banks.map((b) => baht(b.total))} />
                  {q.scenarios[0].bonuses.map((b, bi) => (
                    <Row key={b.year} bonus
                         label={<>โบนัสดัชนี · {b.year === GS25_TERM ? "ครบสัญญา" : `สิ้นปี ${b.year}`}<Tag guaranteed={false} /></>}
                         cells={q.scenarios.filter(onlyPlus4).map((s) => (s.bonuses[bi].value > 0 ? baht(s.bonuses[bi].value) : "—"))}
                         banks={q.banks.map(() => "—")} />
                  ))}
                  <Row total label="รวมรับทั้งหมดตลอดสัญญา"
                       cells={q.scenarios.filter(onlyPlus4).map((s) => baht(s.total))} banks={q.banks.map((b) => baht(b.total))} />
                  <Row strong label="ผลตอบแทนเฉลี่ยต่อปี (IRR)"
                       cells={q.scenarios.filter(onlyPlus4).map((s) => `${s.irr.toFixed(2)}%`)} banks={q.banks.map((b) => `${+(b.rate * 100).toFixed(2)}%`)} />
                </tbody>
              </table>
            </div>
            </Watermark>
          </section>

          <section>
            <h2 className="text-base font-semibold">
              ตารางที่ 2 · ผลประโยชน์รายปี <span className="ml-1 text-sm font-normal text-[var(--lg-mute)]">ปีที่ 1–{GS25_TERM}</span>
            </h2>
            <div role="group" aria-label="ช่องดัชนีในตาราง" className="mt-2 inline-flex gap-1 rounded-full border border-[var(--lg-panel-line)] p-1 text-sm print:hidden">
              {([["paid", "โบนัสที่ได้รับ"], ["surrender", "มูลค่าเวนคืนรวมโบนัส"]] as const).map(([v, label]) => (
                <button key={v} type="button" aria-pressed={bonusView === v} onClick={() => setBonusView(v)}
                  className={`rounded-full px-3.5 py-1 ${bonusView === v ? "bg-[var(--bot-navy)] font-semibold text-white" : "font-medium text-[var(--bot-ink)] hover:bg-[var(--lg-panel)]"}`}>
                  {label}
                </button>
              ))}
            </div>
            <Watermark>
            <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--lg-panel-line)]">
              {/* the pen notes are drawn over the table and scroll with it */}
              <div className="relative min-w-max">
              <table ref={yearly} className="print-table w-full min-w-full text-sm tabular-nums">
                <thead>
                  <tr>
                    <th colSpan={2} className="bg-[var(--bot-navy-deep)] print:!bg-transparent" />
                    <th colSpan={5} scope="colgroup" className={`${TH} !bg-[var(--bot-navy-deep)] !text-center text-xs`}>ส่วนการันตี</th>
                    <th colSpan={q.scenarios.length} scope="colgroup" className={`${TH} !bg-[var(--bot-navy-lift)] !text-center text-xs`}>
                      {bonusView === "paid" ? "โบนัสดัชนี (ไม่การันตี)" : "มูลค่าเวนคืนรวมโบนัสดัชนี (ไม่การันตี)"}
                    </th>
                    <th className="border-l border-l-white/35 bg-[var(--bot-navy-deep)] print:!bg-transparent" />
                  </tr>
                  <tr>
                    {["ปีที่", "อายุ", "เบี้ยต่อปี", "เบี้ยสะสม", "เงินคืน", "คุ้มครองชีวิต", "มูลค่าเวนคืน"].map((h, i) => (
                      <th key={h} scope="col" className={`${TH} whitespace-nowrap ${i === 0 ? "!border-l-0 !text-left" : ""}`}>{h}</th>
                    ))}
                    {q.scenarios.map((s) => <th key={s.rate} scope="col" className={`${TH} whitespace-nowrap`}>{pct(s.rate)}</th>)}
                    <th scope="col" className={`${TH} whitespace-nowrap`}>ลดหย่อนภาษี</th>
                  </tr>
                </thead>
                <tbody>
                  {q.scenarios[0].rows.map((r) => (
                    <tr key={r.year} className={`border-t border-[var(--lg-hair)] even:bg-[var(--lg-panel)]/50
                      ${r.year === GS25_PREM_YEARS ? "border-b-2 border-b-[var(--bot-navy)]" : ""}`}>
                      <td className={`${TD} !text-left`}>{r.year}</td>
                      <td className={TD}>{age + r.year - 1}</td>
                      <td className={TD}>{r.premium ? baht(r.premium) : ""}</td>
                      <td className={TD}>{r.year <= GS25_PREM_YEARS ? baht(r.paid) : ""}</td>
                      <td className={`${TD} ${r.year === GS25_TERM ? "font-semibold" : ""}`}>
                        {r.year === GS25_TERM ? <Highlighted>{baht(r.payback)}</Highlighted> : baht(r.payback)}
                      </td>
                      <td className={TD}>{baht(r.death)}</td>
                      <td className={TD}>{r.surrender > 0 ? baht(r.surrender) : "—"}</td>
                      {bonusView === "surrender" && q.scenarios.map((s) => {
                        const row = s.rows[r.year - 1];
                        return <td key={s.rate} className={TD}>{row.surrender > 0 ? baht(row.surrender + row.surrenderBonus) : "—"}</td>;
                      })}
                      {bonusView === "paid" && q.scenarios.map((s) => {
                        const b = s.bonuses.find((x) => x.year === r.year);
                        return (
                          <td key={s.rate} className={`${TD} ${b ? "font-semibold text-[var(--bot-navy-lift)]" : ""}`}>
                            {b ? (b.value > 0 ? baht(b.value) : "—") : ""}
                          </td>
                        );
                      })}
                      <td className={TD}>{r.premium ? baht(Math.min(r.premium, GS25_TAX_CAP)) : ""}</td>
                    </tr>
                  ))}
                  {/* the last line is everything received in each scenario — paybacks, maturity and the bonuses together */}
                  <tr className="bg-[var(--bot-navy)] font-bold text-white print:bg-transparent print:!text-black">
                    <td className={`${TD} !text-left font-semibold`} colSpan={2}>รวมรับทั้งหมด</td>
                    <td className={TD}>{baht(GS25_PREM_YEARS * q.premium)}</td>
                    <td className={TD} />
                    <td className={TD}>{baht(q.guaranteed)}</td>
                    <td className={TD} />
                    <td className={TD} />
                    {/* a surrender value is not added up over the years, so those columns stay empty here */}
                    {q.scenarios.map((s) => <td key={s.rate} className={TD}>{bonusView === "paid" ? baht(s.total) : ""}</td>)}
                    <td className={TD}>{baht(GS25_PREM_YEARS * Math.min(q.premium, GS25_TAX_CAP))}</td>
                  </tr>
                </tbody>
              </table>
              <GsPens over={yearly} draw={drawTable} deps={penKey} />
              </div>
            </div>
            </Watermark>
            <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
              <span style={{ color: BLUE_PEN }}>✎ ปากกาน้ำเงิน = เงินที่การันตี ได้แน่นอน</span>
              <span className="text-[var(--lg-pen)]">✎ ปากกาแดง = เบี้ยที่จ่าย และโบนัสดัชนีที่ไม่การันตี</span>
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-[var(--lg-mute)]">
              <li>โบนัสดัชนีจ่ายจริง {bonusYears.length} ครั้ง คือสิ้นปีที่ {bonusYears.slice(0, -1).join(", ")} และตอนครบสัญญา ปีอื่นจึงเว้นว่าง</li>
              <li>
                โบนัสแต่ละครั้ง = เบี้ยที่จ่ายมาทั้งหมด × ส่วนที่ดัชนีขึ้นจากวันเริ่ม × 90% × อัตราจ่ายของปีนั้น
                (ปี 10 จ่าย 5% · ปี 15 จ่าย 10% · ปี 20 จ่าย 15% · ครบสัญญาจ่าย 70%) ดัชนีติดลบได้ 0 ไม่ถูกหักเงิน
              </li>
              <li>ดัชนี −1%, +3% และ +5% ตรงกับตัวอย่างในใบเสนอขายของบริษัท ส่วน +2% และ +4% จำลองด้วยสูตรเดียวกัน</li>
              <li>
                มูลค่าเวนคืนเป็นส่วนการันตี ยังไม่รวมโบนัสดัชนีที่อาจได้เพิ่มเมื่อเวนคืนตั้งแต่ปีที่ 6
                กด “มูลค่าเวนคืนรวมโบนัส” เหนือตารางเพื่อดูยอดรวมตามแต่ละอัตราดัชนี (ไม่การันตี)
              </li>
              <li>คุ้มครองชีวิตปีที่ 1–2 จ่าย 102% ของเบี้ยที่ชำระแล้ว ปีที่ 3 จ่าย 315% ปีที่ 4 จ่าย 420% และตั้งแต่ปีที่ 5 จ่าย 535% ของทุน</li>
            </ul>
          </section>
        </>
      )}

      {/* on a phone the send bar stays at the foot of the screen, as on the other plans' pages */}
      {copyText && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden">
          <ContactButtons copyText={copyText} tableCardPath={tableCard} tableLabel="ตาราง + ดัชนี" compact />
        </div>
      )}
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <div className="text-sm text-[var(--lg-mute)]">{label}</div>
      <div className="text-xl font-semibold tabular-nums text-[var(--lg-gold)]">{value}</div>
      <div className="text-xs text-[var(--lg-mute)]">{note}</div>
    </div>
  );
}

function Row({ label, cells, banks, total = false, strong = false, bonus = false }: {
  label: React.ReactNode; cells: string[]; banks: string[]; total?: boolean; strong?: boolean; bonus?: boolean;
}) {
  return (
    <tr className={`border-t ${total ? "border-t-2 border-[var(--lg-panel-line)] bg-[var(--bot-navy-soft)] font-semibold text-[var(--bot-navy)]"
      : "border-[var(--lg-hair)]"} ${strong ? "font-semibold" : ""}`}>
      <td className={`${TD} !text-left`}>{label}</td>
      {cells.map((c, i) => <td key={i} className={`${TD} ${bonus ? "font-semibold text-[var(--bot-navy-lift)]" : ""}`}>{c}</td>)}
      {banks.map((c, i) => <td key={i} className={`${TD} gs-bank`}>{c}</td>)}
    </tr>
  );
}
