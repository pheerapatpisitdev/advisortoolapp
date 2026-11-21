import { describe, expect, it } from "vitest";
import { AD_PRODUCTS, BODY_NAMES, CTA_NAMES, DEFAULT_ART, bodyName, photoScenes, readArt } from "@/lib/ad-video/keys";

describe("ad video keys", () => {
  it("puts photos on lead and contact only when mixed", () => {
    expect(photoScenes("mixed", 2)).toEqual([true, false, false, true]);
  });
  it("puts a photo on every scene when photo", () => {
    expect(photoScenes("photo", 1)).toEqual([true, true, true]);
  });
  it("puts no photo anywhere when motion", () => {
    expect(photoScenes("motion", 3)).toEqual([false, false, false, false, false]);
  });
  it("reads an unknown art as mixed", () => {
    expect(DEFAULT_ART).toBe("mixed");
    expect(readArt("x")).toBe("mixed");
    expect(readArt(undefined)).toBe("mixed");
    expect(readArt("photo")).toBe("photo");
  });
  it("names the bodies, iShield cover as 70 โรค", () => {
    expect(bodyName("cover", "ISHIELD")).toBe("70 โรค");
    expect(bodyName("cover", "LIFEPROTECT")).toBe(BODY_NAMES.cover);
    expect(BODY_NAMES.versus).toBe("เทียบเก็บเงินเอง");
  });
  it("lists products and call-to-action names", () => {
    expect(AD_PRODUCTS).toEqual(["LIFEPROTECT", "ISHIELD", "IHEALTHY"]);
    expect(CTA_NAMES.meet).toBe("นัดคุย 15 นาที");
  });
});
