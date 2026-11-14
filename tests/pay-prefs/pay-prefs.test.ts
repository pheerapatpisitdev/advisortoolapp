import { describe, expect, it } from "vitest";
import { DEFAULT_PAY_PREFS, hiddenModes, hideParam, readHide, showModes, shows, writeHide } from "@/lib/pay-prefs";
import { cardPath } from "@/lib/card-link";

const modes = [
  { mode: "annual" as const, total: 1_240_000, belowMinimum: false },
  { mode: "semi" as const, total: 644_800, belowMinimum: false },
  { mode: "monthly" as const, total: 111_600, belowMinimum: false },
];

describe("ตั้งค่าส่วนตัว: which instalments an agent's quotes show (owner, 2026-11-14)", () => {
  it("shows everything until the agent switches something off", () => {
    expect(hiddenModes(DEFAULT_PAY_PREFS)).toEqual([]);
    expect(showModes(modes, [])).toBe(modes);
  });

  it("leaves out what was switched off and always keeps yearly", () => {
    expect(hiddenModes({ monthly: false, semi: true })).toEqual(["monthly"]);
    expect(hiddenModes({ monthly: false, semi: false })).toEqual(["semi", "monthly"]);
    expect(showModes(modes, ["monthly"]).map((m) => m.mode)).toEqual(["annual", "semi"]);
    expect(showModes(modes, ["semi", "monthly"]).map((m) => m.mode)).toEqual(["annual"]);
    expect(shows(["semi", "monthly"], "annual")).toBe(true);
    expect(showModes(undefined, ["monthly"])).toBeUndefined();
  });

  it("travels in a link as hide=…, and a link without it hides nothing", () => {
    expect(hideParam([])).toBeUndefined();
    expect(hideParam(["monthly", "semi"])).toBe("semi.monthly");
    expect(readHide("semi.monthly")).toEqual(["semi", "monthly"]);
    expect(readHide("monthly")).toEqual(["monthly"]);
    expect(readHide(null)).toEqual([]);
    expect(readHide("annual")).toEqual([]);
    expect(readHide("monthly.x")).toEqual([]);
    const q = new URLSearchParams();
    writeHide(q, []);
    expect(q.toString()).toBe("");
  });

  it("keeps a card's address as it was when nothing is hidden", () => {
    const input = { kind: "plan" as const, planCode: "ISHIELD", variant: "WLCI10", age: 35, sex: "M" as const, sumAssured: 1_000_000 };
    expect(cardPath(input)).not.toContain("hide=");
    expect(cardPath({ ...input, hide: ["monthly"] })).toContain("hide=monthly");
  });
});
