import { describe, expect, it } from "vitest";
import { quote } from "@/calc/quote";
import { getPlan } from "@/calc/plans/registry";
import { riderAvailability } from "@/calc/rules";
import { OCCUPATION_NOTE } from "@/calc/riders/rate-per-thousand";
import type { QuoteInput } from "@/calc/types";

/**
 * Review 2026-10-01: AP and ECARE are priced at occupation class 1 and nothing said so. AP at
 * 1,000,000 came to 3,000 a year for every occupation, where class 4 is 6,000. The owner's
 * call was no new input — only that the class is never silent.
 */

const TODAY = new Date("2026-09-04");
const plb: QuoteInput = {
  planCode: "PLB", variant: "PLB12", age: 35, sex: "M", mode: "annual", sumAssured: 1_000_000, riders: [],
};

describe("AP and ECARE say which occupation class they are priced at", () => {
  it("is said once, by name, as a note and not an error", () => {
    const r = quote({ ...plb, riders: [{ code: "AP", sumAssured: 1_000_000 }, { code: "ECARE", sumAssured: 500_000 }] }, TODAY);
    const notes = r.warnings.filter((w) => w.code === "OCCUPATION_CLASS");
    expect(notes).toHaveLength(1);
    expect(notes[0].level).toBe("warn");
    expect(notes[0].message).toContain("AP / ECARE");
    expect(notes[0].message).toContain("คิดที่อาชีพชั้น 1");
    // the price itself is class 1's: 3.00 per thousand
    expect(r.items.find((i) => i.code === "AP")!.annual).toBe(300_000);
  });

  it("is said on the flat-rate plans too", () => {
    const r = quote({
      planCode: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", mode: "annual", sumAssured: 1_000_000,
      riders: [{ code: "AP", sumAssured: 500_000 }],
    }, TODAY);
    expect(r.warnings.map((w) => w.code)).toContain("OCCUPATION_CLASS");
  });

  it("is not said when neither rider is priced", () => {
    expect(quote(plb, TODAY).warnings).toEqual([]);
    // AP refused for the combined cap is not a priced AP
    const refused = quote({ ...plb, sumAssured: 300_000, riders: [{ code: "AP", sumAssured: 1_000_000 }, { code: "ECARE", sumAssured: 600_000 }] }, TODAY);
    expect(refused.warnings.map((w) => w.code)).not.toContain("OCCUPATION_CLASS");
  });

  it("is on the rider row as well, where the agent ticks the rider", () => {
    const { rules, rates } = getPlan("PLB")!;
    const ctx = { age: 35, baseSumAssured: 1_000_000 };
    expect(riderAvailability(rules, rates, "AP", ctx).note).toBe(OCCUPATION_NOTE);
    expect(riderAvailability(rules, rates, "ECARE", ctx).note).toBe(OCCUPATION_NOTE);
    expect(riderAvailability(rules, rates, "MEB", ctx).note).toBeUndefined();
  });
});
