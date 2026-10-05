import type { Sex } from "@/calc/types";
import { iShieldModes } from "@/lib/ishield-quote";
import { iShieldTable } from "@/lib/ishield-table";
import { definePlan, money, sexWord } from "../numbers";
import { priceLines } from "./price-lines";

/** iShield: a level premium paid for 5–20 years, the full sum back at the end if never claimed. */
export const iShieldNumbers = definePlan<{ sex: Sex; age: number; sum: number; term: string }>({
  product: "iShield",
  cases: [
    { sex: "M", age: 35, sum: 1_000_000, term: "WLCI10" },
    { sex: "F", age: 30, sum: 500_000, term: "WLCI20" },
    { sex: "M", age: 45, sum: 1_000_000, term: "WLCI15" },
  ],
  ladder: { term: "จ่าย 10 ปี คุ้มครองถึงอายุ 85", firstYear: false, rungs: [500_000, 1_000_000, 2_000_000, 3_000_000].map((sum) => ({ sum, term: "WLCI10" })) },
  claims: [
    "เบี้ยไม่เพิ่ม",
    "คุ้มครอง {diseases} โรค เจอระยะเริ่มต้นก็ได้เงิน",
    "ไม่ป่วยก็ไม่เสียเปล่า ครบสัญญารับคืนเต็มทุน",
  ],
  price: (p, claims, today) => {
    const table = iShieldTable(today);
    const term = table.terms.find((t) => t.variant === p.term);
    if (!term || table.expired || p.sum < table.saMin || p.sum > table.saMax) return null;
    const lines = priceLines(iShieldModes(table, term, { sex: p.sex, age: p.age, sumAssured: p.sum }), table.expired);
    if (!lines) return null;
    const diseases = table.illness.earlyCount + table.illness.majorCount;
    return {
      product: "iShield",
      sumLine: `ประกันโรคร้ายแรงทุน ${money(p.sum)} บาท`,
      premiumLine: lines.premiumLine,
      annualSatang: lines.annualSatang,
      ...(lines.monthlySatang ? { monthlySatang: lines.monthlySatang } : {}),
      perDayLine: lines.perDayLine,
      claims: claims.map((c) => c.replace("{diseases}", String(diseases))),
      who: `${sexWord(p.sex)} ${p.age} ปี ${term.label}`,
      poster: { big: lines.big, small: `ทุน ${money(p.sum)} บาท · ตกวันละ ${lines.day} บาท` },
    };
  },
});
