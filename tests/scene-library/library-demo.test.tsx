import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

/**
 * คลังแอนิเมชัน is the owner's alone (spec 2026-11-14-library-owner-only-design.md): the shared demo account,
 * though it is drawn from the owner's own record, never reaches the board, and the owner's board is told nothing
 * about demos or members any more.
 */
const state = vi.hoisted(() => ({ viewer: null as unknown as Viewer, board: null as null | Record<string, unknown> }));

vi.mock("@/lib/auth/viewer", () => ({ gatePage: async () => state.viewer, requireMember: async () => state.viewer }));
vi.mock("@/lib/scene-library/marks", () => ({ marksOf: async () => ({ saved: ["room"], wanted: ["x"] }), wantCounts: async () => ({}) }));
vi.mock("@/lib/scene-library/uploads", () => ({ uploadViews: async () => ({ mine: [], shared: [], waiting: [] }) }));
vi.mock("@/lib/switches/store", () => ({ closedFor: async () => null }));
vi.mock("@/app/studio/library/LibraryBoard", () => ({ LibraryBoard: (p: Record<string, unknown>) => { state.board = p; return null; } }));

import { OWNER } from "../helpers/signed-in";
import LibraryPage from "@/app/studio/library/page";

beforeEach(() => { state.board = null; });

describe("who reaches the board", () => {
  it("the demo account does not, even with the owner's staff record", async () => {
    state.viewer = { ...OWNER, kind: "demo" };
    const html = renderToStaticMarkup(await LibraryPage());
    expect(state.board).toBeNull();
    expect(html).toContain("ฟังก์ชันนี้ปิดใช้งานอยู่");
  });
  it("the owner does, with the saves alone: no votes, no counts, no owner or demo switch", async () => {
    state.viewer = OWNER;
    renderToStaticMarkup(await LibraryPage());
    expect(state.board).not.toBeNull();
    expect(state.board?.saved).toEqual(["room"]);
    for (const k of ["wanted", "counts", "owner", "demo"]) expect(state.board, k).not.toHaveProperty(k);
  });
});
