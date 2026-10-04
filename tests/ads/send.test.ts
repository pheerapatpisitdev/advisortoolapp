import { beforeEach, describe, expect, it } from "vitest";
import type { AdSend, AdSendItem, ItemPatch, NewSend, SendStepPatch } from "@/lib/ads/send-store";
import { REQUEST_TIMEOUT_MS } from "@/lib/ads/graph";
import { EXPIRED } from "@/lib/ads/sync";
import {
  activateSend,
  pauseSend,
  resumeSend,
  runSend,
  SEND_CLAIM_STALE_MS,
  SEND_TIME_BUDGET_MS,
  type SendDeps,
  type SendInput,
  type SendPiece,
} from "@/lib/ads/send";

/**
 * A send makes one campaign, one ad set and an ad per piece on Meta, so both things it talks to
 * are stood in for, as in launch.test.ts: Graph by a fetch that writes down every request and
 * answers from a queue, and the two send tables by an in-memory store that keeps the real one's
 * promises — one holder of a claim at a time, a piece in a send once. What is checked is what
 * reaches Meta, in what order, and what the rows remember when a step or a piece breaks.
 */

type Store = SendDeps["store"];

interface Sent { method: string; path: string; url: string; auth: string | null; params: URLSearchParams }

let sent: Sent[];
let replies: { status: number; body: unknown }[];
let sends: AdSend[];
let items: AdSendItem[];
let nextId: number;
let claimStaleSeen: (number | undefined)[];
/** which createSend call (1-based) writes its items late, as the real one does in a second request */
let lateItemsOfCall: number | null;
let createCalls: number;

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

/**
 * The tables, in memory. Created rows get increasing times, as the database's now() would. The
 * real createSend writes the send row and then its items in a second request; lateItemsOfCall
 * opens that gap for one call, so another send can run in it.
 */
function memoryStore(): Store {
  const sendById = (id: string) => sends.find((s) => s.id === id);
  const itemById = (id: string) => items.find((i) => i.id === id);
  const store = {
    createSend: async (s: NewSend, pieceIds: string[]) => {
      const n = nextId++;
      const send: AdSend = {
        id: `S${n}`, createdAt: new Date(Date.UTC(2026, 9, 4, 1, 0, n)).toISOString(), campaignId: s.campaignId,
        actId: s.actId, pageId: s.pageId, link: s.link, currency: s.currency, dailyBudgetMinor: s.dailyBudgetMinor,
        objective: s.objective ?? "traffic", leadFormId: s.leadFormId ?? null, cta: s.cta ?? null,
        metaCampaignId: null, adsetId: null, step: "none", error: null, claimedAt: null, activatedAt: null,
        pausedAt: null, superseded: false, createdBy: s.createdBy ?? null,
      };
      sends.push(send);
      if (++createCalls === lateItemsOfCall) await new Promise((r) => setTimeout(r, 20));
      const made = [...new Set(pieceIds)].map((pieceId) => {
        const item: AdSendItem = { id: `I${nextId++}`, sendId: send.id, pieceId, imageHash: null, creativeId: null, adId: null, error: null };
        items.push(item);
        return { ...item };
      });
      return { send: { ...send }, items: made };
    },
    getSend: async (id: string) => { const s = sendById(id); return s ? { ...s } : null; },
    listItems: async (sendId: string) => items.filter((i) => i.sendId === sendId).map((i) => ({ ...i })),
    listSends: async (campaignId: string) =>
      sends
        .filter((s) => s.campaignId === campaignId && !s.superseded)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((s) => ({ ...s, items: items.filter((i) => i.sendId === s.id).map((i) => ({ ...i })) })),
    saveSendStep: async (id: string, patch: SendStepPatch) => { Object.assign(sendById(id)!, patch, { error: null }); },
    saveSendError: async (id: string, message: string) => { sendById(id)!.error = message; },
    saveItem: async (id: string, patch: ItemPatch) => { Object.assign(itemById(id)!, patch, { error: null }); },
    saveItemError: async (id: string, message: string) => { itemById(id)!.error = message; },
    claimSend: async (id: string, staleMs?: number) => {
      claimStaleSeen.push(staleMs);
      const s = sendById(id);
      if (!s || s.claimedAt) return false;
      s.claimedAt = "2026-10-04T01:00:00.000Z";
      return true;
    },
    releaseSend: async (id: string) => { const s = sendById(id); if (s) s.claimedAt = null; },
    dropSend: async (id: string) => {
      const s = sendById(id);
      if (!s || s.step !== "none" || s.metaCampaignId) return false;
      sends = sends.filter((x) => x.id !== id);
      items = items.filter((i) => i.sendId !== id);
      return true;
    },
    markSendActivated: async (id: string, at: string) => { sendById(id)!.activatedAt = at; },
    markSendPaused: async (id: string, at: string) => { sendById(id)!.pausedAt = at; },
    sentPieceIds: async (campaignId: string) => {
      const live = new Set(sends.filter((s) => s.campaignId === campaignId && !s.superseded).map((s) => s.id));
      return new Set(items.filter((i) => live.has(i.sendId) && i.pieceId).map((i) => i.pieceId!));
    },
  };
  return store as unknown as Store;
}

const P1 = Buffer.from("poster-1");
const P2 = Buffer.from("poster-2");
const NOW = new Date("2026-10-04T01:00:00.000Z");

const PIECES: SendPiece[] = [
  { id: "P1", headline: "หัวข้อหนึ่ง", primaryText: "ข้อความหนึ่ง", description: "คำอธิบายหนึ่ง" },
  { id: "P2", headline: "หัวข้อสอง", primaryText: "ข้อความสอง", description: "คำอธิบายสอง" },
];

let store: Store;
let token: string | null;
let posters: Record<string, Buffer | null>;
let identity: string | null;
let clock: () => Date;

const deps = (): SendDeps => ({
  store,
  token: async () => token,
  poster: async (id) => posters[id] ?? null,
  piece: async (id) => PIECES.find((p) => p.id === id) ?? null,
  fetchFn: fetchFn(),
  now: () => clock(),
  thIdentity: () => identity,
});

const input: SendInput = {
  campaignId: "K1", actId: "act_1", currency: "THB", pageId: "111", link: "https://example.com/plan",
  dailyBudgetBaht: 100, pieces: PIECES, createdBy: "U1",
};

const ok = (body: unknown) => ({ status: 200, body });
const fail = (code: number, message = "nope") => ({ status: 400, body: { error: { code, message } } });
const image = (hash: string) => ok({ images: { bytes: { hash, url: "u" } } });
const PIECE1 = [image("H1"), ok({ id: "R1" }), ok({ id: "A1" })];
const PIECE2 = [image("H2"), ok({ id: "R2" }), ok({ id: "A2" })];
const FULL = [ok({ id: "C1" }), ok({ id: "AS1" }), ...PIECE1, ...PIECE2];
const SUCCESS = ok({ success: true });

const paths = () => sent.map((s) => s.path);
const itemOf = (pieceId: string) => items.find((i) => i.pieceId === pieceId)!;

beforeEach(() => {
  sent = [];
  replies = [];
  sends = [];
  items = [];
  nextId = 1;
  claimStaleSeen = [];
  lateItemsOfCall = null;
  createCalls = 0;
  store = memoryStore();
  token = "tok";
  posters = { P1, P2 };
  identity = "VID1";
  clock = () => NOW;
});

describe("sending a batch", () => {
  it("makes one campaign, one ad set, and image, creative and ad for each piece in order, every one paused", async () => {
    replies = [...FULL];
    const result = await runSend(input, deps());

    expect(paths()).toEqual([
      "/v23.0/act_1/campaigns", "/v23.0/act_1/adsets",
      "/v23.0/act_1/adimages", "/v23.0/act_1/adcreatives", "/v23.0/act_1/ads",
      "/v23.0/act_1/adimages", "/v23.0/act_1/adcreatives", "/v23.0/act_1/ads",
    ]);
    for (const s of sent) {
      expect(s.method).toBe("POST");
      expect(s.auth).toBe("Bearer tok");
      expect(s.url).not.toContain("tok");
      expect(s.params.get("access_token")).toBeNull();
    }
    const [campaign, adset, img1, creative1, ad1, img2, creative2, ad2] = sent.map((s) => s.params);
    expect(campaign.get("status")).toBe("PAUSED");
    expect(campaign.get("objective")).toBe("OUTCOME_TRAFFIC");
    expect(campaign.get("special_ad_categories")).toBe("[]");
    expect(campaign.get("is_adset_budget_sharing_enabled")).toBe("false");

    expect(adset.get("status")).toBe("PAUSED");
    expect(adset.get("campaign_id")).toBe("C1");
    expect(adset.get("daily_budget")).toBe("10000");
    expect(adset.get("billing_event")).toBe("IMPRESSIONS");
    expect(adset.get("optimization_goal")).toBe("LINK_CLICKS");
    expect(adset.get("bid_strategy")).toBe("LOWEST_COST_WITHOUT_CAP");
    expect(adset.get("destination_type")).toBe("WEBSITE");
    expect(JSON.parse(adset.get("targeting")!)).toEqual({
      geo_locations: { countries: ["TH"] }, age_min: 20, targeting_automation: { advantage_audience: 1 },
    });
    expect(JSON.parse(adset.get("regional_regulated_categories")!)).toEqual(["THAILAND_UNIVERSAL"]);
    expect(JSON.parse(adset.get("regional_regulation_identities")!)).toEqual({ universal_beneficiary: "VID1", universal_payer: "VID1" });

    expect(img1.get("bytes")).toBe(P1.toString("base64"));
    expect(img2.get("bytes")).toBe(P2.toString("base64"));
    expect(JSON.parse(creative1.get("object_story_spec")!)).toEqual({
      page_id: "111",
      link_data: {
        image_hash: "H1", link: "https://example.com/plan", message: "ข้อความหนึ่ง", name: "หัวข้อหนึ่ง", description: "คำอธิบายหนึ่ง",
        call_to_action: { type: "LEARN_MORE", value: { link: "https://example.com/plan" } },
      },
    });
    expect(JSON.parse(creative2.get("object_story_spec")!).link_data).toMatchObject({ image_hash: "H2", name: "หัวข้อสอง" });
    for (const [ad, adset_id, creative_id] of [[ad1, "AS1", "R1"], [ad2, "AS1", "R2"]] as const) {
      expect(ad.get("status")).toBe("PAUSED");
      expect(ad.get("adset_id")).toBe(adset_id);
      expect(JSON.parse(ad.get("creative")!)).toEqual({ creative_id });
    }

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped).toEqual([]);
    expect(result.send).toMatchObject({ step: "ads", metaCampaignId: "C1", adsetId: "AS1", error: null, campaignId: "K1", dailyBudgetMinor: 10000 });
    expect(result.items.map((i) => [i.pieceId, i.adId])).toEqual([["P1", "A1"], ["P2", "A2"]]);
    expect(sends).toHaveLength(1);
    expect(sends[0]).toMatchObject({ step: "ads", metaCampaignId: "C1", adsetId: "AS1", claimedAt: null, activatedAt: null });
    expect(itemOf("P1")).toMatchObject({ imageHash: "H1", creativeId: "R1", adId: "A1", error: null });
    expect(itemOf("P2")).toMatchObject({ imageHash: "H2", creativeId: "R2", adId: "A2", error: null });
  });

  it("goes on to the next piece when one breaks, ends at the ads step, and keeps that piece's error", async () => {
    replies = [ok({ id: "C1" }), ok({ id: "AS1" }), image("H1"), fail(100, "bad creative"), ...PIECE2];
    const result = await runSend(input, deps());

    expect(paths()).toEqual([
      "/v23.0/act_1/campaigns", "/v23.0/act_1/adsets",
      "/v23.0/act_1/adimages", "/v23.0/act_1/adcreatives",
      "/v23.0/act_1/adimages", "/v23.0/act_1/adcreatives", "/v23.0/act_1/ads",
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.send.step).toBe("ads");
    const one = result.items.find((i) => i.pieceId === "P1")!;
    expect(one).toMatchObject({ imageHash: "H1", creativeId: null, adId: null });
    expect(one.error).toContain("bad creative");
    expect(result.items.find((i) => i.pieceId === "P2")).toMatchObject({ adId: "A2", error: null });
    expect(itemOf("P1").error).toContain("bad creative");
    expect(sends[0]).toMatchObject({ step: "ads", claimedAt: null });
  });

  it("resumes only the piece that broke, without a second campaign or ad set, and reuses its image", async () => {
    replies = [ok({ id: "C1" }), ok({ id: "AS1" }), image("H1"), fail(100, "bad creative"), ...PIECE2];
    const first = await runSend(input, deps());
    sent = [];
    replies = [ok({ id: "R1" }), ok({ id: "A1" })];

    const again = await resumeSend(first.ok ? first.send.id : "", deps());
    expect(paths()).toEqual(["/v23.0/act_1/adcreatives", "/v23.0/act_1/ads"]);
    expect(sent[1].params.get("adset_id")).toBe("AS1");
    expect(JSON.parse(sent[0].params.get("object_story_spec")!).link_data).toMatchObject({ image_hash: "H1", name: "หัวข้อหนึ่ง" });
    expect(again.ok).toBe(true);
    expect(itemOf("P1")).toMatchObject({ adId: "A1", error: null });
    expect(sends).toHaveLength(1);
    expect(sends[0]).toMatchObject({ step: "ads", claimedAt: null });
  });

  it("stops at the ad set that broke, and a resume carries on from there with what the send was started with", async () => {
    replies = [ok({ id: "C1" }), fail(100, "bad targeting")];
    const first = await runSend(input, deps());

    expect(first).toMatchObject({ ok: false, step: "adset" });
    expect(!first.ok && first.error).toContain("bad targeting");
    expect(sends[0]).toMatchObject({ step: "campaign", metaCampaignId: "C1", adsetId: null, claimedAt: null });
    expect(sends[0].error).toContain("bad targeting");
    expect(items.every((i) => !i.adId)).toBe(true);

    sent = [];
    replies = [ok({ id: "AS1" }), ...PIECE1, ...PIECE2];
    const again = await resumeSend(sends[0].id, deps());
    expect(again.ok).toBe(true);
    expect(paths()[0]).toBe("/v23.0/act_1/adsets");
    expect(sent[0].params.get("campaign_id")).toBe("C1");
    expect(sent[0].params.get("daily_budget")).toBe("10000");
    expect(sent.filter((s) => s.path.endsWith("/campaigns"))).toHaveLength(0);
    expect(sends[0]).toMatchObject({ step: "ads", adsetId: "AS1", error: null });
  });

  it("counts a 200 with no id as the campaign step breaking", async () => {
    replies = [ok({ success: true })];
    const result = await runSend(input, deps());
    expect(result).toMatchObject({ ok: false, step: "campaign" });
    expect(sends[0]).toMatchObject({ step: "none", metaCampaignId: null });
    expect(sends[0].error).toBeTruthy();
  });

  it("does not touch Meta again for a send that has every ad", async () => {
    replies = [...FULL];
    const first = await runSend(input, deps());
    sent = [];
    const again = await resumeSend(first.ok ? first.send.id : "", deps());
    expect(again.ok).toBe(true);
    expect(sent).toHaveLength(0);
  });

  it("names the reconnect when the token expires on a piece, and keeps going", async () => {
    replies = [ok({ id: "C1" }), ok({ id: "AS1" }), fail(190, "Error validating access token"), ...PIECE2];
    const result = await runSend(input, deps());
    expect(result.ok).toBe(true);
    expect(itemOf("P1").error).toBe(EXPIRED);
  });
});

describe("pieces that cannot go", () => {
  it("leaves out a piece with no poster, says why, and sends the others", async () => {
    posters = { P1: null, P2 };
    replies = [ok({ id: "C1" }), ok({ id: "AS1" }), ...PIECE2];
    const result = await runSend(input, deps());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped).toEqual([{ pieceId: "P1", reason: expect.stringContaining("โปสเตอร์") }]);
    expect(result.items.map((i) => i.pieceId)).toEqual(["P2"]);
    expect(items.map((i) => i.pieceId)).toEqual(["P2"]);
    expect(paths()).toEqual(["/v23.0/act_1/campaigns", "/v23.0/act_1/adsets", "/v23.0/act_1/adimages", "/v23.0/act_1/adcreatives", "/v23.0/act_1/ads"]);
  });

  it("leaves out a piece already in a live send of the campaign", async () => {
    replies = [ok({ id: "C1" }), ok({ id: "AS1" }), ...PIECE1];
    await runSend({ ...input, pieces: [PIECES[0]] }, deps());
    sent = [];
    replies = [ok({ id: "C2" }), ok({ id: "AS2" }), ...PIECE2];

    const result = await runSend(input, deps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped).toEqual([{ pieceId: "P1", reason: expect.stringContaining("ส่ง") }]);
    expect(result.items.map((i) => i.pieceId)).toEqual(["P2"]);
    expect(sent.filter((s) => s.path.endsWith("/adimages"))).toHaveLength(1);
  });

  it("refuses, asking Meta nothing and recording nothing, when no piece is left", async () => {
    posters = { P1: null, P2: null };
    replies = [...FULL];
    const result = await runSend(input, deps());
    expect(result).toMatchObject({ ok: false, step: "check" });
    expect(!result.ok && result.error).toContain("โปสเตอร์");
    expect(sent).toHaveLength(0);
    expect(sends).toHaveLength(0);
  });

  it("refuses an empty selection", async () => {
    const result = await runSend({ ...input, pieces: [] }, deps());
    expect(result).toMatchObject({ ok: false, step: "check", error: "ยังไม่ได้เลือกแอด" });
    expect(sends).toHaveLength(0);
  });

  it("sends a piece listed twice once", async () => {
    replies = [ok({ id: "C1" }), ok({ id: "AS1" }), ...PIECE1];
    const result = await runSend({ ...input, pieces: [PIECES[0], PIECES[0]] }, deps());
    expect(result.ok).toBe(true);
    expect(items).toHaveLength(1);
    expect(sent.filter((s) => s.path.endsWith("/ads"))).toHaveLength(1);
  });

  it("records a piece whose poster went missing before a resume, and goes on", async () => {
    replies = [ok({ id: "C1" }), fail(100)];
    await runSend(input, deps());
    posters = { P1: null, P2 };
    sent = [];
    replies = [ok({ id: "AS1" }), ...PIECE2];

    const result = await resumeSend(sends[0].id, deps());
    expect(result.ok).toBe(true);
    expect(itemOf("P1").error).toContain("โปสเตอร์");
    expect(itemOf("P2").adId).toBe("A2");
  });
});

describe("two presses at once", () => {
  it("make one campaign when two sends of the same pieces race", async () => {
    replies = [...FULL];
    const results = await Promise.all([runSend(input, deps()), runSend(input, deps())]);

    expect(sent.filter((s) => s.path.endsWith("/campaigns"))).toHaveLength(1);
    expect(sent).toHaveLength(8);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ ok: false, step: "check" });
    // the send that stood down made nothing on Meta and is gone, items and all
    expect(sends).toHaveLength(1);
    expect(sends[0]).toMatchObject({ metaCampaignId: "C1", claimedAt: null });
    expect(items.map((i) => i.sendId)).toEqual([sends[0].id, sends[0].id]);
  });

  it("make one campaign when the first send's items are written after the second send has started", async () => {
    // A writes its row, then its items late; B writes row and items, claims, and checks first
    lateItemsOfCall = 1;
    replies = [...FULL];
    const [a, b] = await Promise.all([runSend(input, deps()), runSend(input, deps())]);

    expect(sent.filter((s) => s.path.endsWith("/campaigns"))).toHaveLength(1);
    expect(sent).toHaveLength(8);
    expect(a.ok).toBe(true);
    expect(b).toMatchObject({ ok: false, step: "check" });
    expect(!b.ok && b.error).toContain("กำลังเริ่ม");
    expect(!b.ok && b.send).toBeUndefined();
    expect(sends.map((s) => s.id)).toEqual([a.ok ? a.send.id : ""]);
  });

  it("leave nothing of the send that stood down: its pieces are not counted as sent, and it cannot be resumed", async () => {
    replies = [...FULL];
    const results = await Promise.all([runSend(input, deps()), runSend(input, deps())]);
    const winner = results.find((r) => r.ok)!;
    const loserId = sends.length === 1 && winner.ok ? (winner.send.id === "S1" ? "S2" : "S1") : "";
    expect(loserId).not.toBe("");

    expect([...(await store.sentPieceIds("K1"))].sort()).toEqual(["P1", "P2"]);
    // once the real send is retired, its pieces are free: no leftover row still holds them
    sends[0].superseded = true;
    expect(await store.sentPieceIds("K1")).toEqual(new Set());

    sent = [];
    replies = [...FULL];
    expect(await resumeSend(loserId, deps())).toMatchObject({ ok: false, step: "check" });
    expect(sent).toHaveLength(0);
  });

  it("are not blocked by an old send that never got its items", async () => {
    // a rollback that failed long ago left a row with no items: it is not a send still starting
    sends.push({
      id: "S0", createdAt: "2026-10-04T00:50:00.000Z", campaignId: "K1", actId: "act_1", pageId: "111", link: "https://example.com/plan",
      currency: "THB", dailyBudgetMinor: 10000, objective: "traffic", leadFormId: null, cta: null, metaCampaignId: null, adsetId: null, step: "none", error: null, claimedAt: null,
      activatedAt: null, pausedAt: null, superseded: false, createdBy: "U1",
    });
    replies = [...FULL];
    expect((await runSend(input, deps())).ok).toBe(true);
    expect(sent.filter((s) => s.path.endsWith("/campaigns"))).toHaveLength(1);
  });

  it("make one campaign when two retries of the same send race", async () => {
    replies = [fail(100)];
    await runSend(input, deps());
    sent = [];
    replies = [...FULL];

    const results = await Promise.all([resumeSend(sends[0].id, deps()), resumeSend(sends[0].id, deps())]);
    expect(sent.filter((s) => s.path.endsWith("/campaigns"))).toHaveLength(1);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ ok: false, step: "check" });
  });

  it("hold the claim longer than a send may run, each request waiting its full timeout", async () => {
    // a claim that runs out sooner lets a second press take over a send still making ads
    expect(SEND_CLAIM_STALE_MS).toBeGreaterThan(SEND_TIME_BUDGET_MS + 3 * REQUEST_TIMEOUT_MS);
    // and the longest run — the budget plus a piece started just inside it — ends a minute or more
    // before the page's maxDuration (300 s) kills it, which would leave an ad on Meta unsaved
    expect(SEND_TIME_BUDGET_MS + 3 * REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(300_000 - 60_000);
    replies = [...FULL];
    await runSend(input, deps());
    expect(claimStaleSeen).toEqual([SEND_CLAIM_STALE_MS]);
  });

  it("stop starting pieces once the time budget is spent, and a resume makes the rest", async () => {
    let t = NOW.getTime();
    clock = () => new Date(t);
    const base = fetchFn();
    replies = [ok({ id: "C1" }), ok({ id: "AS1" }), ...PIECE1, ...PIECE2];
    const slow: SendDeps = {
      ...deps(),
      fetchFn: ((url: string | URL | Request, init?: RequestInit) => { t += SEND_TIME_BUDGET_MS / 4; return base(url, init); }) as typeof fetch,
    };
    const result = await runSend(input, slow);

    expect(result.ok).toBe(true);
    expect(itemOf("P1").adId).toBe("A1");
    expect(itemOf("P2").adId).toBeNull();
    expect(itemOf("P2").error).toContain("ลองใหม่");
    expect(sends[0].step).toBe("adset");

    sent = [];
    t = NOW.getTime();
    const again = await resumeSend(sends[0].id, deps());
    expect(again.ok).toBe(true);
    expect(paths()).toEqual(["/v23.0/act_1/adimages", "/v23.0/act_1/adcreatives", "/v23.0/act_1/ads"]);
    expect(sends[0].step).toBe("ads");
  });
});

describe("the time budget counts from the request's start", () => {
  it("counts the time spent drawing posters: a slow draw leaves the pieces for a resume", async () => {
    let t = NOW.getTime();
    clock = () => new Date(t);
    replies = [ok({ id: "C1" }), ok({ id: "AS1" })];
    const slow: SendDeps = { ...deps(), poster: async (id) => { t += SEND_TIME_BUDGET_MS / 2; return posters[id] ?? null; } };
    const result = await runSend(input, slow);

    expect(result.ok).toBe(true);
    expect(paths()).toEqual(["/v23.0/act_1/campaigns", "/v23.0/act_1/adsets"]);
    expect(itemOf("P1").error).toContain("ลองใหม่");
    expect(itemOf("P2").error).toContain("ลองใหม่");
    expect(sends[0].step).toBe("adset");
  });

  it("counts from when the action began, when it says", async () => {
    replies = [ok({ id: "C1" }), ok({ id: "AS1" })];
    const late: SendDeps = { ...deps(), startedAt: NOW.getTime() - SEND_TIME_BUDGET_MS };
    await runSend(input, late);
    expect(paths()).toEqual(["/v23.0/act_1/campaigns", "/v23.0/act_1/adsets"]);
    expect(itemOf("P1").adId).toBeNull();

    sent = [];
    replies = [...PIECE1, ...PIECE2];
    await resumeSend(sends[0].id, late);
    expect(sent).toHaveLength(0);
    await resumeSend(sends[0].id, deps());
    expect(itemOf("P2").adId).toBe("A2");
  });
});

describe("refusing before Meta is asked", () => {
  it.each([
    ["no verified Thai identity", () => { identity = null; }, {}, "META_TH_VERIFIED_IDENTITY_ID"],
    ["no token", () => { token = null; }, {}, "เชื่อม"],
    ["501 baht a day", () => {}, { dailyBudgetBaht: 501 }, "500"],
    ["a USD account", () => {}, { currency: "USD" }, "THB"],
    ["a javascript: link", () => {}, { link: "javascript:alert(1)" }, "ลิงก์"],
    ["an empty link", () => {}, { link: " " }, "ลิงก์"],
    ["a bad account id", () => {}, { actId: "act_1/x" }, "บัญชี"],
    ["a bad page id", () => {}, { pageId: "1?x" }, "เพจ"],
  ])("%s", async (_name, arrange, change, says) => {
    arrange();
    replies = [...FULL];
    const result = await runSend({ ...input, ...change }, deps());

    expect(result).toMatchObject({ ok: false, step: "check" });
    expect(!result.ok && result.error).toContain(says);
    expect(sent).toHaveLength(0);
    expect(sends).toHaveLength(0);
  });

  it("refuses to resume a send that does not exist or was retired", async () => {
    expect(await resumeSend("nope", deps())).toMatchObject({ ok: false, step: "check" });
    replies = [fail(100)];
    await runSend(input, deps());
    sends[0].superseded = true;
    sent = [];
    expect(await resumeSend(sends[0].id, deps())).toMatchObject({ ok: false, step: "check" });
    expect(sent).toHaveLength(0);
  });
});

describe("a request to Meta that never answers", () => {
  it("stops at the ad set, says the result is unknown, and makes no ad", async () => {
    let calls = 0;
    const hung: SendDeps = {
      ...deps(),
      fetchFn: (async (u: string | URL | Request) => {
        calls++;
        sent.push({ method: "POST", path: new URL(String(u)).pathname, url: String(u), auth: null, params: new URLSearchParams() });
        if (calls === 1) return new Response(JSON.stringify({ id: "C1" }), { status: 200 });
        throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
      }) as typeof fetch,
    };
    const result = await runSend(input, hung);
    expect(result).toMatchObject({ ok: false, step: "adset" });
    expect(!result.ok && result.error).toContain("ไม่รู้ว่า");
    expect(paths()).toEqual(["/v23.0/act_1/campaigns", "/v23.0/act_1/adsets"]);
    expect(sends[0]).toMatchObject({ step: "campaign", metaCampaignId: "C1", claimedAt: null });
  });
});

describe("switching the whole send on and off", () => {
  async function made(): Promise<string> {
    replies = [...FULL];
    const r = await runSend(input, deps());
    sent = [];
    if (!r.ok) throw new Error("setup failed");
    return r.send.id;
  }

  it("sets campaign, ad set and every ad ACTIVE in that order, then marks the send", async () => {
    const id = await made();
    replies = [SUCCESS, SUCCESS, SUCCESS, SUCCESS];

    expect(await activateSend(id, deps())).toEqual({ ok: true });
    expect(paths()).toEqual(["/v23.0/C1", "/v23.0/AS1", "/v23.0/A1", "/v23.0/A2"]);
    for (const s of sent) {
      expect(s.method).toBe("POST");
      expect(s.params.get("status")).toBe("ACTIVE");
      expect(s.auth).toBe("Bearer tok");
      expect(s.url).not.toContain("tok");
    }
    expect(sends[0].activatedAt).toBe(NOW.toISOString());
    expect(sends[0].claimedAt).toBeNull();
  });

  it("switches on only the ads that were made", async () => {
    replies = [ok({ id: "C1" }), ok({ id: "AS1" }), image("H1"), fail(100), ...PIECE2];
    const r = await runSend(input, deps());
    sent = [];
    replies = [SUCCESS, SUCCESS, SUCCESS];
    expect(await activateSend(r.ok ? r.send.id : "", deps())).toEqual({ ok: true });
    expect(paths()).toEqual(["/v23.0/C1", "/v23.0/AS1", "/v23.0/A2"]);
  });

  it("does not mark the send when a step in the middle breaks or Meta does not confirm", async () => {
    const id = await made();
    replies = [SUCCESS, fail(100, "budget too low")];
    const result = await activateSend(id, deps());
    expect(!result.ok && result.error).toContain("budget too low");
    expect(sent).toHaveLength(2);
    expect(sends[0].activatedAt).toBeNull();
    expect(sends[0].claimedAt).toBeNull();

    sent = [];
    replies = [ok({ success: false })];
    expect((await activateSend(id, deps())).ok).toBe(false);
    expect(sends[0].activatedAt).toBeNull();
  });

  it("refuses a send that has not made its ad set or any ad", async () => {
    replies = [ok({ id: "C1" }), fail(100)];
    await runSend(input, deps());
    sent = [];
    expect((await activateSend(sends[0].id, deps())).ok).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("sets every ad again on a second press, so an ad a resume made since is switched on too", async () => {
    replies = [ok({ id: "C1" }), ok({ id: "AS1" }), image("H1"), fail(100), ...PIECE2];
    const r = await runSend(input, deps());
    const id = r.ok ? r.send.id : "";
    replies = [SUCCESS, SUCCESS, SUCCESS];
    await activateSend(id, deps());
    replies = [ok({ id: "R1" }), ok({ id: "A1" })];
    await resumeSend(id, deps());
    // made paused, as every ad is: a resume never switches anything on
    expect(sent.at(-1)!.params.get("status")).toBe("PAUSED");
    sent = [];

    replies = [SUCCESS, SUCCESS, SUCCESS, SUCCESS];
    expect(await activateSend(id, deps())).toEqual({ ok: true });
    expect(paths()).toEqual(["/v23.0/C1", "/v23.0/AS1", "/v23.0/A1", "/v23.0/A2"]);
  });

  it("pauses the campaign and marks the send; it can be switched on again after", async () => {
    const id = await made();
    replies = [SUCCESS, SUCCESS, SUCCESS, SUCCESS];
    await activateSend(id, deps());
    sent = [];

    const later = new Date(NOW.getTime() + 60_000);
    clock = () => later;
    replies = [SUCCESS];
    expect(await pauseSend(id, deps())).toEqual({ ok: true });
    expect(paths()).toEqual(["/v23.0/C1"]);
    expect(sent[0].params.get("status")).toBe("PAUSED");
    expect(sends[0].pausedAt).toBe(later.toISOString());
    expect(sends[0].claimedAt).toBeNull();

    sent = [];
    clock = () => new Date(later.getTime() + 60_000);
    replies = [SUCCESS, SUCCESS, SUCCESS, SUCCESS];
    expect(await activateSend(id, deps())).toEqual({ ok: true });
    expect(sent).toHaveLength(4);
  });

  it("does not mark a pause Meta did not confirm", async () => {
    const id = await made();
    replies = [ok({ success: false })];
    expect((await pauseSend(id, deps())).ok).toBe(false);
    expect(sends[0].pausedAt).toBeNull();
  });

  it("refuses to pause a send with no campaign, asking Meta nothing", async () => {
    replies = [fail(100)];
    await runSend(input, deps());
    sent = [];
    expect((await pauseSend(sends[0].id, deps())).ok).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("refuses while another press holds the send", async () => {
    const id = await made();
    sends[0].claimedAt = NOW.toISOString();
    expect((await activateSend(id, deps())).ok).toBe(false);
    expect((await pauseSend(id, deps())).ok).toBe(false);
    expect(sent).toHaveLength(0);
  });
});
