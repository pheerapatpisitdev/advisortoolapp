import { describe, expect, it } from "vitest";
import { MODE_PLANS, modeName } from "@/lib/content/modes";

describe("a piece's mode, from its plan_href", () => {
  it("names the modes that belong to no plan", () => {
    expect(modeName("claim-review")).toBe("รีวิวเคลม");
    expect(modeName("recruit")).toBe("หาทีม");
  });

  it("says nothing of a plan's own href", () => {
    expect(modeName("/lifeprotect")).toBeNull();
  });

  it("lists each mode once, for the list's filter", () => {
    const hrefs = MODE_PLANS.map((m) => m.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
