import type { Sex } from "@/calc/types";
import { coverEndsAt, plbModes } from "@/lib/plb-quote";
import { plbTable } from "@/lib/plb-table";
import { definePlan, money, sexWord } from "../numbers";
import { priceLines } from "./price-lines";

/** Protection Life: term cover, so no "เบี้ยไม่ทิ้ง" — it has no money back at the end. */
export const plbNumbers = definePlan<{ sex: Sex; age: number; sum: number; term: string }>({
  product: "Protection Life",
  cases: [
    { sex: "M", age: 35, sum: 1_000_000, term: "PLB10" },
    { sex: "F", age: 30, sum: 1_000_000, term: "PLB10" },
    { sex: "M", age: 40, sum: 3_000_000, term: "PLB15" },
  ],
  ladder: { term: "จ่าย 10 ปี คุ้มครอง 10 ปี", firstYear: false, rungs: [1, 2, 3, 5].map((m) => ({ sum: m * 1_000_000, term: "PLB10" })) },
  claims: [
    "เบี้ยไม่เพิ่มตลอดสัญญา",
    "จ่ายมีวันจบ",
    "ทุนยิ่งสูง เบี้ยต่อล้านยิ่งถูก",
    "เสียชีวิตระหว่างสัญญา ครอบครัวรับเต็มทุน",
  ],
  price: (p, claims, today) => {
    const table = plbTable(today);
    const term = table.terms.find((t) => t.variant === p.term);
    if (!term || table.expired || p.sum < table.saMin || p.sum > table.saMax) return null;
    // the large-sum discount is inside plbModes, as on the sales page
    const lines = priceLines(plbModes(table, term, { sex: p.sex, age: p.age, sumAssured: p.sum }), table.expired);
    if (!lines) return null;
    return {
      product: "Protection Life",
      sumLine: `ประกันชีวิตทุน ${money(p.sum)} บาท`,
      premiumLine: lines.premiumLine,
      annualSatang: lines.annualSatang,
      ...(lines.monthlySatang ? { monthlySatang: lines.monthlySatang } : {}),
      perDayLine: lines.perDayLine,
      claims,
      who: `${sexWord(p.sex)} ${p.age} ปี คุ้มครอง ${term.years} ปี ถึงอายุ ${coverEndsAt(term, p.age)}`,
      poster: { big: lines.big, small: `ทุน ${money(p.sum)} บาท · ตกวันละ ${lines.day} บาท` },
    };
  },
});
