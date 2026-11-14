import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

const state = vi.hoisted(() => ({
  viewer: null as unknown as Viewer,
  decided: [] as unknown[],
  deleted: [] as unknown[],
}));

vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => state.viewer, getViewer: async () => state.viewer }));
vi.mock("@/lib/scene-library/marks", async (orig) => ({ ...(await orig<object>()), toggleMark: vi.fn() }));
vi.mock("@/lib/scene-library/uploads", () => ({
  decideUpload: async (...a: unknown[]) => { state.decided.push(a); return { ok: true }; },
  deleteUpload: async (...a: unknown[]) => { state.deleted.push(a); return { ok: true }; },
}));

import { OWNER } from "../helpers/signed-in";
import { decideLibraryUpload, removeLibraryUpload } from "@/app/studio/library/actions";

const ID = "11111111-1111-4111-8111-111111111111";
const AGENT: Viewer = { ...OWNER, agentId: "00000000-0000-4000-8000-0000000000a1", staff: null };

beforeEach(() => { state.viewer = OWNER; state.decided = []; state.deleted = []; });

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
