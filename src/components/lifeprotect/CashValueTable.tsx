import { formatBaht } from "@/calc/money";
import { Highlighted } from "@/components/Highlighted";
import type { Projection, ProjectionRow } from "@/lib/cash-projection";
import { CardButton } from "@/components/sales/CardButton";
import { PrintButton } from "@/components/sales/PrintButton";
import { PdfPrepare } from "@/components/sales/PdfPrepare";
import { CashValueChart } from "@/components/lifeprotect/CashValueChart";
import { INSURER } from "@/lib/assistant/common";

export interface CashValueTableProps {
  projection: Projection;
  /** the line above the table, e.g. "ทุนประกัน 1,000,000 บาท · ชาย 35 ปี · ถึงอายุ 99" */
  caption: string;
  /**
   * Where the same table is drawn as a picture. Given, the heading carries a button that
   * hands it over — a table this long is the one thing on the page nobody can screenshot.
   */
  cardPath?: string;
  /** the plan's own name, for the heading of the printed sheet */
  planName?: string;
  /**
   * The three lines under the table — the years with no surrender value, the total paid,
   * what the last row means. On unless a page says otherwise; iShield's owner took them off
   * that page (2026-09-25).
   */
  notes?: boolean;
}

const HEAD = ["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"];
/** the same, with the riders' premium in a column of its own beside the plan's */
const HEAD_RIDERS = ["ปีที่", "อายุ", "เบี้ย/ปี", "สัญญาเพิ่มเติม", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"];

/** every column but the first is ruled off from the one before it */
const RULE = "border-l border-l-white/10";
const CELL = "whitespace-nowrap border-b border-white/5 px-[5px] py-1.5";

/**
 * Every year of the contract, laid out in full.
 *
 * It used to scroll inside its own box so that a sixty-four-year contract left the rest of
 * the page where it was. The owner asked for the box gone, so the page is as long as the
 * contract now — see the note above the table for what that took with it and how the column
 * headings were got back.
 *
 * The years that are worth nothing are shown rather than filtered out, and at the same weight
 * as every other row. A customer should meet that fact before signing, not on the day they
 * try to surrender — and it is said plainly, by the 0 in the column and by the note
 * underneath, rather than by making the numbers harder to read.
 */
export function CashValueTable({ projection, caption, cardPath, planName, notes = true }: CashValueTableProps) {
  const { rows, breakEven, zeroYears, maturityAge } = projection;
  if (!rows.length) return null;

  /**
   * The last year a premium is due, and what has been paid by then.
   *
   * Read off the rows rather than passed in, because the rows are what the reader is looking
   * at: a contract whose paying term the projection and the caller disagreed about would
   * otherwise state a total the table does not show.
   */
  // a year is paid for when either the plan or a rider is: a rider can outlast the plan's term
  const pays = (r: ProjectionRow) => Boolean(r.premiumDue || r.riderDue);
  const riders = rows.some((r) => r.riderDue);
  const head = riders ? HEAD_RIDERS : HEAD;
  const paying = rows.filter(pays);
  const payingYears = paying.length;
  const totalPaid = paying.length ? paying[paying.length - 1].premiumPaid : null;

  return (
    <section className="print-table mt-3.5 border-t border-[var(--lg-panel-line)] pt-3">
      {/* The heading a printed sheet needs and a web page does not: what plan this is, and
          who it was worked out for. Taken from the layout of the insurer's own proposal,
          which is what the owner asked for — but deliberately without their marks. Ours is an
          estimate from an agent's calculator and theirs is a quotation, and a sheet that
          looks like the second while being the first is one a customer would be right to feel
          misled by. So it says what it is, at the top, where it cannot be missed. */}
      <div data-print-only className="mb-4 hidden">
        <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-2">
          <div>
            <p className="text-base font-semibold">{planName ?? "ตารางมูลค่ากรมธรรม์"}</p>
            <p className="mt-0.5 text-[11px]">{caption}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold">เอกสารประมาณการ</p>
            <p className="text-[10px]">ไม่ใช่ใบเสนอราคาของบริษัท</p>
          </div>
        </div>
        {/* The chart the page draws beside the table goes on the sheet too (the owner,
            2026-10-02): the line where the cash value overtakes the premiums is the answer the
            customer is reading the figures for. The first row's age is the age at issue. */}
        <div className="mt-4">
          <CashValueChart projection={projection} age={rows[0].age} onPaper />
        </div>
        <p className="text-sm font-semibold">ตารางมูลค่ากรมธรรม์</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 data-screen-only className="text-sm font-normal text-[var(--lg-gold)]">มูลค่าทุกปี</h4>
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

      <p data-screen-only className="mt-2.5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-gold-glow)] px-3 py-2.5 text-xs leading-[1.75] tabular-nums text-[var(--lg-gold-lit)]">
        {caption}
      </p>

      {/* Laid out in full rather than scrolled inside a box, which the owner asked for after
          living with the box: a table you scroll inside a page you also scroll is two
          scrolls fighting each other, and on a phone the inner one swallows the outer.

          What that costs is the thing the box was for — a sixty-four-year contract now runs
          to sixty-four rows of page, and whatever was under the table is a long way under it.

          The sideways scroll is kept only where it is needed, and that is not tidiness. CSS
          will not let a box scroll in one direction and stay open in the other: set
          `overflow-x`, and `overflow-y` becomes a scroller too, which makes the box the
          thing the sticky header sticks to — and a box as tall as its contents is one the
          header can never stick within. Measured rather than assumed: at row 25 of 50 the
          header sat 376px above the top of the screen, so from about row 12 the reader had
          six columns of numbers and nothing saying which was which.

          Past 1024px the table fits the column beside the menu, so there is no box and the
          header sticks to the page instead. Below that the box comes back, because six
          columns of `whitespace-nowrap` do not fit 375px and never will — there the headings
          still scroll away, which is the part of this not yet solved. */}
      <div className="-mx-2.5 mt-2.5 w-[calc(100%+1.25rem)] max-lg:overflow-x-auto">
        <table className="w-full border-collapse text-xs tabular-nums">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  /* sticky alone is not enough: without the stack order the rows scroll
                     through the header's own text */
                  className={`sticky top-0 z-[2] whitespace-nowrap border-b border-[var(--lg-hair)]
                    bg-[var(--lg-ground-deep)] px-[5px] py-[7px] text-[11px] font-normal text-[var(--lg-mute)]
                    ${i < 2 ? "text-left" : "text-right"} ${i > 0 ? RULE : ""}
                    ${i === head.length - 1 ? "pr-3" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              /**
               * The lit row says what it is, in the space the running total left behind.
               *
               * The highlight on its own is a colour somebody has to be told the meaning of.
               * Written into the cell beside the surrender value, it points at the figure it
               * is about: this is the year that column passes what was paid in.
               *
               * Only where that cell is empty. On a contract still being paid for at the
               * crossover — the life plan paid to 99 is one — both figures are real, and a
               * label there would be a number taken away to make room for a word.
               */
              const crossover = breakEven?.policyYear === r.policyYear;
              const labelHere = crossover && !pays(r);
              /**
               * Every row is the same weight, including the early years worth nothing.
               *
               * They used to recede at 55% opacity, on the argument that a year with no
               * surrender value should say so by fading. Two things were wrong with it. The
               * fact was already said twice over — the เวนคืนได้ column reads 0, and the note
               * under the table names the years by number — so the fade carried nothing the
               * reader did not already have. And it was not even applied consistently: the
               * iShield skin switches it off for the whole page, because on ivory the fade
               * drops that text to between 2.95 and 4.21 to one. So the same table was
               * already being shown two different ways on three pages.
               *
               * Dropping it here settles that the other way, which is what the owner asked
               * for and what the one skin that had thought about it had already done.
               */
              return (
                // no tint on the break-even row any more: its highlighted cells say it, as the owner asked
                <tr key={r.policyYear}>
                  <td className={`${CELL} text-left text-[var(--lg-mute)]`}>{r.policyYear}</td>
                  {/* the break-even year's age and surrender value, marked as the value-table picture marks them */}
                  <td className={`${CELL} ${RULE} text-left text-[var(--lg-mute)]`}>
                    {crossover ? <Highlighted>{r.age}</Highlighted> : r.age}
                  </td>
                  <td className={`${CELL} ${RULE} text-right`}>
                    {r.premiumDue ? formatBaht(r.premiumDue) : "—"}
                  </td>
                  {riders && (
                    <td className={`${CELL} ${RULE} text-right`}>
                      {r.riderDue ? formatBaht(r.riderDue) : "—"}
                    </td>
                  )}
                  {/* The running total stops when the paying does, rather than repeating the
                      same figure down the rest of the contract — thirty-six identical rows
                      are not a column, they are noise with a heading on it.

                      What that costs is the comparison a reader makes further down: on Life
                      Treasure the last premium is year 18 and the cash value only passes it
                      at year 25, so the seven rows where the question "am I ahead yet" gets
                      answered no longer have both numbers side by side. Two things are left
                      carrying it — the break-even row is still lit, which is that answer
                      given rather than left to be worked out, and the total paid is stated
                      under the table, where it is said once instead of fifty times. */}
                  <td className={`${CELL} ${RULE} text-right ${labelHere ? "font-medium" : ""}`}>
                    {labelHere
                      ? <Highlighted>จุดคุ้มทุน &gt;</Highlighted>
                      : pays(r) && r.premiumPaid !== null ? formatBaht(r.premiumPaid) : "—"}
                  </td>
                  <td className={`${CELL} ${RULE} text-right`}>
                    {crossover ? <Highlighted>{formatBaht(r.cashValue)}</Highlighted> : formatBaht(r.cashValue)}
                  </td>
                  <td className={`${CELL} ${RULE} pr-3 text-right`}>{formatBaht(r.cover)}</td>
                </tr>
              );
            })}
          </tbody>
          {/* The proposal this borrows from closes its table with the total, on the same
              grid, under the column it totals. On screen that line already exists as a
              sentence below; on paper it belongs in the table, where the eye is. */}
          {totalPaid !== null && (
            <tfoot data-print-only className="hidden">
              <tr>
                <td className={`${CELL} ${RULE} text-right`} colSpan={riders ? 4 : 3}>รวมเบี้ยที่ชำระ</td>
                <td className={`${CELL} ${RULE} text-right`}>{formatBaht(totalPaid)}</td>
                <td className={`${CELL} ${RULE}`} />
                <td className={`${CELL} ${RULE}`} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {notes && zeroYears > 0 && (
        <p className="mt-2.5 border-l-2 border-[var(--lg-gold-deep)] py-2 pl-3 text-xs leading-[1.8] text-[var(--lg-mute)]">
          <span className="font-medium text-[var(--lg-gold-lit)]">
            {zeroYears === 1 ? "ปีที่ 1" : `ปีที่ 1–${zeroYears}`} ยังไม่มีมูลค่าเวนคืน
          </span>{" "}
          เบี้ยช่วงต้นถูกใช้ไปกับค่าใช้จ่ายในการออกกรมธรรม์ เป็นปกติของประกันตลอดชีพทุกบริษัท
          แบบนี้เน้นความคุ้มครอง ไม่ใช่การออมระยะสั้น
        </p>
      )}
      {/* Said once, here, because the column no longer says it on every row. It is the figure
          every later row is measured against — "have I got back more than I put in" — so it
          cannot simply be dropped along with the repetition. */}
      {notes && totalPaid !== null && (
        <p className="mt-2.5 px-0.5 text-xs leading-[1.7] text-[var(--lg-mute)]">
          จ่ายเบี้ยทั้งหมด{" "}
          <span className="font-medium tabular-nums text-[var(--lg-white)]">{formatBaht(totalPaid)}</span>{" "}
          บาท ({payingYears} ปี) — ตั้งแต่ปีที่ {payingYears + 1} เป็นต้นไปไม่ต้องจ่ายเพิ่ม
        </p>
      )}
      {notes && (
        <p className="mt-2 px-0.5 text-[11.5px] leading-[1.7] text-[var(--lg-mute)] opacity-80">
          แถวสุดท้าย (ปีที่ {rows.length}) คือเงินที่ได้รับเมื่อครบสัญญาอายุ {maturityAge} ปี
        </p>
      )}

      {/* What the proposal this is modelled on carries at the foot of every sheet: who
          underwrites it, and the sentence that has to travel with any figure. Not who is
          presenting it — many agents print from this page, so no one agent's name and
          licence belongs on every customer's sheet (the owner, 2026-10-02). The date is written in by the print button rather than rendered here — a
          `new Date()` in a component that hydrates is a mismatch waiting to happen, and the
          only moment the date means anything is the moment the sheet is made. */}
      <div data-print-only className="mt-6 hidden border-t border-black pt-2 text-[9.5px] leading-[1.6]">
        <p>
          เบี้ยประกันเป็นตัวเลขประมาณการจากตารางของบริษัท ไม่ใช่ใบเสนอราคา
          เบี้ยและความคุ้มครองจริงเป็นไปตามผลการพิจารณารับประกันและที่ระบุในกรมธรรม์
        </p>
        <p className="mt-1.5">รับประกันโดย {INSURER}</p>
        <p data-printed-at className="mt-1" />
      </div>
      <PdfPrepare />
    </section>
  );
}
