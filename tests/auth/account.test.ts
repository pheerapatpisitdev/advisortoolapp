import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

const MEMBER: Viewer = {
  kind: "member", agentId: "m1", code: "somchai@gmail.com", name: "สมชาย", tenantId: null, tenantSlug: "",
  tenantName: "สมาชิกทั่วไป", trial: false, staff: null,
};
const who = vi.hoisted(() => ({ viewer: null as unknown }));
vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => who.viewer }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const store = vi.hoisted(() => ({ setName: vi.fn() }));
vi.mock("@/lib/auth/member-store", () => store);

const { renameMe } = await import("@/app/studio/account/actions");

beforeEach(() => {
  vi.clearAllMocks();
  who.viewer = MEMBER;
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
