import { MODE_FACTOR, MODE_INSTALMENTS, MODE_LABEL, type PensionQuote } from "@/calc/pension/engine";

/**
 * The words that leave /bumnan95: what the customer's chat opens with, and the quotation an
 * agent pastes into whichever chat the customer is already in.
 *
 * Built from the engine's quote and nothing else, so neither can say a figure the page does
 * not show.
 */

const SEX_WORD = { M: "ชาย", F: "หญิง" } as const;
const baht = (n: number) => Math.floor(n).toLocaleString("en-US");
const rdown2 = (x: number) => Math.floor(x * 100 + 1e-9) / 100;

export interface PensionWho { age: number; sex: "M" | "F" }

function payWords(q: PensionQuote): string {
  return q.payYears === 6 && q.plan.paymentOption.includes("6 ปี")
    ? "ชำระเบี้ย 6 ปี"
    : `ชำระเบี้ยจนถึงอายุ ${q.plan.annuityStartAge} (${q.payYears} ปี)`;
}

/** The first message of the customer's chat with the Page, so whoever answers starts from it. */
export function pensionMessage(who: PensionWho, q: PensionQuote | null): string {
  if (!q) return `สนใจบำนาญ สมาร์ท 95 ${SEX_WORD[who.sex]} อายุ ${who.age} ขอคำแนะนำ`;
  return `สนใจบำนาญ สมาร์ท 95 ${SEX_WORD[who.sex]} อายุ ${who.age} รับบำนาญอายุ ${q.plan.annuityStartAge}`
    + ` เดือนละ ${q.monthlyPension.toLocaleString("en-US")} ${payWords(q)}`
    + ` เบี้ยประมาณ ${baht(q.totalYearlyPaid)} บาท/ปี`;
}

/** The quotation as plain text: the pension first, because that is what is being bought. */
export function pensionQuoteText(who: PensionWho, q: PensionQuote): string {
  const first = q.bands[0];
  const last = q.bands[q.bands.length - 1];
  const withRiders = q.riders.some((r) => !r.error);
  const lines = [
    "🌅 บำนาญ สมาร์ท 95 — รับบำนาญถึงอายุ 95",
    `${SEX_WORD[who.sex]} อายุ ${who.age} · ${payWords(q)}`,
    "",
    `🎁 บำนาญเดือนละ ${q.monthlyPension.toLocaleString("en-US")} บาท ตั้งแต่อายุ ${first.fromAge}`,
    ...q.bands.map((b) => `- อายุ ${b.fromAge}–${b.toAge} ปีละ ${b.annual.toLocaleString("en-US")} บาท (${Math.round(b.percent * 100)}% ของทุน)`),
    `รับประกันจ่าย 15 ปีแรก · เพิ่มเป็น ${Math.round(last.percent * 100)}% ตั้งแต่อายุ ${last.fromAge}`,
    "",
    q.mode === "annual"
      ? `💰 เบี้ย${withRiders ? "รวม" : ""}ปีละ ${baht(q.totalAnnualPremium)} บาท`
      : `💰 เบี้ย${withRiders ? "รวม" : ""}${MODE_LABEL[q.mode]} ${baht(q.totalModePremium)} บาท · ${MODE_INSTALMENTS[q.mode]} งวด รวมปีละ ${baht(q.totalYearlyPaid)} บาท`,
    `ราย 6 เดือน ${baht(rdown2(q.annualPremium * MODE_FACTOR.semi))} · รายเดือน ${baht(rdown2(q.annualPremium * MODE_FACTOR.monthly))} บาท`
      + (withRiders ? " (สัญญาหลัก)" : ""),
    ...q.riders.filter((r) => !r.error).map((r) => `- ${r.label} ปีละ ${baht(r.annual)} บาท`),
    "",
    `📌 ทุนประกัน ${q.sumAssured.toLocaleString("en-US")} บาท · เบี้ยสัญญาหลักรวม ${baht(q.totalPremium)} บาท`,
    `รวมรับบำนาญถึงอายุ 95 ประมาณ ${q.totalPension.toLocaleString("en-US")} บาท`,
    "เบี้ยใช้ลดหย่อนภาษีได้ตามเกณฑ์สรรพากร · เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน",
  ];
  return lines.join("\n");
}
