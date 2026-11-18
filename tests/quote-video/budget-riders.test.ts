import { describe, expect, it } from "vitest";
import { RIDERS_NOT_SOLD, resolveBudget } from "@/lib/quote-video/budget";
import { lifeProtectPriced } from "@/lib/lifeprotect-card";
import { lpRiderMenu } from "@/lib/quote-video/lp-rider-menu";
import type { VideoInput } from "@/lib/quote-video/script";

/**
 * วิดีโอนำเสนอ from a budget with Life Protect's riders picked on the form (owner, 2026-11-18, 1ก):
 * the budget pays for plan and riders together.
 */

const TODAY = new Date("2026-11-18");
const base = { product: "LIFEPROTECT", variant: "WLF19H", sex: "M", age: 35, sumAssured: 500_000 } as VideoInput;
const budget = { baht: 60_000, per: "year" } as const;
const sumOf = (v: VideoInput | string) => (typeof v === "string" ? v : (v as { sumAssured: number }).sumAssured);

describe("a budget with riders", () => {
  it("buys a smaller sum than the plan alone, and the whole premium fits", () => {
    const riders = { medical: 1000, illness: [{ code: "AP", sumAssured: 1_000_000 }, { code: "ECARE", sumAssured: 1_000_000 }] };
    const alone = sumOf(resolveBudget(base, budget, TODAY)) as number;
    const withRiders = resolveBudget({ ...base, riders } as VideoInput, budget, TODAY);
    expect(typeof withRiders).toBe("object");
    const sum = sumOf(withRiders) as number;
    expect(sum).toBeLessThan(alone);
    expect((withRiders as { riders?: unknown }).riders).toEqual(riders);
    const paid = lifeProtectPriced({ kind: "plan", planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: sum, riders }, TODAY)!
      .paid!.find((m) => m.mode === "annual")!.total;
    expect(paid).toBeLessThanOrEqual(60_000_00);
  });

  it("says so when the budget is short of plan and riders together", () => {
    const riders = { illness: [{ code: "ECARE", sumAssured: 2_500_000 }] };
    const short = resolveBudget({ ...base, riders } as VideoInput, { baht: 20_000, per: "year" }, TODAY);
    expect(short).toMatch(/^งบนี้ยังไม่พอสำหรับทุนต่ำสุด 500,000 รวมสัญญาเพิ่มเติม/);
  });

  it("says the riders cannot be bought where no sum takes them", () => {
    // ECARE starts at 16
    const riders = { illness: [{ code: "ECARE", sumAssured: 1_000_000 }] };
    expect(resolveBudget({ ...base, age: 10, riders } as VideoInput, budget, TODAY)).toBe(RIDERS_NOT_SOLD);
  });
});

describe("the form's rider menu", () => {
  it("offers what the Life Protect page offers, without the rate tables", () => {
    const m = lpRiderMenu(TODAY);
    expect(m.waiver?.options.map((o) => o.word)).toEqual(["ฟิต", "บียอนด์"]);
    expect(m.medical?.plans).toEqual([500, 1000, 2000, 3000, 4000, 5000]);
    expect(m.medical?.maxAt[8 - m.ageMin]).toBe(500);
    expect(m.medical?.maxAt[3 - m.ageMin]).toBe(0);
    expect(m.illness.map((r) => r.code)).toEqual(["DCI", "CI123", "AP", "ECARE"]);
    expect(JSON.stringify(m).length).toBeLessThan(2000);
  });
});
