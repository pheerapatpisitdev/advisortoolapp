import { describe, expect, it } from "vitest";
import { costPer, sumResults } from "@/lib/ads/results";

const row = (ad_id: string, o: Partial<{ spend: number | string; impressions: number; link_clicks: number; clicks: number; messaging_started: number }> = {}) => ({
  ad_id, spend: 10, impressions: 100, link_clicks: 5, clicks: 9, messaging_started: 1, ...o,
});

describe("sumResults", () => {
  it("adds each key's ads over days, taking link clicks as clicks and spend as a number", () => {
    const m = sumResults(
      [row("a1", { spend: "12.5" }), row("a1", { spend: 7.5, impressions: 50 }), row("a2")],
      new Map([["c1", ["a1", "a2"]]]),
    );
    expect(m.get("c1")).toEqual({ spend: 30, impressions: 250, clicks: 15, messaging: 3 });
  });
  it("sums a key whose ads sit on two sends and two ad accounts", () => {
    const m = sumResults([row("a1"), row("b1")], new Map([["c1", ["a1", "b1"]], ["p1", ["a1"]]]));
    expect(m.get("c1")?.spend).toBe(20);
    expect(m.get("p1")?.spend).toBe(10);
  });
  it("leaves a key out when none of its ads has a row", () => {
    const m = sumResults([row("a1")], new Map([["c1", ["a1"]], ["c2", ["zz"]], ["c3", []]]));
    expect(m.has("c2")).toBe(false);
    expect(m.has("c3")).toBe(false);
    expect(m.has("c1")).toBe(true);
  });
});

describe("costPer", () => {
  it("divides, and is null for none", () => {
    expect(costPer(100, 4)).toBe(25);
    expect(costPer(100, 0)).toBeNull();
  });
});
