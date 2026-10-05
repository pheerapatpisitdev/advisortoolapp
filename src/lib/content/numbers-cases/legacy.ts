import type { Sex } from "@/calc/types";
import { legacyTable } from "@/lib/legacy-table";
import { definePlan, money, sexWord } from "../numbers";
import { bundleModes, priceLines } from "./price-lines";

/**
 * มรดกเพื่อครอบครัว (LEGACY_FAMILY): Life Protect 150,000 + a critical-illness rider. The
 * rider is priced on attained age, so every premium is the first year's. The cash on a
 * critical illness and the sum on a death before 60 are read off the same table the sales
 * page uses.
 */
export const legacyNumbers = definePlan<{ sex: Sex; age: number; tier: number }>({
  product: "มรดกเพื่อครอบครัว",
  cases: [
    { sex: "F", age: 30, tier: 1 },
    { sex: "M", age: 35, tier: 1 },
    { sex: "F", age: 45, tier: 1 },
  ],
  ladder: {
    term: "จ่ายเบี้ยถึงอายุ 99",
    firstYear: true,
    // its sheets carry no note, yet every price is the package's: the base and the rider together
    // (this file's comment and data/bundles/legacy-family.json, whose every tier is on 150,000)
    note: "เบี้ยรวม Life Protect x 2 ทุน 150,000 บาท กับสัญญาเพิ่มเติมโรคร้ายแรง",
    rungs: [{ tier: 1 }, { tier: 2 }, { tier: 3 }, { tier: 5 }],
  },
  claims: [
    "ป่วยโรคร้ายแรงรับเงินสด {critical} บาท",
    "เสียชีวิตก่อน 60 รับ {death} บาท",
    "คุ้มครองโรคร้ายแรง {diseases} โรค",
  ],
  price: (p, claims, today) => {
    const table = legacyTable(today);
    const i = p.tier - 1;
    const death = table.death[i];
    if (table.expired || !death || table.critical[i] === undefined) return null;
    const lines = priceLines(bundleModes("LEGACY_FAMILY", p.tier, p, today), table.expired, true);
    if (!lines) return null;
    const before = p.age < death.under.beforeAge ? death.under : null;
    const said = claims.flatMap((c) => {
      if (c.includes("{death}")) return before ? [c.replace("{death}", money(before.sumBefore)).replace("60", String(before.beforeAge))] : [];
      return [c.replace("{critical}", money(table.critical[i])).replace("{diseases}", String(table.diseaseCount))];
    });
    const plan = death.under.sumFrom;
    return {
      product: "มรดกเพื่อครอบครัว",
      sumLine: `มรดกให้ครอบครัว ${money(plan)} บาท`,
      premiumLine: lines.premiumLine,
      annualSatang: lines.annualSatang,
      ...(lines.monthlySatang ? { monthlySatang: lines.monthlySatang } : {}),
      perDayLine: lines.perDayLine,
      claims: said,
      who: `${sexWord(p.sex)} ${p.age} ปี`,
      poster: { big: lines.big, small: `มรดก ${money(plan)} บาท · ปีแรกตกวันละ ${lines.day} บาท` },
    };
  },
});
