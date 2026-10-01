import { describe, expect, it } from "vitest";
import { ci123Table } from "@/lib/ci123-table";
import { stagePays } from "@/lib/ci123-cta";
import { getBundle } from "@/calc/bundles/registry";
import { bundleModePremiums, quoteBundle } from "@/calc/bundles/quote";
import { quoteCard } from "@/lib/quote-card";

/** The rate table behind the page lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-23");

describe("ci123Table", () => {
  it("prices every age from birth to 75, both sexes, all seven sums", () => {
    const t = ci123Table(WHILE_CURRENT);
    expect(t).toMatchObject({ ageMin: 0, ageMax: 75, baseSum: 150_000, expired: false, diseaseCount: 122 });
    expect(t.sums).toEqual([500_000, 1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000, 10_000_000]);
    for (const sex of ["M", "F"] as const) {
      expect(t.premiums[sex]).toHaveLength(7);
      t.premiums[sex].forEach((tier, i) => {
        expect(tier).toHaveLength(76);
        /**
         * Every row but the one the engine refuses: a woman of 19 at the smallest sum, whose
         * CI 123 premium falls under the rider's own minimum. That row used to be priced at
         * nought in all three modes and drawn as "0.00" (review 2026-10-01); it is a gap now,
         * which the page draws as "—".
         */
        const gaps = tier.flatMap((row, at) => (row === null ? [at + t.ageMin] : []));
        expect(gaps, `${sex} tier ${i + 1}`).toEqual(sex === "F" && i === 0 ? [19] : []);
      });
      expect(t.basePremiums[sex].every((b) => b !== null)).toBe(true);
    }
  });

  it("carries the same figures the engine quotes", () => {
    const t = ci123Table(WHILE_CURRENT);
    const bundle = getBundle("CI123_SET")!;
    for (const [tier, age, sex] of [[2, 30, "F"], [1, 0, "M"], [7, 75, "F"], [4, 45, "M"]] as const) {
      const modes = bundleModePremiums(bundle, tier, { age, sex }, WHILE_CURRENT)!;
      const row = t.premiums[sex][tier - 1][age - t.ageMin]!;
      expect(row.slice(0, 3)).toEqual(modes.map((m) => m.total));
      expect(row[3]).toBe(modes.find((m) => m.mode === "monthly")!.belowMinimum ? 1 : 0);
    }
  });

  /**
   * The owner's older page folded ไลฟ์เรดดี้ 99 at 150,000 into every figure. Its CI 123 part
   * is recoverable — ชาย 30 ทุน 5 แสน was 3,671 of which the base was 2,325 — and has to be
   * what this set charges for the rider, since only the base contract changed.
   */
  it("charges the same for the rider as the older page did, on a different base", () => {
    const t = ci123Table(WHILE_CURRENT);
    const at = 30 - t.ageMin;
    const rider = t.premiums.M[0][at]![0] - t.basePremiums.M[at]!;
    expect(rider).toBe(3_671_00 - 2_325_00);
  });

  it("opens on a woman of 30 with a million: 5,309.50 a year, and no monthly under the floor", () => {
    const t = ci123Table(WHILE_CURRENT);
    const row = t.premiums.F[1][30 - t.ageMin]!;
    expect(row[0]).toBe(5_309_50);
    expect(row[3]).toBe(1);
  });

  it("pays each stage the share the rate table prices it on, held under its cap", () => {
    const t = ci123Table(WHILE_CURRENT);
    const by = Object.fromEntries(t.stages.map((s) => [s.key, s]));
    expect(t.stages.map((s) => [s.key, s.count])).toEqual([
      ["pre-early ci", 6], ["early to intermediate ci", 42], ["juvenile ci", 17],
      ["special conditions", 4], ["critical care benefit", 2], ["major ci", 53],
    ]);
    expect(stagePays(by["pre-early ci"], 1_000_000)).toBe(100_000);
    expect(stagePays(by["pre-early ci"], 400_000)).toBe(80_000);
    expect(stagePays(by["early to intermediate ci"], 1_000_000)).toBe(250_000);
    expect(stagePays(by["special conditions"], 2_000_000)).toBe(200_000);
    expect(stagePays(by["major ci"], 5_000_000)).toBe(5_000_000);
  });
});

describe("the CI 123 card", () => {
  it("itemises the two contracts once and draws the six stages", () => {
    const card = quoteCard({ kind: "bundle", bundleCode: "CI123_SET", tier: 2, age: 30, sex: "F", mode: "annual" }, WHILE_CURRENT)!;
    expect(card.planLine).toBe("ชุดประกันโรคร้ายแรง CI 123");
    const made = card.sections.find((s) => s.title === "ชุดนี้ประกอบด้วย")!;
    expect(made.rows.map((r) => r.amount)).toEqual(["150,000", "1,000,000"]);
    const stages = card.sections.find((s) => s.title.startsWith("ตรวจพบโรคร้ายแรง"))!;
    expect(stages.rows.map((r) => r.amount)).toEqual(["100,000", "250,000", "250,000", "100,000", "250,000", "1,000,000"]);
    // the base is there to carry the rider: no surrender table on this card
    expect(card.sections.some((s) => s.title.includes("มูลค่าเงินสด"))).toBe(false);
  });

  it("is the same price the bundle quotes", () => {
    const q = quoteBundle(getBundle("CI123_SET")!, 2, { age: 30, sex: "F", mode: "annual" }, WHILE_CURRENT)!;
    expect(q.totalAnnual).toBe(5_309_50);
  });
});
