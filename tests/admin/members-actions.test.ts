import { beforeEach, describe, expect, it, vi } from "vitest";

const viewer = vi.hoisted(() => ({ requireStaff: vi.fn(async () => ({ agentId: "owner" })), audit: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => viewer);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const store = vi.hoisted(() => ({ saveMemberSettings: vi.fn(), setPin: vi.fn(), setStatus: vi.fn() }));
vi.mock("@/lib/auth/member-store", () => store);

const { resetMemberPin, saveSignupSettings, setMemberStatus } = await import("@/app/admin/members/actions");
const ID = "00000000-0000-4000-8000-0000000000aa";

beforeEach(() => vi.clearAllMocks());

describe("the back office's members", () => {
  it("asks for the admin permission every time", async () => {
    await saveSignupSettings(true, "");
    await resetMemberPin(ID, "730512");
    await setMemberStatus(ID, "suspended");
    expect(viewer.requireStaff).toHaveBeenCalledTimes(3);
    expect(viewer.requireStaff).toHaveBeenCalledWith("admin");
  });

  it("switches sign-up and keeps an https contact link, or none", async () => {
    expect(await saveSignupSettings(true, " https://lin.ee/abc ")).toEqual({ ok: true });
    expect(store.saveMemberSettings).toHaveBeenLastCalledWith({ signupOpen: true, contactUrl: "https://lin.ee/abc" });
    expect(await saveSignupSettings(false, "")).toEqual({ ok: true });
    expect(store.saveMemberSettings).toHaveBeenLastCalledWith({ signupOpen: false, contactUrl: null });
    expect(await saveSignupSettings(true, "http://x.test")).toEqual({ ok: false, error: "ลิงก์ติดต่อต้องขึ้นต้นด้วย https://" });
    expect(viewer.audit).toHaveBeenCalledWith("member-signup-switch", null, { open: true });
  });

  it("resets a PIN with the same rules as signing up, and writes it down", async () => {
    expect(await resetMemberPin(ID, "123456")).toEqual({ ok: false, error: "PIN นี้เดาง่ายเกินไป ลองตั้งใหม่" });
    expect(await resetMemberPin(ID, "730512")).toEqual({ ok: true });
    const [id, hash, at] = store.setPin.mock.calls[0];
    expect(id).toBe(ID);
    expect(hash).toMatch(/^scrypt\$/);
    expect(at).toBeInstanceOf(Date);
    expect(viewer.audit).toHaveBeenCalledWith("member-pin-reset", ID);
  });

  it("suspends and reinstates, and nothing else", async () => {
    expect(await setMemberStatus(ID, "suspended")).toEqual({ ok: true });
    expect(await setMemberStatus(ID, "active")).toEqual({ ok: true });
    expect(await setMemberStatus(ID, "deleted")).toEqual({ ok: false, error: "สถานะไม่ถูกต้อง" });
    expect(viewer.audit).toHaveBeenCalledWith("member-suspend", ID);
    expect(viewer.audit).toHaveBeenCalledWith("member-reinstate", ID);
  });

  it("refuses an id that is not a uuid", async () => {
    expect(await resetMemberPin("x", "730512")).toEqual({ ok: false, error: "ไม่พบสมาชิกนี้" });
    expect(await setMemberStatus("x", "active")).toEqual({ ok: false, error: "ไม่พบสมาชิกนี้" });
  });
});
