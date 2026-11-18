import type { BasePackage, CoverTopUp, PlanRates, PlanRules } from "../types";
import plbRates from "../../../data/rates/plb.json";
import plbRules from "../../../data/rules/plb.json";
import ishieldRates from "../../../data/rates/ishield.json";
import ishieldRules from "../../../data/rules/ishield.json";
import ismartRates from "../../../data/rates/ismart.json";
import ismartRules from "../../../data/rules/ismart.json";
import lifetreasureRates from "../../../data/rates/lifetreasure.json";
import lifetreasureRules from "../../../data/rules/lifetreasure.json";
import lifeprotectRates from "../../../data/rates/lifeprotect.json";
import lifeprotectRules from "../../../data/rules/lifeprotect.json";
import easyprotectRates from "../../../data/rates/easyprotect.json";
import easyprotectRules from "../../../data/rules/easyprotect.json";
import twelvePlRates from "../../../data/rates/12pl.json";
import twelvePlRules from "../../../data/rules/12pl.json";

export interface PlanBundle {
  rates: PlanRates;
  rules: PlanRules;
  /** overrides the workbook's Thai name in the plan picker */
  planLabel?: string;
  /** rider codes in display order */
  riderOrder: string[];
  /** what to quote when nobody picks a term; falls back to the first variant */
  defaultVariant?: string;
  variantLabels: Record<string, string>;
  /**
   * How the death benefit is topped up above the sum assured, read off the plan's own
   * benefit sheet. Absent for a plan whose sheet has not been read.
   */
  coverTopUp?: CoverTopUp;
}

/** "(Non-Participating)" / "(ไม่มีเงินปันผล)" adds nothing on screen, so it is trimmed off. */
const NON_PARTICIPATING = /\s*\((?:ไม่มีเงินปันผล|Non-Participating)\)\s*/gi;
export function trimSuffix(name: string): string {
  return name.replace(NON_PARTICIPATING, "").trim();
}

/** A package's product name in English where the workbook has one, else Thai. */
export function productLabel(pkg: BasePackage): string | undefined {
  const raw = pkg.productNameEn ?? pkg.productName;
  return raw ? trimSuffix(raw) : undefined;
}

/** The three W-family plans share a rider order and take their variant labels from the package table. */
function wFamily(
  code: string, rates: unknown, rules: unknown, planLabel?: string, defaultVariant?: string,
  coverTopUp?: CoverTopUp,
): Record<string, PlanBundle> {
  const r = rates as PlanRates;
  const packages = r.base.packages ?? [];
  // ไลฟ์ โพรเทค+ sells the same payment terms under two products, so the term alone would
  // show up twice with identical text. Put the product in front when there is more than one.
  const products = new Set(packages.map((p) => productLabel(p)).filter(Boolean));
  return {
    [code]: {
      rates: r,
      rules: rules as PlanRules,
      planLabel,
      defaultVariant,
      coverTopUp,
      riderOrder: ["PB", "WP", "AP", "ECARE", "MEX", "MEB", "DCI", "PLS", "CPR", "HIC", "IHU", "RRSS", "CI123"],
      variantLabels: Object.fromEntries(packages.map((p) => [
        p.code,
        products.size > 1 && productLabel(p) ? `${productLabel(p)} · ${p.name}` : p.name,
      ])),
    },
  };
}

const PLANS: Record<string, PlanBundle> = {
  PLB: {
    planLabel: "Protection Life (PLB)",
    rates: plbRates as unknown as PlanRates,
    rules: plbRules as unknown as PlanRules,
    riderOrder: ["AP", "ECARE", "MEB"],
    variantLabels: {
      // cover runs exactly as long as the premium is paid, so the term is the whole label;
      // the product's own name is the plan label above it, and on the card in front of it
      PLB05: "ชำระเบี้ย 5 ปี",
      PLB10: "ชำระเบี้ย 10 ปี",
      PLB12: "ชำระเบี้ย 12 ปี",
      PLB15: "ชำระเบี้ย 15 ปี",
    },
  },
  ISHIELD: {
    planLabel: "iShield",
    // ตารางแสดงผลประโยชน์ F: MAX(previous, IF(premiums > sumAssured, premiums, sumAssured))
    coverTopUp: { premiumPercent: 100, includeCashValue: false },
    rates: ishieldRates as unknown as PlanRates,
    rules: ishieldRules as unknown as PlanRules,
    riderOrder: ["PB", "AP", "ECARE", "MEB", "PLS"],
    variantLabels: {
      WLCI05: "iShield 05 (ชำระเบี้ย 5 ปี)",
      WLCI10: "iShield 10 (ชำระเบี้ย 10 ปี)",
      WLCI15: "iShield 15 (ชำระเบี้ย 15 ปี)",
      WLCI20: "iShield 20 (ชำระเบี้ย 20 ปี)",
    },
  },
  // ตารางแสดงผลประโยชน์ H: MAX(2 × จำนวนเงินเอาประกันภัย, 101% ของเบี้ยที่ชำระมาแล้ว, มูลค่าเวนคืน)
  ...wFamily("ISMART", ismartRates, ismartRules, "iSmart 80/6", undefined,
    { premiumPercent: 101, includeCashValue: true, sumAssuredMultiple: 2 }),
  // ตารางแสดงผลประโยชน์ หมายเหตุ 3: จำนวนเงินเอาประกันภัย หรือมูลค่าเวนคืนกรมธรรม์
  // หรือ 101% ของเบี้ยที่ชำระมาแล้ว แล้วแต่จำนวนใดจะมากกว่า
  ...wFamily("LIFETREASURE", lifetreasureRates, lifetreasureRules, "Life Treasure", undefined,
    { premiumPercent: 101, includeCashValue: true }),
  EASYPROTECT: {
    planLabel: "อีซี่ โพรเทค 6",
    // The source calculator's benefit table: MAX(ทุน, 101% ของเบี้ยที่ชำระมาแล้ว, มูลค่าเวนคืน)
    // — the same three amounts ไลฟ์เทรเชอร์ compares, and the same ones its sheet prints.
    coverTopUp: { premiumPercent: 101, includeCashValue: true },
    rates: easyprotectRates as unknown as PlanRates,
    rules: easyprotectRules as unknown as PlanRules,
    // Only the riders this plan sells. The six it does not — AP, ECARE, MEX, CPR, HIC and
    // โรคร้ายโซชิลด์ — are absent from its rules as well, so neither the form nor the quote
    // can offer one.
    riderOrder: ["PB", "WP", "MEB", "DCI", "PLS", "IHU", "CI123"],
    variantLabels: { W99F06A: "ชำระเบี้ย 6 ปี" },
  },
  // Life Protect x 2 paid to age 99 is the one agents quote most, so it is the default here too.
  // ตารางแสดงผลประโยชน์ H: MAX(multiple × sumAssured, 101% × premiums paid, surrender value)
  ...wFamily("LIFEPROTECT", lifeprotectRates, lifeprotectRules, "Life Protect x 1.5 / x 2", "WLF99H",
    { premiumPercent: 101, includeCashValue: true }),
  // 12 พีแอล: ตารางแสดงผลประโยชน์ R = MAX(มูลค่าเวนคืน, จำนวนเงินเอาประกันภัย) — no premium floor.
  // Its riders are the W family's own sheets, so it takes the same rider order.
  ...wFamily("12PL", twelvePlRates, twelvePlRules, "12 พีแอล (12PL)", undefined,
    { premiumPercent: 0, includeCashValue: true }),
};

/** Display order for the plan picker; anything not listed follows in definition order. */
const PLAN_ORDER = ["LIFEPROTECT", "ISMART", "EASYPROTECT", "LIFETREASURE", "12PL", "ISHIELD", "PLB"];

export function listPlans(): { code: string; name: string }[] {
  const entries = Object.entries(PLANS).map(([code, p]) => ({ code, name: p.planLabel ?? p.rates.planName }));
  return entries.sort((a, b) => {
    const ia = PLAN_ORDER.indexOf(a.code);
    const ib = PLAN_ORDER.indexOf(b.code);
    return (ia < 0 ? PLAN_ORDER.length : ia) - (ib < 0 ? PLAN_ORDER.length : ib);
  });
}

/**
 * Plans the calculators sell that the chat does not know yet. 12 พีแอล came in as a page
 * (owner, 2026-11-18); teaching the bots it is its own decision, so it stays out of their
 * knowledge, their plan list and their price buttons until then.
 */
const NOT_IN_CHAT = new Set(["12PL"]);

/** listPlans without the plans the chat has not been taught. */
export function listChatPlans(): { code: string; name: string }[] {
  return listPlans().filter((p) => !NOT_IN_CHAT.has(p.code));
}

export function getPlan(code: string): PlanBundle | undefined {
  return PLANS[code];
}
