import { describe, expect, it } from "vitest";
import { cleanPrices, DEFAULT_PRICES, PRICE_ITEMS, pictureSatang, priceBaht } from "@/lib/wallet/prices";

/** The owner's fixed prices (owner, 2026-10-12). */

describe("the owner's price list", () => {
  it("starts at the prices the owner chose", () => {
    expect(DEFAULT_PRICES).toEqual({
      drawStandard: 100, drawSharp: 200, drawGemini: 500, describe: 100,
      videoClassic: 500, videoMotion: 1000, videoFhc: 300, elevenExtra: 200,
      // the longer clips (owner, 2026-10-13)
      videoLongClassic: 800, videoLongMotion: 1500, videoMaxClassic: 1000, videoMaxMotion: 2000,
      // คลิปเล่าเรื่อง (owner, 2026-10-15): the classic clip's price until the owner sets its own
      videoStory: 500,
      // หลังการขาย's short clips (owner, 2026-10-15): ฿3
      videoStoryShort: 300,
      // คลิปตามโจทย์ (owner, 2026-10-16): ฿5, its own row
      videoPrompt: 500,
      // คลิปตามโจทย์ ดีไซน์พิเศษ (owner, 2026-10-21): ฿15
      videoPromptDesign: 1500,
      // ภาพขยับ ต่อฉาก (owner, 2026-10-17): ฿15
      motionScene: 1500,
    });
  });

  it("is above what each costs the providers, as the owner set it", () => {
    for (const i of PRICE_ITEMS) expect(DEFAULT_PRICES[i.key]).toBeGreaterThan(i.costThb * 100);
  });

  it("keeps what was stored and fills anything missing or broken with the default", () => {
    expect(cleanPrices({ drawStandard: 150, drawSharp: -1, videoFhc: 2.5, describe: "100" })).toEqual({ ...DEFAULT_PRICES, drawStandard: 150 });
    expect(cleanPrices(null)).toEqual(DEFAULT_PRICES);
    expect(cleanPrices({})).toEqual(DEFAULT_PRICES);
  });

  it("prices a picture by its painter, and nothing for none", () => {
    expect(pictureSatang(DEFAULT_PRICES, "standard")).toBe(100);
    expect(pictureSatang(DEFAULT_PRICES, "sharp")).toBe(200);
    expect(pictureSatang(DEFAULT_PRICES, "gemini")).toBe(500);
    expect(pictureSatang(DEFAULT_PRICES, "none")).toBeNull();
  });

  it("writes baht without satang when there are none", () => {
    expect(priceBaht(500)).toBe("5");
    expect(priceBaht(150)).toBe("1.50");
    expect(priceBaht(100_000)).toBe("1,000");
  });
});
