import { beforeEach, describe, expect, it, vi } from "vitest";

/* An in-memory stand-in for ins_agent_line and ins_quote_videos: enough of supabase-js's chain for
 * select / update with eq, is, in, gte, order and limit, read by a plain await. */
const db: Record<string, Record<string, unknown>[]> = {};
function from(name: string) {
  const rows = (db[name] ??= []);
  let patch: Record<string, unknown> | null = null;
  let order: { k: string; asc: boolean } | null = null;
  let max = Infinity;
  const tests: ((r: Record<string, unknown>) => boolean)[] = [];
  const hit = () => {
    const found = rows.filter((r) => tests.every((t) => t(r)));
    if (order) found.sort((a, b) => String(a[order!.k]).localeCompare(String(b[order!.k])) * (order!.asc ? 1 : -1));
    return found.slice(0, max);
  };
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => { tests.push((r) => r[k] === v); return q; },
    is: (k: string, v: unknown) => { tests.push((r) => (r[k] ?? null) === v); return q; },
    in: (k: string, vs: unknown[]) => { tests.push((r) => vs.includes(r[k])); return q; },
    gte: (k: string, v: string) => { tests.push((r) => String(r[k]) >= v); return q; },
    order: (k: string, o: { ascending: boolean }) => { order = { k, asc: o.ascending }; return q; },
    limit: (n: number) => { max = n; return q; },
    update: (p: Record<string, unknown>) => { patch = p; return q; },
    then: (ok: (v: unknown) => void) => {
      if (patch) {
        for (const r of rows.filter((r) => tests.every((t) => t(r)))) Object.assign(r, patch);
        return ok({ data: null, error: null });
      }
      ok({ data: hit().map((r) => ({ ...r })), error: null });
    },
  };
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from }) }));

const VIEWER = { kind: "unitos", agentId: "A1", code: "015872", name: "สมหญิง", tenantId: "t", tenantSlug: "t", tenantName: "t", trial: false, staff: null };
const viewerOfAgent = vi.fn(async () => VIEWER as unknown);
vi.mock("@/lib/auth/viewer", () => ({ viewerOfAgent }));
const startQuoteClip = vi.fn(async () => ({ ok: true, id: "clip-new" }) as { ok: true; id: string } | { ok: false; error: string; needContact?: boolean });
vi.mock("@/lib/quote-video/start", () => ({ startQuoteClip, NOT_PRICED: "คิดราคาไม่ได้" }));
const costView = vi.fn(async () => ({ kind: "wallet", balance: "฿150.00", satang: 15_000, prices: {} }) as unknown);
vi.mock("@/lib/quote-video/make", () => ({
  costView, videoPrice: () => 1_000,
  clipEstimates: async () => new Proxy({}, { get: () => ({ pre: 60, render: 120 }) }),
}));
vi.mock("@/lib/wallet/store", () => ({ walletPrices: async () => ({}) }));
vi.mock("@/lib/quote-video/check-input", async (orig) => ({ ...(await orig<object>()), payAndPen: async () => [[], true] }));
const pushesNearFull = vi.fn(async () => false);
vi.mock("@/lib/quote-video/fail-alert", () => ({
  pushesNearFull,
  clipWhat: () => "วิดีโอนำเสนอ · Life Protect (Motion)",
  lineVideo: async (id: string) => ({ url: `https://x.supabase.co/${id}.mp4?token=t`, preview: `https://www.advisortool.app/api/line/clip-preview/${id}` }),
}));

const { answerClipChat } = await import("@/lib/line/clip-order-run");

const USER = "Uagent";
const say = (text: string, slots: unknown = null) => answerClipChat(text, USER, slots as never);
const words = (m: unknown) => JSON.stringify(m);

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.ins_agent_line = [{ agent_id: "A1", line_user_id: USER, clip_draft: null }];
  db.ins_quote_videos = [];
  startQuoteClip.mockClear();
  pushesNearFull.mockReset().mockResolvedValue(false);
  costView.mockReset().mockResolvedValue({ kind: "wallet", balance: "฿150.00", satang: 15_000, prices: {} });
});

describe("a linked agent orders in the chat", () => {
  it("one line → the card, priced from the wallet; สร้างคลิป → started as a LINE order", async () => {
    const card = await say("คลิป LP ชาย 35 ทุน 1 ล้าน คุณสมชาย");
    expect(card).toHaveLength(1);
    expect(card![0].type).toBe("flex");
    expect(words(card)).toContain("฿10 จากกระเป๋า · เหลือ ฿140");
    const done = await say("สร้างคลิป ฿10");
    expect(startQuoteClip).toHaveBeenCalledWith(VIEWER, expect.objectContaining({ product: "LIFEPROTECT", sumAssured: 1_000_000, style: "motion" }), "สมชาย", { lineOrder: true });
    expect(done![0]).toMatchObject({ text: expect.stringContaining("เสร็จแล้วจะส่งวิดีโอมาในแชทนี้") });
    expect(db.ins_agent_line[0].clip_draft).toBeNull();
  });
  it("asks for what is missing, then the card", async () => {
    expect(words(await say("ทำคลิปให้ลูกค้าหน่อย"))).toContain("ทำคลิปแบบประกันไหนครับ");
    expect(words(await say("มรดก"))).toContain("ลูกค้าเพศอะไร");
    expect(words(await say("หญิง 50"))).toContain("ครอบครัวได้รับเงินกี่ล้านครับ");
    const card = await say("3 ล้าน");
    expect(card![0].type).toBe("flex");
  });
  it("starts from the quote the chat holds", async () => {
    const slots = { intent: "quote", product: "ishield", age: 40, sex: "F", sumAssured: 500_000, variant: "WLCI10" };
    const card = await say("สร้างเป็นวิดีโอ", slots);
    expect(words(card)).toContain("iShield · จ่าย 10 ปี");
    expect(words(card)).toContain("หญิง 40");
  });
  it("เปลี่ยนแบบคลิป swaps the look; ยกเลิก forgets the order", async () => {
    await say("คลิป LP ชาย 35 ทุน 1 ล้าน");
    expect(words(await say("เปลี่ยนแบบคลิป"))).toContain("แบบปกติ · ~60 วิ");
    expect(words(await say("ยกเลิก"))).toContain("ยกเลิกคำสั่งคลิปแล้ว");
    expect(words(await say("สร้างคลิป ฿10"))).toContain("หมดเวลาหรือยกเลิกไปแล้ว");
    expect(startQuoteClip).not.toHaveBeenCalled();
  });
  it("too little in the wallet: the top-up link instead of the card", async () => {
    costView.mockResolvedValue({ kind: "wallet", balance: "฿4.00", satang: 400, prices: {} });
    const said = await say("คลิป LP ชาย 35 ทุน 1 ล้าน");
    expect(said![0]).toMatchObject({ text: expect.stringMatching(/^⚠️ เงินในกระเป๋าเหลือ ฿4 ไม่พอสำหรับคลิปนี้ \(฿10\)\nเติมเงิน .+\/studio\/wallet$/) });
  });
  it("the month's pushes near full: started, and told to press ขอคลิป", async () => {
    pushesNearFull.mockResolvedValue(true);
    await say("คลิป LP ชาย 35 ทุน 1 ล้าน");
    const said = await say("สร้างคลิป ฿10");
    expect(words(said)).toContain("ระบบจะไม่ส่งคลิปมาเอง");
  });
  it("a refusal from the start is said as it is", async () => {
    startQuoteClip.mockResolvedValueOnce({ ok: false, needContact: true, error: "ใส่ชื่อและเบอร์ในบัญชีของฉันก่อน" });
    await say("คลิป LP ชาย 35 ทุน 1 ล้าน");
    expect(words(await say("สร้างคลิป ฿10"))).toMatch(/ใส่ชื่อและเบอร์ในบัญชีของฉันก่อน\\n.+\/studio\/account/);
  });
});

describe("ขอคลิป", () => {
  const clip = (id: string, extra: Record<string, unknown>) => ({
    id, agent_id: "A1", input: { product: "LIFEPROTECT" }, customer_name: "สมชาย", video_path: `${id}/quote.mp4`,
    status: "done", deleted_at: null, line_pending: false, created_at: "2026-11-27T08:00:00Z", updated_at: new Date().toISOString(), ...extra,
  });
  it("the clip owed, as a reply, and no longer owed; more owed → the button again", async () => {
    db.ins_quote_videos.push(clip("c1", { line_pending: true, updated_at: "2026-11-27T08:10:00Z" }), clip("c2", { line_pending: true, updated_at: "2026-11-27T08:20:00Z" }));
    const said = await say("ขอคลิป");
    expect(said![1]).toMatchObject({ type: "video", originalContentUrl: expect.stringContaining("c2.mp4") });
    expect(words(said![3])).toContain("ยังมีอีก 1 คลิป");
    expect(db.ins_quote_videos.find((r) => r.id === "c2")!.line_pending).toBe(false);
    const again = await say("ขอคลิป");
    expect(again![1]).toMatchObject({ originalContentUrl: expect.stringContaining("c1.mp4") });
    expect(again).toHaveLength(3);
  });
  it("still being made: about how long, and the button", async () => {
    db.ins_quote_videos.push(clip("c3", { status: "drawing", video_path: null, created_at: new Date().toISOString() }));
    const said = await say("ขอคลิป");
    expect(said![0]).toMatchObject({ text: expect.stringMatching(/^คลิปยังสร้างอยู่ อีกประมาณ \d+ นาที/) });
  });
  it("nothing owed: the latest finished clip again", async () => {
    db.ins_quote_videos.push(clip("c4", {}));
    expect((await say("ขอคลิป"))![1]).toMatchObject({ type: "video" });
  });
});

describe("a customer", () => {
  it("is left to the sales bot, ขอคลิป or not", async () => {
    db.ins_agent_line = [];
    expect(await say("ขอคลิป")).toBeNull();
    expect(await say("คลิป LP ชาย 35 ทุน 1 ล้าน")).toBeNull();
  });
  it("an agent's ordinary question is left to the bot too", async () => {
    expect(await say("ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่")).toBeNull();
  });
});
