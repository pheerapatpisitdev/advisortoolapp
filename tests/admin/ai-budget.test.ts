import { describe, expect, it } from "vitest";
import { checkBudget, MAX_BUDGET_THB } from "@/app/admin/ai/budget";

/**
 * The monthly budget box on /admin/ai.
 *
 * A monthly budget of 0 was stored, shown as "ยังไม่ได้ตั้งงบ", and read by the AI client as a
 * ฿0 ceiling — every customer's answer stopped. Empty is the only way to say "no limit".
 */
describe("the budget box", () => {
  it("takes empty as no limit", () => {
    expect(checkBudget("", 300)).toEqual({ ok: true, monthly: null });
  });

  it("refuses 0 and negatives, saying how to mean no limit", () => {
    for (const v of ["0", "-1", "-0.5"]) {
      const r = checkBudget(v, null);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toContain("เว้นว่าง");
    }
  });

  it("refuses what is not a number, and what is absurdly large", () => {
    expect(checkBudget("abc", null).ok).toBe(false);
    expect(checkBudget("1e3", null).ok).toBe(false);
    expect(checkBudget(String(MAX_BUDGET_THB + 1), null).ok).toBe(false);
  });

  it("accepts amounts a step of 50 used to block, to the satang", () => {
    expect(checkBudget("120", null)).toEqual({ ok: true, monthly: 120 });
    expect(checkBudget("1,000.345", null)).toEqual({ ok: true, monthly: 1000.35 });
  });

  it("may not go below เพดานงบใช้ฟรี, which would stop the bots once agents' free use reached it", () => {
    const r = checkBudget("200", 300);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("ไม่น้อยกว่าเพดานงบใช้ฟรี");
    expect(checkBudget("300", 300)).toEqual({ ok: true, monthly: 300 });
    expect(checkBudget("200", null)).toEqual({ ok: true, monthly: 200 });
  });
});
