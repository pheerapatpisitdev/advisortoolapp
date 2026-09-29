import { beforeEach, describe, expect, it, vi } from "vitest";

/** The owner ties Pages to a member of staff on /admin/team (2026-09-29). */

const db = vi.hoisted(() => ({
  staff: new Map<string, { is_owner: boolean }>(),
  pages: [] as { agent_id: string; page_id: string }[],
}));
const viewer = vi.hoisted(() => ({ requireStaff: vi.fn(async () => ({ agentId: "owner1" })), audit: vi.fn(async () => undefined), agentsByCode: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => viewer);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/facebook/connection", () => ({ pageConnections: vi.fn(async () => [{ pageId: "p1" }, { pageId: "p2" }]) }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => ({ data: table === "ins_staff" ? db.staff.get(id) ?? null : null, error: null }),
        }),
      }),
      delete: () => ({ eq: async (_col: string, id: string) => { db.pages = db.pages.filter((r) => r.agent_id !== id); return { error: null }; } }),
      insert: async (rows: { agent_id: string; page_id: string }[]) => { db.pages.push(...rows); return { error: null }; },
    }),
  }),
}));

const { setStaffPages } = await import("@/app/admin/team/actions");

beforeEach(() => {
  vi.clearAllMocks();
  db.staff = new Map([["s1", { is_owner: false }], ["owner1", { is_owner: true }]]);
  db.pages = [{ agent_id: "s1", page_id: "p1" }];
});

describe("tying Pages to a member of staff", () => {
  it("replaces their Pages with the ones ticked, and writes it down", async () => {
    expect(await setStaffPages("s1", ["p2", "p2"])).toEqual({ ok: true });
    expect(db.pages).toEqual([{ agent_id: "s1", page_id: "p2" }]);
    expect(viewer.audit).toHaveBeenCalledWith("staff-pages", "s1", { pages: ["p2"] });
  });

  it("takes every Page away with none ticked", async () => {
    expect(await setStaffPages("s1", [])).toEqual({ ok: true });
    expect(db.pages).toEqual([]);
  });

  it("drops a Page no longer connected rather than refusing, so a stale tie cannot lock the ticks", async () => {
    db.pages = [{ agent_id: "s1", page_id: "p1" }, { agent_id: "s1", page_id: "gone" }];
    // the screen sends what the person had, the stale tie included, plus the new tick
    expect(await setStaffPages("s1", ["p1", "gone", "p2"])).toEqual({ ok: true });
    expect(db.pages).toEqual([{ agent_id: "s1", page_id: "p1" }, { agent_id: "s1", page_id: "p2" }]);
  });

  it("leaves the owner's row alone, and refuses someone not on the team", async () => {
    expect(await setStaffPages("owner1", ["p1"])).toMatchObject({ ok: false });
    expect(await setStaffPages("nobody", ["p1"])).toMatchObject({ ok: false });
  });

  it("is the owner's alone", async () => {
    viewer.requireStaff.mockRejectedValueOnce(new Error("ไม่มีสิทธิ์ใช้ส่วนนี้"));
    await expect(setStaffPages("s1", ["p1"])).rejects.toThrow();
  });
});
