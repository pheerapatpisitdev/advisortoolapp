import { describe, expect, it, vi } from "vitest";
import { said } from "@/lib/auth/said";

/** a board's action answers why it failed instead of "การเชื่อมต่อหลุด" (owner, 2026-10-18) */
describe("said", () => {
  it("passes on a refusal written for the agent", async () => {
    expect(await said(async () => { throw new Error("ไม่มีสิทธิ์ใช้ส่วนนี้"); })).toEqual({ ok: false, error: "ไม่มีสิทธิ์ใช้ส่วนนี้" });
  });

  it("says the fallback for an internal error, and logs it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await said(async () => { throw new Error("db timeout"); }, "ลองใหม่")).toEqual({ ok: false, error: "ลองใหม่" });
    expect(log).toHaveBeenCalled();
  });

  it("returns the action's own answer untouched", async () => {
    expect(await said(async () => ({ ok: true as const, n: 1 }))).toEqual({ ok: true, n: 1 });
  });
});
