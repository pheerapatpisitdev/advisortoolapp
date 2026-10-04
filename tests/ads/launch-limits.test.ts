import { describe, expect, it } from "vitest";
import { DEFAULT_MAX_DAILY_BUDGET_THB, checkDailyBudget, checkLink, maxDailyBudgetThb } from "@/lib/ads/launch-limits";

/**
 * The two checks that stand between the form and a request that spends money: how much a day,
 * and where the ad sends people. Pure functions — no database, no Meta.
 */

describe("the daily budget cap", () => {
  it("defaults to 500 baht", () => {
    expect(DEFAULT_MAX_DAILY_BUDGET_THB).toBe(500);
    expect(maxDailyBudgetThb({})).toBe(500);
  });

  it("is raised or lowered by the env value when it is a positive whole number", () => {
    expect(maxDailyBudgetThb({ ADS_MAX_DAILY_BUDGET_THB: "800" })).toBe(800);
  });

  it.each(["", "  ", "abc", "-1", "0", "1.5", "NaN"])("falls back to the default for %j", (value) => {
    expect(maxDailyBudgetThb({ ADS_MAX_DAILY_BUDGET_THB: value })).toBe(500);
  });

  it("falls back to the default when the env value is missing", () => {
    expect(maxDailyBudgetThb({ ADS_MAX_DAILY_BUDGET_THB: undefined })).toBe(500);
  });
});

describe("a daily budget", () => {
  it("passes in baht and comes back in satang, the minor unit Meta counts THB in", () => {
    expect(checkDailyBudget(100, "THB")).toEqual({ ok: true, minor: 10000 });
  });

  it("passes at the cap and fails one baht over it", () => {
    expect(checkDailyBudget(500, "THB")).toEqual({ ok: true, minor: 50000 });
    expect(checkDailyBudget(501, "THB").ok).toBe(false);
  });

  it("measures against the cap it is given", () => {
    expect(checkDailyBudget(800, "THB", 800)).toEqual({ ok: true, minor: 80000 });
    expect(checkDailyBudget(801, "THB", 800).ok).toBe(false);
  });

  // a cap that is NaN makes `baht > max` false for every amount, which would turn the cap off
  it.each([NaN, Infinity, -1, 0, 0.5, 1.5, Number.MAX_SAFE_INTEGER + 2])("falls back to the default cap when the cap is %s", (max) => {
    expect(checkDailyBudget(501, "THB", max).ok).toBe(false);
    expect(checkDailyBudget(500, "THB", max)).toEqual({ ok: true, minor: 50000 });
  });

  it("names the cap in the message when over it", () => {
    const r = checkDailyBudget(501, "THB");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("500");
  });

  it.each([0, -5, 99.5, NaN, Infinity])("rejects %s", (baht) => {
    const r = checkDailyBudget(baht, "THB");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toBe("");
  });

  it("rejects an account that is not in baht, and says only baht accounts work", () => {
    const r = checkDailyBudget(100, "USD");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("บาท");
  });

  it("rejects an account whose currency is unknown", () => {
    expect(checkDailyBudget(100, null).ok).toBe(false);
  });
});

describe("a destination link", () => {
  it("passes an https link and hands back the normalised address", () => {
    expect(checkLink("https://x.test/lifeprotect")).toEqual({ ok: true, url: "https://x.test/lifeprotect" });
  });

  it("trims the spaces around it", () => {
    expect(checkLink("  https://x.test/a  ")).toEqual({ ok: true, url: "https://x.test/a" });
  });

  it("passes http too", () => {
    expect(checkLink("http://x.test/a").ok).toBe(true);
  });

  it.each(["", "  ", "javascript:alert(1)", "ftp://x.test", "https://", "x.test"])("rejects %j", (raw) => {
    const r = checkLink(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toBe("");
  });
});
