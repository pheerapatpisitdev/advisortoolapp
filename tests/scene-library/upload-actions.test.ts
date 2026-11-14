import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

const state = vi.hoisted(() => ({
  viewer: null as unknown as Viewer,
  decided: [] as unknown[],
  deleted: [] as unknown[],
  withdrawn: [] as unknown[],
}));

vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => state.viewer, getViewer: async () => state.viewer }));
vi.mock("@/lib/scene-library/marks", async (orig) => ({ ...(await orig<object>()), toggleMark: vi.fn() }));
vi.mock("@/lib/scene-library/uploads", () => ({
  decideUpload: async (...a: unknown[]) => { state.decided.push(a); return { ok: true }; },
  deleteUpload: async (...a: unknown[]) => { state.deleted.push(a); return { ok: true }; },
  withdrawUpload: async (...a: unknown[]) => { state.withdrawn.push(a); return { ok: true, removed: false }; },
}));

import { OWNER } from "../helpers/signed-in";
import { decideLibraryUpload, removeLibraryUpload, withdrawLibraryUpload } from "@/app/studio/library/actions";

const ID = "11111111-1111-4111-8111-111111111111";
const AGENT: Viewer = { ...OWNER, agentId: "00000000-0000-4000-8000-0000000000a1", staff: null };

beforeEach(() => { state.viewer = OWNER; state.decided = []; state.deleted = []; state.withdrawn = []; });

describe("decideLibraryUpload", () => {
  it("passes the owner's verdict on to decideUpload", async () => {
    expect(await decideLibraryUpload(ID, "no", "อาจติดลิขสิทธิ์")).toEqual({ ok: true });
    expect(state.decided).toEqual([[OWNER.agentId, ID, "no", "อาจติดลิขสิทธิ์"]]);
  });

  it("never reaches decideUpload for a non-owner", async () => {
    state.viewer = AGENT;
    expect(await decideLibraryUpload(ID, "ok")).toEqual({ ok: false, error: "ไม่พบไฟล์นี้" });
    state.viewer = { ...AGENT, staff: { owner: false, publish: true, connect: true, admin: true } };
    expect(await decideLibraryUpload(ID, "ok")).toEqual({ ok: false, error: "ไม่พบไฟล์นี้" });
    expect(state.decided).toEqual([]);
  });

  it("refuses the demo account", async () => {
    state.viewer = { ...OWNER, kind: "demo" };
    expect((await decideLibraryUpload(ID, "ok")).ok).toBe(false);
    expect(state.decided).toEqual([]);
  });

  it("refuses a verdict outside the four", async () => {
    for (const v of ["wait", "yes", "", "OK"]) expect((await decideLibraryUpload(ID, v)).ok).toBe(false);
    expect(state.decided).toEqual([]);
  });

  it("accepts each of the four", async () => {
    for (const v of ["ok", "no", "queue", "closed"]) await decideLibraryUpload(ID, v, "r");
    expect(state.decided).toHaveLength(4);
  });
});

describe("removeLibraryUpload", () => {
  it("passes the caller's own agentId", async () => {
    state.viewer = AGENT;
    expect(await removeLibraryUpload(ID)).toEqual({ ok: true });
    expect(state.deleted).toEqual([[AGENT.agentId, ID]]);
  });

  it("refuses a non-string id", async () => {
    expect((await removeLibraryUpload(5 as never)).ok).toBe(false);
    expect(state.deleted).toEqual([]);
  });
});

describe("withdrawLibraryUpload", () => {
  it("passes the owner's id, the file and the reason on to withdrawUpload", async () => {
    expect(await withdrawLibraryUpload(ID, "อาจติดลิขสิทธิ์")).toEqual({ ok: true, removed: false });
    expect(state.withdrawn).toEqual([[OWNER.agentId, ID, "อาจติดลิขสิทธิ์"]]);
  });

  it("never reaches withdrawUpload for a non-owner, staff with every other right included", async () => {
    state.viewer = AGENT;
    expect(await withdrawLibraryUpload(ID, "อาจติดลิขสิทธิ์")).toEqual({ ok: false, error: "ไม่พบไฟล์นี้" });
    state.viewer = { ...AGENT, staff: { owner: false, publish: true, connect: true, admin: true } };
    expect(await withdrawLibraryUpload(ID, "อาจติดลิขสิทธิ์")).toEqual({ ok: false, error: "ไม่พบไฟล์นี้" });
    expect(state.withdrawn).toEqual([]);
  });

  it("refuses the demo account", async () => {
    state.viewer = { ...OWNER, kind: "demo" };
    expect((await withdrawLibraryUpload(ID, "อาจติดลิขสิทธิ์")).ok).toBe(false);
    expect(state.withdrawn).toEqual([]);
  });

  it("refuses a non-string id or reason", async () => {
    expect((await withdrawLibraryUpload(5 as never, "อาจติดลิขสิทธิ์")).ok).toBe(false);
    expect((await withdrawLibraryUpload(ID, undefined as never)).ok).toBe(false);
    expect(state.withdrawn).toEqual([]);
  });
});
