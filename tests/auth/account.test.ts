import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";
import { hashPin } from "@/lib/auth/member";

const MEMBER: Viewer = {
  kind: "member", agentId: "m1", code: "0812345678", name: "สมชาย", tenantId: null, tenantSlug: "",
  tenantName: "สมาชิกทั่วไป", trial: false, staff: null,
};
const who = vi.hoisted(() => ({ viewer: null as unknown }));
vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => who.viewer }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const auth = vi.hoisted(() => ({ startSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => auth);
const store = vi.hoisted(() => ({ memberByPhone: vi.fn(), setPin: vi.fn(), setName: vi.fn() }));
vi.mock("@/lib/auth/member-store", () => store);

const { changePin, renameMe } = await import("@/app/studio/account/actions");
let STORED = "";

beforeEach(async () => {
  vi.clearAllMocks();
  who.viewer = MEMBER;
  STORED ||= await hashPin("280419");
  store.memberByPhone.mockResolvedValue({ id: "m1", phone: "0812345678", name: "สมชาย", status: "active", pin_changed_at: null, pin_hash: STORED });
});

describe("changePin", () => {
  it("takes the old PIN, sets the new one, and keeps this device signed in", async () => {
    const before = Date.now();
    expect(await changePin("280419", "730512", "730512")).toEqual({ ok: true });
    const [id, hash, at] = store.setPin.mock.calls[0];
    expect(id).toBe("m1");
    expect(hash).toMatch(/^scrypt\$/);
    expect((at as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect(auth.startSession).toHaveBeenCalledWith("m1");
    // the new session is issued after the change, so admitMember lets it in
    expect(store.setPin.mock.invocationCallOrder[0]).toBeLessThan(auth.startSession.mock.invocationCallOrder[0]);
  });

  it("refuses a wrong old PIN and a weak new one", async () => {
    expect(await changePin("280418", "730512", "730512")).toEqual({ ok: false, error: "PIN เดิมไม่ถูกต้อง" });
    expect(await changePin("280419", "111111", "111111")).toEqual({ ok: false, error: "PIN นี้เดาง่ายเกินไป ลองตั้งใหม่" });
    expect(store.setPin).not.toHaveBeenCalled();
  });

  it("is not for a UnitOS agent, who has no PIN here", async () => {
    who.viewer = { ...MEMBER, kind: "unitos", tenantId: "t1" };
    expect(await changePin("280419", "730512", "730512")).toEqual({ ok: false, error: "หน้านี้สำหรับสมาชิกทั่วไปเท่านั้น" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
  });
});

describe("renameMe", () => {
  it("sets a cleaned name", async () => {
    expect(await renameMe("  สมชาย  ใจดี ")).toEqual({ ok: true });
    expect(store.setName).toHaveBeenCalledWith("m1", "สมชาย ใจดี");
  });

  it("refuses a blank name, and a UnitOS agent", async () => {
    expect(await renameMe("  ")).toEqual({ ok: false, error: "กรุณากรอกชื่อ (ไม่เกิน 60 ตัวอักษร)" });
    who.viewer = { ...MEMBER, kind: "unitos" };
    expect(await renameMe("ก")).toEqual({ ok: false, error: "หน้านี้สำหรับสมาชิกทั่วไปเท่านั้น" });
    expect(store.setName).not.toHaveBeenCalled();
  });
});
