import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";
import type { ContentItem } from "@/lib/content/store";
import { OWNER } from "../helpers/signed-in";

/**
 * The shared hook-formula library (owner, 2026-10-11): only the team's ✓ใช้จริง adds to it, and
 * the owner can take a formula out.
 */
const who = vi.hoisted(() => ({ viewer: null as Viewer | null }));
vi.mock("@/lib/auth/viewer", async () => {
  const base = (await import("../helpers/signed-in")).asOwner;
  const can = (await import("@/lib/auth/access")).can;
  return {
    ...base,
    getViewer: async () => who.viewer,
    requireMember: async () => { if (!who.viewer) throw new Error("กรุณาเข้าสู่ระบบก่อน"); return who.viewer; },
    requireStaff: async (perm: Parameters<typeof can>[1]) => {
      if (!who.viewer || !can(who.viewer, perm)) throw new Error("ไม่มีสิทธิ์ใช้ส่วนนี้");
      return who.viewer;
    },
  };
});
const later = vi.hoisted(() => [] as (() => unknown)[]);
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (task: () => unknown) => { later.push(task); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const store = vi.hoisted(() => ({ getContent: vi.fn(), setStatus: vi.fn(), deleteHookTemplate: vi.fn() }));
vi.mock("@/lib/content/store", async (orig) => ({ ...(await orig<typeof import("@/lib/content/store")>()), ...store }));

const { deleteHookFormula, setContentStatus } = await import("@/app/studio/actions");

const AGENT: Viewer = { ...OWNER, agentId: "00000000-0000-4000-8000-000000000002", code: "123456", name: "ตัวแทน", staff: null };
const ASSISTANT: Viewer = { ...OWNER, staff: { owner: false, publish: true, connect: false, admin: false } };
const piece = {
  id: "p1", status: "draft", format: "post", campaignId: null, hookTemplateId: null, publish: null,
  output: { hooks: ["อายุ 35 แล้วยังไม่มีประกัน?"], body: "", closing: "", hashtags: [] },
} as unknown as ContentItem;
const FORMULA = "0f9c2a1e-5b7d-4c3a-9e8f-1a2b3c4d5e6f";

beforeEach(() => {
  vi.clearAllMocks();
  later.length = 0;
  store.getContent.mockResolvedValue(piece);
});

describe("✓ใช้จริง and the library", () => {
  it("an agent who is not staff marks the piece used, and the library is left alone", async () => {
    who.viewer = AGENT;
    expect(await setContentStatus("p1", "used")).toEqual({ ok: true });
    expect(store.setStatus).toHaveBeenCalledWith("p1", "used");
    expect(later).toHaveLength(0);
  });

  it("the team's ✓ใช้จริง still draws a formula out", async () => {
    for (const v of [OWNER, ASSISTANT]) {
      later.length = 0;
      who.viewer = v;
      expect(await setContentStatus("p1", "used")).toEqual({ ok: true });
      expect(later).toHaveLength(1);
    }
  });
});

describe("taking a formula out", () => {
  it("is the owner's", async () => {
    who.viewer = OWNER;
    expect(await deleteHookFormula(FORMULA)).toEqual({ ok: true });
    expect(store.deleteHookTemplate).toHaveBeenCalledWith(FORMULA);
  });

  it("is refused to anyone else", async () => {
    for (const v of [AGENT, ASSISTANT]) {
      who.viewer = v;
      await expect(deleteHookFormula(FORMULA)).rejects.toThrow("ไม่มีสิทธิ์");
    }
    expect(store.deleteHookTemplate).not.toHaveBeenCalled();
  });

  it("takes nothing that is not a formula's id", async () => {
    who.viewer = OWNER;
    expect(await deleteHookFormula("'; drop table x")).toEqual({ ok: false });
    expect(store.deleteHookTemplate).not.toHaveBeenCalled();
  });
});
