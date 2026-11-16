import { describe, expect, it } from "vitest";
import { getPlan } from "@/calc/plans/registry";
import { baseSumAssuredLimits } from "@/calc/rules";
import { formatBaht } from "@/calc/money";
import type { PayMode, Sex } from "@/calc/types";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { MODES, coveragesFor, iHealthyPricing, plansFor } from "@/lib/ihealthy-quote";
import {
  IHEALTHY_OPENING, baseFor, resolveArrangement, sumFor, sumsFor,
} from "@/lib/ihealthy-choice";
import { shownAt } from "@/lib/ihealthy-quote";

const WHILE_CURRENT = new Date("2026-09-12");
const table = iHealthyTable(WHILE_CURRENT);
const rules = getPlan("LIFEPROTECT")!.rules;

/** What the page prices for one whole arrangement, in the baht the card prints. */
function baht(choice: {
  sex: Sex; age: number; base: string; sumAssured: number;
  plan: string; territory: string; coverage: string; mode: PayMode;
}) {
  const priced = iHealthyPricing(table, { ...choice, base: baseFor(table, choice.base).variant });
  const shown = shownAt(priced, choice.mode);
  return shown && {
    base: formatBaht(shown.base), rider: formatBaht(shown.rider),
    standard: shown.standard && formatBaht(shown.standard.total),
    total: formatBaht(shown.total),
  };
}

const THAI = "ประเทศไทย";
const FULL = "Full Coverage";

describe("the sums the form offers", () => {
  /**
   * The engine zeroes an arrangement written under the base's floor, so a picker that could
   * reach a smaller sum would price something the company would refuse to issue. The floor
   * is read from the rules the engine itself checks against, not from a second copy of it.
   */
  it("never goes under the floor the engine enforces", () => {
    for (const base of table.bases) {
      const limits = baseSumAssuredLimits(rules, base.variant);
      expect(sumsFor(base).every((s) => s >= limits.min)).toBe(true);
      if (limits.exact) expect(sumsFor(base)).toEqual([limits.min]);
    }
  });

  it("prices every one of them", () => {
    for (const base of table.bases) {
      for (const sumAssured of sumsFor(base)) {
        const priced = iHealthyPricing(table, {
          base: base.variant, sex: "F", age: 35, sumAssured, plan: "GOLD", territory: THAI, coverage: FULL,
        });
        expect(priced?.total[0].total).toBeGreaterThan(0);
      }
    }
  });

  /**
   * The package pins fifty thousand, which is a third of what the other two are issued for.
   * Switching to it and back must not carry that figure over — the engine would void the
   * whole quote, and the picker would be showing an amount that is not among its options.
   */
  it("does not carry the package's pinned sum over to a base that is not sold for it", () => {
    const pkg = table.bases.find((b) => b.fixedSum !== undefined)!;
    const open = table.bases.find((b) => b.fixedSum === undefined)!;
    expect(sumFor(pkg, 1_000_000)).toBe(pkg.fixedSum);
    expect(sumsFor(open)).toContain(sumFor(open, pkg.fixedSum!));
  });

  it("keeps the customer's own sum when the base does sell it", () => {
    const open = table.bases.find((b) => b.fixedSum === undefined)!;
    expect(sumFor(open, 2_000_000)).toBe(2_000_000);
  });
});

describe("baseFor", () => {
  it("hands back a base the engine can price, whatever the link asked for", () => {
    expect(baseFor(table, "WLF99HX").variant).toBe("WLF99HX");
    // x 1.5 is a real variant of the plan that this page does not sell, so a link naming it
    // lands on the page's own first base rather than on a button that is not there
    expect(baseFor(table, "WLF99L").variant).toBe(table.bases[0].variant);
    // iHealthyPricing throws on a variant the table has never heard of
    expect(baseFor(table, "WLF09L").variant).toBe(table.bases[0].variant);
    // the 9- and 19-year terms of x 2 are sold here (owner, 2026-11-16) and kept as asked
    expect(baseFor(table, "WLF09H").variant).toBe("WLF09H");
    expect(baseFor(table, "WLF19H").variant).toBe("WLF19H");
    expect(() => iHealthyPricing(table, {
      base: baseFor(table, "nonsense").variant, sex: "F", age: 35, sumAssured: 150_000,
      plan: "GOLD", territory: THAI, coverage: FULL,
    })).not.toThrow();
  });
});

describe("resolveArrangement", () => {
  it("leaves an arrangement the company sells alone", () => {
    const r = resolveArrangement(table, 35, IHEALTHY_OPENING);
    expect([r.plan?.code, r.territory, r.coverage]).toEqual(["GOLD", THAI, FULL]);
  });

  it("walks a child down to a plan and a territory a child may have", () => {
    const r = resolveArrangement(table, 8, { plan: "PLATINUM", territory: "ทั่วโลก", coverage: FULL });
    expect(r.plans.map((p) => p.code)).toEqual(["SMART", "BRONZE"]);
    expect([r.plan?.code, r.territory]).toEqual(["SMART", THAI]);
  });

  it("drops a way of sharing the bill that the territory does not sell", () => {
    const r = resolveArrangement(table, 35, { plan: "PLATINUM", territory: "ทั่วโลก", coverage: "Co-Payment" });
    expect(r.coverages).toEqual([FULL]);
    expect(r.coverage).toBe(FULL);
  });

  /**
   * The three fields have to be sold *together*, which is more than each being on its own
   * list: the territory is asked per plan but the coverages the page can offer are asked for
   * the whole page, so narrowing them to the resolved plan is the only thing standing between
   * a legal-looking arrangement and a card with no price and nothing true to say about why.
   *
   * Every preference the pickers can hold, at every age the page offers — 54 combinations
   * across 75 ages — settled and then priced for real, once per base and sex.
   */
  it("settles on an arrangement that is sold as a whole, at every age", () => {
    const wanted = table.plans.flatMap((p) =>
      Object.keys(table.territories).flatMap((territory) =>
        Object.keys(table.coverages).map((coverage) => ({ plan: p.code, territory, coverage }))));
    expect(wanted).toHaveLength(54);
    for (let age = table.ageMin; age <= table.ageMax; age++) {
      for (const want of wanted) {
        const where = `age ${age} · ${want.plan} ${want.territory} ${want.coverage}`;
        const r = resolveArrangement(table, age, want);
        expect(r.plan, where).toBeDefined();
        expect(r.plans, where).toContain(r.plan);
        expect(r.territories, where).toContain(r.territory);
        expect(r.coverages, where).toContain(r.coverage);
        for (const sex of ["M", "F"] as Sex[]) {
          for (const base of table.bases) {
            const priced = iHealthyPricing(table, {
              base: base.variant, sex, age, sumAssured: sumFor(base, IHEALTHY_OPENING.sumAssured),
              plan: r.plan!.code, territory: r.territory!, coverage: r.coverage!,
            });
            expect(priced, `${where} · ${base.variant} ${sex}`).toBeDefined();
          }
        }
      }
    }
  });

  /**
   * The list the customer is shown, not only the one item resolved out of it: every way of
   * sharing the bill the select offers has to be one this plan is actually sold under.
   *
   * And it must not overshoot: the territory was reached under the default way of sharing the
   * bill, so that one is always still on the list once the plan has had its say.
   */
  it("offers only the ways of sharing the bill that this plan is sold under", () => {
    for (let age = table.ageMin; age <= table.ageMax; age++) {
      for (const p of table.plans) {
        for (const territory of Object.keys(table.territories)) {
          const r = resolveArrangement(table, age, { plan: p.code, territory, coverage: FULL });
          const where = `age ${age} · ${p.code} ${territory}`;
          expect(r.coverages.length, where).toBeGreaterThan(0);
          for (const coverage of r.coverages) {
            expect(iHealthyPricing(table, {
              base: "WLF99H", sex: "F", age, sumAssured: IHEALTHY_OPENING.sumAssured,
              plan: r.plan!.code, territory: r.territory!, coverage,
            }), `${where} · ${coverage}`).toBeDefined();
          }
        }
      }
    }
  });

  /**
   * Today's rate table sells every plan under every way of sharing the bill it sells at all,
   * so nothing above can tell a narrowed list from an unnarrowed one. This is the rate table
   * as it would look the morning the company stopped writing แพลทินั่ม with a deductible: the
   * page-wide list does not notice, because the other five plans still have one.
   */
  it("drops a coverage this plan alone has lost", () => {
    const patched = { ...table, riderRates: { ...table.riderRates, MHPD6S: undefined } };
    expect(coveragesFor(patched, THAI, 35)).toContain("Deductible");
    const r = resolveArrangement(patched, 35, { plan: "PLATINUM", territory: THAI, coverage: "Deductible" });
    expect(r.plan?.code).toBe("PLATINUM");
    expect(r.coverages).toEqual([FULL, "Co-Payment"]);
    expect(r.coverage).toBe(FULL);
  });
});

describe("shownAt", () => {
  it("has nothing to show without a price", () => {
    expect(shownAt(undefined, "annual")).toBeUndefined();
  });

  it("carries the other two instalments with the one on screen", () => {
    const priced = iHealthyPricing(table, {
      base: "WLF99H", sex: "F", age: 35, sumAssured: 150_000, plan: "GOLD", territory: THAI, coverage: FULL,
    });
    const shown = shownAt(priced, "semi")!;
    expect(shown.others.map((o) => o.mode)).toEqual(["annual", "monthly"]);
    // the total is the three lines the card prints, not two of them
    expect(shown.base + shown.rider + (shown.standard?.total ?? 0)).toBe(shown.total);
  });

  /**
   * With the agency's daily cash attached the floor is out of reach: the cheapest the pickers
   * reach is 1,062 a month against a floor of 1,000. It is one un-tick away, though — an
   * agent who empties the fold can reach 945 — so the second half of this checks that the
   * page refuses to offer that instalment rather than that it cannot happen.
   */
  it("sells nothing the company would refuse an instalment of", () => {
    const pkg = table.bases.find((b) => b.fixedSum !== undefined)!;
    let cheapest: { total: number; belowMinimum: boolean } | undefined;
    for (let age = table.ageMin; age <= table.ageMax; age++) {
      for (const plan of plansFor(table, age)) {
        for (const coverage of coveragesFor(table, THAI, age)) {
          const shown = shownAt(iHealthyPricing(table, {
            base: pkg.variant, sex: "M", age, sumAssured: pkg.fixedSum!,
            plan: plan.code, territory: THAI, coverage,
          }), "monthly")!;
          if (cheapest === undefined || shown.total < cheapest.total) cheapest = shown;
        }
      }
    }
    expect(cheapest!.total).toBeGreaterThanOrEqual(table.minMonthly * 100);
    expect(cheapest!.belowMinimum).toBe(false);
    // and the arrangement the page opens on is nowhere near it
    expect(shownAt(iHealthyPricing(table, { ...IHEALTHY_OPENING, base: "WLF99H" }), "monthly")!.belowMinimum)
      .toBe(false);

    // Empty the fold on that same cheapest arrangement and the floor is reachable. The page
    // must then not offer the instalment, and must say which one it is withholding.
    const emptied = { label: "", premiums: MODES.map((mode) => ({ mode, total: 0 })) };
    const under = shownAt(iHealthyPricing(table, {
      base: pkg.variant, sex: "M", age: 18, sumAssured: pkg.fixedSum!,
      plan: "SMART", territory: THAI, coverage: "Deductible",
    }, emptied), "annual")!;
    expect(under.others.map((o) => o.mode)).toEqual(["semi"]);
    expect(under.refused).toEqual(["monthly"]);
  });

  /**
   * An instalment the company refuses is not an instalment to print.
   *
   * The flag only ever rode on the instalment the card headlines, and the card headlines the
   * yearly one — so a monthly figure under the floor went out unflagged on the card, in the
   * benefit table, on the picture and in the text an agent pastes to a customer. Every other
   * calculator in the building drops those instalments instead, and so does this one now.
   */
  it("does not offer an instalment the company will not take", () => {
    const priced = iHealthyPricing(table, {
      base: "WLF99H", sex: "F", age: 35, sumAssured: 150_000, plan: "GOLD", territory: THAI, coverage: FULL,
    })!;
    // the real floor is out of reach, so the rule is exercised against a raised one, the way
    // ihealthy-quote.test.ts exercises the arithmetic behind it
    const strict = { ...priced, total: priced.total.map((m) => ({ ...m, belowMinimum: m.mode === "monthly" })) };
    const shown = shownAt(strict, "annual")!;
    expect(shown.others.map((o) => o.mode)).toEqual(["semi"]);
    expect(shown.others.some((o) => o.mode === "monthly")).toBe(false);
  });
});

/**
 * The four arrangements the page is read back against by hand. Two are the workbook's own
 * examples; all four are here so a rate revision moves a test rather than a sales page.
 */
describe("what the card shows", () => {
  it("prices the arrangement the page opens on", () => {
    // the package, which is the cheapest vehicle the health cover can ride on
    expect(baht(IHEALTHY_OPENING))
      .toEqual({ base: "710", rider: "43,800", standard: "1,300", total: "45,810" });
  });

  it("prices the other vehicle, which costs more and covers more life", () => {
    /**
     * ไลฟ์ โพรเทค+ x 2 is the second button, and the sum travels with it: this base is not
     * written below a hundred and fifty thousand, so changing one without the other is an
     * arrangement the company would refuse — and the page walks it somewhere sellable rather
     * than pricing it, which is what made the old form of this test quietly meaningless.
     */
    expect(baht({ ...IHEALTHY_OPENING, base: "WLF99H", sumAssured: 150_000 }))
      .toEqual({ base: "2,130", rider: "43,800", standard: "1,300", total: "47,230" });
  });

  it("prices บรอนซ์ for a woman of 45", () => {
    expect(baht({ ...IHEALTHY_OPENING, age: 45, plan: "BRONZE" })?.rider).toBe("26,700");
  });

  it("prices the package for a boy of 8", () => {
    const pkg = table.bases.find((b) => b.fixedSum !== undefined)!;
    expect(baht({
      ...IHEALTHY_OPENING, sex: "M", age: 8, base: pkg.variant, sumAssured: pkg.fixedSum!, plan: "BRONZE",
      // a child is sold the 500 plan of the daily cash, not the 1,000 the agency asks for
    })).toEqual({ base: "380", rider: "38,600", standard: "475", total: "39,455" });
  });

  it("prices แพลทินั่ม anywhere in the world", () => {
    expect(baht({ ...IHEALTHY_OPENING, plan: "PLATINUM", territory: "ทั่วโลก" })?.rider).toBe("563,500");
  });
});
