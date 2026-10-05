import type { Sex } from "@/calc/types";
import { leverage, lifeTreasureModes, totalPaid } from "@/lib/lifetreasure-quote";
import { lifeTreasureTable } from "@/lib/lifetreasure-table";
import { definePlan, money, sexWord } from "../numbers";
import { priceLines } from "./price-lines";

/**
 * ไลฟ์เทรเชอร์: a sum set in advance for heirs. "ส่งต่อได้ {n} เท่า" is the sum over every
 * yearly premium paid, to one decimal, as lifeTreasureFacts says it on the sales page.
 */
export const lifeTreasureNumbers = definePlan<{ sex: Sex; age: number; sum: number; term: string }>({
  product: "Life Treasure",
  cases: [
    { sex: "M", age: 45, sum: 10_000_000, term: "H99F12A" },
    { sex: "F", age: 40, sum: 10_000_000, term: "H99F12A" },
    { sex: "M", age: 55, sum: 20_000_000, term: "H99F06A" },
  ],
  ladder: { term: "จ่าย 12 ปี คุ้มครองถึงอายุ 99", firstYear: false, rungs: [10, 15, 20, 30].map((m) => ({ sum: m * 1_000_000, term: "H99F12A" })) },
  claims: [
    "เงินก้อนระบุจำนวนไว้ล่วงหน้า ไม่ขึ้นกับตลาด",
    "แบ่งให้ใครเท่าไรระบุได้",
    "คุ้มครองถึงอายุ 99",
    "ส่งต่อได้ {n} เท่าของเบี้ยที่จ่ายรายปี",
  ],
  price: (p, claims, today) => {
    const table = lifeTreasureTable(today);
    const term = table.terms.find((t) => t.variant === p.term);
    if (!term || table.expired || p.sum < table.saMin || p.sum > table.saMax) return null;
    const lines = priceLines(lifeTreasureModes(table, term, { sex: p.sex, age: p.age, sumAssured: p.sum }), table.expired);
    if (!lines) return null;
    const times = leverage(p.sum, totalPaid(lines.annualSatang, term));
    // below one time over there is nothing to say, so that claim is left out rather than bent
    const said = claims.flatMap((c) => (c.includes("{n}") ? (times === null ? [] : [c.replace("{n}", times.toFixed(1))]) : [c]));
    return {
      product: "Life Treasure",
      sumLine: `ทุนประกันชีวิต ${money(p.sum)} บาท`,
      premiumLine: lines.premiumLine,
      annualSatang: lines.annualSatang,
      ...(lines.monthlySatang ? { monthlySatang: lines.monthlySatang } : {}),
      perDayLine: lines.perDayLine,
      claims: said,
      who: `${sexWord(p.sex)} ${p.age} ปี จ่าย ${term.payTerm} ปี`,
      poster: { big: lines.big, small: `ทุน ${money(p.sum)} บาท · ตกวันละ ${lines.day} บาท` },
    };
  },
});
