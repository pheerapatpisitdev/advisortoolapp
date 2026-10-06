import { beforeEach, describe, expect, it } from "vitest";
import type { AdRun, NewRun, RunPatch } from "@/lib/ads/run-store";
import { FELL_BACK, OPEN_RUN, OUT_OF_TIME, resumeRun, RUN_TIME_BUDGET_MS, runPosts, type RunDeps, type RunInput, type RunPost } from "@/lib/ads/run";

/**
 * A run puts each Organic post on Facebook as one ACTIVE ad set and ad under the Page's standing
 * campaign (spec 2026-10-07). Meta is stood in for by a fetch that answers by path and writes down
 * every request; the run tables by an in-memory store. What is checked is what reaches Meta, in
 * what order, and what the rows remember.
 */

interface Sent { method: string; path: string; params: URLSearchParams; query: URLSearchParams }
type Reply = { status: number; body: unknown } | "drop";

let sent: Sent[];
let answer: (s: Sent) => Reply;
let runs: AdRun[];
let standing: Map<string, string>;
let nextId: number;
let clock: number;
/** posts whose open run the database already holds (createRun answers null) */
let openFor: Set<string>;

const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  const s: Sent = {
    method: init?.method ?? "GET",
    path: url.pathname.replace("/v23.0/", ""),
    params: new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    query: url.searchParams,
  };
  sent.push(s);
  const r = answer(s);
  if (r === "drop") throw new Error("socket hang up");
  return new Response(JSON.stringify(r.body), { status: r.status });
}) as typeof fetch;

/** Meta as it answers when everything goes: ids for creates, ACTIVE for reads. */
function meta(over: (s: Sent) => Reply | undefined = () => undefined): (s: Sent) => Reply {
  return (s) => {
    const o = over(s);
    if (o) return o;
    if (s.method === "GET") return { status: 200, body: { effective_status: "ACTIVE", page_story_id: "105_88" } };
    if (s.path.endsWith("/campaigns")) return { status: 200, body: { id: "900" } };
    if (s.path.endsWith("/adsets")) return { status: 200, body: { id: `AS${sent.length}` } };
    if (s.path.endsWith("/adimages")) return { status: 200, body: { images: { p: { hash: "HASH" } } } };
    if (s.path.endsWith("/adcreatives")) return { status: 200, body: { id: `CR${sent.length}` } };
    if (s.path.endsWith("/ads")) return { status: 200, body: { id: `AD${sent.length}` } };
    throw new Error(`unexpected ${s.method} ${s.path}`);
  };
}

const refuse = { status: 400, body: { error: { message: "Invalid parameter" } } };

function memoryStore(): RunDeps["store"] {
  const store = {
    createRun: async (r: NewRun) => {
      if (openFor.has(r.contentId)) return null;
      const run: AdRun = {
        id: `R${nextId++}`, createdAt: new Date(clock).toISOString(), pageId: r.pageId, actId: r.actId, contentId: r.contentId,
        path: r.path, storyId: r.storyId, dailyBudgetMinor: r.dailyBudgetMinor, endAt: r.endAt, metaCampaignId: r.metaCampaignId,
        adsetId: null, imageHash: null, creativeId: null, adId: null, step: "none", error: null, pausedAt: null, createdBy: r.createdBy,
      };
      runs.push(run);
      return { ...run };
    },
    getRun: async (id: string) => { const r = runs.find((x) => x.id === id); return r ? { ...r } : null; },
    listRuns: async (pageId: string) => runs.filter((r) => r.pageId === pageId),
    saveRun: async (id: string, patch: RunPatch) => { Object.assign(runs.find((x) => x.id === id)!, patch); },
    claimRun: async () => true,
    releaseRun: async () => {},
    getStanding: async (pageId: string, actId: string) => standing.get(`${pageId}|${actId}`) ?? null,
    saveStanding: async (pageId: string, actId: string, id: string) => { standing.set(`${pageId}|${actId}`, id); },
  };
  return store as unknown as RunDeps["store"];
}

const boost = (contentId: string, postId: string): RunPost => ({ contentId, path: { kind: "boost", postId }, headline: `หัว ${contentId}`, text: `ข้อความ ${contentId}` });
const fresh = (contentId: string): RunPost => ({ contentId, path: { kind: "new" }, headline: `หัว ${contentId}`, text: `ข้อความ ${contentId}` });

const input = (posts: RunPost[], over: Partial<RunInput> = {}): RunInput => ({
  pageId: "105", pageName: "LuckyPlanner", actId: "act_1", currency: "THB", dailyBudgetBaht: 200, days: 7, posts, createdBy: "U1", ...over,
});

let posterless: Set<string>;
function deps(over: Partial<RunDeps> = {}): RunDeps {
  return {
    store: memoryStore(),
    token: async () => "TOKEN",
    poster: async (id) => (posterless.has(id) ? null : Buffer.from("png")),
    post: async (id) => fresh(id),
    thIdentity: () => "VID1",
    fetchFn,
    now: () => new Date(clock),
    startedAt: clock,
    ...over,
  };
}

const creates = () => sent.filter((s) => s.method === "POST").map((s) => s.path);

beforeEach(() => {
  sent = [];
  answer = meta();
  runs = [];
  standing = new Map();
  nextId = 1;
  clock = Date.parse("2026-10-07T00:00:00Z");
  posterless = new Set();
  openFor = new Set();
});

describe("a boost", () => {
  it("makes the standing campaign once, then an ACTIVE ad set ending in 7 days, the post's creative and an ACTIVE ad", async () => {
    const out = await runPosts(input([boost("C1", "105_77")]), deps());
    expect(out).toEqual({ ok: true, outcomes: [{ contentId: "C1", runId: "R1", ok: true, path: "boost", note: null, error: null }] });
    expect(creates()).toEqual(["act_1/campaigns", "act_1/adsets", "act_1/adcreatives", "act_1/ads"]);
    const [campaign, adset, creative, ad] = sent.filter((s) => s.method === "POST");
    expect(campaign.params.get("name")).toBe("AdvisorTool · ทักแชท · LuckyPlanner");
    expect(campaign.params.get("objective")).toBe("OUTCOME_ENGAGEMENT");
    expect(campaign.params.get("status")).toBe("ACTIVE");
    expect(standing.get("105|act_1")).toBe("900");
    expect(adset.params.get("campaign_id")).toBe("900");
    expect(adset.params.get("status")).toBe("ACTIVE");
    expect(adset.params.get("daily_budget")).toBe("20000");
    expect(adset.params.get("destination_type")).toBe("MESSENGER");
    expect(adset.params.get("end_time")).toBe("2026-10-14T00:00:00.000Z");
    expect(creative.params.get("object_story_id")).toBe("105_77");
    expect(ad.params.get("status")).toBe("ACTIVE");
    expect(runs[0]).toMatchObject({ path: "boost", storyId: "105_77", step: "ad", error: null });
    expect(runs[0].adId).toMatch(/^AD/);
  });

  it("reuses a standing campaign Meta still has", async () => {
    standing.set("105|act_1", "777");
    await runPosts(input([boost("C1", "105_77")]), deps());
    expect(sent[0]).toMatchObject({ method: "GET", path: "777" });
    expect(creates()).not.toContain("act_1/campaigns");
    expect(sent.find((s) => s.path === "act_1/adsets")!.params.get("campaign_id")).toBe("777");
  });

  it("makes a new standing campaign when the stored one was deleted in Ads Manager", async () => {
    standing.set("105|act_1", "777");
    answer = meta((s) => (s.method === "GET" && s.path === "777" ? { status: 200, body: { effective_status: "DELETED" } } : undefined));
    await runPosts(input([boost("C1", "105_77")]), deps());
    expect(creates()[0]).toBe("act_1/campaigns");
    expect(standing.get("105|act_1")).toBe("900");
  });

  it("looks a photo's post up first and boosts that", async () => {
    await runPosts(input([boost("C1", "1070061492680588")]), deps());
    const look = sent.find((s) => s.path === "1070061492680588")!;
    expect(look.method).toBe("GET");
    expect(look.query.get("fields")).toBe("page_story_id");
    expect(sent.find((s) => s.path === "act_1/adcreatives")!.params.get("object_story_id")).toBe("105_88");
    expect(runs[0]).toMatchObject({ path: "boost", storyId: "105_88" });
  });
});

describe("the standing campaign's state", () => {
  it("refuses to run under a standing campaign paused in Ads Manager, and makes nothing", async () => {
    standing.set("105|act_1", "777");
    answer = meta((s) => (s.method === "GET" && s.path === "777" ? { status: 200, body: { effective_status: "PAUSED" } } : undefined));
    const out = await runPosts(input([boost("C1", "105_77")]), deps());
    expect(out).toEqual({ ok: false, error: "แคมเปญประจำ “AdvisorTool · ทักแชท · LuckyPlanner” ถูกหยุดใน Ads Manager — เปิดแคมเปญนั้นก่อนแล้วค่อยยิง" });
    expect(creates()).toEqual([]);
  });

  it("stops rather than makes a second standing campaign when the check's answer is lost", async () => {
    standing.set("105|act_1", "777");
    answer = meta((s) => (s.method === "GET" && s.path === "777" ? "drop" : undefined));
    const out = await runPosts(input([boost("C1", "105_77")]), deps());
    expect(out.ok).toBe(false);
    expect(creates()).toEqual([]);
    expect(standing.get("105|act_1")).toBe("777");
  });

  it("makes a new one when Meta refuses to read the stored one (gone or not ours)", async () => {
    standing.set("105|act_1", "777");
    answer = meta((s) => (s.method === "GET" && s.path === "777" ? refuse : undefined));
    await runPosts(input([boost("C1", "105_77")]), deps());
    expect(creates()[0]).toBe("act_1/campaigns");
    expect(standing.get("105|act_1")).toBe("900");
  });
});

describe("a post with an open run", () => {
  it("is left out with why, and the others go on", async () => {
    openFor.add("C1");
    const out = await runPosts(input([boost("C1", "105_77"), boost("C2", "105_78")]), deps());
    expect(out).toMatchObject({ ok: true, outcomes: [
      { contentId: "C1", runId: null, ok: false, error: OPEN_RUN },
      { contentId: "C2", ok: true },
    ] });
    expect(creates().filter((p) => p === "act_1/adsets")).toHaveLength(1);
  });
});

describe("when the boost is refused", () => {
  it("makes a new ad from the post when the photo cannot be looked up", async () => {
    answer = meta((s) => (s.path === "1070061492680588" ? refuse : undefined));
    const out = await runPosts(input([boost("C1", "1070061492680588")]), deps());
    expect(out).toMatchObject({ ok: true, outcomes: [{ ok: true, path: "fallback", note: FELL_BACK }] });
    const creative = sent.find((s) => s.path === "act_1/adcreatives")!;
    expect(creative.params.get("object_story_id")).toBeNull();
    expect(JSON.parse(creative.params.get("object_story_spec")!).link_data.call_to_action.type).toBe("MESSAGE_PAGE");
    expect(creates()).toContain("act_1/adimages");
    expect(runs[0]).toMatchObject({ path: "fallback", imageHash: "HASH", step: "ad", error: null });
  });

  it("makes a new ad when Meta refuses the boost creative", async () => {
    let first = true;
    answer = meta((s) => (s.path === "act_1/adcreatives" && first ? ((first = false), refuse) : undefined));
    const out = await runPosts(input([boost("C1", "105_77")]), deps());
    expect(out).toMatchObject({ ok: true, outcomes: [{ ok: true, path: "fallback", note: FELL_BACK }] });
    expect(creates().filter((p) => p === "act_1/adcreatives")).toHaveLength(2);
  });

  it("makes a new ad when Meta refuses the ad on the boosted post", async () => {
    let first = true;
    answer = meta((s) => (s.path === "act_1/ads" && first ? ((first = false), refuse) : undefined));
    const out = await runPosts(input([boost("C1", "105_77")]), deps());
    expect(out).toMatchObject({ ok: true, outcomes: [{ ok: true, path: "fallback" }] });
    expect(creates().filter((p) => p === "act_1/ads")).toHaveLength(2);
  });

  it("does not fall back when the answer was lost: it saves why, and a retry makes only the ad", async () => {
    let drop = true;
    answer = meta((s) => (s.path === "act_1/ads" && drop ? ((drop = false), "drop") : undefined));
    const out = await runPosts(input([boost("C1", "105_77")]), deps());
    expect(out).toMatchObject({ ok: true, outcomes: [{ ok: false, path: "boost" }] });
    expect(runs[0].error).toContain("ไม่รู้ว่าขั้นนี้สำเร็จหรือไม่");
    expect(runs[0].path).toBe("boost");

    sent = [];
    const again = await resumeRun("R1", deps());
    expect(again).toMatchObject({ ok: true, path: "boost", error: null });
    expect(creates()).toEqual(["act_1/ads"]);
    expect(runs[0]).toMatchObject({ step: "ad", error: null });
  });
});

describe("a new ad from a draft", () => {
  it("uploads the picture and makes a send-message creative with the post's words", async () => {
    const out = await runPosts(input([fresh("C2")]), deps());
    expect(out).toMatchObject({ ok: true, outcomes: [{ contentId: "C2", ok: true, path: "new" }] });
    expect(creates()).toEqual(["act_1/campaigns", "act_1/adsets", "act_1/adimages", "act_1/adcreatives", "act_1/ads"]);
    const spec = JSON.parse(sent.find((s) => s.path === "act_1/adcreatives")!.params.get("object_story_spec")!);
    expect(spec.link_data).toMatchObject({ image_hash: "HASH", message: "ข้อความ C2", name: "หัว C2", link: "https://m.me/105" });
  });

  it("leaves out a post with no picture before anything is made for it", async () => {
    posterless.add("C2");
    const out = await runPosts(input([fresh("C2")]), deps());
    expect(out).toEqual({ ok: true, outcomes: [{ contentId: "C2", runId: null, ok: false, path: null, note: null, error: "โพสต์นี้ยังไม่มีรูป" }] });
    expect(creates().filter((p) => p !== "act_1/campaigns")).toEqual([]);
    expect(runs).toHaveLength(0);
  });
});

describe("a batch", () => {
  it("leaves the posts it has no time for without a row, saying so", async () => {
    const d = deps({ now: () => new Date(clock) });
    // the first post's last request moves the clock past the budget
    answer = meta((s) => { if (s.path === "act_1/ads") clock += RUN_TIME_BUDGET_MS; return undefined; });
    const out = await runPosts(input([boost("C1", "105_77"), boost("C2", "105_78")]), d);
    expect(out).toMatchObject({ ok: true, outcomes: [{ contentId: "C1", ok: true }, { contentId: "C2", runId: null, ok: false, error: OUT_OF_TIME }] });
    expect(runs).toHaveLength(1);
  });

  it("goes on with the other posts when one is refused", async () => {
    answer = meta((s) => (s.path === "act_1/adsets" && sent.filter((x) => x.path === "act_1/adsets").length === 1 ? refuse : undefined));
    const out = await runPosts(input([fresh("C1"), fresh("C2")]), deps());
    expect(out).toMatchObject({ ok: true, outcomes: [{ contentId: "C1", ok: false }, { contentId: "C2", ok: true }] });
    expect(runs[0].error).toContain("Invalid parameter");
  });
});

describe("checks before anything is made", () => {
  it("refuses a budget over the cap", async () => {
    const out = await runPosts(input([fresh("C1")], { dailyBudgetBaht: 100000 }), deps());
    expect(out.ok).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("refuses days other than 3, 7 or 14, bad ids, no identity and no token", async () => {
    expect((await runPosts(input([fresh("C1")], { days: 5 }), deps())).ok).toBe(false);
    expect((await runPosts(input([fresh("C1")], { actId: "act_1/../x" }), deps())).ok).toBe(false);
    expect((await runPosts(input([fresh("C1")]), deps({ thIdentity: () => null }))).ok).toBe(false);
    expect((await runPosts(input([fresh("C1")]), deps({ token: async () => null }))).ok).toBe(false);
    expect((await runPosts(input([]), deps())).ok).toBe(false);
    expect(sent).toHaveLength(0);
  });
});
