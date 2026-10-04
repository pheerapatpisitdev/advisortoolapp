import { describe, expect, it } from "vitest";
import { formReady, overCap } from "@/app/studio/ads/form-ready";

/** The form's own refusal of a daily budget above the cap; the server checks it again. */

const ok = { hasPoster: true, nonBaht: false, link: "https://x.test/", budget: "100", pageId: "1", actId: "act_1", maxDailyBudgetThb: 500 };

describe("the ads form's readiness", () => {
  it("accepts 500 and refuses 501 under the default cap", () => {
    expect(formReady({ ...ok, budget: "500" })).toBe(true);
    expect(formReady({ ...ok, budget: "501" })).toBe(false);
    expect(overCap("501", 500)).toBe(true);
    expect(overCap("500", 500)).toBe(false);
  });

  it("respects a cap from the setup, up or down", () => {
    expect(formReady({ ...ok, budget: "1000", maxDailyBudgetThb: 1000 })).toBe(true);
    expect(formReady({ ...ok, budget: "1001", maxDailyBudgetThb: 1000 })).toBe(false);
    expect(formReady({ ...ok, budget: "200", maxDailyBudgetThb: 150 })).toBe(false);
    expect(overCap("200", 150)).toBe(true);
  });

  it("still refuses an empty, zero, fractional or non-numeric budget, and the other missing pieces", () => {
    for (const budget of ["", " ", "0", "1.5", "abc", "-5"]) expect(formReady({ ...ok, budget })).toBe(false);
    expect(overCap("", 500)).toBe(false);
    expect(overCap("abc", 500)).toBe(false);
    expect(formReady({ ...ok, link: "  " })).toBe(false);
    expect(formReady({ ...ok, hasPoster: false })).toBe(false);
    expect(formReady({ ...ok, nonBaht: true })).toBe(false);
    expect(formReady({ ...ok, pageId: "" })).toBe(false);
    expect(formReady({ ...ok, actId: "" })).toBe(false);
  });
});
