/**
 * Which sales page makes which quote PDF, and the sums each page's slider offers.
 *
 * Plain constants only. The calculators are client components and import their sums from here,
 * so nothing in this file may reach a rate table or any other server-only module; everything
 * that reads rates sits in link.ts.
 */

export type PlanPage = "lifeprotect" | "easyprotect" | "ishield" | "lifetreasure" | "plb";
export type PdfPage = PlanPage | "ihealthy-ultra";

/**
 * The sums the slider offers: every half million up to ten, then every million up to fifty.
 * One step the whole way would be a hundred stops on a thumb-wide track; the coarser upper
 * half keeps the slider usable where the extra half-millions matter least.
 */
export const LIFEPROTECT_SUMS = [
  ...Array.from({ length: 20 }, (_, i) => 500_000 * (i + 1)),
  ...Array.from({ length: 40 }, (_, i) => 11_000_000 + 1_000_000 * i),
];

/**
 * The sums the slider offers: every hundred thousand from the plan's five-hundred-thousand
 * floor to three million, then every half-million to ten. The fine steps sit where most of
 * this plan is written — a first policy, or a top-up on one — and the coarse ones above
 * keep the slider usable with a thumb.
 */
export const EASYPROTECT_SUMS = [
  ...Array.from({ length: 26 }, (_, i) => 500_000 + 100_000 * i),
  ...Array.from({ length: 14 }, (_, i) => 3_500_000 + 500_000 * i),
];

/**
 * The sums the slider offers: every hundred thousand to a million, then every half million
 * to five. The plan's own floor and ceiling are 100,000 and 5,000,000, and the finer steps
 * sit where most of this plan is sold.
 */
export const ISHIELD_SUMS = [
  ...Array.from({ length: 10 }, (_, i) => 100_000 * (i + 1)),
  ...Array.from({ length: 8 }, (_, i) => 1_500_000 + 500_000 * i),
];

/**
 * The sums the slider offers: every million from the plan's ten-million floor to thirty,
 * then every five to fifty. The finer steps sit where most of this plan is written; above
 * thirty million the extra millions are a conversation rather than a slider.
 */
export const LIFETREASURE_SUMS = [
  ...Array.from({ length: 21 }, (_, i) => 10_000_000 + 1_000_000 * i),
  ...Array.from({ length: 4 }, (_, i) => 35_000_000 + 5_000_000 * i),
];

/**
 * The sums the slider offers: every hundred thousand from the plan's floor to a million,
 * then every half million to five. The finer steps sit under a million, which is where the
 * rate discount changes and where most of this plan is sold.
 */
export const PLB_SUMS = [
  ...Array.from({ length: 8 }, (_, i) => 300_000 + 100_000 * i),
  ...Array.from({ length: 8 }, (_, i) => 1_500_000 + 500_000 * i),
];

export const PLAN_PAGES: Record<PlanPage, { planCode: string; path: string; sums: readonly number[] }> = {
  lifeprotect: { planCode: "LIFEPROTECT", path: "/lifeprotect", sums: LIFEPROTECT_SUMS },
  easyprotect: { planCode: "EASYPROTECT", path: "/easyprotect", sums: EASYPROTECT_SUMS },
  ishield: { planCode: "ISHIELD", path: "/ishield", sums: ISHIELD_SUMS },
  lifetreasure: { planCode: "LIFETREASURE", path: "/lifetreasure", sums: LIFETREASURE_SUMS },
  plb: { planCode: "PLB", path: "/plb", sums: PLB_SUMS },
};

/** The page that prices a plan, or undefined for a plan with no page of its own (ISMART, say). */
export function pageForPlan(planCode: string): PlanPage | undefined {
  return (Object.keys(PLAN_PAGES) as PlanPage[]).find((p) => PLAN_PAGES[p].planCode === planCode);
}
