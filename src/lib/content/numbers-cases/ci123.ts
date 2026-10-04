import type { Sex } from "@/calc/types";
import { getBundle } from "@/calc/bundles/registry";
import { ci123Table } from "@/lib/ci123-table";
import { definePlan, money, sexWord } from "../numbers";
import { bundleModes, priceLines } from "./price-lines";

/**
 * CI 123 (CI123_SET): the CI 123 rider on Life Protect x 2 at 150,000. The rider is priced on
 * attained age, so every premium is the first year's, for the set as a whole.
 */
export const ci123Numbers = definePlan<{ sex: Sex; age: number; tier: number }>({
  product: "CI 123",
  cases: [
    { sex: "F", age: 30, tier: 1 },
    { sex: "M", age: 35, tier: 2 },
    { sex: "F", age: 45, tier: 2 },
  ],
  ladder: { term: "จ่ายเบี้ยถึงอายุ 99", firstYear: true, rungs: [{ tier: 1 }, { tier: 2 }, { tier: 3 }, { tier: 6 }] },
  claims: [
    "คุ้มครอง {diseases} โรค",
    "เจอระยะแรกก็ได้เงิน",
    "เคลมระยะแรกแล้ว ยังเคลมระยะถัดไปได้",
  ],
  price: (p, claims, today) => {
    const tier = getBundle("CI123_SET")?.tiers.find((t) => t.no === p.tier);
    const ci = tier?.riders.find((r) => r.code === "CI123")?.sumAssured;
    if (!tier || !ci) return null;
    const table = ci123Table(today);
    const lines = priceLines(bundleModes("CI123_SET", p.tier, p, today), table.expired, true);
    if (!lines) return null;
    return {
      product: "CI 123",
      sumLine: `ประกันโรคร้ายแรงทุน ${money(ci)} บาท`,
      sumNote: `คู่กับประกันชีวิต Life Protect x 2 ทุน ${money(tier.sumAssured)} บาท`,
      premiumLine: lines.premiumLine,
      annualSatang: lines.annualSatang,
      perDayLine: lines.perDayLine,
      claims: claims.map((c) => c.replace("{diseases}", String(table.diseaseCount))),
      who: `${sexWord(p.sex)} ${p.age} ปี`,
      poster: { big: lines.big, small: `ทุนโรคร้ายแรง ${money(ci)} บาท · ปีแรกตกวันละ ${lines.day} บาท` },
    };
  },
});
