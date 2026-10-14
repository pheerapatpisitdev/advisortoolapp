import { beforeEach, describe, expect, it, vi } from "vitest";

const viewer = vi.hoisted(() => ({ requireStaff: vi.fn(async () => ({ agentId: "owner" })), audit: vi.fn(), memberById: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => viewer);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const store = vi.hoisted(() => ({ saveMemberSettings: vi.fn(), setStatus: vi.fn(), purgeMember: vi.fn() }));
vi.mock("@/lib/auth/member-store", () => store);
const files = vi.hoisted(() => ({ clearMemberFiles: vi.fn(async () => {}) }));
vi.mock("@/lib/members/purge-files", () => files);

const { deleteMemberForGood, saveSignupSettings, setMemberStatus } = await import("@/app/admin/members/actions");
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
    expect(viewer.requireStaff).toHaveBeenCalledWith("backoffice");
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

describe("deleting a member for good (owner, 2026-10-14)", () => {
  const FILES = { pieces: ["p1"], people: [], videos: ["v1"], logos: [] };
  const suspended = () => viewer.memberById.mockResolvedValue({ id: ID, email: "Somchai@gmail.com", name: "สมชาย", status: "suspended", revoked_at: "x" });

  it("deletes a suspended member once their email is typed, clears the files and writes it down", async () => {
    suspended();
    store.purgeMember.mockResolvedValue({ ok: true, files: FILES });
    expect(await deleteMemberForGood(ID, "  somchai@GMAIL.com ")).toEqual({ ok: true });
    expect(viewer.requireStaff).toHaveBeenCalledWith("backoffice");
    expect(store.purgeMember).toHaveBeenCalledWith(ID);
    expect(files.clearMemberFiles).toHaveBeenCalledWith(ID, FILES);
    expect(viewer.audit).toHaveBeenCalledWith("member-delete", ID, { name: "สมชาย" });
  });

  it("refuses a member who is still active (2ข), touching nothing", async () => {
    expect(await deleteMemberForGood(ID, "somchai@gmail.com")).toEqual({ ok: false, error: "ต้องระงับสมาชิกก่อน จึงจะลบได้" });
    expect(store.purgeMember).not.toHaveBeenCalled();
    expect(viewer.audit).not.toHaveBeenCalled();
  });

  it("refuses when the typed email is not theirs", async () => {
    suspended();
    expect(await deleteMemberForGood(ID, "someone@gmail.com")).toEqual({ ok: false, error: "อีเมลที่พิมพ์ไม่ตรงกับอีเมลของสมาชิก" });
    expect(store.purgeMember).not.toHaveBeenCalled();
  });

  it("refuses when the database finds them reinstated in between", async () => {
    suspended();
    store.purgeMember.mockResolvedValue({ ok: false, why: "not-suspended" });
    expect(await deleteMemberForGood(ID, "somchai@gmail.com")).toEqual({ ok: false, error: "ต้องระงับสมาชิกก่อน จึงจะลบได้" });
    expect(files.clearMemberFiles).not.toHaveBeenCalled();
    expect(viewer.audit).not.toHaveBeenCalled();
  });

  it("says not found for an unknown id or one that is not a uuid", async () => {
    viewer.memberById.mockResolvedValue(null);
    expect(await deleteMemberForGood(ID, "a@gmail.com")).toEqual({ ok: false, error: "ไม่พบสมาชิกนี้" });
    expect(await deleteMemberForGood("x", "a@gmail.com")).toEqual({ ok: false, error: "ไม่พบสมาชิกนี้" });
  });

  it("reports a failed delete without auditing it", async () => {
    suspended();
    store.purgeMember.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await deleteMemberForGood(ID, "somchai@gmail.com")).toEqual({ ok: false, error: "ลบไม่สำเร็จ ลองใหม่อีกครั้ง" });
    expect(viewer.audit).not.toHaveBeenCalled();
  });
});
