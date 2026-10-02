import type { CoverRow } from "@/lib/cover-rows";
import { CardButton } from "@/components/sales/CardButton";
import { PrintButton } from "@/components/sales/PrintButton";
import { PdfPrepare } from "@/components/sales/PdfPrepare";

/**
 * Every year of a term contract, on the page rather than only in a picture.
 *
 * The figures were already drawn as a card an agent could save and send. What the customer
 * looking at the page could not do was read them — and this is the plan where the year-by-year
 * view answers the thing customers of a term plan most often get wrong: the year the cover
 * stops. A contract that ends is a different promise from one that does not, and it should be
 * possible to see that without downloading anything.
 *
 * No surrender column, because the plan has no surrender value: คุ้มครองล้วน ไม่มีมูลค่าเวนคืน
 * และไม่มีเงินคืนเมื่อครบสัญญา. Borrowing a neighbouring product's numbers to fill the column
 * is the one thing that must never happen here — the workbook's own CV sheets belong to PR60,
 * a retirement plan this file was copied from.
 */

const HEAD = ["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "คุ้มครอง"];

/** every column but the first is ruled off from the one before it */
const RULE = "border-l border-l-white/10";
const CELL = "whitespace-nowrap border-b border-white/5 px-[5px] py-1.5";

export interface CoverTableProps {
  rows: CoverRow[];
  /** the line above the table, e.g. "ทุนประกัน 1,000,000 บาท · ชาย 35 ปี · คุ้มครอง 12 ปี" */
  caption: string;
  /** the last year of cover, said in words under the table because it is the point of it */
  endsNote: string;
  /** where the same table is drawn as a picture, for the agent who has to send it */
  cardPath?: string;
  planName?: string;
}

export function CoverTable({ rows, caption, endsNote, cardPath, planName }: CoverTableProps) {
  if (!rows.length) return null;
  const last = rows[rows.length - 1];

  return (
    <section className="print-table mt-3.5 border-t border-[var(--lg-panel-line)] pt-3">
      {/* the heading a printed sheet needs and a web page does not — see CashValueTable, which
          sets out at length why ours says what it is at the top and carries no mark of theirs */}
      <div data-print-only className="mb-4 hidden">
        <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-2">
          <div>
            <p className="text-base font-semibold">{planName ?? "ตารางความคุ้มครอง"}</p>
            <p className="mt-0.5 text-[11px]">{caption}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold">เอกสารประมาณการ</p>
            <p className="text-[10px]">ไม่ใช่ใบเสนอราคาของบริษัท</p>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold">ตารางความคุ้มครอง</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 data-screen-only className="text-sm font-normal text-[var(--lg-gold)]">ความคุ้มครองทุกปี</h4>
        <div data-screen-only className="flex flex-wrap items-center gap-2">
          <PrintButton className="rounded-sm border border-[var(--lg-gold)] px-3 py-1.5 text-xs font-medium text-[var(--lg-gold)]" />
          {cardPath && (
            <CardButton
              path={cardPath}
              filename="cover-table.png"
              label={{ full: "บันทึกตารางเป็นรูป", compact: "บันทึกตาราง" }}
              className="rounded-sm border border-[var(--lg-gold)] px-3 py-1.5 text-xs font-medium text-[var(--lg-gold)]"
            />
          )}
        </div>
      </div>

      <p data-screen-only className="mt-2.5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-gold-glow)] px-3 py-2.5 text-xs leading-[1.75] tabular-nums text-[var(--lg-gold-lit)]">
        {caption}
      </p>

      {/* laid out in full, with the sideways scroll kept only below 1024px — the reasoning is
          written out over CashValueTable's own table and is the same reasoning here */}
      <div className="-mx-2.5 mt-2.5 w-[calc(100%+1.25rem)] max-lg:overflow-x-auto">
        <table className="w-full border-collapse text-xs tabular-nums">
          <thead>
            <tr>
              {HEAD.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`sticky top-0 z-[2] whitespace-nowrap border-b border-[var(--lg-hair)]
                    bg-[var(--lg-ground-deep)] px-[5px] py-[7px] text-[11px] font-normal text-[var(--lg-mute)]
                    ${i < 2 ? "text-left" : "text-right"} ${i > 0 ? RULE : ""}
                    ${i === HEAD.length - 1 ? "pr-3" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              /* the last year is lit, because it is the one fact a term plan is bought and
                 misremembered on: this is the year the cover stops */
              <tr key={r.year} className={r.year === last.year ? "bg-[var(--lg-gold-glow)]" : undefined}>
                <td className={`${CELL} text-left text-[var(--lg-mute)]`}>{r.year}</td>
                <td className={`${CELL} ${RULE} text-left text-[var(--lg-mute)]`}>{r.age}</td>
                <td className={`${CELL} ${RULE} text-right`}>{r.due}</td>
                <td className={`${CELL} ${RULE} text-right`}>{r.paid ?? "—"}</td>
                <td className={`${CELL} ${RULE} pr-3 text-right`}>{r.cover}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-[1.8] text-[var(--lg-mute)] opacity-80">
        {endsNote} · แบบนี้เป็นความคุ้มครองล้วน ไม่มีมูลค่าเวนคืนและไม่มีเงินคืนเมื่อครบสัญญา
      </p>
      <PdfPrepare />
    </section>
  );
}
