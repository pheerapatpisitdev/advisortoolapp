import { quoteGlobalSaving } from "@/calc/global-saving/engine";
import type { ModePremium } from "@/calc/mode-premiums";
import { quotePension } from "@/calc/pension/engine";
import { cancerQuoteText } from "@/lib/cancer-cta";
import { ci123QuoteText } from "@/lib/ci123-cta";
import { ci123Table } from "@/lib/ci123-table";
import { easyProtectQuoteText } from "@/lib/easyprotect-cta";
import { gsQuoteText } from "@/lib/global-saving-text";
import { iHealthyQuoteText, type IHealthyCtaFacts } from "@/lib/ihealthy-cta";
import { iShieldQuoteText } from "@/lib/ishield-cta";
import { legacyQuoteText } from "@/lib/legacy-cta";
import { lifeProtectQuoteText } from "@/lib/lifeprotect-cta";
import { lifeTreasureQuoteText } from "@/lib/lifetreasure-cta";
import { pensionQuoteText } from "@/lib/pension-cta";
import { plbQuoteText } from "@/lib/plb-cta";
import {
  cancerSlots, ci123Slots, easyProtectSlots, gsavingSlots, iHealthySlots, iShieldSlots, legacySlots,
  lifeProtectSlots, lifeTreasureSlots, pensionSlots, plbSlots, SHARE_PLANS, type SharePlan,
} from "./plans";
import { shareText } from "./template";

/**
 * One example quote a plan, for the settings page's preview and for the AI to see what each slot
 * holds. The figures are each calculator's opening arrangement as it priced on 2026-11-14 — an
 * example, said so beside it, never a quote: the page a member sends from prices its own.
 */
export interface ShareSample {
  /** who the example is, in words for the preview's caption */
  who: string;
  standard: string;
  slots: Record<string, string | undefined>;
}

const m = (mode: ModePremium["mode"], baht: number, belowMinimum = false): ModePremium =>
  ({ mode, total: baht * 100, belowMinimum });
const CASH_99 = [{ age: 60, amount: 503_000 }, { age: 70, amount: 632_000 }, { age: 80, amount: 776_000 }, { age: 99, amount: 1_000_000 }];

export function shareSample(plan: SharePlan): ShareSample {
  switch (plan) {
    case "lifeprotect": {
      const f = {
        sumAssured: 1_000_000, termLabel: "จ่าย 19 ปี", age: 35, sex: "M" as const,
        modes: [m("monthly", 2_583), m("semi", 14_924), m("annual", 28_700)],
        death: { beforeAge: 60, sumBefore: 2_000_000, sumFrom: 1_000_000, alreadyPastAge: false }, cash: [],
      };
      return { who: "ชาย 35 ปี ทุน 1 ล้าน จ่าย 19 ปี", standard: lifeProtectQuoteText(f), slots: lifeProtectSlots(f) };
    }
    case "easyprotect": {
      const f = {
        sumAssured: 1_000_000, age: 35, sex: "M" as const, years: 6, coverToAge: 99,
        modes: [m("monthly", 6_120), m("semi", 35_360), m("annual", 68_000)],
        total: 408_000 * 100, leverage: 2.5, cash: CASH_99, premiumFloorPercent: 101,
      };
      return { who: "ชาย 35 ปี ทุน 1 ล้าน", standard: easyProtectQuoteText(f), slots: easyProtectSlots(f) };
    }
    case "lifetreasure": {
      const f = {
        sumAssured: 10_000_000, termLabel: "ชำระเบี้ย 18 ปี", age: 45, sex: "M" as const, years: 18, coverToAge: 99,
        modes: [m("monthly", 33_300), m("semi", 192_400), m("annual", 370_000)],
        total: 6_660_000 * 100, leverage: 1.5, premiumFloorPercent: 101,
        cash: [{ age: 60, amount: 4_950_000 }, { age: 70, amount: 6_910_000 }, { age: 80, amount: 8_070_000 }, { age: 99, amount: 10_000_000 }],
      };
      return { who: "ชาย 45 ปี ทุน 10 ล้าน ชำระเบี้ย 18 ปี", standard: lifeTreasureQuoteText(f), slots: lifeTreasureSlots(f) };
    }
    case "ishield": {
      const f = {
        sumAssured: 1_000_000, termLabel: "ชำระเบี้ย 10 ปี", age: 35, sex: "M" as const,
        modes: [m("monthly", 6_028), m("semi", 34_829), m("annual", 66_980)],
        illness: { early: 250_000, major: 1_000_000 }, counts: { earlyCount: 20, majorCount: 50, waitingDays: 90 },
        maturityAge: 85,
        cash: [{ age: 60, amount: 676_000 }, { age: 70, amount: 790_000 }, { age: 80, amount: 911_000 }, { age: 85, amount: 1_000_000 }],
      };
      return { who: "ชาย 35 ปี ทุน 1 ล้าน ชำระเบี้ย 10 ปี", standard: iShieldQuoteText(f), slots: iShieldSlots(f) };
    }
    case "plb": {
      const f = {
        sumAssured: 1_000_000, termLabel: "ชำระเบี้ย 12 ปี", age: 35, sex: "M" as const, years: 12, endsAtAge: 47,
        modes: [m("annual", 5_470), m("semi", 2_844)], total: 65_640 * 100,
      };
      return { who: "ชาย 35 ปี ทุน 1 ล้าน คุ้มครอง 12 ปี", standard: plbQuoteText(f), slots: plbSlots(f) };
    }
    case "legacy": {
      const f = {
        millions: 1, age: 30, sex: "F" as const, minMonthly: 1_000, critical: 850_000, diseaseCount: 31,
        modes: [m("annual", 4_123), m("monthly", 371, true), m("semi", 2_143)],
        death: { beforeAge: 60, sumBefore: 1_150_000, sumFrom: 1_000_000, alreadyPastAge: false, riderCoverEnds: { age: 75, sum: 150_000 } },
      };
      return { who: "หญิง 30 ปี มรดก 1 ล้าน", standard: legacyQuoteText(f), slots: legacySlots(f) };
    }
    case "cancer": {
      const f = {
        cpr: 1_000_000, hic: 4_000, baseSum: 200_000, age: 35, sex: "F" as const, minMonthly: 1_000,
        modes: [m("annual", 4_745), m("monthly", 427, true), m("semi", 2_467)],
      };
      return { who: "หญิง 35 ปี ทุนมะเร็ง 1 ล้าน", standard: cancerQuoteText(f), slots: cancerSlots(f) };
    }
    case "ci123": {
      const t = ci123Table();
      const f = {
        sum: 1_000_000, baseSum: t.baseSum, age: 30, sex: "F" as const, minMonthly: 1_000,
        modes: [m("annual", 5_309), m("monthly", 477, true), m("semi", 2_760)],
        stages: t.stages, diseaseCount: t.diseaseCount,
      };
      return { who: "หญิง 30 ปี ทุน 1 ล้าน", standard: ci123QuoteText(f), slots: ci123Slots(f) };
    }
    case "pension": {
      const who = { age: 40, sex: "M" as const };
      const r = quotePension({ ...who, annuityAge: 60, pay: "untilAnnuity", mode: "annual", basis: "monthlyPension", amount: 10_000 });
      if (!r.ok) throw new Error(`pension sample: ${r.error}`);
      return { who: "ชาย 40 ปี บำนาญเดือนละ 10,000 ตั้งแต่อายุ 60", standard: pensionQuoteText(who, r.quote), slots: pensionSlots(who, r.quote) };
    }
    case "gsaving": {
      const q = quoteGlobalSaving({ basis: "premium", amount: 50_000, age: 35 });
      return { who: "อายุ 35 ปี เบี้ยปีละ 50,000", standard: gsQuoteText(35, q), slots: gsavingSlots(35, q) };
    }
    case "ihealthy": {
      const f: IHealthyCtaFacts = {
        arrangement: { planName: "Gold", annualMax: 25_000_000, territory: "ประเทศไทย", coverage: "Full Coverage", deductible: 0 },
        copayPercent: 20, age: 35, sex: "F", baseLabel: "Health Ultra Package", sumAssured: 50_000,
        death: { beforeAge: 60, sumBefore: 100_000, sumFrom: 50_000, alreadyPastAge: false },
        mode: "annual", minMonthly: 1_000,
        shown: {
          base: 0, rider: 0, total: 45_810 * 100, belowMinimum: false, refused: [],
          others: [{ mode: "semi", total: 23_821 * 100 }, { mode: "monthly", total: 4_122 * 100 }],
          standard: { label: "ค่าชดเชยรายวัน 1,000 บาท", total: 1 },
        },
        benefits: { room: "9,000 ต่อวัน", opd: "12,000" },
      };
      return { who: "หญิง 35 ปี แผน Gold", standard: iHealthyQuoteText(f)!, slots: iHealthySlots(f) };
    }
  }
}

/** A template as the customer would read it, with the example's figures. */
export function samplePreview(plan: SharePlan, template: string): string {
  const s = shareSample(plan);
  return shareText(template, s.standard, s.slots, SHARE_PLANS[plan].blocks);
}
