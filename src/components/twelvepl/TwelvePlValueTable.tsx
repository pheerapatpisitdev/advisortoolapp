"use client";

import { formatBaht } from "@/calc/money";
import { Highlighted } from "@/components/Highlighted";
import { CardButton } from "@/components/sales/CardButton";
import { PrintButton } from "@/components/sales/PrintButton";
import { Watermark } from "@/components/sales/Watermark";
import type { ProjectionRow } from "@/lib/cash-projection";
import { excelRound, type TwelvePlYear } from "@/lib/twelvepl-benefits";

/** baht, whole, as the company's sheet prints them; a zero is left blank */
const whole = (n: number) => (n ? excelRound(n).toLocaleString("en-US") : "");

const RULE = "border-l border-l-white/10";
const CELL = "whitespace-nowrap border-b border-white/5 px-[5px] py-1.5";

export interface TwelvePlValueTableProps {
  /** the plan's own year-by-year figures: premiums, riders, surrender value and cover */
  rows: ProjectionRow[];
  /** the same years' cash backs and dividends, from twelvePlYears */
  years: TwelvePlYear[];
  /** which dividend example is shown: an index into each year's `dividend`, or null for none */
  example: number | null;
  /** the examples the buttons offer, as index → button words */
  examples: { index: number; label: string }[];
  onExample: (index: number | null) => void;
  caption: string;
  cardPath?: string;
  planName: string;
}

/**
 * Every year of 12 พีแอล, laid out as the company's ตารางแสดงผลประโยชน์ reads: the premium,
 * the cash back paid that year (the maturity in the last), the dividend in the example picked
 * (owner chose ก, 2026-11-18: one column and a switch), the cover and the surrender value.
 */
export function TwelvePlValueTable({
  rows, years, example, examples, onExample, caption, cardPath, planName,
}: TwelvePlValueTableProps) {
  if (!rows.length) return null;
  const riders = rows.some((r) => r.riderDue);
  const showDividend = example !== null;
  const head = [
    "ปีที่", "อายุ", "เบี้ย/ปี", ...(riders ? ["สัญญาเพิ่มเติม"] : []), "เงินคืน",
    ...(showDividend ? ["ปันผล*"] : []), "คุ้มครอง", "เวนคืนได้",
  ];
  const last = rows.length - 1;
  const choice = (label: string, on: boolean, pick: () => void) => (
    <button
      key={label} type="button" onClick={pick} aria-pressed={on}
      className={`rounded-sm border px-2.5 py-1.5 text-xs transition-colors ${
        on ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="print-table mt-3.5 border-t border-[var(--lg-panel-line)] pt-3">
      <div data-print-only className="mb-4 hidden">
        <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-2">
          <div>
            <p className="text-base font-semibold">{planName}</p>
            <p className="mt-0.5 text-[11px]">{caption}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold">เอกสารประมาณการ</p>
            <p className="text-[10px]">ไม่ใช่ใบเสนอราคาของบริษัท</p>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold">ตารางผลประโยชน์</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 data-screen-only className="text-sm font-normal text-[var(--lg-gold)]">ตารางผลประโยชน์ทุกปี</h4>
        <div data-screen-only className="flex flex-wrap items-center gap-2">
          <PrintButton className="rounded-sm border border-[var(--lg-gold)] px-3 py-1.5 text-xs font-medium text-[var(--lg-gold)]" />
          {cardPath && (
            <CardButton
              path={cardPath}
              filename="value-table.png"
              label={{ full: "บันทึกตารางเป็นรูป", compact: "บันทึกตาราง" }}
              className="rounded-sm border border-[var(--lg-gold)] px-3 py-1.5 text-xs font-medium text-[var(--lg-gold)]"
            />
          )}
        </div>
      </div>

      <div data-screen-only className="mt-2.5 flex flex-wrap gap-2">
        {choice("ไม่รวมปันผล", example === null, () => onExample(null))}
        {examples.map((e) => choice(e.label, example === e.index, () => onExample(e.index)))}
      </div>

      <p data-screen-only className="mt-2.5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-gold-glow)] px-3 py-2.5 text-xs leading-[1.75] tabular-nums text-[var(--lg-gold-lit)]">
        {caption}
      </p>

      <Watermark>
        <div className="-mx-2.5 mt-2.5 w-[calc(100%+1.25rem)] max-lg:overflow-x-auto">
          <table className="w-full border-collapse text-xs tabular-nums">
            <thead>
              <tr>
                {head.map((h, i) => (
                  <th
                    key={h} scope="col"
                    className={`sticky top-0 z-[2] whitespace-nowrap bg-[var(--bot-navy)] px-[5px] py-2
                      text-[12.5px] font-semibold text-white print:!text-black
                      ${i < 2 ? "text-left" : "text-right"} ${i > 0 ? "border-l border-l-white/35" : ""}
                      ${i === head.length - 1 ? "pr-3" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, n) => {
                const y = years[n];
                const end = n === last;
                return (
                  <tr key={r.policyYear} className={end ? "font-medium" : undefined}>
                    <td className={`${CELL} text-left text-[var(--lg-mute)]`}>{r.policyYear}</td>
                    <td className={`${CELL} ${RULE} text-left text-[var(--lg-mute)]`}>{r.age}</td>
                    <td className={`${CELL} ${RULE} text-right`}>{r.premiumDue ? formatBaht(r.premiumDue) : ""}</td>
                    {riders && <td className={`${CELL} ${RULE} text-right`}>{r.riderDue ? formatBaht(r.riderDue) : ""}</td>}
                    <td className={`${CELL} ${RULE} text-right text-[var(--lg-gain)]`}>
                      {end && y ? <Highlighted>{whole(y.cashBack)}</Highlighted> : whole(y?.cashBack ?? 0)}
                    </td>
                    {showDividend && (
                      <td className={`${CELL} ${RULE} text-right text-[var(--lg-mute)]`}>{whole(y?.dividend[example] ?? 0)}</td>
                    )}
                    <td className={`${CELL} ${RULE} text-right`}>{formatBaht(r.cover)}</td>
                    <td className={`${CELL} ${RULE} pr-3 text-right`}>{formatBaht(r.cashValue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Watermark>

      <p className="mt-2.5 px-0.5 text-xs leading-[1.8] text-[var(--lg-mute)]">
        เงินคืนปีสุดท้ายรวมเงินครบกำหนดสัญญา · มูลค่าเวนคืนไม่รวมเงินคืนที่จ่ายไปแล้ว
        {showDividend && " · * เงินปันผลไม่รับรองการจ่าย เป็นตัวอย่างตามสมมติฐานผลตอบแทนการลงทุนของบริษัท ไม่ใช่อัตราขั้นต่ำหรือขั้นสูง"}
      </p>
    </section>
  );
}
