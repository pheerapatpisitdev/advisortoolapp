import { beforeEach, describe, expect, it, vi } from "vitest";

/** campaignResults: owner only, the Page must be the owner's, and only that Page's sent ads are read. */

process.env.ADMIN_SESSION_SECRET = "test-secret";
process.env.FB_APP_ID = "1";
process.env.FB_APP_SECRET = "s";

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
const camps = vi.hoisted(() => ({ listCampaigns: vi.fn() }));
vi.mock("@/lib/ads/campaign-store", () => camps);
const sends = vi.hoisted(() => ({ listSends: vi.fn() }));
vi.mock("@/lib/ads/send-store", () => sends);
const synced = vi.hoisted(() => ({ adAccounts: vi.fn() }));
vi.mock("@/lib/facebook/ads-connection", () => synced);
const manage = vi.hoisted(() => ({ adManageAccounts: vi.fn() }));
vi.mock("@/lib/facebook/ads-manage-connection", () => manage);

type Call = { table: string; ids: string[]; gte: [string, string] | null; range: [number, number] | null };
const db = vi.hoisted(() => ({ calls: [] as Call[], rows: [] as Record<string, unknown>[], fail: false, pages: null as null | ((c: Call) => Record<string, unknown>[]) }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const c: Call = { table, ids: [], gte: null, range: null };
      const b: Record<string, unknown> = {
        select: () => b,
        in: (_col: string, v: string[]) => { c.ids = v; return b; },
        gte: (col: string, v: string) => { c.gte = [col, v]; return b; },
        order: () => b,
        range: (a: number, z: number) => { c.range = [a, z]; return b; },
        then: (resolve: (v: unknown) => unknown) => {
          db.calls.push(c);
          return resolve(db.fail ? { data: null, error: { message: "boom: secret detail" } } : db.pages ? { data: db.pages(c), error: null } : { data: db.rows.filter((r) => c.ids.includes(r.ad_id as string)), error: null });
        },
      };
      return b;
    },
  }),
}));

const { campaignResults } = await import("@/app/studio/ads/actions");

const r = (ad_id: string, spend: number | string, fetched_at = "2026-10-05T01:00:00Z") => ({
  ad_id, date: "2026-10-04", spend, impressions: 100, link_clicks: 4, clicks: 8, messaging_started: 2, fetched_at,
});
const item = (pieceId: string | null, adId: string | null) => ({ id: `i-${pieceId}-${adId}`, sendId: "S", pieceId, imageHash: null, creativeId: null, adId, error: null });

beforeEach(() => {
  vi.clearAllMocks();
  who.owner = true;
  db.calls.length = 0;
  db.fail = false;
  db.pages = null;
  db.rows = [r("A1", "10.5"), r("A2", 5, "2026-10-05T03:00:00Z"), r("B1", 1), r("OLD1", 20)];
  pages.myPages.mockResolvedValue([{ pageId: "P1", pageName: "x" }]);
  synced.adAccounts.mockResolvedValue([{ id: "act_1", name: "บัญชีดึงผล" }]);
  manage.adManageAccounts.mockResolvedValue([{ id: "act_1", name: "บัญชี 1" }, { id: "act_2", name: "บัญชีสตูดิโอ" }]);
  camps.listCampaigns.mockResolvedValue([{ id: "C1" }, { id: "C2" }]);
  sends.listSends.mockImplementation(async (id: string, opts?: { includeSuperseded?: boolean }) =>
    id === "C1"
      ? [
          { id: "S1", actId: "act_1", items: [item("p1", "A1"), item("p2", "A2"), item("p3", null)] },
          { id: "S2", actId: "act_1", items: [item("p1", "B1")] },
          ...(opts?.includeSuperseded ? [{ id: "S3", actId: "act_1", items: [item("p2", "OLD1")] }] : []),
        ]
      : [],
  );
});

describe("campaignResults", () => {
  it("sums by campaign and by piece across sends, and gives the newest fetch time", async () => {
    const res = await campaignResults("P1", 7);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.byCampaign.C1).toEqual({ spend: 36.5, impressions: 400, clicks: 16, messaging: 8 });
    expect(res.byCampaign.C2).toBeUndefined();
    expect(res.byPiece.p1.spend).toBe(11.5);
    expect(res.byPiece.p2.spend).toBe(25); // a superseded send's ad spend counts
    expect(res.byPiece.p3).toBeUndefined();
    expect(res.fetchedAt).toBe("2026-10-05T03:00:00Z");
    expect(res.unsynced).toEqual([]);
  });
  it("names an account the sends used that the nightly read does not cover", async () => {
    camps.listCampaigns.mockResolvedValue([{ id: "C1" }]);
    sends.listSends.mockResolvedValue([
      { id: "S1", actId: "act_1", items: [item("p1", "A1")] },
      { id: "S2", actId: "act_2", items: [item("p2", "A2")] },
      // a send that made no ad is no reason to warn
      { id: "S3", actId: "act_3", items: [item("p3", null)] },
    ]);
    const res = await campaignResults("P1", 7);
    expect(res.ok && res.unsynced).toEqual([{ actId: "act_2", name: "บัญชีสตูดิโอ" }]);
  });
  it("warns of no account when the synced list cannot be read, and still gives the figures", async () => {
    synced.adAccounts.mockRejectedValue(new Error("boom"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await campaignResults("P1", 7);
    err.mockRestore();
    expect(res.ok && res.unsynced).toEqual([]);
    expect(res.ok && res.byCampaign.C1.spend).toBe(36.5);
  });
  it("cleans the days the browser sent: anything but 30 is 7", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T20:00:00Z"));
    try { await campaignResults("P1", 9999 as unknown as 7); } finally { vi.useRealTimers(); }
    expect(db.calls[0].gte).toEqual(["date", "2026-09-30"]);
  });
  it("asks only for the window's days and the Page's ad ids", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T20:00:00Z"));
    try { await campaignResults("P1", 30); } finally { vi.useRealTimers(); }
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].table).toBe("ins_ad_daily");
    expect(db.calls[0].ids.sort()).toEqual(["A1", "A2", "B1", "OLD1"]);
    // 2026-10-05 20:00 UTC is already 06 Oct in Bangkok: 30 days = 06 Oct and the 29 before
    expect(db.calls[0].gte).toEqual(["date", "2026-09-07"]);
  });
  it("7 days is today and the 6 before, by the Thai date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T20:00:00Z"));
    try { await campaignResults("P1", 7); } finally { vi.useRealTimers(); }
    expect(db.calls[0].gte).toEqual(["date", "2026-09-30"]);
  });
  it("reads 100 ad ids at a time", async () => {
    sends.listSends.mockResolvedValue([{ id: "S", actId: "act_1", items: Array.from({ length: 250 }, (_, i) => item(`p${i}`, `AD${i}`)) }]);
    camps.listCampaigns.mockResolvedValue([{ id: "C1" }]);
    await campaignResults("P1", 7);
    expect(db.calls.map((c) => c.ids.length)).toEqual([100, 100, 50]);
  });
  it("has no fetch time and reads nothing when nothing was sent", async () => {
    sends.listSends.mockResolvedValue([]);
    const res = await campaignResults("P1", 7);
    expect(res).toEqual({ ok: true, byCampaign: {}, byPiece: {}, fetchedAt: null, unsynced: [] });
    expect(db.calls).toHaveLength(0);
  });
  it("refuses a Page that is not the owner's", async () => {
    const res = await campaignResults("OTHER", 7);
    expect(res.ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
  it("is owner only", async () => {
    who.owner = false;
    await expect(campaignResults("P1", 7)).rejects.toThrow();
  });
  it("says so, in Thai, when the read breaks", async () => {
    db.fail = true;
    const res = await campaignResults("P1", 7);
    expect(res).toEqual({ ok: false, error: "ทำรายการไม่สำเร็จ ลองอีกครั้ง ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ" });
    expect(JSON.stringify(res)).not.toContain("secret detail");
  });
  it("pages past 1000 rows and counts every page", async () => {
    sends.listSends.mockResolvedValue([{ id: "S", actId: "act_1", items: [item("p1", "A1")] }]);
    camps.listCampaigns.mockResolvedValue([{ id: "C1" }]);
    db.pages = (c) => (c.range![0] === 0 ? Array.from({ length: 1000 }, () => r("A1", 1)) : [r("A1", 1), r("A1", 1)]);
    const res = await campaignResults("P1", 30);
    expect(db.calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]]);
    expect(res.ok && res.byCampaign.C1.spend).toBe(1002);
  });
});
