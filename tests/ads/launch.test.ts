import { beforeEach, describe, expect, it } from "vitest";
import type { LaunchRow, NewLaunch } from "@/lib/ads/launch-store";
import { EXPIRED } from "@/lib/ads/sync";
import { activateLaunch, adEffectiveStatus, runLaunch, type LaunchDeps, type LaunchInput } from "@/lib/ads/launch";

/**
 * The launch spends real money on Meta, so both things it talks to are stood in for: Graph by a
 * fetch that writes down every request and answers from a queue, and the launch table by an
 * in-memory store that keeps the real one's two promises — one live row per piece and account,
 * and one holder of a claim at a time. What is checked is what reaches Meta, in what order, and
 * what the row remembers when a step breaks.
 */

type Store = LaunchDeps["store"];

interface Sent { method: string; path: string; url: string; auth: string | null; params: URLSearchParams }

let sent: Sent[];
let replies: { status: number; body: unknown }[];
let rows: LaunchRow[];
let nextId: number;

function fetchFn(): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    sent.push({
      method: init?.method ?? "GET",
      path: new URL(url).pathname,
      url,
      auth: headers.get("authorization"),
      params: new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    });
    const r = replies.shift();
    if (!r) throw new Error(`unexpected fetch ${url}`);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

const copy = (r: LaunchRow): LaunchRow => ({ ...r });

/** The table, in memory: a second live row for the same piece and account is refused, as the unique index does. */
function memoryStore(): Store {
  const byId = (id: string) => rows.find((r) => r.id === id);
  const live = (pieceId: string, actId: string) => rows.find((r) => r.pieceId === pieceId && r.actId === actId && !r.superseded);
  const store = {
    findLaunch: async (pieceId: string, actId: string) => { const r = live(pieceId, actId); return r ? copy(r) : null; },
    getLaunch: async (id: string) => { const r = byId(id); return r ? copy(r) : null; },
    createLaunch: async (input: NewLaunch) => {
      const existing = live(input.pieceId, input.actId);
      if (existing) return { row: copy(existing), created: false };
      const row: LaunchRow = {
        id: `L${nextId++}`, createdAt: "2026-10-04T01:00:00.000Z", pieceId: input.pieceId, actId: input.actId,
        pageId: input.pageId, link: input.link, currency: input.currency, dailyBudgetMinor: input.dailyBudgetMinor,
        headline: input.headline ?? null, primaryText: input.primaryText ?? null, description: input.description ?? null,
        campaignId: null, adsetId: null, imageHash: null, creativeId: null, adId: null, step: "none", error: null,
        activatedAt: null, claimedAt: null, superseded: false, createdBy: input.createdBy ?? null,
      };
      rows.push(row);
      return { row: copy(row), created: true };
    },
    saveStep: async (id: string, patch: Partial<LaunchRow>) => { Object.assign(byId(id)!, patch, { error: null }); },
    saveError: async (id: string, message: string) => { byId(id)!.error = message; },
    markActivated: async (id: string, at: string) => { byId(id)!.activatedAt = at; },
    supersede: async (id: string) => { byId(id)!.superseded = true; },
    claimLaunch: async (id: string) => {
      const r = byId(id);
      if (!r || r.claimedAt) return false;
      r.claimedAt = "2026-10-04T01:00:00.000Z";
      return true;
    },
    releaseLaunch: async (id: string) => { byId(id)!.claimedAt = null; },
  };
  return store as unknown as Store;
}

const POSTER = Buffer.from("poster-png");
const NOW = new Date("2026-10-04T01:00:00.000Z");

let store: Store;
let token: string | null;
let poster: Buffer | null;
const deps = (): LaunchDeps => ({
  store,
  token: async () => token,
  poster: async () => poster,
  fetchFn: fetchFn(),
  now: () => NOW,
});

const input: LaunchInput = {
  pieceId: "P1", actId: "act_1", currency: "THB", pageId: "111", link: "https://example.com/plan",
  dailyBudgetBaht: 100, headline: "ประกันสุขภาพ", primaryText: "ข้อความหลัก", description: "คำอธิบาย", createdBy: "U1",
};

const ok = (body: unknown) => ({ status: 200, body });
const fail = (code: number, message = "nope") => ({ status: 400, body: { error: { code, message } } });
const FULL = [ok({ id: "C1" }), ok({ id: "S1" }), ok({ images: { bytes: { hash: "H1", url: "u" } } }), ok({ id: "R1" }), ok({ id: "A1" })];

beforeEach(() => {
  sent = [];
  replies = [];
  rows = [];
  nextId = 1;
  store = memoryStore();
  token = "tok";
  poster = POSTER;
});

describe("making the ad", () => {
  it("makes campaign, ad set, image, creative and ad in that order, every one paused", async () => {
    replies = [...FULL];
    const result = await runLaunch(input, deps());

    expect(sent.map((s) => s.path)).toEqual([
      "/v23.0/act_1/campaigns", "/v23.0/act_1/adsets", "/v23.0/act_1/adimages", "/v23.0/act_1/adcreatives", "/v23.0/act_1/ads",
    ]);
    for (const s of sent) {
      expect(s.method).toBe("POST");
      expect(s.auth).toBe("Bearer tok");
      expect(s.url).not.toContain("tok");
      expect(s.params.get("access_token")).toBeNull();
    }
    const [campaign, adset, image, creative, ad] = sent.map((s) => s.params);
    expect(campaign.get("status")).toBe("PAUSED");
    expect(campaign.get("objective")).toBe("OUTCOME_TRAFFIC");
    expect(campaign.get("special_ad_categories")).toBe("[]");
    expect(campaign.get("is_adset_budget_sharing_enabled")).toBe("false");
    expect(campaign.get("name")).toBe("Studio · ประกันสุขภาพ · 2026-10-04");

    expect(adset.get("status")).toBe("PAUSED");
    expect(adset.get("campaign_id")).toBe("C1");
    expect(adset.get("daily_budget")).toBe("10000");
    expect(adset.get("billing_event")).toBe("IMPRESSIONS");
    expect(adset.get("optimization_goal")).toBe("LINK_CLICKS");
    expect(adset.get("bid_strategy")).toBe("LOWEST_COST_WITHOUT_CAP");
    expect(adset.get("destination_type")).toBe("WEBSITE");
    expect(JSON.parse(adset.get("targeting")!)).toEqual({ geo_locations: { countries: ["TH"] } });

    expect(image.get("bytes")).toBe(POSTER.toString("base64"));

    expect(JSON.parse(creative.get("object_story_spec")!)).toEqual({
      page_id: "111",
      link_data: {
        image_hash: "H1", link: "https://example.com/plan", message: "ข้อความหลัก", name: "ประกันสุขภาพ", description: "คำอธิบาย",
        call_to_action: { type: "LEARN_MORE", value: { link: "https://example.com/plan" } },
      },
    });

    expect(ad.get("status")).toBe("PAUSED");
    expect(ad.get("adset_id")).toBe("S1");
    expect(JSON.parse(ad.get("creative")!)).toEqual({ creative_id: "R1" });

    expect(result.ok).toBe(true);
    expect(rows[0]).toMatchObject({
      step: "ad", campaignId: "C1", adsetId: "S1", imageHash: "H1", creativeId: "R1", adId: "A1", error: null, claimedAt: null,
      dailyBudgetMinor: 10000,
    });
  });

  it("stops at the ad set that broke, keeps the campaign, and carries on from there next time", async () => {
    replies = [ok({ id: "C1" }), fail(100, "bad targeting")];
    const first = await runLaunch(input, deps());

    expect(first).toMatchObject({ ok: false, step: "adset" });
    expect(!first.ok && first.error).toContain("bad targeting");
    expect(sent.map((s) => s.path)).toEqual(["/v23.0/act_1/campaigns", "/v23.0/act_1/adsets"]);
    expect(rows[0]).toMatchObject({ step: "campaign", campaignId: "C1", adsetId: null, claimedAt: null });
    expect(rows[0].error).toContain("bad targeting");

    sent = [];
    replies = [ok({ id: "S1" }), ok({ images: { bytes: { hash: "H1" } } }), ok({ id: "R1" }), ok({ id: "A1" })];
    const second = await runLaunch(input, deps());

    expect(second.ok).toBe(true);
    expect(sent.map((s) => s.path)).toEqual(["/v23.0/act_1/adsets", "/v23.0/act_1/adimages", "/v23.0/act_1/adcreatives", "/v23.0/act_1/ads"]);
    expect(sent[0].params.get("campaign_id")).toBe("C1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ step: "ad", campaignId: "C1", adsetId: "S1", adId: "A1", error: null });
  });

  it("resumes with the values it was started with, not the ones sent the second time", async () => {
    replies = [ok({ id: "C1" }), fail(100)];
    await runLaunch(input, deps());
    sent = [];
    replies = [ok({ id: "S1" }), ok({ images: { bytes: { hash: "H1" } } }), ok({ id: "R1" }), ok({ id: "A1" })];
    await runLaunch({ ...input, dailyBudgetBaht: 300, link: "https://other.example/", pageId: "222" }, deps());

    expect(sent[0].params.get("daily_budget")).toBe("10000");
    const spec = JSON.parse(sent[2].params.get("object_story_spec")!);
    expect(spec.page_id).toBe("111");
    expect(spec.link_data.link).toBe("https://example.com/plan");
  });

  it("counts a 200 with no id as the step breaking", async () => {
    replies = [ok({ success: true })];
    const result = await runLaunch(input, deps());

    expect(result).toMatchObject({ ok: false, step: "campaign" });
    expect(sent).toHaveLength(1);
    expect(rows[0]).toMatchObject({ step: "none", campaignId: null });
    expect(rows[0].error).toBeTruthy();
  });

  it("counts an image upload with no hash as the creative step breaking", async () => {
    replies = [ok({ id: "C1" }), ok({ id: "S1" }), ok({ images: {} })];
    const result = await runLaunch(input, deps());

    expect(result).toMatchObject({ ok: false, step: "creative" });
    expect(sent).toHaveLength(3);
  });

  it("says to reconnect when the token expired at the creative, and keeps what was made", async () => {
    replies = [ok({ id: "C1" }), ok({ id: "S1" }), ok({ images: { bytes: { hash: "H1" } } }), fail(190, "Error validating access token")];
    const result = await runLaunch(input, deps());

    expect(result).toMatchObject({ ok: false, step: "creative", error: EXPIRED });
    expect(rows[0]).toMatchObject({ step: "adset", campaignId: "C1", adsetId: "S1", imageHash: "H1", creativeId: null, error: EXPIRED });

    // the image is already in the account: the retry goes straight to the creative
    sent = [];
    replies = [ok({ id: "R1" }), ok({ id: "A1" })];
    expect((await runLaunch(input, deps())).ok).toBe(true);
    expect(sent.map((s) => s.path)).toEqual(["/v23.0/act_1/adcreatives", "/v23.0/act_1/ads"]);
  });

  it("makes one campaign when two clicks arrive together", async () => {
    replies = [...FULL];
    const results = await Promise.all([runLaunch(input, deps()), runLaunch(input, deps())]);

    expect(sent.filter((s) => s.path.endsWith("/campaigns"))).toHaveLength(1);
    expect(sent).toHaveLength(5);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ ok: false, step: "check" });
    expect(rows).toHaveLength(1);
  });

  it("does not touch Meta again for a launch that already has its ad", async () => {
    replies = [...FULL];
    await runLaunch(input, deps());
    sent = [];

    const again = await runLaunch(input, deps());
    expect(again.ok).toBe(true);
    expect(again.ok && again.launch.adId).toBe("A1");
    expect(sent).toHaveLength(0);
  });

  it("retires the old launch and makes a fresh set when asked to recreate", async () => {
    replies = [...FULL];
    await runLaunch(input, deps());
    sent = [];
    replies = [ok({ id: "C2" }), ok({ id: "S2" }), ok({ images: { bytes: { hash: "H2" } } }), ok({ id: "R2" }), ok({ id: "A2" })];

    const fresh = await runLaunch({ ...input, recreate: true }, deps());
    expect(fresh.ok).toBe(true);
    // the old one was never switched on, so there is nothing to pause
    expect(sent.map((s) => s.path)).toEqual([
      "/v23.0/act_1/campaigns", "/v23.0/act_1/adsets", "/v23.0/act_1/adimages", "/v23.0/act_1/adcreatives", "/v23.0/act_1/ads",
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ superseded: true, adId: "A1" });
    expect(rows[1]).toMatchObject({ superseded: false, step: "ad", campaignId: "C2", adId: "A2" });
  });

  async function switchedOn(): Promise<void> {
    replies = [...FULL];
    const r = await runLaunch(input, deps());
    if (!r.ok) throw new Error("setup failed");
    replies = [ok({ success: true }), ok({ success: true }), ok({ success: true })];
    expect(await activateLaunch(r.launch.id, deps())).toEqual({ ok: true });
    sent = [];
  }

  it("pauses the old campaign before recreating over an ad that is switched on", async () => {
    await switchedOn();
    replies = [ok({ success: true }), ok({ id: "C2" }), ok({ id: "S2" }), ok({ images: { bytes: { hash: "H2" } } }), ok({ id: "R2" }), ok({ id: "A2" })];

    const fresh = await runLaunch({ ...input, recreate: true }, deps());
    expect(fresh.ok).toBe(true);
    expect(sent.map((s) => s.path)).toEqual([
      "/v23.0/C1", "/v23.0/act_1/campaigns", "/v23.0/act_1/adsets", "/v23.0/act_1/adimages", "/v23.0/act_1/adcreatives", "/v23.0/act_1/ads",
    ]);
    expect(sent[0].method).toBe("POST");
    expect(sent[0].params.get("status")).toBe("PAUSED");
    expect(sent[0].auth).toBe("Bearer tok");
    expect(sent[0].url).not.toContain("tok");
    for (const i of [1, 2, 5]) expect(sent[i].params.get("status")).toBe("PAUSED");
    expect(rows[0]).toMatchObject({ superseded: true, campaignId: "C1" });
    expect(rows[1]).toMatchObject({ superseded: false, step: "ad", campaignId: "C2", activatedAt: null });
  });

  it.each([
    ["Meta refuses", fail(100, "cannot pause"), "ปิดแอดเดิมไม่สำเร็จ"],
    ["Meta does not confirm", ok({ success: false }), "ปิดแอดเดิมไม่สำเร็จ"],
    ["the token expired", fail(190), EXPIRED],
  ])("keeps the old launch and makes nothing new when the pause fails: %s", async (_name, reply, message) => {
    await switchedOn();
    replies = [reply, ...FULL];

    const result = await runLaunch({ ...input, recreate: true }, deps());
    expect(result).toMatchObject({ ok: false, step: "check" });
    expect(!result.ok && result.error).toContain(message);
    expect(sent.map((s) => s.path)).toEqual(["/v23.0/C1"]);
    expect(rows).toHaveLength(1);
    expect(rows[0].superseded).toBe(false);
  });

  it("neither pauses nor retires a switched-on ad when the recreate is refused before Meta", async () => {
    await switchedOn();
    poster = null;
    replies = [ok({ success: true }), ...FULL];

    const result = await runLaunch({ ...input, recreate: true }, deps());
    expect(result).toMatchObject({ ok: false, step: "check" });
    expect(sent).toHaveLength(0);
    expect(rows[0].superseded).toBe(false);
  });
});

describe("refusing before Meta is asked", () => {
  it.each([
    ["no poster", () => { poster = null; }, {}],
    ["no token", () => { token = null; }, {}],
    ["501 baht a day", () => {}, { dailyBudgetBaht: 501 }],
    ["a USD account", () => {}, { currency: "USD" }],
    ["a javascript: link", () => {}, { link: "javascript:alert(1)" }],
    ["an empty link", () => {}, { link: " " }],
  ])("%s", async (_name, arrange, change) => {
    arrange();
    replies = [...FULL];
    const result = await runLaunch({ ...input, ...change }, deps());

    expect(result).toMatchObject({ ok: false, step: "check" });
    expect(!result.ok && result.error).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  it("asks for the ads connection when there is no token", async () => {
    token = null;
    const result = await runLaunch(input, deps());
    expect(!result.ok && result.error).toContain("เชื่อม");
  });

  it("does not retire the old launch when the new one cannot start", async () => {
    replies = [...FULL];
    await runLaunch(input, deps());
    poster = null;
    sent = [];

    const result = await runLaunch({ ...input, recreate: true }, deps());
    expect(result).toMatchObject({ ok: false, step: "check" });
    expect(rows).toHaveLength(1);
    expect(rows[0].superseded).toBe(false);
    expect(sent).toHaveLength(0);
  });
});

describe("switching the ad on", () => {
  async function launched(): Promise<string> {
    replies = [...FULL];
    const r = await runLaunch(input, deps());
    sent = [];
    if (!r.ok) throw new Error("setup failed");
    return r.launch.id;
  }

  it("sets campaign, ad set and ad ACTIVE in that order, then marks the launch", async () => {
    const id = await launched();
    replies = [ok({ success: true }), ok({ success: true }), ok({ success: true })];

    expect(await activateLaunch(id, deps())).toEqual({ ok: true });
    expect(sent.map((s) => s.path)).toEqual(["/v23.0/C1", "/v23.0/S1", "/v23.0/A1"]);
    for (const s of sent) {
      expect(s.method).toBe("POST");
      expect(s.params.get("status")).toBe("ACTIVE");
      expect(s.auth).toBe("Bearer tok");
      expect(s.url).not.toContain("tok");
    }
    expect(rows[0].activatedAt).toBe(NOW.toISOString());
    expect(rows[0].claimedAt).toBeNull();
  });

  it("does not mark the launch when a step in the middle breaks", async () => {
    const id = await launched();
    replies = [ok({ success: true }), fail(100, "budget too low")];

    const result = await activateLaunch(id, deps());
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("budget too low");
    expect(sent).toHaveLength(2);
    expect(rows[0].activatedAt).toBeNull();
    expect(rows[0].claimedAt).toBeNull();
  });

  it("refuses a launch that has not reached its ad", async () => {
    replies = [ok({ id: "C1" }), fail(100)];
    const r = await runLaunch(input, deps());
    sent = [];

    const result = await activateLaunch(r.launch!.id, deps());
    expect(result.ok).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("does not call Meta again for a launch already switched on", async () => {
    const id = await launched();
    replies = [ok({ success: true }), ok({ success: true }), ok({ success: true })];
    await activateLaunch(id, deps());
    sent = [];

    expect(await activateLaunch(id, deps())).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
  });
});

describe("reading what Meta made of the ad", () => {
  it("returns the ad's effective_status, with the token in the header", async () => {
    replies = [ok({ id: "A1", effective_status: "DISAPPROVED" })];
    expect(await adEffectiveStatus("A1", "tok", fetchFn())).toBe("DISAPPROVED");
    expect(sent[0].path).toBe("/v23.0/A1");
    expect(new URL(sent[0].url).searchParams.get("fields")).toBe("effective_status");
    expect(sent[0].auth).toBe("Bearer tok");
    expect(sent[0].url).not.toContain("tok");
  });

  it("returns null when Meta answers with an error", async () => {
    replies = [fail(190)];
    expect(await adEffectiveStatus("A1", "tok", fetchFn())).toBeNull();
  });
});
