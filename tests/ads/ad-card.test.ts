import { describe, expect, it } from "vitest";
import { AD_FOLD, brokenStep, cardLaunch, cardText, writeCount } from "@/lib/ads/ad-card";
import { AD_LIMITS } from "@/lib/content/ads";

/**
 * What an ad card says: the primary text cut where Facebook folds it, the launch that decides
 * its tab, the step a stopped launch broke at, and how many ads one press writes.
 */

describe("cardText", () => {
  it("cuts where Facebook folds an ad", () => {
    expect(AD_FOLD).toBe(AD_LIMITS.fold);
  });

  it("keeps a short text whole, with nothing more to open", () => {
    expect(cardText("สั้นๆ")).toEqual({ shown: "สั้นๆ", more: false });
    expect(cardText("")).toEqual({ shown: "", more: false });
  });

  it("keeps exactly 125 code points and says there is more", () => {
    const text = "ก".repeat(130);
    const { shown, more } = cardText(text);
    expect([...shown]).toHaveLength(125);
    expect(more).toBe(true);
    expect(cardText("ก".repeat(125))).toEqual({ shown: "ก".repeat(125), more: false });
  });

  it("counts Thai vowels and tone marks as characters of their own, as the fold does", () => {
    // "ผู้" is three code points
    const { shown, more } = cardText("ผู้".repeat(50));
    expect([...shown]).toHaveLength(125);
    expect(more).toBe(true);
  });
});

describe("cardLaunch", () => {
  it("prefers the launch that was switched on, in any account", () => {
    const newest = { id: "new", activatedAt: null };
    const live = { id: "live", activatedAt: "2026-10-04T00:00:00Z" };
    expect(cardLaunch([newest, live])).toBe(live);
  });

  it("is the newest launch when none is switched on, and none for a draft", () => {
    const a = { id: "a", activatedAt: null };
    const b = { id: "b", activatedAt: null };
    expect(cardLaunch([a, b])).toBe(a);
    expect(cardLaunch([])).toBeNull();
  });
});

describe("brokenStep", () => {
  it("names the step after the last one made", () => {
    expect(brokenStep({ step: "none", error: "x" })).toBe("แคมเปญ");
    expect(brokenStep({ step: "campaign", error: "x" })).toBe("ชุดโฆษณา");
    expect(brokenStep({ step: "adset", error: "x" })).toBe("ครีเอทีฟ");
    expect(brokenStep({ step: "creative", error: "x" })).toBe("โฆษณา");
  });

  it("is nothing for a launch without an error, or one that made every step", () => {
    expect(brokenStep({ step: "adset", error: null })).toBeNull();
    expect(brokenStep({ step: "ad", error: "x" })).toBeNull();
  });
});

describe("writeCount", () => {
  it("is angles times tones", () => {
    expect(writeCount(3, 2)).toBe(6);
    expect(writeCount(1, 1)).toBe(1);
  });

  it("never asks for fewer than one of either", () => {
    expect(writeCount(0, 2)).toBe(2);
    expect(writeCount(Number.NaN, 2)).toBe(2);
  });
});
