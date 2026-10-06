import { describe, expect, it } from "vitest";
import { LIFEPROTECT_SUMS, lifeProtectSumNear, planInitialFromTable } from "@/lib/quote-pdf/pages";

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
  it("run every fifty thousand from half a million to fifty million", () => {
    expect(LIFEPROTECT_SUMS[0]).toBe(500_000);
    expect(LIFEPROTECT_SUMS.at(-1)).toBe(50_000_000);
    expect(LIFEPROTECT_SUMS).toContain(750_000);
    expect(LIFEPROTECT_SUMS.every((s, i) => i === 0 || s - LIFEPROTECT_SUMS[i - 1] === 50_000)).toBe(true);
  });

  it.each([
    [750_000, 750_000],
    [760_000, 750_000],
    [775_000, 800_000],
    [120_000, 500_000],
    [0, 500_000],
    [99_000_000, 50_000_000],
  ])("a typed %i lands on %i", (typed, sum) => {
    expect(lifeProtectSumNear(typed)).toBe(sum);
  });
});
