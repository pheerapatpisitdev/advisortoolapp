import { quote } from "@/calc/quote";
import type { Sex } from "@/calc/types";
import { cardVersionFor } from "@/lib/card-theme";
import { easyProtectTable } from "@/lib/easyprotect-table";
import { iShieldTable } from "@/lib/ishield-table";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { lifeTreasureTable } from "@/lib/lifetreasure-table";
import { plbTable } from "@/lib/plb-table";
import {
  PLAN_PAGES, pageForPlan, planInitialFromTable, type PlanInitial, type PlanPage,
} from "@/lib/quote-pdf/pages";

export type { PlanInitial };

/**
 * The link from a quote to its PDF, and from a page's address back to the values it opens on.
 *
 * The chat bot sends the same PDF the sales page's "บันทึกเป็น PDF" button makes, and the
 * customer can open the page pre-filled with the same numbers. Both ends read one query, and
 * `planInitialFrom` is the only judge of it: it owns every rule a page applies to what it is
 * handed, so a page can seed its calculator from the result without a second check, and the
 * PDF route can refuse what no page could show.
 */

/** The same key names `/api/card` reads. */
export function planQueryFor(i: PlanInitial): string {
  return new URLSearchParams({
    age: String(i.age), sex: i.sex, sum: String(i.sumAssured), variant: i.variant,
  }).toString();
}

type Query = Record<string, string | string[] | undefined>;

/**
 * The variants and ages the page's own controls offer. The engine's range can be wider, and a
 * link that asked for what the page cannot show would open on something other than what the
 * PDF says.
 */
function offered(page: PlanPage, today: Date): { ageMin: number; ageMax: number; variants: string[] } {
  switch (page) {
    case "lifeprotect": {
      const t = lifeProtectTable(today);
      return { ageMin: t.ageMin, ageMax: t.ageMax, variants: t.terms.map((x) => x.variant) };
    }
    case "easyprotect": {
      // the page has no term picker: it prices the first term
      const t = easyProtectTable(today);
      return { ageMin: t.ageMin, ageMax: t.ageMax, variants: [t.terms[0].variant] };
    }
    case "ishield": {
      const t = iShieldTable(today);
      return { ageMin: t.ageMin, ageMax: t.ageMax, variants: t.terms.map((x) => x.variant) };
    }
    case "lifetreasure": {
      const t = lifeTreasureTable(today);
      return { ageMin: t.ageMin, ageMax: t.ageMax, variants: t.terms.map((x) => x.variant) };
    }
    case "plb": {
      const t = plbTable(today);
      return { ageMin: t.ageMin, ageMax: t.ageMax, variants: t.terms.map((x) => x.variant) };
    }
  }
}

/** Undefined unless the page can open on exactly this quote and the engine can price it. */
export function planInitialFrom(page: PlanPage, query: Query, today: Date = new Date()): PlanInitial | undefined {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, v);
  }
  const { planCode, sums } = PLAN_PAGES[page];
  const initial = planInitialFromTable(params, { sums, ...offered(page, today) });
  if (!initial) return undefined;
  const { age, sex, sumAssured, variant } = initial;

  const result = quote({ planCode, variant, age, sex, mode: "annual", sumAssured, riders: [] }, today);
  if (result.warnings.some((w) => w.level === "error")) return undefined;
  if (!result.items.every((i) => i.eligible) || result.totalAnnual <= 0) return undefined;
  return { age, sex, sumAssured, variant };
}

/** The PDF route's address for a quote, or undefined when no sales page could show it. */
export function quotePdfPath(
  input:
    | { kind: "plan"; planCode: string; variant: string; age: number; sex: Sex; sumAssured: number }
    | { kind: "ihealthy"; query: string },
): string | undefined {
  const v = cardVersionFor();
  if (input.kind === "ihealthy") return `/api/quote-pdf?page=ihealthy-ultra&${input.query}&v=${v}`;
  const page = pageForPlan(input.planCode);
  if (!page) return undefined;
  const query = planQueryFor({
    age: input.age, sex: input.sex, sumAssured: input.sumAssured, variant: input.variant,
  });
  const checked = planInitialFrom(page, Object.fromEntries(new URLSearchParams(query)));
  if (!checked) return undefined;
  return `/api/quote-pdf?page=${page}&${query}&v=${v}`;
}

/**
 * LINE's own key: a link carrying it opens in the phone's browser rather than LINE's, which
 * on Android shows a PDF as a blank page. The route accepts it and prints past it.
 */
export const EXTERNAL_BROWSER = "openExternalBrowser";

/** The page address that opens on the same values as a PDF path, minus the PDF-only keys. */
export function pagePathFor(pdfPath: string): string | undefined {
  const [, search = ""] = pdfPath.split("?");
  const params = new URLSearchParams(search);
  const page = params.get("page");
  if (page === null) return undefined;
  params.delete("page");
  params.delete("v");
  params.delete(EXTERNAL_BROWSER);
  const path = page === "ihealthy-ultra"
    ? "/ihealthy-ultra"
    : Object.hasOwn(PLAN_PAGES, page) ? PLAN_PAGES[page as PlanPage].path : undefined;
  if (path === undefined) return undefined;
  const rest = params.toString();
  return rest ? `${path}?${rest}` : path;
}
