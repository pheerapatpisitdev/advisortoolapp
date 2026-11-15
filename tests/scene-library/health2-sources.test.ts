import { describe, expect, it } from "vitest";
import { HEALTH2_FIXED } from "@/lib/scene-library/health2-fixed";
import { groupPremium, health2Sources, hospitalCounts, opdOf, roomOf } from "@/lib/scene-library/health2-sources";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { PA_WEEKLY_MAX_WEEKS } from "@/lib/pa-plans";
import { HEALTH_PARENTS_CAP } from "@/lib/scene-library/tax-th";

describe("round-5 sources: the real files", () => {
  it("reads the iHealthy sheet: room per day, OPD as a number, none or actual", () => {
    const rooms = Object.fromEntries(iHealthyFacts().plans.map((p) => [p.code, roomOf(p.code)]));
    expect(rooms).toEqual({ SMART: 1_500, BRONZE: 3_000, SILVER: 5_500, GOLD: 9_000, DIAMOND: 15_000, PLATINUM: 21_000 });
    const opd = Object.fromEntries(iHealthyFacts().plans.map((p) => [p.code, opdOf(p.code)]));
    expect(opd).toEqual({ SMART: "none", BRONZE: "none", SILVER: 6_000, GOLD: 12_000, DIAMOND: 60_000, PLATINUM: "actual" });
  });
  it("reads the plans' deductibles, the co-payment and the renewal age from the sheet", () => {
    const f = health2Sources();
    expect(f.deductible).toEqual([30_000, 50_000, 100_000]);
    expect(f.copayPercent).toBe(20);
    expect(f.renewalToAge).toBe(98);
    expect(f.parentsCap).toBe(HEALTH_PARENTS_CAP);
    expect(f.parentsCap).toBe(15_000);
    expect(f.pa.weeks).toBe(PA_WEEKLY_MAX_WEEKS);
    expect(f.pa.weeks).toBe(52);
  });
  it("reads the group premiums and the PA values", () => {
    expect(groupPremium("biz1", "10-25", 0)).toBe(2_552);
    expect(health2Sources().groupPerYear).toHaveLength(54);
    expect(health2Sources().pa.medical).toEqual([80_000, 100_000, 120_000, 150_000, 200_000, 300_000]);
    expect(health2Sources().pa.weekly).toEqual([1_000, 2_000, 3_000, 5_000, 10_000]);
  });
  it("counts the hospital list: 537 in all, the five biggest provinces as the spec's stills use them, the fetched date", () => {
    const h = hospitalCounts();
    expect(h.total).toBe(537);
    expect(h.ranked.slice(0, 5).map((r) => [r.province, r.count])).toEqual([
      ["กรุงเทพมหานคร", 135], ["ชลบุรี", 49], ["ระยอง", 38], ["สมุทรปราการ", 25], ["นนทบุรี", 22],
    ]);
    expect(h.ranked.reduce((s, r) => s + r.count, 0)).toBe(h.total);
    expect(h.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("the cross-field sources (final review 1 to 3)", () => {
  it("lists the six plans' own room and OPD pairs, as the sheet has them", () => {
    expect(health2Sources().ipdopd.plans).toEqual([
      { code: "SMART", label: "Smart", room: 1_500, opd: "none" },
      { code: "BRONZE", label: "Bronze", room: 3_000, opd: "none" },
      { code: "SILVER", label: "Silver", room: 5_500, opd: 6_000 },
      { code: "GOLD", label: "Gold", room: 9_000, opd: 12_000 },
      { code: "DIAMOND", label: "Diamond", room: 15_000, opd: 60_000 },
      { code: "PLATINUM", label: "Platinum", room: 21_000, opd: "actual" },
    ]);
  });
  it("lists each head-count band's own premiums: 18 a column, every one in the all-bands list, and 2,552 only in 10-25", () => {
    const b = health2Sources().groupByBand;
    for (const band of ["10-25", "26-50", "51-100"] as const) {
      expect(b[band], band).toHaveLength(18);
      for (const x of b[band]) expect(health2Sources().groupPerYear, `${band} ${x}`).toContain(x);
    }
    expect(b["10-25"]).toContain(2_552);
    expect(b["26-50"]).not.toContain(2_552);
    expect(b["51-100"]).not.toContain(2_552);
  });
  it("lists the PA plans' medical and weekly sums in pairs: the five Platinum plans, never Classic or Max", () => {
    expect(health2Sources().pa.pairs).toEqual([[100_000, 1_000], [120_000, 2_000], [150_000, 3_000], [200_000, 5_000], [300_000, 10_000]]);
  });
});

describe("the browser snapshot (health2-fixed.ts) equals the real files", () => {
  // checkDevice runs in the browser and must not carry the files; this is what keeps the snapshot honest
  it("matches field for field", () => {
    expect(HEALTH2_FIXED).toEqual(health2Sources());
  });
});
