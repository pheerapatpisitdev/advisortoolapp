import { beforeEach, describe, expect, it, vi } from "vitest";

const viewer = vi.hoisted(() => ({ requireStaff: vi.fn(async () => ({ agentId: "owner" })), audit: vi.fn(), memberById: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => viewer);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const store = vi.hoisted(() => ({ saveMemberSettings: vi.fn(), setStatus: vi.fn() }));
vi.mock("@/lib/auth/member-store", () => store);

const { saveSignupSettings, setMemberStatus } = await import("@/app/admin/members/actions");
const ID = "00000000-0000-4000-8000-0000000000aa";

beforeEach(() => {
  vi.clearAllMocks();
  viewer.memberById.mockResolvedValue({ id: ID, email: "somchai@gmail.com", name: "สมชาย", status: "active", revoked_at: null });
});

describe("the back office's members", () => {
  it("asks for the admin permission every time", async () => {
    await saveSignupSettings(true);
    await setMemberStatus(ID, "suspended");
    expect(viewer.requireStaff).toHaveBeenCalledTimes(2);
    expect(viewer.requireStaff).toHaveBeenCalledWith("admin");
  });

  it("switches sign-up and writes it down", async () => {
    expect(await saveSignupSettings(true)).toEqual({ ok: true });
    expect(store.saveMemberSettings).toHaveBeenLastCalledWith({ signupOpen: true });
    expect(await saveSignupSettings(false)).toEqual({ ok: true });
    expect(store.saveMemberSettings).toHaveBeenLastCalledWith({ signupOpen: false });
    expect(viewer.audit).toHaveBeenCalledWith("member-signup-switch", null, { open: true });
  });

  it("reports an unknown member as not found, writing and auditing nothing", async () => {
    viewer.memberById.mockResolvedValue(null);
    expect(await setMemberStatus(ID, "suspended")).toEqual({ ok: false, error: "ไม่พบสมาชิกนี้" });
    expect(store.setStatus).not.toHaveBeenCalled();
    expect(viewer.audit).not.toHaveBeenCalled();
  });

  it("suspends and reinstates, and nothing else", async () => {
    expect(await setMemberStatus(ID, "suspended")).toEqual({ ok: true });
    expect(await setMemberStatus(ID, "active")).toEqual({ ok: true });
    expect(await setMemberStatus(ID, "deleted")).toEqual({ ok: false, error: "สถานะไม่ถูกต้อง" });
    expect(store.setStatus).toHaveBeenCalledWith(ID, "suspended");
    expect(store.setStatus).toHaveBeenCalledWith(ID, "active");
    expect(viewer.audit).toHaveBeenCalledWith("member-suspend", ID);
    expect(viewer.audit).toHaveBeenCalledWith("member-reinstate", ID);
  });

  it("refuses an id that is not a uuid", async () => {
    expect(await setMemberStatus("x", "active")).toEqual({ ok: false, error: "ไม่พบสมาชิกนี้" });
  });
});
