import { describe, expect, it } from "vitest";
import { AD_LIMITS, parseAdCopy } from "@/lib/content/ads";

describe("parseAdCopy", () => {
  it("keeps a headline whole even past Facebook's 27 — a clipped figure is a false claim", () => {
    // cutting once turned "…คุ้มครองสูงสุด 2 ล้าน" into "…คุ้มครองสูงสุด 2"
    const ad = parseAdCopy(JSON.stringify({ primaryText: "ข้อความหลัก", headline: "ทุน 1 ล้าน คุ้มครองสูงสุด 2 ล้าน", description: "ทักแชทได้เลยครับ" }))!;
    expect(ad.headline).toBe("ทุน 1 ล้าน คุ้มครองสูงสุด 2 ล้าน");
    expect([...ad.headline].length).toBeGreaterThan(AD_LIMITS.headline);
  });

  it("refuses a reply with no primary text or no headline", () => {
    expect(parseAdCopy(JSON.stringify({ primaryText: "x" }))).toBeNull();
    expect(parseAdCopy(JSON.stringify({ headline: "x" }))).toBeNull();
  });
});
