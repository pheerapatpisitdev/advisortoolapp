import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

const MEMBER: Viewer = {
  kind: "member", agentId: "m1", code: "somchai@gmail.com", name: "สมชาย", tenantId: null, tenantSlug: "",
  tenantName: "สมาชิกทั่วไป", trial: false, staff: null,
};
const who = vi.hoisted(() => ({ viewer: null as unknown }));
vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => who.viewer }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const store = vi.hoisted(() => ({ setProfile: vi.fn() }));
vi.mock("@/lib/auth/member-store", () => store);

const { saveMyProfile } = await import("@/app/studio/account/actions");

beforeEach(() => {
  vi.clearAllMocks();
  who.viewer = MEMBER;
});

describe("saveMyProfile (owner, 2026-10-27)", () => {
  it("sets a cleaned name and สำนักงาน", async () => {
    expect(await saveMyProfile("  สมชาย  ใจดี ", " AIA  ตึกสาทร ")).toEqual({ ok: true });
    expect(store.setProfile).toHaveBeenCalledWith("m1", { name: "สมชาย ใจดี", office: "AIA ตึกสาทร" });
  });

  it("refuses a blank name or สำนักงาน, and a UnitOS agent", async () => {
    expect(await saveMyProfile("  ", "AIA")).toEqual({ ok: false, error: "กรุณากรอกชื่อ - นามสกุล (ไม่เกิน 60 ตัวอักษร)" });
    expect(await saveMyProfile("สมชาย", " ")).toEqual({ ok: false, error: "กรุณากรอกสำนักงาน (ไม่เกิน 100 ตัวอักษร)" });
    who.viewer = { ...MEMBER, kind: "unitos" };
    expect(await saveMyProfile("ก", "AIA")).toEqual({ ok: false, error: "หน้านี้สำหรับสมาชิกทั่วไปเท่านั้น" });
    expect(store.setProfile).not.toHaveBeenCalled();
  });
});
