import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

/**
 * The shared demo account's votes are left out of every count (marks.ts wantCounts), so the page tells
 * the board who is looking: the demo's own อยากได้ then moves its mark, never the number beside it.
 */
const state = vi.hoisted(() => ({ viewer: null as unknown as Viewer, board: null as null | Record<string, unknown> }));

vi.mock("@/lib/auth/viewer", () => ({ gatePage: async () => state.viewer, requireMember: async () => state.viewer }));
vi.mock("@/lib/scene-library/marks", () => ({ marksOf: async () => ({ saved: [], wanted: [] }), wantCounts: async () => ({}) }));
vi.mock("@/lib/scene-library/uploads", () => ({ uploadViews: async () => ({ mine: [], shared: [], waiting: [] }) }));
vi.mock("@/lib/switches/store", () => ({ closedFor: async () => null }));
vi.mock("@/app/studio/library/LibraryBoard", () => ({ LibraryBoard: (p: Record<string, unknown>) => { state.board = p; return null; } }));

import { OWNER } from "../helpers/signed-in";
import LibraryPage from "@/app/studio/library/page";

const DEMO: Viewer = { ...OWNER, kind: "demo", agentId: "00000000-0000-4000-8000-000000012345", code: "012345", name: "ลูกค้าทดลองใช้", staff: null };

beforeEach(() => { state.board = null; });

describe("the page tells the board when the viewer is the demo", () => {
  it("demo: true for the demo account", async () => {
    state.viewer = DEMO;
    renderToStaticMarkup(await LibraryPage());
    expect(state.board?.demo).toBe(true);
  });
  it("demo: false for anyone else", async () => {
    state.viewer = OWNER;
    renderToStaticMarkup(await LibraryPage());
    expect(state.board?.demo).toBe(false);
  });
});
