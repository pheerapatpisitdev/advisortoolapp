import { describe, expect, it } from "vitest";
import { modePremiumsFrom, quoteModePremiums } from "@/calc/mode-premiums";
import { quote } from "@/calc/quote";
import type { PayMode, QuoteInput } from "@/calc/types";

const TODAY = new Date("2026-09-04");
const plb: QuoteInput = {
  planCode: "PLB", variant: "PLB12", age: 35, sex: "M", mode: "annual", sumAssured: 1_000_000, riders: [],
};

describe("quoteModePremiums", () => {
  it("prices a hand-built quote in all three modes", () => {
    expect(quoteModePremiums(plb, TODAY)).toEqual([
      { mode: "annual", total: 547_000, belowMinimum: false },
      { mode: "semi", total: 284_440, belowMinimum: false },
      { mode: "monthly", total: 49_230, belowMinimum: true },
    ]);
  });

  it("quotes each mode in full instead of scaling the annual premium", () => {
    // the workbook rounds every instalment down on its own, so twelve monthly ones overshoot the year
    const [annual, , monthly] = quoteModePremiums(plb, TODAY)!;
    expect(monthly.total * 12).not.toBe(annual.total);
    for (const mode of ["annual", "semi", "monthly"] as PayMode[]) {
      expect(quoteModePremiums(plb, TODAY)!.find((m) => m.mode === mode)!.total)
        .toBe(quote({ ...plb, mode }, TODAY).totalModal);
    }
  });

  it("ignores the mode the caller happened to put in the input", () => {
    expect(quoteModePremiums({ ...plb, mode: "monthly" }, TODAY)).toEqual(quoteModePremiums(plb, TODAY));
  });
});

/**
 * Review 2026-10-01: on a premium-basis quote every mode used to derive its own sum assured
 * from the same target, so the panel printed the target three times over.
 */
describe("quoteModePremiums on a premium-basis quote", () => {
  const ishield: QuoteInput = {
    planCode: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", mode: "monthly",
    sumAssured: 0, basis: "premium", targetPremium: 20_000, riders: [],
  };

  it("prices one contract — the sum the chosen mode's target buys — in every mode", () => {
    const sumAssured = quote(ishield, TODAY).sumAssured;
    expect(sumAssured).toBe(3_317_740);
    expect(quoteModePremiums(ishield, TODAY)).toEqual([
      { mode: "annual", total: 22_222_222, belowMinimum: false },
      { mode: "semi", total: 11_555_555, belowMinimum: false },
      { mode: "monthly", total: 2_000_000, belowMinimum: false },
    ]);
    for (const mode of ["annual", "semi", "monthly"] as PayMode[]) {
      expect(quoteModePremiums(ishield, TODAY)!.find((m) => m.mode === mode)!.total).toBe(
        quote({ ...ishield, basis: "sumAssured", sumAssured, targetPremium: undefined, mode }, TODAY).totalModal,
      );
    }
  });

  it("does not print nought for the modes a small monthly target could not buy on its own", () => {
    // 3,000 a year is under iShield's smallest contract; 3,000 a month is not
    const rows = quoteModePremiums({ ...ishield, targetPremium: 3_000 }, TODAY)!;
    expect(rows.map((r) => r.total)).toEqual([3_333_333, 1_733_333, 300_000]);
  });

  it("withholds the row when the target buys no contract at all", () => {
    expect(quoteModePremiums({ ...ishield, targetPremium: 100 }, TODAY)).toBeUndefined();
  });
});

describe("modePremiumsFrom", () => {
  it("treats a total of nought as not priced, rather than as a free instalment", () => {
    const r = quote(plb, TODAY);
    expect(modePremiumsFrom((mode) => (mode === "annual" ? { ...r, totalModal: 0 } : r))).toBeUndefined();
  });
});

/** A refused base plan is not priced by its riders (review 2026-10-11, /other-plans). */
describe("a base plan the engine refuses", () => {
  const today = new Date("2026-10-11T05:00:00Z");
  it("has no price when PLB is refused at 60, riders or not", () => {
    const at60: QuoteInput = {
      planCode: "PLB", variant: "PLB10", age: 60, sex: "M", mode: "annual", sumAssured: 1_000_000,
      riders: [{ code: "AP", sumAssured: 500_000 }, { code: "MEB", plan: 1000 }],
    };
    expect(quote(at60, today).totalAnnual).toBeGreaterThan(0);
    expect(quoteModePremiums(at60, today)).toBeUndefined();
  });

  it("has no price under the plan's smallest sum", () => {
    expect(quoteModePremiums({ ...plb, variant: "PLB10", age: 30, sumAssured: 100_000 }, today)).toBeUndefined();
  });

  it("still prices a monthly instalment under the floor, marked", () => {
    expect(quoteModePremiums(plb, TODAY)!.find((m) => m.mode === "monthly")!.belowMinimum).toBe(true);
  });
});

