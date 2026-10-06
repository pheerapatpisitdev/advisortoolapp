import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ads Studio's doors (spec 2026-10-07): owner only; the Page and the account must be the owner's;
 * a post goes only from its own Page and never twice while it runs; a Meta read that fails is a
 * missing label, not a missing board.
 */

process.env.ADMIN_SESSION_SECRET = "test-secret";

const who = vi.hoisted(() => ({ owner: true }));
vi.mock("@/lib/auth/viewer", async () => {
  const { asOwner, OWNER } = await import("../helpers/signed-in");
  return {
    ...asOwner,
    requireStaff: async () => {
      if (!who.owner) throw new Error("ไม่มีสิทธิ์ใช้ส่วนนี้");
      return OWNER;
    },
    audit: vi.fn(async () => {}),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const pages = vi.hoisted(() => ({ myPages: vi.fn() }));
vi.mock("@/lib/auth/pages", () => pages);
const manage = vi.hoisted(() => ({ adManageAccounts: vi.fn(), adManageToken: vi.fn() }));
vi.mock("@/lib/facebook/ads-manage-connection", () => manage);
const read = vi.hoisted(() => ({ adAccountToken: vi.fn() }));
vi.mock("@/lib/facebook/ads-connection", () => read);
const engine = vi.hoisted(() => ({ runPosts: vi.fn(), resumeRun: vi.fn() }));
vi.mock("@/lib/ads/run", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/run")>()), ...engine }));
const runStore = vi.hoisted(() => ({ listRuns: vi.fn(), getRun: vi.fn() }));
vi.mock("@/lib/ads/run-store", () => runStore);
vi.mock("@/lib/content/poster-draw", () => ({ drawPoster: vi.fn(async () => Buffer.from("png")) }));
vi.mock("@/lib/ads/sync", () => ({ syncAds: vi.fn() }));
vi.mock("@/app/studio/ads/connection", () => ({ connection: vi.fn() }));

/** the tables, filtered by eq / neq / in / gte as PostgREST would */
const db = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]> }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const tests: ((r: Record<string, unknown>) => boolean)[] = [];
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (c: string, v: unknown) => { tests.push((r) => r[c] === v); return b; },
        neq: (c: string, v: unknown) => { tests.push((r) => r[c] !== v); return b; },
        in: (c: string, v: unknown[]) => { tests.push((r) => v.includes(r[c])); return b; },
        gte: (c: string, v: string) => { tests.push((r) => String(r[c]) >= v); return b; },
        order: () => b,
        range: () => b,
        limit: () => b,
        then: (resolve: (v: unknown) => unknown) =>
          resolve({ data: (db.tables[table] ?? []).filter((r) => tests.every((t) => t(r))), error: null }),
      };
      return b;
    },
  }),
}));

const { boardAction, postsForAds, runPostsAction } = await import("@/app/studio/ads/run-actions");

const NOW = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const output = { hooks: ["มรดก 10 ล้าน"], body: "b", closing: "c", hashtags: [], imagePrompt: "", disclaimer: "", poster: { headline: "x" } };
const content = (id: string, over: Record<string, unknown> = {}) => ({
  id, created_at: iso(NOW - 86_400_000), plan_href: "/lifeprotect", format: "post", angle: null, length: null, output,
  flags: {}, model: null, cost_thb: 0, status: "used", hook_template_id: null, fb_page_id: "105", fb_post_id: "105_77",
  publish_state: "published", publish_at: iso(NOW - 86_400_000), publish_error: null, page_id: "105", plan_day: null,
  planned_done_at: null, campaign_id: null, agent_id: null, ...over,
});
const run = (over: Record<string, unknown> = {}) => ({
  id: "R1", createdAt: iso(NOW), pageId: "105", actId: "act_1", contentId: "C1", path: "boost", storyId: "105_77",
  dailyBudgetMinor: 20000, endAt: iso(NOW + 3 * 86_400_000), metaCampaignId: "900", adsetId: "AS1", imageHash: null,
  creativeId: "K1", adId: "A1", step: "ad", error: null, pausedAt: null, createdBy: "U1", ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  who.owner = true;
  pages.myPages.mockResolvedValue([{ pageId: "105", pageName: "LuckyPlanner" }]);
  manage.adManageAccounts.mockResolvedValue([{ id: "act_1", name: "Lucky", currency: "THB", connectedAt: "" }]);
  manage.adManageToken.mockResolvedValue("TOKEN");
  read.adAccountToken.mockResolvedValue(null);
  runStore.listRuns.mockResolvedValue([]);
  engine.runPosts.mockImplementation(async (input: { posts: { contentId: string }[] }) => ({
    ok: true, outcomes: input.posts.map((p) => ({ contentId: p.contentId, runId: "R9", ok: true, path: "boost", note: null, error: null })),
  }));
  db.tables = {
    ins_content: [content("C1"), content("C2", { fb_post_id: "105_78" }), content("C3", { page_id: "999" })],
    ins_ad_daily: [],
  };
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
});

describe("runPostsAction", () => {
  const ask = (contentIds: string[], over = {}) =>
    runPostsAction({ pageId: "105", actId: "act_1", contentIds, dailyBudgetBaht: 200, days: 7, ...over });

  it("is the owner's alone", async () => {
    who.owner = false;
    await expect(ask(["C1"])).rejects.toThrow("ไม่มีสิทธิ์");
  });

  it("refuses an account not connected for making ads", async () => {
    expect(await ask(["C1"], { actId: "act_2" })).toEqual({ ok: false, error: "บัญชีโฆษณานี้ยังไม่ได้เชื่อมสำหรับสร้างแอด" });
    expect(engine.runPosts).not.toHaveBeenCalled();
  });

  it("leaves out a post of another Page, and runs the rest", async () => {
    const out = await ask(["C1", "C3"]);
    expect(out).toMatchObject({ ok: true });
    if (!out.ok) return;
    expect(out.outcomes.find((o) => o.contentId === "C3")).toMatchObject({ ok: false, runId: null, error: "โพสต์นี้ไม่ได้อยู่ในเพจนี้" });
    const sent = engine.runPosts.mock.calls[0][0];
    expect(sent.posts.map((p: { contentId: string }) => p.contentId)).toEqual(["C1"]);
    expect(sent).toMatchObject({ pageId: "105", pageName: "LuckyPlanner", actId: "act_1", currency: "THB", dailyBudgetBaht: 200, days: 7 });
    expect(sent.posts[0]).toMatchObject({ path: { kind: "boost", postId: "105_77" }, headline: "มรดก 10 ล้าน" });
  });

  it("will not run a post again while it is running", async () => {
    runStore.listRuns.mockResolvedValue([run()]);
    const out = await ask(["C1", "C2"]);
    if (!out.ok) throw new Error("refused");
    expect(out.outcomes.find((o) => o.contentId === "C1")).toMatchObject({ ok: false, error: "โพสต์นี้กำลังรันอยู่ — เพิ่มงบหรือยืดเวลาในแท็บผลแอด" });
    expect(engine.runPosts.mock.calls[0][0].posts.map((p: { contentId: string }) => p.contentId)).toEqual(["C2"]);
  });

  it("will not run a post that has a stuck run, pointing at ลองใหม่ / เลิก", async () => {
    runStore.listRuns.mockResolvedValue([run({ adId: null, error: "Facebook ไม่รับ — x" })]);
    const out = await ask(["C1"]);
    expect(out).toMatchObject({ ok: true, outcomes: [{ contentId: "C1", ok: false, error: "โพสต์นี้มีรายการค้างอยู่ — กดลองใหม่หรือเลิกในแท็บผลแอดก่อน" }] });
    expect(engine.runPosts).not.toHaveBeenCalled();
  });

  it("runs a post again once its stuck run was dropped", async () => {
    runStore.listRuns.mockResolvedValue([run({ adId: null, pausedAt: iso(NOW), error: "เลิกแล้ว" })]);
    await ask(["C1"]);
    expect(engine.runPosts).toHaveBeenCalledTimes(1);
  });

  it("does not call the engine when nothing is left to run", async () => {
    const out = await ask(["C3"]);
    expect(out).toMatchObject({ ok: true, outcomes: [{ contentId: "C3", ok: false }] });
    expect(engine.runPosts).not.toHaveBeenCalled();
  });
});

describe("postsForAds", () => {
  it("lists the Page's posts only, not binned ones or scripts, and marks one running", async () => {
    db.tables.ins_content.push(content("C4", { status: "trashed" }), content("C5", { format: "script" }));
    runStore.listRuns.mockResolvedValue([run({ contentId: "C2", adId: "A2" })]);
    const out = await postsForAds("105");
    if (!out.ok) throw new Error(out.error);
    expect(out.posts.map((p) => p.id).sort()).toEqual(["C1", "C2"]);
    expect(out.posts.find((p) => p.id === "C2")).toMatchObject({ live: true, path: { kind: "boost" } });
    expect(out.posts.find((p) => p.id === "C1")).toMatchObject({ live: false, stuck: false, title: "มรดก 10 ล้าน", lastCostPerChat: null });
  });

  it("marks a post whose run is stuck", async () => {
    runStore.listRuns.mockResolvedValue([run({ adId: null })]);
    const out = await postsForAds("105");
    if (!out.ok) throw new Error(out.error);
    expect(out.posts.find((p) => p.id === "C1")).toMatchObject({ stuck: true, live: false });
  });

  it("refuses a Page that is not the owner's", async () => {
    expect(await postsForAds("999")).toEqual({ ok: false, error: "เพจนี้ยังไม่ได้เชื่อมกับระบบ" });
  });
});

describe("boardAction", () => {
  it("still answers when Meta's statuses cannot be read", async () => {
    runStore.listRuns.mockResolvedValue([run()]);
    db.tables.ins_ad_daily = [
      { ad_id: "A1", ad_name: "x", campaign_name: "AdvisorTool", account_id: "act_1", spend: 120, messaging_started: 4, date: iso(NOW).slice(0, 10), page_id: "105", fetched_at: iso(NOW) },
    ];
    const out = await boardAction("105", 7);
    if (!out.ok) throw new Error(out.error);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ adId: "A1", title: "มรดก 10 ล้าน", status: "unknown", spend: 120, chats: 4 });
    expect(out.baseline).toBe(30);
    expect(out.controllable).toEqual(["A1"]);
    expect(out.stuck).toEqual([]);
  });

  it("lists stuck runs with their post, so they can be retried or dropped", async () => {
    runStore.listRuns.mockResolvedValue([run({ id: "R2", adId: null, error: "ไม่รู้ว่าขั้นนี้สำเร็จหรือไม่" }), run({ id: "R3", adId: null, pausedAt: iso(NOW) })]);
    const out = await boardAction("105", 7);
    if (!out.ok) throw new Error(out.error);
    expect(out.stuck).toEqual([{ runId: "R2", contentId: "C1", title: "มรดก 10 ล้าน", poster: output.poster, error: "ไม่รู้ว่าขั้นนี้สำเร็จหรือไม่", createdAt: iso(NOW) }]);
  });
});
