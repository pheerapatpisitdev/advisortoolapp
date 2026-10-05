import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONTENT_PRODUCTS } from "@/lib/content/products";

/** campaignRows: owner only, the Page must be the owner's; counts as the room counts, live sends only, accounts named. */

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
const camps = vi.hoisted(() => ({ listCampaigns: vi.fn(), listCampaignPieces: vi.fn() }));
vi.mock("@/lib/ads/campaign-store", () => camps);
const sends = vi.hoisted(() => ({ listSends: vi.fn() }));
vi.mock("@/lib/ads/send-store", () => sends);
const conn = vi.hoisted(() => ({ adManageAccounts: vi.fn() }));
vi.mock("@/lib/facebook/ads-manage-connection", () => conn);
const launches = vi.hoisted(() => ({ findLaunch: vi.fn() }));
vi.mock("@/lib/ads/launch-store", () => launches);

const { campaignRows } = await import("@/app/studio/ads/actions");

const plan = CONTENT_PRODUCTS[0];
const piece = (id: string, status = "draft") => ({ id, status, output: {} });
const item = (pieceId: string | null, adId: string | null) => ({ id: `i-${pieceId}-${adId}`, sendId: "S", pieceId, adId, error: null });
const sendRow = (id: string, actId: string, items: ReturnType<typeof item>[], on: boolean) => ({
  id, actId, dailyBudgetMinor: 15000, metaCampaignId: on ? "MC" : null, adsetId: on ? "AS" : null, activatedAt: on ? "2026-10-04T01:00:00Z" : null, pausedAt: null, items,
});

beforeEach(() => {
  vi.clearAllMocks();
  who.owner = true;
  pages.myPages.mockResolvedValue([{ pageId: "P1", pageName: "เพจ" }]);
  conn.adManageAccounts.mockResolvedValue([{ id: "act_1", name: "บัญชี A", currency: "THB" }]);
  camps.listCampaigns.mockResolvedValue([
    { id: "C1", name: null, planHref: plan.href },
    { id: "C2", name: "ของฉัน", planHref: "/no-such-plan" },
  ]);
  camps.listCampaignPieces.mockImplementation(async (id: string) =>
    id === "C1" ? [piece("p1"), piece("p2"), piece("p3"), piece("p4", "trashed"), piece("old")] : []);
  sends.listSends.mockImplementation(async (id: string) =>
    id === "C1"
      ? [sendRow("S2", "act_9", [item("p2", null)], false), sendRow("S1", "act_1", [item("p1", "A1"), item(null, "A0")], true)]
      : []);
  // a piece sent before batch sends, through a launch of its own
  launches.findLaunch.mockImplementation(async (pieceId: string) => (pieceId === "old" ? { id: "L", createdAt: "2026-01-01" } : null));
});

describe("campaignRows", () => {
  it("names, counts, and the live sends with their accounts", async () => {
    const res = await campaignRows("P1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toEqual([
      {
        id: "C1", name: plan.name, planName: plan.name, drafts: 1, sent: 3, liveLaunches: 0,
        sends: [
          { id: "S2", activatedAt: null, pausedAt: null, dailyBudgetMinor: 15000, accountName: "act_9", ads: 0, hasMetaCampaign: false, hasAdset: false },
          { id: "S1", activatedAt: "2026-10-04T01:00:00Z", pausedAt: null, dailyBudgetMinor: 15000, accountName: "บัญชี A (act_1)", ads: 2, hasMetaCampaign: true, hasAdset: true },
        ],
      },
      { id: "C2", name: "ของฉัน", planName: "/no-such-plan", drafts: 0, sent: 0, sends: [], liveLaunches: 0 },
    ]);
    // superseded sends are not asked for: they do not switch or spend a budget now
    for (const call of sends.listSends.mock.calls) expect(call[1]?.includeSuperseded).toBeFalsy();
  });

  it("counts a pre-send launch that was switched on, for the delete question", async () => {
    launches.findLaunch.mockImplementation(async (pieceId: string) =>
      (pieceId === "old" ? { id: "L", createdAt: "2026-01-01", activatedAt: "2026-01-02T00:00:00Z" } : pieceId === "p3" ? { id: "L3", createdAt: "2026-01-01", activatedAt: null } : null));
    const res = await campaignRows("P1");
    expect(res.ok && res.rows[0].liveLaunches).toBe(1);
  });

  it("refuses a Page that is not the owner's", async () => {
    expect(await campaignRows("P2")).toEqual({ ok: false, error: "เพจนี้ยังไม่ได้เชื่อมกับระบบ" });
    expect(camps.listCampaigns).not.toHaveBeenCalled();
  });

  it("refuses anyone but the owner", async () => {
    who.owner = false;
    await expect(campaignRows("P1")).rejects.toThrow();
  });

  it("one campaign that cannot be read is a row saying so; the others still come", async () => {
    sends.listSends.mockImplementation(async (id: string) => { if (id === "C1") throw new Error("boom"); return []; });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await campaignRows("P1");
    err.mockRestore();
    expect(res.ok && res.rows).toEqual([
      { id: "C1", name: plan.name, planName: plan.name, drafts: 0, sent: 0, sends: [], liveLaunches: 0, unreadable: true },
      { id: "C2", name: "ของฉัน", planName: "/no-such-plan", drafts: 0, sent: 0, sends: [], liveLaunches: 0 },
    ]);
  });

  it("marks an English campaign — iHealthy Ultra on an Expat Page (spec 2026-10-06) — and no Thai one", async () => {
    const EXPAT = "112110731809903";
    pages.myPages.mockResolvedValue([{ pageId: EXPAT, pageName: "Expat" }]);
    camps.listCampaigns.mockResolvedValue([
      { id: "C1", name: null, planHref: "/ihealthy-ultra", pageId: EXPAT },
      { id: "C2", name: null, planHref: "/lifeprotect", pageId: EXPAT },
    ]);
    const res = await campaignRows(EXPAT);
    expect(res.ok && res.rows.map((r) => r.lang)).toEqual(["en", undefined]);
    expect(res.ok && "lang" in res.rows[1]).toBe(false);
  });

  it("says something broke without the detail", async () => {
    camps.listCampaigns.mockRejectedValue(new Error("boom: secret detail"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await campaignRows("P1");
    expect(res.ok).toBe(false);
    expect(JSON.stringify(res)).not.toContain("secret");
    err.mockRestore();
  });
});
