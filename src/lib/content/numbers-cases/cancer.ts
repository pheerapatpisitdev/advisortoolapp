import type { Sex } from "@/calc/types";
import { getBundle } from "@/calc/bundles/registry";
import { definePlan, money, sexWord } from "../numbers";
import { bundleModes, priceLines } from "./price-lines";

/**
 * ชุดประกันมะเร็ง (CANCER_SET): CPR + HIC on Life Protect x 2 at 150,000. Both riders are
 * yearly and priced on age, so every premium is the first year's, for the set as a whole.
 */
export const cancerNumbers = definePlan<{ sex: Sex; age: number; tier: number }>({
  product: "ชุดประกันมะเร็ง",
  cases: [
    { sex: "F", age: 30, tier: 1 },
    { sex: "M", age: 35, tier: 4 },
    { sex: "F", age: 45, tier: 4 },
  ],
  ladder: { term: "จ่ายเบี้ยถึงอายุ 99", firstYear: true, rungs: [{ tier: 1 }, { tier: 2 }, { tier: 4 }, { tier: 6 }] },
  claims: [
    "เจอมะเร็งระยะแรกก็ได้เงินก้อน",
    "นอนโรงพยาบาลรับชดเชยรายวัน",
    "เงินก้อนเอาไปใช้อะไรก็ได้",
  ],
  price: (p, claims, today) => {
    const tier = getBundle("CANCER_SET")?.tiers.find((t) => t.no === p.tier);
    const cpr = tier?.riders.find((r) => r.code === "CPR")?.sumAssured;
    const hic = tier?.riders.find((r) => r.code === "HIC")?.sumAssured;
    if (!tier || !cpr || !hic) return null;
    const lines = priceLines(bundleModes("CANCER_SET", p.tier, p, today), false, true);
    if (!lines) return null;
    return {
      product: "ชุดประกันมะเร็ง",
      sumLine: `ประกันมะเร็งทุน ${money(cpr)} บาท`,
      sumNote: `ชดเชยนอนโรงพยาบาลวันละ ${money(hic)} บาท · คู่กับ Life Protect x 2 ทุน ${money(tier.sumAssured)} บาท`,
      premiumLine: lines.premiumLine,
      annualSatang: lines.annualSatang,
      ...(lines.monthlySatang ? { monthlySatang: lines.monthlySatang } : {}),
      perDayLine: lines.perDayLine,
      claims,
      who: `${sexWord(p.sex)} ${p.age} ปี`,
      poster: { big: lines.big, small: `ทุนมะเร็ง ${money(cpr)} บาท · ปีแรกตกวันละ ${lines.day} บาท` },
    };
  },
});
