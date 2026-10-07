import { describe, expect, it } from "vitest";
import { placeFigures, type PlaceInput } from "@/lib/chart-figures";

/** A chart 888 wide whose line climbs left to right, from x=100 at the insured's age to x=874 at 99. */
const chart = (startAge: number, over: Partial<PlaceInput> = {}): PlaceInput => ({
  startAge, endAge: 99,
  x: (age) => 100 + ((age - startAge) * 774) / (99 - startAge),
  yAt: (px) => 700 - px * 0.2,
  left: 86, right: 874, top: 0, scale: 0.7,
  ...over,
});
const kinds = (input: PlaceInput) => placeFigures(input).map((f) => f.kind);

describe("who stands on the line", () => {
  it("gives a 41-year-old a working-age family, a middle-aged man and a grandfather", () => {
    expect(kinds(chart(41))).toEqual(["adult", "kid", "mom", "mid", "senior"]);
  });

  it("gives a newborn every stage in turn", () => {
    expect(kinds(chart(0))).toEqual(["kid", "teen", "adult", "kid", "mom", "mid", "senior"]);
  });

  it("leaves out a stage that is over before the line starts", () => {
    expect(kinds(chart(45))).toEqual(["mid", "senior"]);
    expect(kinds(chart(70))).toEqual(["senior"]);
  });

  it("keeps a stage the insured has at least a year of", () => {
    expect(kinds(chart(44))).toContain("mom");
  });

  it("leaves out a stage that is over, and draws nothing on an empty line", () => {
    expect(kinds(chart(13))[0]).toBe("teen");
    expect(kinds(chart(99))).toEqual([]);
  });
});

describe("where they stand", () => {
  it("puts every figure's feet on the line, at its own x", () => {
    for (const f of placeFigures(chart(30))) expect(f.y).toBeCloseTo(700 - f.x * 0.2, 6);
  });

  it("keeps the whole family inside the chart, even at the line's very start", () => {
    const input = chart(41);
    const family = placeFigures(input).filter((f) => ["adult", "kid", "mom"].includes(f.kind));
    expect(Math.min(...family.map((f) => f.x))).toBeGreaterThan(input.left + 20);
    expect(family[0].x).toBeLessThan(family[1].x);
    expect(family[1].x).toBeLessThan(family[2].x);
  });

  it("keeps the last figure inside the right edge", () => {
    const f = placeFigures(chart(60, { endAge: 62 })).at(-1)!;
    expect(f.x).toBeLessThan(874 - 20);
  });

  it("never sets a figure on the break-even marker", () => {
    for (let age = 0; age <= 80; age += 1) {
      for (const avoidX of [150, 300, 420, 600, 780]) {
        for (const f of placeFigures(chart(age, { avoidX }))) expect(Math.abs(f.x - avoidX)).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it("never lets two figures overlap, however narrow the chart", () => {
    for (let age = 0; age <= 80; age += 1) {
      for (const perYear of [3, 6, 14]) {
        const input = chart(age, { x: (a) => 100 + (a - age) * perYear, right: 100 + (99 - age) * perYear + 14 });
        const xs = placeFigures(input).map((f) => f.x).sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i += 1) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it("draws smaller on a narrower chart", () => {
    const wide = placeFigures(chart(41, { scale: 1.35 }))[0];
    const narrow = placeFigures(chart(41, { scale: 0.7 }))[0];
    expect(wide.scale).toBe(1.35);
    expect(narrow.scale).toBe(0.7);
  });

  it("shrinks a figure that would stand with its head above the top of the chart", () => {
    // a line that is 80 units from the top at the old end of the chart, where a full-size person is 100 tall
    const input = chart(60, { scale: 1.35, yAt: () => 80 });
    const [only] = placeFigures(input);
    expect(only.kind).toBe("senior");
    expect(only.scale).toBeLessThan(1.35);
    expect(only.y - 110 * only.scale).toBeGreaterThanOrEqual(0);
  });

  it("leaves a figure out when there is no room above the line at all", () => {
    expect(placeFigures(chart(60, { yAt: () => 20 }))).toEqual([]);
  });

  it("does not shrink a figure that has the room", () => {
    for (const f of placeFigures(chart(41, { scale: 1.35, yAt: () => 600 }))) expect(f.scale).toBe(1.35);
  });
});
