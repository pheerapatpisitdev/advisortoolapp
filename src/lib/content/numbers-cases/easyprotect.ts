import type { Sex } from "@/calc/types";
import { easyProtectModes } from "@/lib/easyprotect-quote";
import { easyProtectTable } from "@/lib/easyprotect-table";
import { definePlan, money, sexWord } from "../numbers";
import { priceLines } from "./price-lines";

/** อีซี่ โพรเทค 6: one term, six years of premium, cover to 99. */
export const easyProtectNumbers = definePlan<{ sex: Sex; age: number; sum: number }>({
  product: "Easy Protect 6",
  cases: [
    { sex: "M", age: 35, sum: 500_000 },
    { sex: "F", age: 30, sum: 500_000 },
    { sex: "M", age: 45, sum: 1_000_000 },
  ],
  ladder: { term: "จ่าย 6 ปี คุ้มครองถึงอายุ 99", firstYear: false, rungs: [500_000, 1_000_000, 2_000_000, 3_000_000].map((sum) => ({ sum })) },
  claims: [
    "จ่ายเบี้ยแค่ 6 ปี",
    "คุ้มครองถึงอายุ 99",
    "เบี้ยไม่ทิ้ง มูลค่าเวนคืนโตทุกปี",
    "เบี้ยล็อกตามอายุวันที่ทำ",
  ],
  price: (p, claims, today) => {
    const table = easyProtectTable(today);
    const term = table.terms[0];
    if (!term || table.expired || p.sum < table.saMin || p.sum > table.saMax) return null;
    const lines = priceLines(easyProtectModes(table, term, { sex: p.sex, age: p.age, sumAssured: p.sum }), table.expired);
    if (!lines) return null;
    return {
      product: "Easy Protect 6",
      sumLine: `ประกันชีวิตทุน ${money(p.sum)} บาท`,
      premiumLine: lines.premiumLine,
      annualSatang: lines.annualSatang,
      perDayLine: lines.perDayLine,
      claims,
      who: `${sexWord(p.sex)} ${p.age} ปี จ่าย ${term.payTerm} ปี`,
      poster: { big: lines.big, small: `ทุน ${money(p.sum)} บาท · ตกวันละ ${lines.day} บาท` },
    };
  },
});
