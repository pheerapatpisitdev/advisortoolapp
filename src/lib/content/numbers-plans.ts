import type { NumberSheet, PricedPlan } from "./numbers";
import type { Lang } from "./output";
import { lifelong } from "./wording";
import { cancerNumbers } from "./numbers-cases/cancer";
import { ci123Numbers } from "./numbers-cases/ci123";
import { easyProtectNumbers } from "./numbers-cases/easyprotect";
import { iHealthyNumbers, iHealthyNumbersEn } from "./numbers-cases/ihealthy";
import { legacyNumbers } from "./numbers-cases/legacy";
import { lifeProtectNumbers } from "./numbers-cases/lifeprotect";
import { lifeTreasureNumbers } from "./numbers-cases/lifetreasure";
import { pensionNumbers } from "./numbers-cases/pension";
import { plbNumbers } from "./numbers-cases/plb";
import { iShieldNumbers } from "./numbers-cases/ishield";

/**
 * The plans the ตัวเลขชัดๆ angle can price, by sales-page href. Each plan's three people, its
 * owner-approved claim lines (spec 2026-09-24) and its pricing live in numbers-cases/. A case
 * the engine cannot price today — an age off the table, a lapsed rate table — is skipped, and
 * a plan with nobody left gives no sheets, so the angle says so instead of writing a post
 * without figures. NUMBERS_HREFS in prompt.ts must list the same hrefs; a test holds them.
 */
export const NUMBERS_PLANS: Record<string, PricedPlan> = {
  "/lifeprotect": lifeProtectNumbers,
  "/plb": plbNumbers,
  "/easyprotect": easyProtectNumbers,
  "/lifetreasure": lifeTreasureNumbers,
  "/legacy": legacyNumbers,
  "/ishield": iShieldNumbers,
  "/ci123": ci123Numbers,
  "/cancer": cancerNumbers,
  "/ihealthy-ultra": iHealthyNumbers,
  "/bumnan95": pensionNumbers,
};

/** The plans with an English version; the rest give no English sheets and are written in Thai. */
export const EXPAT_NUMBERS_PLANS: Record<string, PricedPlan> = {
  "/ihealthy-ultra": iHealthyNumbersEn,
};

/** piece i's two claims: consecutive pairs round the list, so a round of three differs */
export function claimsFor(list: string[], i: number): string[] {
  if (list.length <= 2) return list;
  return [list[(i * 2) % list.length], list[(i * 2 + 1) % list.length]];
}

/** `count` sheets for a round, one person each in turn; empty when nobody can be priced. */
export function numberSheets(href: string, count: number, today: Date = new Date(), lang: Lang = "th"): NumberSheet[] {
  const en = lang === "en";
  const plan = (en ? EXPAT_NUMBERS_PLANS : NUMBERS_PLANS)[href];
  if (!plan) return [];
  const priced = Array.from({ length: plan.caseCount }, (_, i) => i).filter((i) => plan.price(i, plan.claims, today) !== null);
  if (priced.length === 0) return [];
  return Array.from({ length: count }, (_, n) => {
    const sheet = plan.price(priced[n % priced.length], claimsFor(plan.claims, n), today)!;
    return en ? sheet : lifelongSheet(sheet);
  });
}

/** every line of a sheet with ตลอดชีพ in place of 99 (wording.ts) — the engines say "ถึงอายุ 99" */
function lifelongSheet(s: NumberSheet): NumberSheet {
  return {
    ...s,
    sumLine: lifelong(s.sumLine),
    ...(s.sumNote ? { sumNote: lifelong(s.sumNote) } : {}),
    premiumLine: lifelong(s.premiumLine),
    perDayLine: lifelong(s.perDayLine),
    claims: s.claims.map(lifelong),
    who: lifelong(s.who),
    poster: { big: lifelong(s.poster.big), small: lifelong(s.poster.small) },
  };
}
