import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

/** คลังแอนิเมชัน's actions: the owner's alone (spec 2026-11-14-library-owner-only-design.md), whatever the page shows */
const { state, record } = vi.hoisted(() => {
  const state = { viewer: null as unknown as Viewer, calls: [] as [string, unknown[]][] };
  const record = (name: string, answer: unknown) => async (...a: unknown[]) => { state.calls.push([name, a]); return answer; };
  return { state, record };
});

vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => state.viewer, getViewer: async () => state.viewer }));
vi.mock("@/lib/scene-library/marks", async (orig) => ({ ...(await orig<object>()), toggleMark: record("toggleMark", { ok: true, on: true }) }));
vi.mock("@/lib/scene-library/uploads", () => ({
  decideUpload: record("decideUpload", { ok: true }),
  deleteUpload: record("deleteUpload", { ok: true }),
  withdrawUpload: record("withdrawUpload", { ok: true, removed: false }),
  hideUpload: record("hideUpload", { ok: true }),
  showUpload: record("showUpload", { ok: true }),
}));

import { OWNER, SUPER } from "../helpers/signed-in";
import { LIBRARY_CLOSED } from "@/lib/scene-library/access";
import {
  decideLibraryUpload, hideLibraryUpload, removeLibraryUpload, showLibraryUpload, toggleLibraryMark, withdrawLibraryUpload,
} from "@/app/studio/library/actions";

const ID = "11111111-1111-4111-8111-111111111111";
const AGENT: Viewer = { ...OWNER, agentId: "00000000-0000-4000-8000-0000000000a1", staff: null };
const ADMIN: Viewer = { ...AGENT, staff: { owner: false, publish: true, connect: true, admin: true } };
const MEMBER: Viewer = { ...AGENT, kind: "member" };
const DEMO: Viewer = { ...OWNER, kind: "demo" };

beforeEach(() => { state.viewer = OWNER; state.calls = []; });

describe("every action refuses anyone but the owner", () => {
  const actions: [string, () => Promise<unknown>][] = [
    ["toggleLibraryMark", () => toggleLibraryMark("room", "save")],
    ["decideLibraryUpload", () => decideLibraryUpload(ID, "ok")],
    ["withdrawLibraryUpload", () => withdrawLibraryUpload(ID, "อาจติดลิขสิทธิ์")],
    ["removeLibraryUpload", () => removeLibraryUpload(ID)],
    ["hideLibraryUpload", () => hideLibraryUpload(ID)],
    ["showLibraryUpload", () => showLibraryUpload(ID)],
  ];
  for (const [name, call] of actions) {
    it(`${name}: an agent, an admin who is not the owner, a member and the demo account are told it is closed`, async () => {
      for (const v of [AGENT, ADMIN, MEMBER, DEMO]) {
        state.viewer = v;
        expect(await call(), v.kind).toEqual({ ok: false, error: LIBRARY_CLOSED });
      }
      expect(state.calls).toEqual([]);
    });
  }
  it("the closed line is the page's", () => expect(LIBRARY_CLOSED).toBe("ฟังก์ชันนี้ปิดใช้งานอยู่"));
});

describe("the owner's calls", () => {
  it("toggleLibraryMark marks for the owner", async () => {
    expect(await toggleLibraryMark("room", "save")).toEqual({ ok: true, on: true });
    expect(state.calls).toEqual([["toggleMark", [OWNER.agentId, "room", "save"]]]);
  });
  it("the Super Admin counts as the owner", async () => {
    state.viewer = SUPER;
    expect(await hideLibraryUpload(ID)).toEqual({ ok: true });
    expect(state.calls).toEqual([["hideUpload", [SUPER.agentId, ID]]]);
  });
  it("hideLibraryUpload and showLibraryUpload pass the owner's id and the file on", async () => {
    expect(await hideLibraryUpload(ID)).toEqual({ ok: true });
    expect(await showLibraryUpload(ID)).toEqual({ ok: true });
    expect(state.calls).toEqual([["hideUpload", [OWNER.agentId, ID]], ["showUpload", [OWNER.agentId, ID]]]);
  });
  it("hide, show and remove refuse a non-string id without reaching the store", async () => {
    for (const call of [hideLibraryUpload, showLibraryUpload, removeLibraryUpload]) expect((await call(5 as never)).ok).toBe(false);
    expect(state.calls).toEqual([]);
  });
  it("removeLibraryUpload passes the owner's own agentId", async () => {
    expect(await removeLibraryUpload(ID)).toEqual({ ok: true });
    expect(state.calls).toEqual([["deleteUpload", [OWNER.agentId, ID]]]);
  });
  it("decideLibraryUpload still passes a verdict on, and refuses one outside the four", async () => {
    expect(await decideLibraryUpload(ID, "no", "อาจติดลิขสิทธิ์")).toEqual({ ok: true });
    for (const v of ["wait", "yes", "", "OK"]) expect((await decideLibraryUpload(ID, v)).ok).toBe(false);
    expect(state.calls).toEqual([["decideUpload", [OWNER.agentId, ID, "no", "อาจติดลิขสิทธิ์"]]]);
  });
  it("withdrawLibraryUpload still passes the reason on, and refuses a non-string id or reason", async () => {
    expect(await withdrawLibraryUpload(ID, "อาจติดลิขสิทธิ์")).toEqual({ ok: true, removed: false });
    expect((await withdrawLibraryUpload(5 as never, "อาจติดลิขสิทธิ์")).ok).toBe(false);
    expect((await withdrawLibraryUpload(ID, undefined as never)).ok).toBe(false);
    expect(state.calls).toEqual([["withdrawUpload", [OWNER.agentId, ID, "อาจติดลิขสิทธิ์"]]]);
  });
});
