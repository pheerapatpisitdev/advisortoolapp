import { GS_PREM_YEARS, GS_TAX_CAP, GS_TERM, type GsQuote } from "@/calc/global-saving/engine";

/**
 * Global Savings Plus 15/8's quote as text, sent beside its table card from the page's
 * ส่งให้ลูกค้า (owner chose ค, 2026-10-20). The guarantee is said as certain; the bonus only as
 * the +3% example the card's middle column shows, and always as not guaranteed.
 */

const baht = (n: number) => Math.round(n).toLocaleString("en-US");
const premium = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function gsQuoteText(age: number, q: GsQuote): string {
  const at3 = q.scenarios.find((s) => Math.abs(s.rate - 0.03) < 1e-9);
  const lines = [
    "💰 Global Savings Plus 15/8 — ออมทรัพย์ผลตอบแทนตามดัชนี",
    `อายุ ${age} ปี · คุ้มครอง ${GS_TERM} ปี · จ่ายเบี้ย ${GS_PREM_YEARS} ปี`,
    "",
    `เบี้ยปีละ ${premium(q.premium)} บาท (รวม ${baht(GS_PREM_YEARS * q.premium)} บาท)`,
    `ทุนประกัน ${baht(q.sa)} บาท`,
    "",
    `✅ เงินการันตีรวม ${baht(q.guaranteed)} บาท`,
    `- เงินคืนทุกปี ปีละ ${baht(q.scenarios[0].rows[0].payback)} บาท · ครบสัญญา ${baht(q.scenarios[0].maturity)} บาท`,
    ...(at3 ? [`📈 ถ้าดัชนีโตเฉลี่ยปีละ 3% รับรวมประมาณ ${baht(at3.total)} บาท (โบนัสไม่การันตี)`] : []),
    "",
    `ลดหย่อนภาษีได้ปีละ ${baht(Math.min(q.premium, GS_TAX_CAP))} บาท ตามเกณฑ์สรรพากร`,
  ];
  return lines.join("\n");
}
