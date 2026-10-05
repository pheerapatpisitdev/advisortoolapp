import type { ModePremium } from "@/calc/mode-premiums";
import { getBundle } from "@/calc/bundles/registry";
import { quoteBundle } from "@/calc/bundles/quote";
import { formatBaht } from "@/calc/money";
import type { Sex } from "@/calc/types";
import { displayPremium, perDay } from "@/lib/legacy-cta";
import type { Lang } from "../output";
import { money } from "../numbers";

/**
 * A premium as the ตัวเลขชัดๆ post says it, from an engine's modes.
 *
 * Monthly while the company takes it; under its monthly floor, the day figure alone — the
 * owner wants no yearly premium in content (2026-09-25). The day figure is the yearly premium ÷ 365 rounded up, also as they say
 * it. A premium that rises with age (the health and critical-illness riders) is said as the
 * first year's, on every line: the owner's rule, and the only true one.
 */
export interface PriceLines {
  premiumLine: string;
  perDayLine: string;
  /** the poster's big line: "เบี้ย 1,548 บาท/เดือน" */
  big: string;
  /** "48": the day figure alone, for the poster's small line */
  day: string;
  annualSatang: number;
  /**
   * the monthly mode's premium in satang when the company takes it monthly at this premium (the
   * month premiumLine says); absent under the monthly floor. The ad's table says it as ตกเดือนละ.
   */
  monthlySatang?: number;
}

export function priceLines(modes: ModePremium[] | undefined, expired: boolean, firstYear = false, lang: Lang = "th"): PriceLines | null {
  const shown = displayPremium(modes, expired);
  const annual = modes?.find((m) => m.mode === "annual");
  if (!shown || !annual) return null;
  const monthly = shown.mode === "monthly";
  const day = money(perDay(annual.total));
  const month = monthly ? { monthlySatang: shown.total } : {};
  if (lang === "en") {
    const perDayLine = `About THB ${day} a day${firstYear ? " in the first year" : ""}`;
    return {
      premiumLine: monthly ? `${firstYear ? "First-year premium" : "Premium"} THB ${formatBaht(shown.total)}/month` : "",
      perDayLine,
      big: monthly ? `THB ${formatBaht(shown.total)}/month` : perDayLine,
      day,
      annualSatang: annual.total,
      ...month,
    };
  }
  const word = firstYear ? "เบี้ยปีแรก" : "เบี้ย";
  // a month's premium or the day's, never a year's (owner, 2026-09-25): below the monthly
  // floor the day figure leads, and there is no premium line above it
  return {
    premiumLine: monthly ? `${word} ${formatBaht(shown.total)} บาท ต่อเดือน` : "",
    perDayLine: `${firstYear ? "ปีแรกตกวันละ" : "ตกวันละ"} ${day} บาท`,
    big: monthly ? `${word} ${formatBaht(shown.total)} บาท/เดือน` : `${firstYear ? "ปีแรกตกวันละ" : "ตกวันละ"} ${day} บาท`,
    day,
    annualSatang: annual.total,
    ...month,
  };
}

/**
 * A bundle tier's premium as modes, for priceLines: the yearly total, and the monthly one
 * marked below the floor when the engine says it is (its MIN_MONTHLY warning). Undefined when
 * the tier cannot be sold to this person — quoteBundle then zeroes its totals.
 */
export function bundleModes(bundleId: string, tierNo: number, who: { sex: Sex; age: number }, today: Date): ModePremium[] | undefined {
  const bundle = getBundle(bundleId);
  if (!bundle) return undefined;
  const annual = quoteBundle(bundle, tierNo, { ...who, mode: "annual" }, today);
  const monthly = quoteBundle(bundle, tierNo, { ...who, mode: "monthly" }, today);
  if (!annual || !annual.totalAnnual || annual.meta.expired) return undefined;
  const modes: ModePremium[] = [{ mode: "annual", total: annual.totalAnnual, belowMinimum: false }];
  if (monthly && monthly.totalModal) {
    modes.push({ mode: "monthly", total: monthly.totalModal, belowMinimum: monthly.warnings.some((w) => w.code === "MIN_MONTHLY") });
  }
  return modes;
}
