import { beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FLAGS } from "@/lib/content/clip";

// publish-flow is imported for its 48-hour window; its other imports are not needed here
vi.mock("@/app/studio/actions", () => ({ setContentStatus: vi.fn() }));
// a posted Reel is asked about before its file goes; nothing here reaches Facebook
const fb = vi.hoisted(() => ({ reelState: vi.fn(), pageToken: vi.fn() }));
vi.mock("@/lib/facebook/publish", async (orig) => ({ ...(await orig<object>()), reelState: fb.reelState }));
vi.mock("@/lib/facebook/connection", () => ({ pageToken: fb.pageToken }));

const { sweepPlan } = await import("@/lib/content/clip-sweep");
type SweepFile = import("@/lib/content/clip-sweep").SweepFile;
type SweepRow = import("@/lib/content/clip-sweep").SweepRow;

const now = new Date("2026-12-31T00:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const file = (piece: string, name: string, h = 30): SweepFile => ({ piece, name, createdAt: ago(h) });
const row = (id: string, name: string, over: Partial<SweepRow> = {}, uploadedH = 30): SweepRow => ({
  id, rev: "r", state: null, at: null,
  video: { path: `${id}/${name}`, durationSec: 5, width: 1, height: 2, sizeBytes: 1, mime: "video/mp4", uploadedAt: ago(uploadedH), caption: "", flags: NO_FLAGS },
  ...over,
});

describe("sweepPlan", () => {
  it("removes a file whose piece is gone, and a file no piece points at, once a day old", () => {
    const rows = new Map([["a", row("a", "keep.mp4")]]);
    const plan = sweepPlan([file("gone", "x.mp4"), file("a", "old.mp4"), file("a", "keep.mp4"), file("a", "fresh.mp4", 2)], rows, now);
    expect(plan.remove.sort()).toEqual(["a/old.mp4", "gone/x.mp4"]);
    expect(plan.expire).toEqual([]);
  });

  it("lets a posted clip's file go 48 hours after it went up", () => {
    const rows = new Map([
      ["a", row("a", "v.mp4", { state: "published", at: ago(49) })],
      ["b", row("b", "v.mp4", { state: "published", at: ago(10) })],
    ]);
    const plan = sweepPlan([file("a", "v.mp4"), file("b", "v.mp4")], rows, now);
    expect(plan.remove).toEqual(["a/v.mp4"]);
    expect(plan.expire).toEqual(["a"]);
  });

  it("lets a never-scheduled clip's file go after 60 days", () => {
    const rows = new Map([
      ["a", row("a", "v.mp4", {}, 24 * 61)],
      ["b", row("b", "v.mp4", { state: "failed" }, 24 * 61)],
      ["c", row("c", "v.mp4", {}, 24 * 59)],
    ]);
    const plan = sweepPlan([file("a", "v.mp4"), file("b", "v.mp4"), file("c", "v.mp4")], rows, now);
    expect(plan.remove.sort()).toEqual(["a/v.mp4", "b/v.mp4"]);
    expect(plan.expire.sort()).toEqual(["a", "b"]);
  });

  it("never touches a held clip, however old", () => {
    const rows = new Map([
      ["a", row("a", "v.mp4", { state: "scheduled", at: ago(-24) }, 24 * 90)],
      ["b", row("b", "v.mp4", { state: "posting", at: ago(1) }, 24 * 90)],
    ]);
    expect(sweepPlan([file("a", "v.mp4"), file("b", "v.mp4")], rows, now)).toEqual({ remove: [], expire: [] });
  });

  it("does not expire a clip already expired", () => {
    const r = row("a", "v.mp4", {}, 24 * 61);
    r.video!.expired = true;
    expect(sweepPlan([file("a", "v.mp4")], new Map([["a", r]]), now)).toEqual({ remove: ["a/v.mp4"], expire: [] });
  });

  it("keeps a clip's preview and edited take while the clip is kept, and lets them go with it", () => {
    const withEdit = (r: SweepRow): SweepRow => ({ ...r, video: { ...r.video!, edit: { proxyPath: `${r.id}/p.mp4`, renderedPath: `${r.id}/e.mp4`, cut: [], trimSilence: true, subs: [], hook: { main: "" }, style: "box", rev: "x" } } });
    const live = new Map([["a", withEdit(row("a", "v.mp4"))]]);
    expect(sweepPlan([file("a", "v.mp4"), file("a", "p.mp4"), file("a", "e.mp4"), file("a", "old.png")], live, now).remove).toEqual(["a/old.png"]);
    const idle = new Map([["a", withEdit(row("a", "v.mp4", {}, 24 * 61))]]);
    expect(sweepPlan([file("a", "v.mp4"), file("a", "p.mp4"), file("a", "e.mp4")], idle, now).remove.sort()).toEqual(["a/e.mp4", "a/p.mp4", "a/v.mp4"]);
  });
});

// ---- sweepClips against an in-memory bucket and table ----

const dbMock = vi.hoisted(() => ({ state: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => (dbMock.state as { client: unknown }).client }));

type Filter = [string, string, unknown];
function fake(opts: { folders: Record<string, { name: string; created_at: string }[]>; rows: Record<string, unknown>[]; matches?: boolean; readError?: boolean }) {
  const updates: { id: unknown; filters: Filter[]; patch: Record<string, unknown> }[] = [];
  const removed: string[] = [];
  const query = (kind: "select" | "update", patch?: Record<string, unknown>) => {
    const filters: Filter[] = [];
    const b: Record<string, unknown> = {};
    b.eq = (c: string, v: unknown) => { filters.push(["eq", c, v]); return b; };
    b.is = (c: string, v: unknown) => { filters.push(["is", c, v]); return b; };
    b.in = (_c: string, ids: string[]) => Promise.resolve(opts.readError
      ? { data: null, error: { message: "boom" } }
      : { data: opts.rows.filter((r) => ids.includes(r.id as string)), error: null });
    b.maybeSingle = () => Promise.resolve({ data: opts.rows.find((r) => r.id === filters.find((f) => f[1] === "id")?.[2]) ?? null, error: null });
    b.select = () => {
      if (kind === "update") {
        updates.push({ id: filters.find((f) => f[1] === "id")?.[2], filters, patch: patch! });
        return Promise.resolve({ data: opts.matches === false ? [] : [{ id: "x" }], error: null });
      }
      return b;
    };
    return b;
  };
  const client = {
    storage: { from: () => ({
      // a page at a time, as storage answers: at most `limit` (100 when not said) from `offset`
      list: async (dir: string, o: { limit?: number; offset?: number } = {}) => {
        const all = dir === "" ? Object.keys(opts.folders).map((name) => ({ name })) : opts.folders[dir] ?? [];
        const from = o.offset ?? 0;
        return { data: all.slice(from, from + (o.limit ?? 100)), error: null };
      },
      remove: async (paths: string[]) => { removed.push(...paths); return { error: null }; },
    }) },
    from: () => ({ select: () => query("select"), update: (p: Record<string, unknown>) => query("update", p) }),
  };
  dbMock.state = { client };
  return { updates, removed };
}

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const old = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const dbRow = (id: string, over: Record<string, unknown> = {}) => ({
  id, publish_state: "published", publish_at: old(60), fb_post_id: "vid1", fb_page_id: "105",
  output: { rev: "r1", video: { path: `${id}/v.mp4`, uploadedAt: old(100), expired: false } },
  ...over,
});

describe("sweepClips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fb.pageToken.mockResolvedValue("tok");
    fb.reelState.mockResolvedValue("published");
  });

  it("writes expiry only against the revision, clip and publish state the plan saw", async () => {
    const f = fake({ folders: { [U1]: [{ name: "v.mp4", created_at: old(100) }] }, rows: [dbRow(U1)] });
    const { sweepClips } = await import("@/lib/content/clip-sweep");
    expect(await sweepClips()).toEqual({ removed: 1, expired: 1 });
    const fl = f.updates[0].filters;
    expect(fl).toContainEqual(["eq", "output->>rev", "r1"]);
    expect(fl).toContainEqual(["eq", "output->video->>path", `${U1}/v.mp4`]);
    expect(fl).toContainEqual(["eq", "publish_state", "published"]);
    expect(fl.some((x) => x[1] === "publish_at")).toBe(true);
    expect(f.removed).toEqual([`${U1}/v.mp4`]);
  });

  it("uses is-null filters when the plan saw no revision or state", async () => {
    const f = fake({
      folders: { [U1]: [{ name: "v.mp4", created_at: old(100) }] },
      rows: [dbRow(U1, { publish_state: null, publish_at: null, output: { video: { path: `${U1}/v.mp4`, uploadedAt: old(24 * 61) } } })],
    });
    const { sweepClips } = await import("@/lib/content/clip-sweep");
    await sweepClips();
    expect(f.updates[0].filters).toContainEqual(["is", "output->>rev", null]);
    expect(f.updates[0].filters).toContainEqual(["is", "publish_state", null]);
  });

  it("holds back a piece's file when its update matched nothing, but still removes an orphan elsewhere", async () => {
    const f = fake({
      folders: { [U1]: [{ name: "v.mp4", created_at: old(100) }], [U2]: [{ name: "x.mp4", created_at: old(100) }] },
      rows: [dbRow(U1)], matches: false,
    });
    const { sweepClips } = await import("@/lib/content/clip-sweep");
    expect(await sweepClips()).toEqual({ removed: 1, expired: 0 });
    expect(f.removed).toEqual([`${U2}/x.mp4`]);
  });

  it("ignores a folder that is not a piece id and carries on", async () => {
    const f = fake({
      folders: { "not-a-uuid": [{ name: "a.mp4", created_at: old(500) }], [U2]: [{ name: "x.mp4", created_at: old(100) }] },
      rows: [],
    });
    const { sweepClips } = await import("@/lib/content/clip-sweep");
    expect(await sweepClips()).toEqual({ removed: 1, expired: 0 });
    expect(f.removed).toEqual([`${U2}/x.mp4`]);
  });

  it("removes nothing when the rows cannot be read", async () => {
    const f = fake({ folders: { [U2]: [{ name: "x.mp4", created_at: old(100) }] }, rows: [], readError: true });
    const { sweepClips } = await import("@/lib/content/clip-sweep");
    await expect(sweepClips()).rejects.toThrow("boom");
    expect(f.removed).toEqual([]);
    expect(f.updates).toEqual([]);
  });

  it("asks Facebook about a posted Reel first; published lets its file go", async () => {
    const f = fake({ folders: { [U1]: [{ name: "v.mp4", created_at: old(100) }] }, rows: [dbRow(U1)] });
    const { sweepClips } = await import("@/lib/content/clip-sweep");
    expect(await sweepClips()).toEqual({ removed: 1, expired: 1 });
    expect(fb.pageToken).toHaveBeenCalledWith("105");
    expect(fb.reelState).toHaveBeenCalledWith("vid1", "tok");
    expect(f.removed).toEqual([`${U1}/v.mp4`]);
  });

  it("a Reel Facebook failed: the row turns failed with its post id cleared, the file stays", async () => {
    fb.reelState.mockResolvedValue("failed");
    const f = fake({ folders: { [U1]: [{ name: "v.mp4", created_at: old(100) }] }, rows: [dbRow(U1)] });
    const { sweepClips } = await import("@/lib/content/clip-sweep");
    const { REEL_FAILED } = await import("@/lib/content/publish-flow");
    expect(await sweepClips()).toEqual({ removed: 0, expired: 0 });
    expect(f.removed).toEqual([]);
    expect(f.updates).toHaveLength(1);
    expect(f.updates[0].patch).toEqual({ publish_state: "failed", publish_error: REEL_FAILED, fb_post_id: null });
    expect(f.updates[0].id).toBe(U1);
    expect(f.updates[0].filters).toContainEqual(["eq", "publish_state", "published"]);
    expect(f.updates[0].filters.some((x) => x[1] === "publish_at")).toBe(true);
    expect(f.updates[0].filters).toContainEqual(["eq", "fb_post_id", "vid1"]);
  });

  it("a Reel Facebook cannot speak for yet is left alone until tomorrow", async () => {
    fb.reelState.mockResolvedValue("unknown");
    const f = fake({ folders: { [U1]: [{ name: "v.mp4", created_at: old(100) }] }, rows: [dbRow(U1)] });
    const { sweepClips } = await import("@/lib/content/clip-sweep");
    expect(await sweepClips()).toEqual({ removed: 0, expired: 0 });
    expect(f.removed).toEqual([]);
    expect(f.updates).toEqual([]);
  });

  it("a Graph error, or no token, leaves the Reel alone", async () => {
    fb.reelState.mockRejectedValue(new Error("graph down"));
    let f = fake({ folders: { [U1]: [{ name: "v.mp4", created_at: old(100) }] }, rows: [dbRow(U1)] });
    const { sweepClips } = await import("@/lib/content/clip-sweep");
    expect(await sweepClips()).toEqual({ removed: 0, expired: 0 });
    expect(f.removed).toEqual([]);
    expect(f.updates).toEqual([]);

    fb.reelState.mockResolvedValue("published");
    fb.pageToken.mockResolvedValue(null);
    f = fake({ folders: { [U1]: [{ name: "v.mp4", created_at: old(100) }] }, rows: [dbRow(U1, { fb_page_id: "106" })] });
    expect(await sweepClips()).toEqual({ removed: 0, expired: 0 });
    expect(fb.reelState).toHaveBeenCalledTimes(1);
    expect(f.removed).toEqual([]);
    expect(f.updates).toEqual([]);
  });

  it("reads a piece's folder to its end: a render's pictures past the first hundred go too (final review, 2026-10-02)", async () => {
    const pngs = Array.from({ length: 250 }, (_, i) => ({ name: `${String(i).padStart(3, "0")}.png`, created_at: old(30) }));
    const f = fake({
      folders: { [U1]: [{ name: "v.mp4", created_at: old(100) }, ...pngs] },
      rows: [dbRow(U1, { publish_state: null, publish_at: null, output: { rev: "r1", video: { path: `${U1}/v.mp4`, uploadedAt: old(1) } } })],
    });
    const { sweepClips } = await import("@/lib/content/clip-sweep");
    expect(await sweepClips()).toEqual({ removed: 250, expired: 0 });
    expect(f.removed.sort()).toEqual(pngs.map((p) => `${U1}/${p.name}`).sort());
    expect(f.removed).not.toContain(`${U1}/v.mp4`);
  });

  it("a draft clip past 60 days goes without asking Facebook", async () => {
    const f = fake({
      folders: { [U1]: [{ name: "v.mp4", created_at: old(100) }] },
      rows: [dbRow(U1, { publish_state: null, publish_at: null, fb_post_id: null, fb_page_id: null, output: { rev: "r1", video: { path: `${U1}/v.mp4`, uploadedAt: old(24 * 61) } } })],
    });
    const { sweepClips } = await import("@/lib/content/clip-sweep");
    expect(await sweepClips()).toEqual({ removed: 1, expired: 1 });
    expect(fb.reelState).not.toHaveBeenCalled();
    expect(f.removed).toEqual([`${U1}/v.mp4`]);
  });
});
