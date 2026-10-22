import { describe, expect, it } from "vitest";
import { firstGap, gapsOf, offerMonthly, offerPrice, type Gap } from "@/lib/fhc/gaps";
import type { PlanResult } from "@/lib/plan/recommend";

const plan = (areas: PlanResult["areas"], order: PlanResult["order"]): PlanResult => ({
  areas, budget: 4_000, usedAnnual: 0, taxSaved: 0, order, orderedBy: "fixed", summary: "",
});

const PLAN = plan([
  { key: "health", unit: "room", have: 0, should: 3_000, status: "fits",
    offer: { product: "iHealthy Ultra แผนซิลเวอร์", href: "/x", sum: 3_000, cover: 3_000, annual: 1_420_000, firstYear: true } },
  { key: "life", unit: "sum", have: 500_000, should: 3_200_000, status: "short",
    offer: { product: "Life Protect x 2", href: "/y", sum: 1_000_000, cover: 2_000_000, annual: 2_140_000, firstYear: false } },
  { key: "ci", unit: "sum", have: 1_000_000, should: 1_000_000, status: "covered" },
  { key: "retire", unit: "pension", have: 0, should: 25_000, status: "unavailable" },
], ["health", "life", "ci", "retire"]);

describe("gapsOf", () => {
  it("names a cover held at none as missing, some as short, and a met need as ok", () => {
    const g = gapsOf(PLAN);
    expect(g.map((x) => [x.key, x.state])).toEqual([
      ["life", "short"], ["health", "missing"], ["ci", "ok"], ["retire", "missing"],
    ]);
  });

  it("keeps the offer only where something is still open", () => {
    const g = gapsOf(PLAN);
    expect(g.find((x) => x.key === "health")).toMatchObject({ product: "iHealthy Ultra แผนซิลเวอร์", annual: 1_420_000 });
    expect(g.find((x) => x.key === "ci")?.product).toBeUndefined();
    expect(g.find((x) => x.key === "retire")?.product).toBeUndefined();
  });
});

describe("firstGap", () => {
  it("is the first area in the plan's order that is not covered", () => {
    expect(firstGap(PLAN, gapsOf(PLAN))).toBe("health");
  });

  it("skips a covered area at the front", () => {
    const p = plan(PLAN.areas, ["ci", "life", "health", "retire"]);
    expect(firstGap(p, gapsOf(p))).toBe("life");
  });

  it("is null when everything is covered", () => {
    const p = plan(PLAN.areas.map((a) => ({ ...a, status: "covered" as const })), PLAN.order);
    expect(firstGap(p, gapsOf(p))).toBeNull();
  });
});

describe("offerPrice", () => {
  const gap = (key: Gap["key"], annual?: number): Gap => ({ key, state: "missing", unit: "sum", have: 0, should: 1, annual });

  it("says ปีแรก for health and critical illness, whose premiums climb with age", () => {
    expect(offerPrice(gap("health", 2_134_000))).toBe("ปีแรก 21,340 บาท");
    expect(offerPrice(gap("ci", 685_000))).toBe("ปีแรก 6,850 บาท");
  });

  it("says ปีละ for life and retirement, which are level", () => {
    expect(offerPrice(gap("life", 1_480_000))).toBe("ปีละ 14,800 บาท");
    expect(offerPrice(gap("retire", 6_000_000))).toBe("ปีละ 60,000 บาท");
  });

  it("gives the monthly average beside it, and nothing without a price", () => {
    expect(offerMonthly(gap("health", 2_134_000))).toBe("เฉลี่ยเดือนละ 1,778");
    expect(offerPrice(gap("life"))).toBeNull();
    expect(offerMonthly(gap("life"))).toBeNull();
  });
});
