import { describe, expect, it } from "vitest";
import { shortBaht } from "@/lib/short-baht";

/** The chart's sum line names the sum, not a rounding of it (review, 2026-10-11). */
describe("a sum short enough for a chart", () => {
  for (const [baht, said] of [
    [150_000, "1.5 แสน"], [500_000, "5 แสน"], [650_000, "6.5 แสน"], [950_000, "9.5 แสน"],
    [1_000_000, "1 ล้าน"], [1_250_000, "1.25 ล้าน"], [2_000_000, "2 ล้าน"], [50_000, "50,000"],
  ] as const) {
    it(`${baht} reads ${said}`, () => expect(shortBaht(baht)).toBe(said));
  }
});
