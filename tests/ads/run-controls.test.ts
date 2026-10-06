import { beforeEach, describe, expect, it } from "vitest";
import type { AdRun, RunPatch } from "@/lib/ads/run-store";
import { controlRun, extendedEnd, raisedBudgetMinor, setAdStatus } from "@/lib/ads/run-controls";

/** ผลแอด's buttons on a run's ad set, and หยุด / เปิดต่อ on any ad (spec 2026-10-07). */

interface Sent { method: string; path: string; params: URLSearchParams }
let sent: Sent[];
let reply: { status: number; body: unknown };
let run: AdRun;
const now = new Date("2026-10-07T00:00:00Z");

const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
  sent.push({
    method: init?.method ?? "GET",
    path: new URL(String(input)).pathname.replace("/v23.0/", ""),
    params: new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
  });
  return new Response(JSON.stringify(reply.body), { status: reply.status });
}) as typeof fetch;

const store = {
  getRun: async (id: string) => (id === run.id ? { ...run } : null),
  saveRun: async (_id: string, patch: RunPatch) => { run = { ...run, ...patch }; },
  claimRun: async () => true,
  releaseRun: async () => {},
} as unknown as typeof import("@/lib/ads/run-store");

const deps = (over = {}) => ({ store, token: async () => "TOKEN", fetchFn, now: () => now, capBaht: 500, ...over });

beforeEach(() => {
  sent = [];
  reply = { status: 200, body: { success: true } };
  run = {
    id: "R1", createdAt: "2026-10-01T00:00:00Z", pageId: "105", actId: "act_1", contentId: "C1", path: "boost",
    storyId: "105_77", dailyBudgetMinor: 20000, endAt: "2026-10-10T00:00:00.000Z", metaCampaignId: "900",
    adsetId: "555", imageHash: null, creativeId: "K1", adId: "A1", step: "ad", error: null, pausedAt: null, createdBy: "U1",
  };
});

describe("the arithmetic", () => {
  it("raises by half, to whole baht, never over the cap", () => {
    expect(raisedBudgetMinor(20000, 500)).toBe(30000);
    expect(raisedBudgetMinor(20100, 500)).toBe(30200);
    expect(raisedBudgetMinor(40000, 500)).toBe(50000);
  });
  it("extends by 7 days from the end, or from now once it has passed", () => {
    expect(extendedEnd("2026-10-10T00:00:00.000Z", now)).toBe("2026-10-17T00:00:00.000Z");
    expect(extendedEnd("2026-10-01T00:00:00.000Z", now)).toBe("2026-10-14T00:00:00.000Z");
  });
});

describe("controlRun", () => {
  it("pauses the ad set and remembers when", async () => {
    const out = await controlRun("R1", "pause", deps());
    expect(out.ok).toBe(true);
    expect(sent).toEqual([{ method: "POST", path: "555", params: new URLSearchParams({ status: "PAUSED" }) }]);
    expect(run.pausedAt).toBe(now.toISOString());
  });

  it("switches the ad set back on", async () => {
    run.pausedAt = "2026-10-05T00:00:00Z";
    expect((await controlRun("R1", "resume", deps())).ok).toBe(true);
    expect(sent[0].params.get("status")).toBe("ACTIVE");
    expect(run.pausedAt).toBeNull();
  });

  it("will not switch on a run that has ended", async () => {
    run.endAt = "2026-10-06T00:00:00.000Z";
    expect(await controlRun("R1", "resume", deps())).toEqual({ ok: false, error: "แอดนี้จบแล้ว กดยืดเวลาก่อน" });
    expect(sent).toHaveLength(0);
  });

  it("raises the daily budget, and refuses at the cap", async () => {
    expect((await controlRun("R1", "raise", deps())).ok).toBe(true);
    expect(sent[0].params.get("daily_budget")).toBe("30000");
    expect(run.dailyBudgetMinor).toBe(30000);
    sent = [];
    run.dailyBudgetMinor = 50000;
    expect(await controlRun("R1", "raise", deps())).toEqual({ ok: false, error: "งบถึงเพดานแล้ว" });
    expect(sent).toHaveLength(0);
  });

  it("extends the end by 7 days", async () => {
    expect((await controlRun("R1", "extend", deps())).ok).toBe(true);
    expect(sent[0].params.get("end_time")).toBe("2026-10-17T00:00:00.000Z");
    expect(run.endAt).toBe("2026-10-17T00:00:00.000Z");
  });

  it("refuses a run whose ad set was never made, and an answer without success", async () => {
    run.adsetId = null;
    expect(await controlRun("R1", "pause", deps())).toEqual({ ok: false, error: "ชุดโฆษณายังสร้างไม่เสร็จ" });
    run.adsetId = "555";
    reply = { status: 200, body: {} };
    expect(await controlRun("R1", "pause", deps())).toEqual({ ok: false, error: "Facebook ไม่ยืนยันการเปลี่ยนแปลง" });
    expect(run.pausedAt).toBeNull();
  });

  it("says Meta's reason when it refuses", async () => {
    reply = { status: 400, body: { error: { message: "nope" } } };
    expect(await controlRun("R1", "extend", deps())).toEqual({ ok: false, error: "Facebook ไม่รับ — nope" });
  });

  it("refuses an unknown run and a missing token", async () => {
    expect((await controlRun("nope", "pause", deps())).ok).toBe(false);
    expect(await controlRun("R1", "pause", deps({ token: async () => null }))).toMatchObject({ ok: false });
    expect(sent).toHaveLength(0);
  });
});

describe("setAdStatus", () => {
  it("pauses or switches on one ad", async () => {
    expect(await setAdStatus("123", "PAUSED", "TOKEN", fetchFn)).toEqual({ ok: true });
    expect(sent[0]).toMatchObject({ method: "POST", path: "123" });
    expect(sent[0].params.get("status")).toBe("PAUSED");
  });
  it("refuses an id that is not Meta's", async () => {
    expect((await setAdStatus("1/../2", "PAUSED", "TOKEN", fetchFn)).ok).toBe(false);
    expect(sent).toHaveLength(0);
  });
});
