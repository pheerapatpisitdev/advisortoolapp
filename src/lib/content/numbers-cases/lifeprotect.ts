import type { Sex } from "@/calc/types";
import { deathBenefitOf, lifeProtectModes } from "@/lib/lifeprotect-quote";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { definePlan, money, sexWord } from "../numbers";
import { priceLines } from "./price-lines";

/**
 * Life Protect x 2 for the ตัวเลขชัดๆ angle. The owner wants the doubled sum up front
 * (2026-09-24); it is only true for a death before the booster age, so it carries that
 * condition, and someone already past it is shown the plain sum.
 */
export const lifeProtectNumbers = definePlan<{ sex: Sex; age: number; sum: number; term: string }>({
  product: "Life Protect x 2",
  cases: [
    { sex: "M", age: 35, sum: 1_000_000, term: "WLF99H" },
    { sex: "F", age: 30, sum: 500_000, term: "WLF19H" },
    { sex: "M", age: 45, sum: 1_000_000, term: "WLF19H" },
  ],
  // six rungs whose doubled cover reads 500,000 to 5,000,000 (owner, 2026-10-05): the ad's
  // headline can then name the cover a reader asks for; the company's smallest sum is 150,000
  ladder: {
    term: "จ่าย 19 ปี คุ้มครองถึงอายุ 99",
    firstYear: false,
    rungs: [250_000, 500_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000].map((sum) => ({ sum, term: "WLF19H" })),
  },
  claims: [
    "เบี้ยไม่เพิ่ม",
    "เบี้ยไม่ทิ้ง คุ้มครองถึงอายุ 99",
    // the doubled sum leads the post itself, so no claim repeats it
    "จ่ายจบได้ใน 9 หรือ 19 ปี",
  ],
  price: (p, claims, today) => {
    const table = lifeProtectTable(today);
    const term = table.terms.find((t) => t.variant === p.term);
    if (!term || table.expired) return null;
    const lines = priceLines(lifeProtectModes(table, term, { sex: p.sex, age: p.age, sumAssured: p.sum }), table.expired);
    if (!lines) return null;
    const doubled = p.age < table.boosterBeforeAge;
    const cover = doubled ? deathBenefitOf(table, p.age, p.sum).sumBefore : p.sum;
    return {
      product: "Life Protect x 2",
      sumLine: doubled ? `ประกันชีวิตคุ้มครอง ${money(cover)} บาท` : `ประกันชีวิตทุน ${money(p.sum)} บาท`,
      ...(doubled ? { sumNote: `ทุน ${money(p.sum)} บาท × 2 เมื่อเสียชีวิตก่อนอายุ ${table.boosterBeforeAge}` } : {}),
      premiumLine: lines.premiumLine,
      annualSatang: lines.annualSatang,
      ...(lines.monthlySatang ? { monthlySatang: lines.monthlySatang } : {}),
      perDayLine: lines.perDayLine,
      claims,
      who: `${sexWord(p.sex)} ${p.age} ปี ${term.label}`,
      poster: { big: lines.big, small: `${doubled ? "คุ้มครอง" : "ทุน"} ${money(cover)} บาท · ตกวันละ ${lines.day} บาท` },
    };
  },
});
