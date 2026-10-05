import type { ModePremium } from "@/calc/mode-premiums";
import { quotePension } from "@/calc/pension/engine";
import { definePlan, money, sexWord } from "../numbers";
import { priceLines } from "./price-lines";

/**
 * บำนาญ สมาร์ท 95, asked the way the page and the chat ask it: a pension a month from an
 * age, paying until it starts. The engine speaks baht to the satang; priceLines wants satang.
 */
export const pensionNumbers = definePlan<{ sex: "M" | "F"; age: number; monthly: number; from: number }>({
  product: "บำนาญ สมาร์ท 95",
  cases: [
    { sex: "M", age: 40, monthly: 10_000, from: 60 },
    { sex: "F", age: 35, monthly: 5_000, from: 60 },
    { sex: "M", age: 45, monthly: 10_000, from: 60 },
  ],
  ladder: { term: "จ่ายถึงอายุ 60 รับบำนาญตั้งแต่ 60", firstYear: false, rungs: [5_000, 10_000, 20_000, 30_000].map((monthly) => ({ monthly, from: 60 })) },
  claims: [
    "รับบำนาญถึงอายุ 95",
    "รับประกันจ่าย 15 ปีแรก",
    "บำนาญเพิ่มเป็นขั้นตามอายุ",
    "ลดหย่อนภาษีได้ตามเงื่อนไขสรรพากร",
  ],
  price: (p, claims) => {
    const ask = (mode: "annual" | "monthly") => quotePension({
      age: p.age, sex: p.sex, annuityAge: p.from, pay: "untilAnnuity", mode, basis: "monthlyPension", amount: p.monthly,
    });
    const annual = ask("annual");
    if (!annual.ok) return null;
    const monthly = ask("monthly");
    const modes: ModePremium[] = [{ mode: "annual", total: Math.round(annual.quote.annualPremium * 100), belowMinimum: false }];
    if (monthly.ok) modes.push({ mode: "monthly", total: Math.round(monthly.quote.modePremium * 100), belowMinimum: false });
    const lines = priceLines(modes, false);
    if (!lines) return null;
    return {
      product: "บำนาญ สมาร์ท 95",
      sumLine: `บำนาญเดือนละ ${money(annual.quote.monthlyPension)} บาท`,
      sumNote: `เริ่มรับตั้งแต่อายุ ${p.from}`,
      premiumLine: lines.premiumLine,
      annualSatang: lines.annualSatang,
      ...(lines.monthlySatang ? { monthlySatang: lines.monthlySatang } : {}),
      perDayLine: lines.perDayLine,
      claims,
      who: `${sexWord(p.sex)} ${p.age} ปี จ่ายเบี้ย ${annual.quote.payYears} ปี`,
      poster: { big: lines.big, small: `บำนาญเดือนละ ${money(annual.quote.monthlyPension)} บาท · ตกวันละ ${lines.day} บาท` },
    };
  },
});
