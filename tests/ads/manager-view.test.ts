import { describe, expect, it } from "vitest";
import { campaignState, foldAt, onBudget, parseDays, parseTab, totals } from "@/lib/ads/manager-view";

const on = { activatedAt: "2026-10-04T01:00:00Z", pausedAt: null };
const off = { activatedAt: "2026-10-04T01:00:00Z", pausedAt: "2026-10-04T02:00:00Z" };
const never = { activatedAt: null, pausedAt: null };

describe("campaignState", () => {
  it("is on when any send is switched on", () => expect(campaignState([off, on])).toBe("on"));
  it("is paused when sends exist but none is on", () => {
    expect(campaignState([off, never])).toBe("paused");
  });
  it("is draft with no sends", () => {
    expect(campaignState([])).toBe("draft");
  });
  it("counts a switch-on after a pause as on", () => {
    expect(campaignState([{ activatedAt: "2026-10-04T03:00:00Z", pausedAt: "2026-10-04T02:00:00Z" }])).toBe("on");
  });
});

describe("onBudget", () => {
  it("sums the on sends' daily budget in baht, across accounts", () => {
    expect(onBudget([{ ...on, dailyBudgetMinor: 15000 }, { ...on, dailyBudgetMinor: 5050 }, { ...off, dailyBudgetMinor: 99900 }])).toBe(200.5);
  });
  it("is null when none is on", () => {
    expect(onBudget([{ ...off, dailyBudgetMinor: 15000 }])).toBeNull();
    expect(onBudget([])).toBeNull();
  });
});

describe("totals", () => {
  it("adds the rows, and is zero for none", () => {
    expect(totals([{ spend: 1.5, impressions: 10, clicks: 2, messaging: 1 }, { spend: 2, impressions: 5, clicks: 1, messaging: 0 }])).toEqual({ spend: 3.5, impressions: 15, clicks: 3, messaging: 1 });
    expect(totals([])).toEqual({ spend: 0, impressions: 0, clicks: 0, messaging: 0 });
  });
});

describe("parseDays / parseTab", () => {
  it("takes 30, otherwise 7", () => {
    expect(parseDays("30")).toBe(30);
    expect(parseDays(30)).toBe(30);
    for (const v of ["7", "14", undefined, null, "x", ["30"]]) expect(parseDays(v)).toBe(7);
  });
  it("takes the three tabs; ads needs a campaign", () => {
    expect(parseTab("campaigns", false)).toBe("campaigns");
    expect(parseTab("page", false)).toBe("page");
    expect(parseTab("ads", true)).toBe("ads");
    expect(parseTab("ads", false)).toBe("campaigns");
    expect(parseTab("nope", true)).toBe("campaigns");
    expect(parseTab(undefined, true)).toBe("campaigns");
  });
});

describe("foldAt", () => {
  it("is the length when the text fits", () => expect(foldAt("สั้นๆ", 125)).toBe(5));
  it("breaks at the last space within n", () => expect(foldAt("aaa bbb ccc", 9)).toBe(7));
  it("breaks at a line boundary", () => expect(foldAt("aaaaaaa\nbbbbbbbb", 9)).toBe(7));
  it("cuts at n when there is no whitespace", () => expect(foldAt("x".repeat(300), 125)).toBe(125));
  it("never splits a Thai cluster with no spaces to cut at", () => {
    const text = "กรุงเทพมหานครอมรรัตนโกสินทร์มหินทรายุธยามหาดิลกภพนพรัตน์ราชธานีบูรีรมย์".repeat(4);
    for (const n of [10, 17, 40, 77, 125]) {
      const cut = Array.from(text).slice(n, n + 1).join("");
      const at = foldAt(text, n);
      expect(at).toBeLessThanOrEqual(n);
      expect(at).toBeGreaterThan(0);
      expect(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(Array.from(text)[at] ?? "")).toBe(false);
      void cut;
    }
  });
  it("keeps an emoji ZWJ sequence whole", () => {
    const fam = "👨‍👩‍👧"; // 5 code points
    const text = "a".repeat(8) + fam + "b".repeat(40);
    expect(foldAt(text, 10)).toBe(8);
  });
  it("ignores a space too early to be a good cut", () => {
    const text = "ab " + "x".repeat(60);
    expect(foldAt(text, 40)).toBe(40);
  });
  it("is 0 for n <= 0", () => expect(foldAt("abc", 0)).toBe(0));
  it("counts code points, not UTF-16 units", () => {
    expect(foldAt("😀😀😀 😀😀😀", 5)).toBe(3);
    expect(foldAt("😀".repeat(200), 125)).toBe(125);
  });
});
