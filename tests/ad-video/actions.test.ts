import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";
import { quoteVideoFacts, type VideoInput } from "@/lib/quote-video/script";
import { cleanAdPlan, fixedBody, fixedPlan, nextYear } from "@/lib/ad-video/plan";
import type { AdPlan } from "@/lib/ad-video/keys";

/**
 * วิดีโอโฆษณา's server actions (studio/ad-video/actions.ts) as the page calls them: every gate of วิดีโอนำเสนอ,
 * the ad's own shape forced on the server, one rate limit for drafts and redrafts, and only the server's cleaned
 * plan ever stored (R13, 2026-11-22). Nothing here reaches the database or a paid model.
 */

const s = vi.hoisted(() => ({
  agent: "a1",
  closed: null as string | null,
  contact: { name: "ตัวแทน", phone: "0812345678" } as { name?: string; phone?: string },
  create: vi.fn(),
  later: vi.fn(),
  chat: vi.fn(),
  rows: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => { throw new Error("no database in tests"); } }));
vi.mock("@/lib/auth/viewer", () => ({
  requireMember: async () => ({ kind: "unitos", agentId: s.agent, name: "ตัวแทน", staff: null }),
  requireStaff: async () => { throw new Error("not in tests"); },
}));
vi.mock("@/lib/switches/store", () => ({ closedFor: async () => s.closed }));
vi.mock("@/lib/pay-prefs-store", () => ({
  prefsFor: async () => ({ monthly: true, semi: true, pen: true }),
  hiddenFor: async () => [],
}));
vi.mock("@/lib/quote-video/contact", async (orig) => ({ ...(await orig<object>()), getContact: async () => s.contact }));
vi.mock("@/lib/quote-video/voice-check", () => ({ voiceAsked: () => undefined, voiceRefusal: async () => null }));
vi.mock("@/lib/later", async (orig) => ({ ...(await orig<object>()), runLater: (...a: unknown[]) => s.later(...a) }));
vi.mock("@/lib/ai/client", async (orig) => ({
  ...(await orig<object>()),
  chat: (...a: unknown[]) => s.chat(...a),
  drawImage: async () => { throw new Error("no drawing in tests"); },
}));
vi.mock("@/lib/wallet/store", async (orig) => ({ ...(await orig<object>()), walletPrices: async () => DEFAULT_PRICES }));
vi.mock("@/lib/quote-video/make", async (orig) => ({
  ...(await orig<object>()),
  createVideo: (...a: unknown[]) => s.create(...a),
  listVideos: async () => s.rows,
}));

const { draftAdPlan, makeAdVideo, myAdVideos, previewAd, redraftAdPart } = await import("@/app/studio/ad-video/actions");

const LP: VideoInput = { variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 };
const IH: VideoInput = { product: "IHEALTHY", plan: "GOLD", age: 30, sex: "F", compare: [] };
const lp = quoteVideoFacts(LP)!;
const next = nextYear(LP);
const plan = (): AdPlan => fixedPlan(lp, { art: "mixed", mode: "ai", next });

let n = 0;
beforeEach(() => {
  // the limiter lives as long as the module: each test is its own agent, so counts never carry over
  s.agent = `agent-${++n}`;
  s.closed = null;
  s.contact = { name: "ตัวแทน", phone: "0812345678" };
  s.rows = [];
  for (const f of [s.create, s.later, s.chat]) f.mockReset();
  s.create.mockResolvedValue({ id: "v1" });
  // the model is down unless a test says otherwise: the fixed plan stands in
  s.chat.mockRejectedValue(new Error("model down"));
});

describe("the switch", () => {
  it("refuses every step while วิดีโอโฆษณา is switched off; nothing is written or made", async () => {
    s.closed = "ปิดปรับปรุงชั่วคราว";
    expect(await draftAdPlan(LP, { mode: "ai", art: "mixed" })).toEqual({ error: "ปิดปรับปรุงชั่วคราว" });
    expect(await redraftAdPart(LP, plan(), "body1")).toEqual({ error: "ปิดปรับปรุงชั่วคราว" });
    expect(await previewAd(LP, "mixed", 2)).toEqual({ error: "ปิดปรับปรุงชั่วคราว" });
    expect(await makeAdVideo(LP, plan())).toEqual({ ok: false, error: "ปิดปรับปรุงชั่วคราว" });
    expect(s.chat).not.toHaveBeenCalled();
    expect(s.create).not.toHaveBeenCalled();
  });
});

describe("what an ad can be made of", () => {
  it("turns away riders, a budget, compared plans, a page setup and the 4-plan clip", async () => {
    const odd: VideoInput[] = [
      { ...LP, riders: { pb: true } as never },
      { ...LP, budget: { baht: 1000, per: "month" } },
      { ...IH, compare: ["PLATINUM"] } as VideoInput,
      { ...IH, allPlans: "room" } as VideoInput,
      { product: "PENSION", sex: "M", age: 40, sumAssured: 100_000, annuityAge: 60, pay: "6" } as VideoInput,
    ];
    for (const v of odd) {
      expect(await draftAdPlan(v, { mode: "ai", art: "mixed" })).toEqual({ error: "ยังไม่รองรับแบบนี้" });
      expect(await makeAdVideo(v, plan())).toEqual({ ok: false, error: "ยังไม่รองรับแบบนี้" });
    }
    expect(s.chat).not.toHaveBeenCalled();
    expect(s.create).not.toHaveBeenCalled();
  });
  it("still checks the quote as วิดีโอนำเสนอ does", async () => {
    expect(await draftAdPlan({ ...LP, age: 120 }, { mode: "ai", art: "mixed" })).toEqual({ error: "ใส่อายุให้ถูกต้อง" });
  });
});

describe("draftAdPlan", () => {
  it("answers the plan with the scenes and closings this quote can carry", async () => {
    const got = await draftAdPlan(LP, { mode: "ai", art: "mixed" });
    if ("error" in got) throw new Error(got.error);
    expect(got.plan.written).toBe(false);
    expect(got.bodies).toEqual(["price", "cover", "value", "versus"].filter((k) => got.bodies.includes(k as never)));
    expect(got.bodies.slice(0, 2)).toEqual(["price", "cover"]);
    expect(got.ctas).toContain("chat");
    expect(got.facts.line).toContain(lp.lead.amount);
    const ih = await draftAdPlan(IH, { mode: "ai", art: "motion" });
    if ("error" in ih) throw new Error(ih.error);
    expect(ih.bodies).toEqual(["price", "cover"]);
    expect(ih.plan.art).toBe("motion");
  });
  it("caps the agent's own opening at 150 characters before any prompt (R13)", async () => {
    s.chat.mockResolvedValue({ text: "{}", model: "m" });
    await draftAdPlan(LP, { mode: "pick", art: "mixed", hook: "own", ownHook: "ก".repeat(400) });
    const prompt = String((s.chat.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content);
    expect(prompt).toContain("ก".repeat(150));
    expect(prompt).not.toContain("ก".repeat(151));
  });
  it("says when the agent's own opening was replaced, and why", async () => {
    const got = await draftAdPlan(LP, { mode: "pick", art: "mixed", hook: "own", ownHook: "วันละ 59 บาท คุ้มครองทั้งครอบครัว" });
    if ("error" in got) throw new Error(got.error);
    expect(got.plan.hook.voice).not.toContain("59");
    expect(got.fixed).toContain("hook");
    expect(got.reasons?.hook).toBeTruthy();
  });
  it("allows sixty drafts and redrafts an hour, together, then asks to wait", async () => {
    for (let i = 0; i < 59; i++) expect("plan" in (await draftAdPlan(LP, { mode: "ai", art: "mixed" }))).toBe(true);
    expect("plan" in (await redraftAdPart(LP, plan(), "body1"))).toBe(true);
    expect(await draftAdPlan(LP, { mode: "ai", art: "mixed" })).toEqual({ error: "ลองใหม่อีกครั้งในอีกสักครู่" });
    expect(await redraftAdPart(LP, plan(), "cta")).toEqual({ error: "ลองใหม่อีกครั้งในอีกสักครู่" });
  });
});

describe("redraftAdPart", () => {
  it("leaves the agent's own opening to the agent (R13)", async () => {
    const own = { ...plan(), mode: "pick" as const, hook: { kind: "own" as const, voice: "ประโยคของฉันเองค่ะ", headline: ["ประโยคของฉัน"] } };
    expect(await redraftAdPart(LP, own, "hook")).toEqual({ error: "ประโยคที่เขียนเองแก้ในช่องได้เลย" });
    expect(s.chat).not.toHaveBeenCalled();
  });
  it("turns away a part the plan has not got", async () => {
    expect("error" in (await redraftAdPart(LP, plan(), "body9" as never))).toBe(true);
    expect("error" in (await redraftAdPart(LP, plan(), "photos" as never))).toBe(true);
    expect(s.chat).not.toHaveBeenCalled();
  });
  it("answers the plan cleaned, with the part kept when the model is down", async () => {
    const sent = { ...plan(), evil: 1 } as AdPlan;
    const got = await redraftAdPart(LP, sent, "body1");
    if ("error" in got) throw new Error(got.error);
    expect(got.plan).toEqual(cleanAdPlan(sent, lp, next).plan);
  });
});

describe("previewAd", () => {
  it("prices the Motion clip and each photo its art draws", async () => {
    const mixed = await previewAd(LP, "mixed", 2);
    if ("error" in mixed) throw new Error(mixed.error);
    expect(mixed.satang).toBe(DEFAULT_PRICES.videoMotion + 2 * DEFAULT_PRICES.drawGemini);
    expect(mixed.bodies.slice(0, 2)).toEqual(["price", "cover"]);
    const motion = await previewAd(LP, "motion", 2);
    expect("satang" in motion && motion.satang).toBe(DEFAULT_PRICES.videoMotion);
    const photo = await previewAd(LP, "photo", 3);
    expect("satang" in photo && photo.satang).toBe(DEFAULT_PRICES.videoMotion + 5 * DEFAULT_PRICES.drawGemini);
  });
});

describe("makeAdVideo", () => {
  const stored = () => s.create.mock.calls[0][1] as VideoInput & { ad: AdPlan };
  it("makes a 15-second portrait Motion clip with no brief, recipe, name or picture paths from the form", async () => {
    const sent = {
      ...LP, style: "classic", length: "full", size: "landscape", theme: "festival", recipe: "price-first",
      brief: { hook: "question" }, lines: { hook: "x" }, pictures: ["other/agent/pic.png"], mascot: true,
    } as unknown as VideoInput;
    expect(await makeAdVideo(sent, plan())).toEqual({ ok: true, id: "v1" });
    const input = stored();
    expect(input).toMatchObject({ style: "motion", length: "short", size: "portrait", variant: "WLF19H", sumAssured: 1_000_000 });
    for (const k of ["brief", "lines", "recipe", "riders", "budget", "pictures", "mascot", "theme"]) expect(input).not.toHaveProperty(k);
    expect(s.create.mock.calls[0][2]).toBe("");
    expect(s.later).toHaveBeenCalledTimes(1);
  });
  it("keeps แบบเดิม when asked for", async () => {
    await makeAdVideo({ ...LP, theme: "navy" } as VideoInput, plan());
    expect(stored().theme).toBe("navy");
  });
  it("refuses a plan the checker had to mend, makes and holds nothing, and hands back the mended plan (R14)", async () => {
    const edited = plan();
    edited.body[0] = { key: edited.body[0].key, voice: "ออมแค่วันละ 59 บาท ค่ะ" };
    const got = await makeAdVideo(LP, edited);
    expect(got).toMatchObject({ ok: false, error: "มีบางประโยคใช้ไม่ได้ ระบบแก้ให้แล้ว ตรวจอีกครั้งแล้วกดสร้าง", fixed: ["body1"] });
    if (got.ok) throw new Error("made");
    expect(got.reasons?.body1).toBeTruthy();
    expect(got.plan).toEqual(cleanAdPlan(edited, lp, next).plan);
    expect(got.plan?.body[0].voice).toBe(fixedBody(lp, edited.body[0].key));
    expect(s.create).not.toHaveBeenCalled();
    expect(s.later).not.toHaveBeenCalled();
  });
  it("makes the mended plan when it is sent back: no refusal loop", async () => {
    const edited = plan();
    edited.body[0] = { key: edited.body[0].key, voice: "ออมแค่วันละ 59 บาท ค่ะ" };
    const first = await makeAdVideo(LP, edited);
    if (first.ok || !first.plan) throw new Error("not refused");
    expect(await makeAdVideo(LP, first.plan)).toEqual({ ok: true, id: "v1" });
    expect(stored().ad).toEqual(first.plan);
    expect(s.later).toHaveBeenCalledTimes(1);
  });
  it("refuses when only a photo idea was mended, then makes the mended plan", async () => {
    const sent = { ...plan(), photos: { hook: "ภาพครอบครัว 3 คน", close: "a family at home" } } as AdPlan;
    const first = await makeAdVideo(LP, sent);
    expect(first).toMatchObject({ ok: false, fixed: ["photos"] });
    expect(s.create).not.toHaveBeenCalled();
    if (first.ok || !first.plan) throw new Error("not refused");
    expect(await makeAdVideo(LP, first.plan)).toEqual({ ok: true, id: "v1" });
    expect(stored().ad.photos.close).toBe("a family at home");
    expect(stored().ad.photos.hook).not.toMatch(/[ก-๙0-9]/);
  });
  it("stores only the server's cleaned plan, never the object as sent (R13)", async () => {
    const sent = { ...plan(), evil: "x", photos: { hook: "a father with his child", close: "a family at home" } } as AdPlan;
    expect(await makeAdVideo(LP, sent)).toEqual({ ok: true, id: "v1" });
    expect(stored().ad).toEqual(cleanAdPlan(sent, lp, next).plan);
    expect(stored().ad).not.toHaveProperty("evil");
  });
  it("asks for the agent's name and phone first", async () => {
    s.contact = { name: "ตัวแทน", phone: "" };
    expect(await makeAdVideo(LP, plan())).toMatchObject({ ok: false, needContact: true });
    expect(s.create).not.toHaveBeenCalled();
  });
  it("passes a refusal through and starts nothing", async () => {
    s.create.mockResolvedValue({ refusal: "เงินในกระเป๋าไม่พอ" });
    expect(await makeAdVideo(LP, plan())).toEqual({ ok: false, error: "เงินในกระเป๋าไม่พอ" });
    expect(s.later).not.toHaveBeenCalled();
  });
});

describe("myAdVideos", () => {
  it("lists the ad board's clips alone, titled วิดีโอโฆษณา with the plan's name", async () => {
    const row = (id: string, input: Record<string, unknown>) => ({
      id, input, status: "failed", error: "x", created_at: "2026-11-22T00:00:00Z", customer_name: "", video_path: null,
      duration_sec: null, post_text: null, cost_parts: null, paid_by: "free", held_satang: null, multiplier: null, cost_thb: 0,
    });
    s.rows = [row("a", { ...LP, style: "motion", length: "short", ad: plan() }), row("q", { ...LP, style: "motion" })];
    const list = await myAdVideos();
    expect(list.map((v) => v.id)).toEqual(["a"]);
    expect(list[0].title.startsWith("วิดีโอโฆษณา · Life Protect")).toBe(true);
  });
});
