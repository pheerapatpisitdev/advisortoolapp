import { describe, expect, it } from "vitest";
import { AD_LIMITS, parseLongAd } from "@/lib/content/ads";

describe("parseLongAd", () => {
  it("keeps a headline whole even past Facebook's 27 — a clipped figure is a false claim", () => {
    // cutting once turned "…คุ้มครองสูงสุด 2 ล้าน" into "…คุ้มครองสูงสุด 2"
    const ad = parseLongAd(JSON.stringify({ opening: "ข้อความหลัก", headline: "ทุน 1 ล้าน คุ้มครองสูงสุด 2 ล้าน", description: "ทักแชทได้เลย" }))!;
    expect(ad.headline).toBe("ทุน 1 ล้าน คุ้มครองสูงสุด 2 ล้าน");
    expect([...ad.headline].length).toBeGreaterThan(AD_LIMITS.headline);
  });
});
