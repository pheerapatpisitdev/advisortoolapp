import { describe, expect, it } from "vitest";
import type { AdRun } from "@/lib/ads/run-store";
import { boardRows, boardStatus, boardTotals, STATUS_LABEL, type BoardDaily } from "@/lib/ads/board";

/** ผลแอด: one row per ad of the Page, Studio runs and Ads Manager's alike (spec 2026-10-07). */

const now = new Date("2026-10-07T00:00:00Z");
const run = (over: Partial<AdRun> = {}): AdRun => ({
  id: "R1", createdAt: "2026-10-01T00:00:00Z", pageId: "105", actId: "act_1", contentId: "C1", path: "boost",
  storyId: "105_77", dailyBudgetMinor: 20000, endAt: "2026-10-10T00:00:00Z", metaCampaignId: "900",
  adsetId: "AS1", imageHash: null, creativeId: "K1", adId: "A1", step: "ad", error: null, pausedAt: null, createdBy: "U1",
  ...over,
});
const day = (ad_id: string, spend: number, chats: number, over: Partial<BoardDaily> = {}): BoardDaily => ({
  ad_id, ad_name: `ad ${ad_id}`, campaign_name: "มรดก", account_id: "act_1", spend, messaging_started: chats, ...over,
});
const posts = new Map([["C1", { title: "เบี้ยวันละ 25", poster: null }]]);

describe("boardStatus", () => {
  it("reads Meta's status, and an ended run as ended", () => {
    expect(boardStatus("ACTIVE", null, now)).toBe("running");
    expect(boardStatus("ACTIVE", run({ endAt: "2026-10-06T00:00:00Z" }), now)).toBe("ended");
    expect(boardStatus("PENDING_REVIEW", null, now)).toBe("review");
    expect(boardStatus("IN_PROCESS", null, now)).toBe("review");
    expect(boardStatus("DISAPPROVED", null, now)).toBe("rejected");
    expect(boardStatus("WITH_ISSUES", null, now)).toBe("rejected");
    expect(boardStatus("PAUSED", null, now)).toBe("paused");
    expect(boardStatus("ADSET_PAUSED", null, now)).toBe("paused");
    expect(boardStatus("CAMPAIGN_PAUSED", null, now)).toBe("paused");
    expect(boardStatus(null, null, now)).toBe("unknown");
    expect(STATUS_LABEL).toEqual({ running: "รัน", paused: "หยุด", review: "รอตรวจ", rejected: "ไม่ผ่าน", ended: "จบแล้ว", unknown: "—" });
  });
});

describe("boardRows", () => {
  const statuses = new Map([["A1", "ACTIVE"], ["X1", "ACTIVE"], ["X2", "PAUSED"]]);

  it("sums an ad's days into one row and names a run's ad after its post", () => {
    const rows = boardRows({ daily: [day("A1", 100, 2), day("A1", 50, 1)], runs: [run()], posts, statuses, baseline: 50, now });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ adId: "A1", actId: "act_1", title: "เบี้ยวันละ 25", contentId: "C1", spend: 150, chats: 3, costPerChat: 50, status: "running" });
    expect(rows[0].run?.id).toBe("R1");
  });

  it("shows a run whose ad has no figures yet", () => {
    const rows = boardRows({ daily: [], runs: [run()], posts, statuses, baseline: 50, now });
    expect(rows[0]).toMatchObject({ adId: "A1", title: "เบี้ยวันละ 25", spend: 0, chats: 0, costPerChat: null });
  });

  it("names other ads by their ad or campaign name, with no run", () => {
    const rows = boardRows({ daily: [day("X1", 10, 0), day("X3", 5, 0, { ad_name: null })], runs: [], posts, statuses, baseline: 50, now });
    expect(rows.find((r) => r.adId === "X1")).toMatchObject({ title: "ad X1", run: null, contentId: null, campaignName: "มรดก" });
    expect(rows.find((r) => r.adId === "X3")!.title).toBe("มรดก");
  });

  it("suggests only for running ads", () => {
    const rows = boardRows({ daily: [day("X1", 100, 0), day("X2", 100, 0)], runs: [], posts, statuses, baseline: 50, now });
    expect(rows.find((r) => r.adId === "X1")!.advice?.kind).toBe("stop");
    expect(rows.find((r) => r.adId === "X2")!.advice).toBeNull();
  });

  it("puts running ads first, then the rest, each by spend", () => {
    const rows = boardRows({
      daily: [day("X2", 900, 0), day("X1", 10, 0), day("A1", 300, 5)],
      runs: [run()], posts, statuses, baseline: 50, now,
    });
    expect(rows.map((r) => r.adId)).toEqual(["A1", "X1", "X2"]);
  });

  it("leaves out a run with no ad made", () => {
    expect(boardRows({ daily: [], runs: [run({ adId: null })], posts, statuses, baseline: 50, now })).toEqual([]);
  });
});

describe("boardTotals", () => {
  it("sums spend and chats", () => {
    const rows = boardRows({ daily: [day("A1", 100, 2), day("X1", 50, 1)], runs: [run()], posts, statuses: new Map(), baseline: 50, now });
    expect(boardTotals(rows)).toEqual({ spend: 150, chats: 3, costPerChat: 50 });
    expect(boardTotals([])).toEqual({ spend: 0, chats: 0, costPerChat: null });
  });
});
