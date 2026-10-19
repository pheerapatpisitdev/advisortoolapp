import { describe, expect, it } from "vitest";
import {
  bankCompare, GS_MIN_PREMIUM, premiumFromSa, quoteGlobalSaving, saFromPremium, surrenderPct,
} from "@/calc/global-saving/engine";
import { INDEX_ALLOCATION, indexLevels } from "@/calc/global-saving/factsheet";

/**
 * The figures the owner's own calculator was checked against (its README): 50,000 a year at
 * 35. The port has to land on the same numbers, or the page would quote differently from the
 * tool the owner already trusts.
 */
describe("Global Savings Plus 15/8, against the owner's calculator", () => {
  const q = quoteGlobalSaving({ basis: "premium", amount: 50_000, age: 35 });

  it("buys the same sum and the same guaranteed total", () => {
    expect(q.sa).toBe(50_051);
    expect(Math.round(q.guaranteed)).toBe(407_916);
  });

  it("returns 0.17% at −1% and 5.83% at +5%", () => {
    expect(q.scenarios[0].irr.toFixed(2)).toBe("0.17");
    expect(q.scenarios[4].irr.toFixed(2)).toBe("5.83");
  });

  it("puts the bank columns at the same totals", () => {
    expect(q.banks.map((b) => Math.round(b.total))).toEqual([411_659, 474_977]);
  });

  it("pays no bonus when the index falls, and the guarantee is the same in every scenario", () => {
    expect(q.scenarios[0].bonuses.every((b) => b.value === 0)).toBe(true);
    for (const s of q.scenarios) expect(s.paybackTotal + s.maturity).toBeCloseTo(q.guaranteed, 6);
    // the bonus only grows with the index
    const totals = q.scenarios.map((s) => s.total);
    expect([...totals].sort((a, b) => a - b)).toEqual(totals);
  });

  it("pays the index bonus only at the end of year 10 and at maturity", () => {
    expect(q.scenarios[2].bonuses.map((b) => b.year)).toEqual([10, 15]);
  });
});

describe("premium and sum", () => {
  it("go round trip through the rate bands", () => {
    for (const age of [0, 35, 66, 75]) {
      for (const sa of [60_000, 300_000, 1_000_000]) {
        expect(saFromPremium(premiumFromSa(sa, age), age)).toBeCloseTo(sa, 6);
      }
    }
  });

  it("warns below the minimum premium and below the sum floor from 71", () => {
    expect(quoteGlobalSaving({ basis: "premium", amount: GS_MIN_PREMIUM - 1, age: 35 }).warnings).toHaveLength(1);
    expect(quoteGlobalSaving({ basis: "premium", amount: GS_MIN_PREMIUM, age: 35 }).warnings).toHaveLength(0);
    expect(quoteGlobalSaving({ basis: "sumAssured", amount: 150_000, age: 72 }).warnings.join()).toContain("200,000");
  });
});

describe("the surrender table", () => {
  it("reads table ages exactly and steps between them", () => {
    expect(surrenderPct(15, 35)).toBeCloseTo(8.01, 6);
    expect(surrenderPct(8, 35)).toBeCloseTo(6.584, 6);
    expect(surrenderPct(8, 37)).toBeGreaterThan(surrenderPct(8, 35));
    expect(surrenderPct(8, 37)).toBeLessThan(surrenderPct(8, 40));
  });

  it("matches the bank formula the page compares with", () => {
    const b = bankCompare(10_000, 0);
    expect(b.total).toBe(80_000);
    expect(b.interest).toBe(0);
  });
});

describe("the index fact sheet", () => {
  it("adds up to the whole portfolio", () => {
    const sum = INDEX_ALLOCATION.flatMap((g) => g.items).reduce((s, i) => s + i.pct, 0);
    expect(sum).toBeCloseTo(100, 1);
  });

  it("starts at 100 points and runs a year a point", () => {
    const l = indexLevels();
    expect(l[0]).toEqual({ year: 2545, level: 100 });
    expect(l.at(-1)!.year).toBe(2568);
  });
});
