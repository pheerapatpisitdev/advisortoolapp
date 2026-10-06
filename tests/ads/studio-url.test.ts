import { describe, expect, it } from "vitest";
import { parseStudioTab, studioUrl } from "@/lib/ads/studio-url";

/** Every choice on /studio/ads is in its address, so a reload or a link lands where it was (spec 2026-10-07). */

describe("studioUrl", () => {
  it("names the Page, the tab and the range", () => {
    expect(studioUrl({ page: "105", tab: "results", days: 30 })).toBe("/studio/ads?page=105&tab=results&days=30");
  });
  it("opens the settings when asked", () => {
    expect(studioUrl({ page: "105", tab: "post", days: 7, settings: true })).toBe("/studio/ads?page=105&tab=post&days=7&settings=1");
  });
  it("leaves out a Page that is not known", () => {
    expect(studioUrl({ page: null, tab: "post", days: 7 })).toBe("/studio/ads?tab=post&days=7");
  });
});

describe("parseStudioTab", () => {
  it("is results only when asked, and ยิงแอด otherwise", () => {
    expect(parseStudioTab("results")).toBe("results");
    expect(parseStudioTab("x")).toBe("post");
    expect(parseStudioTab(undefined)).toBe("post");
  });
});
