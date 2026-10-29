import { describe, expect, it } from "vitest";
import { LIFEPROTECT_BUDGET_SUMS, LIFEPROTECT_LINK_SUMS, LIFEPROTECT_SUMS, lifeProtectTypedSum, planInitialFromTable } from "@/lib/quote-pdf/pages";

const offer = { sums: [500_000, 1_000_000], variants: ["A", "B"], ageMin: 20, ageMax: 59 };
const q = (s: string) => new URLSearchParams(s);
const good = "age=40&sex=F&sum=1000000&variant=B";

describe("planInitialFromTable", () => {
  it("accepts a valid query", () => {
    expect(planInitialFromTable(q(good), offer)).toEqual({ age: 40, sex: "F", sumAssured: 1_000_000, variant: "B" });
  });
  it.each([
    ["missing age", "sex=F&sum=1000000&variant=B"],
    ["missing variant", "age=40&sex=F&sum=1000000"],
    ["empty sum", "age=40&sex=F&sum=&variant=B"],
    ["bad sex", "age=40&sex=X&sum=1000000&variant=B"],
    ["non-digit age", "age=4e1&sex=F&sum=1000000&variant=B"],
    ["signed sum", "age=40&sex=F&sum=%2B1000000&variant=B"],
    ["sum not offered", "age=40&sex=F&sum=123&variant=B"],
    ["variant not offered", "age=40&sex=F&sum=1000000&variant=Z"],
    ["age below range", "age=19&sex=F&sum=1000000&variant=B"],
    ["age above range", "age=60&sex=F&sum=1000000&variant=B"],
    ["repeated key", `${good}&age=41`],
  ])("rejects %s", (_n, query) => {
    expect(planInitialFromTable(q(query), offer)).toBeUndefined();
  });
});

describe("Life Protect's sums", () => {
  it("run every hundred and fifty thousand from half a million to fifty million", () => {
    expect(LIFEPROTECT_SUMS[0]).toBe(500_000);
    expect(LIFEPROTECT_SUMS.at(-1)).toBe(50_000_000);
    expect(LIFEPROTECT_SUMS).toContain(650_000);
    expect(LIFEPROTECT_SUMS.every((s, i) => i === 0 || s - LIFEPROTECT_SUMS[i - 1] === 150_000)).toBe(true);
    expect(LIFEPROTECT_LINK_SUMS).toContain(1_000_000);
  });

  it("a link may name the plan's own smallest sums, below the slider's first stop", () => {
    expect(LIFEPROTECT_LINK_SUMS[0]).toBe(150_000);
    expect(LIFEPROTECT_LINK_SUMS).toEqual(expect.arrayContaining([150_000, 250_000, 300_000]));
    expect(LIFEPROTECT_LINK_SUMS.at(-1)).toBe(50_000_000);
  });

  it("a link may name any thousand the page could have been typed with", () => {
    expect(LIFEPROTECT_LINK_SUMS).toEqual(expect.arrayContaining([1_235_000, 777_000, 49_999_000]));
    expect(LIFEPROTECT_LINK_SUMS).not.toContain(1_234_567);
    expect(LIFEPROTECT_LINK_SUMS).not.toContain(149_000);
  });

  it("a budget still buys on fifty-thousand steps, as the chat does", () => {
    expect(LIFEPROTECT_BUDGET_SUMS[0]).toBe(150_000);
    expect(LIFEPROTECT_BUDGET_SUMS.at(-1)).toBe(50_000_000);
    expect(LIFEPROTECT_BUDGET_SUMS.every((s) => s % 50_000 === 0)).toBe(true);
  });
});

describe("lifeProtectTypedSum", () => {
  it.each([
    [150_000, 150_000],
    [300_000, 300_000],
    [1_234_567, 1_235_000],
    [1_234_499, 1_234_000],
    [777_000, 777_000],
    [1_000_000, 1_000_000],
    [120_000, 150_000],
    [10_000, 150_000],
    [0, 150_000],
    [99_000_000, 50_000_000],
  ])("a typed %i lands on %i", (typed, sum) => {
    expect(lifeProtectTypedSum(typed)).toBe(sum);
  });
});
