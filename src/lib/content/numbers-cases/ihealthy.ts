import type { Sex } from "@/calc/types";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { baseAt, iHealthyPricing } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import type { Lang } from "../output";
import { IHEALTHY_RUNGS } from "../ihealthy-ad";
import { definePlan, money, sexWord, sexWordEn } from "../numbers";
import { priceLines } from "./price-lines";

/** the Health Ultra Package: its base at a fixed sum, the IHU plan, and the standard daily cash */
const PACKAGE = "WLF99HX";

const CASES: { sex: Sex; age: number; plan: string }[] = [
  { sex: "F", age: 30, plan: "SMART" },
  { sex: "M", age: 35, plan: "BRONZE" },
  { sex: "F", age: 45, plan: "SILVER" },
];

/** the owner-approved claim lines, per language, with {renew} and {ncd} filled at pricing */
const CLAIMS: Record<Lang, string[]> = {
  th: ["เหมาจ่ายค่ารักษาต่อปี", "ต่ออายุได้ถึงอายุ {renew}", "ไม่เคลม 3 ปีติดต่อกัน ลดเบี้ย {ncd}%"],
  en: ["Lump-sum medical cover each year", "Renewable up to age {renew}", "{ncd}% premium discount after 3 years with no claims"],
};

/**
 * iHealthy Ultra as the Health Ultra Package — the owner lifted "ห้ามระบุเบี้ย" for this
 * angle on 2026-09-24, priced as a package. Health cover is priced on age every year, so
 * every premium is the first year's, for the package as a whole. Thailand, full coverage:
 * the arrangement the page and the chat open on. One helper builds both languages, so the
 * cases and the pricing exist once and only the words differ.
 */
function iHealthyPlan(lang: Lang) {
  const en = lang === "en";
  return definePlan<{ sex: Sex; age: number; plan: string }>({
    product: "iHealthy Ultra",
    cases: CASES,
    claims: CLAIMS[lang],
    // the premium table's rungs, the same in both languages (spec 2026-10-06): the English ad on
    // an Expat Page carries the same figures, its term said as the English sheet says it
    ladder: {
      // no pay or cover period in the ad's table (owner, 2026-10-06): the premium and the plan are the point
      term: "",
      firstYear: true,
      rungs: IHEALTHY_RUNGS.map((plan) => ({ plan })),
    },
    price: (p, claims, today) => {
      const table = iHealthyTable(today);
      const plan = table.plans.find((x) => x.code === p.plan);
      if (table.expired || !plan) return null;
      const base = baseAt(table, PACKAGE);
      const sum = base.fixedSum ?? base.saMin;
      const priced = iHealthyPricing(table, {
        base: PACKAGE, sex: p.sex, age: p.age, sumAssured: sum, plan: p.plan,
        territory: IHEALTHY_OPENING.territory, coverage: IHEALTHY_OPENING.coverage,
      });
      const lines = priceLines(priced?.total, table.expired, true, lang);
      if (!priced || !lines) return null;
      const { terms } = iHealthyFacts();
      return {
        product: "iHealthy Ultra",
        sumLine: en ? `Medical cover up to THB ${money(plan.annualMax)} a year` : `ประกันสุขภาพวงเงินค่ารักษาปีละ ${money(plan.annualMax)} บาท`,
        sumNote: en
          ? `A package with life cover of THB ${money(sum)}${priced.standard ? " and daily cash" : ""}`
          : `แพ็กเกจรวมประกันชีวิตทุน ${money(sum)} บาท${priced.standard ? " และค่าชดเชยรายวัน" : ""}`,
        premiumLine: lines.premiumLine,
        annualSatang: lines.annualSatang,
        ...(lines.monthlySatang ? { monthlySatang: lines.monthlySatang } : {}),
        perDayLine: lines.perDayLine,
        claims: claims.map((c) => c.replace("{renew}", String(terms.renewalToAge)).replace("{ncd}", String(terms.noClaimDiscountPercent))),
        who: en ? `${sexWordEn(p.sex)}, ${p.age}` : `${sexWord(p.sex)} ${p.age} ปี`,
        poster: {
          big: lines.big,
          small: en
            ? `Up to THB ${money(plan.annualMax)} a year · about THB ${lines.day} a day in year one`
            : `วงเงินปีละ ${money(plan.annualMax)} บาท · ปีแรกตกวันละ ${lines.day} บาท`,
        },
      };
    },
  });
}

export const iHealthyNumbers = iHealthyPlan("th");
/** the same cases and figures in English, for a piece ticked for expats */
export const iHealthyNumbersEn = iHealthyPlan("en");
