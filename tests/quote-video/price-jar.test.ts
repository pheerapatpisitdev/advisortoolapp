import { describe, expect, it, vi } from "vitest";
import { jarFits } from "@/lib/quote-video/motion";
import { quoteVideoFacts } from "@/lib/quote-video/script";
import { quotePartsFor } from "@/lib/quote-video/make";

const lp = { product: "LIFEPROTECT" as const, variant: "WLF19H", age: 35, sex: "M" as const, sumAssured: 1_000_000, style: "motion" as const };
const contact = { name: "ก", phone: "081" };

describe("the piggy jar (owner, 2026-10-20)", () => {
  it("tells a quote with a standing daily price and its paying years", () => {
    expect(jarFits(quoteVideoFacts(lp)!)).toBe(true);
    const ih = quoteVideoFacts({ product: "IHEALTHY", age: 40, sex: "F", plan: "BRONZE", compare: ["SILVER"], style: "motion" } as never);
    expect(ih && jarFits(ih)).toBe(false);
  });

  it("takes the price in a portrait Motion clip at random, never in a wide one", () => {
    const secs = [10, 10, 10, 10, 10];
    const random = vi.spyOn(Math, "random").mockReturnValue(0.1);
    expect(quotePartsFor({ input: lp, customer_name: "" }, contact, secs).motion$?.shown.priceJar).toBe(true);
    expect(quotePartsFor({ input: { ...lp, size: "square" }, customer_name: "" }, contact, secs).motion$?.shown.priceJar).toBeUndefined();
    random.mockReturnValue(0.9);
    expect(quotePartsFor({ input: lp, customer_name: "" }, contact, secs).motion$?.shown.priceJar).toBeUndefined();
    random.mockRestore();
  });

  it("tells the cover as the road of life in one portrait clip in two, reading the cover at each age", async () => {
    const { coverAt, roadFits } = await import("@/lib/quote-video/motion");
    const f = quoteVideoFacts(lp)!;
    expect(roadFits(f)).toBe(true);
    expect(coverAt(f, 40)).toBe("2,000,000");
    expect(coverAt(f, 70)).toBe("1,000,000");
    const random = vi.spyOn(Math, "random").mockReturnValue(0.1);
    expect(quotePartsFor({ input: lp, customer_name: "" }, contact, [10, 10, 10, 10, 10]).motion$?.shown.coverRoad).toBe(true);
    random.mockRestore();
  });
});
