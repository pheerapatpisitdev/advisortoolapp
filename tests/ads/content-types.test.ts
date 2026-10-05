import { beforeEach, describe, expect, it, vi } from "vitest";
import { headlineSheet, premiumTable, tableText } from "@/lib/content/premium-table";
import { numbersBody } from "@/lib/content/numbers";
import { thbAfter } from "@/lib/content/premium-table";
import { NUMBERS_AD_CTA, NUMBERS_AD_CTA_EN } from "@/lib/content/ad-kinds";

/**
 * Ads Studio's content types, round 1 (spec 2026-10-06): the round's `kind` — the long ad as it
 * was, ตัวเลขชัดๆ, ความรู้ (with its sub-kind) and เล่าเป็นเรื่อง — cleaned on the server, through
 * the same planner, owner line, hold, checks and save as the long ad. Only the AI is mocked.
 */

const quota = vi.hoisted(() => ({ takeRound: vi.fn(async () => ({ ok: true, paidBy: "staff" })), allowanceOf: vi.fn() }));
const project = vi.hoisted(() => ({ projectPage: vi.fn(), myPages: vi.fn() }));
const campaigns = vi.hoisted(() => ({ getCampaign: vi.fn(), listCampaignPieces: vi.fn(), updateCampaign: vi.fn() }));
const contacts = vi.hoisted(() => ({ getPageContact: vi.fn() }));
const ai = vi.hoisted(() => ({ chat: vi.fn() }));
const viewer = vi.hoisted(() => ({ owner: true }));
const ip = vi.hoisted(() => ({ n: 0 }));
const store = vi.hoisted(() => ({
  saveContent: vi.fn(),
  getContent: vi.fn(),
  saveOutputIf: vi.fn(),
  contentSpentThisMonth: vi.fn(async () => 0),
  contentCap: vi.fn(async () => 1000),
  holdContentBudget: vi.fn(async () => ({ ok: true, id: "hold-1" })),
  releaseContentBudget: vi.fn(async () => {}),
  usedHooks: vi.fn(async (): Promise<string[]> => []),
  listWords: vi.fn(async () => []),
}));

vi.mock("@/lib/auth/viewer", async () => {
  const { asOwner, OWNER } = await import("../helpers/signed-in");
  return {
    ...asOwner,
    requireStaff: async () => {
      if (!viewer.owner) throw new Error("ไม่มีสิทธิ์ใช้ส่วนนี้");
      return OWNER;
    },
  };
});
// a fresh address per request, so the hourly limit of ten rounds never stands in a test's way
vi.mock("next/headers", () => ({ headers: async () => new Map([["x-real-ip", `10.0.0.${++ip.n}`]]) }));
vi.mock("@/lib/auth/quota", () => quota);
vi.mock("@/lib/auth/pages", async (orig) => ({ ...(await orig<typeof import("@/lib/auth/pages")>()), projectPage: project.projectPage, myPages: project.myPages }));
vi.mock("@/lib/ads/campaign-store", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/campaign-store")>()), ...campaigns }));
vi.mock("@/lib/ads/page-contact", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/page-contact")>()), ...contacts }));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), chat: ai.chat }));
vi.mock("@/lib/content/ceiling", () => ({ ceilingBeforeRound: vi.fn(async () => null) }));
vi.mock("@/lib/content/store", async (orig) => ({ ...(await orig<typeof import("@/lib/content/store")>()), ...store }));

const { generateContent } = await import("@/app/studio/actions");

const campaign = {
  id: "c1", createdAt: "2026-10-06T00:00:00Z", pageId: "P1", planHref: "/lifeprotect", name: null,
  angles: 1, tones: 1, theme: null, hint: "เน้นครอบครัว", agentId: null,
  brandVoice: "อบอุ่น", writer: null, painter: null, person: null,
};
const EXPAT_PAGE = "112110731809903";
const contact = { agentName: "คุณเอ", lineId: "abc123", inboxUrl: "https://m.me/104857600123456" };
const CONTACT_TH = "👉 คุณเอ\n📲 Line: @abc123\n👉 Inbox: https://m.me/104857600123456";
const sent = {
  href: "/ishield", format: "ad" as const, angle: "family" as const, custom: "", length: null, count: 2, hookTemplateId: null,
  reader: "", age: 35, sex: "M" as const, rung: 1, campaignId: "c1",
};

const plannerReply = (n: number) => ({
  text: JSON.stringify({ plans: Array.from({ length: n }, (_, i) => ({ angle: `มุมที่ ${i + 1}`, hook: `ฮุกที่ ${i + 1}` })) }),
  model: "small", costThb: 0.2, outputTokens: 50,
});
const writerReply = {
  text: JSON.stringify({
    opening: "หลายคนคิดว่าประกันชีวิตซื้อตอนแก่ก็ได้", bullets: ["🥇 เงินก้อนให้ครอบครัว"],
    points: ["ยิ่งอายุมาก เบี้ยยิ่งสูงขึ้น", "สุขภาพเปลี่ยน อาจซื้อไม่ได้"],
    cta: "ทักแชทมาคุยกันได้เลย", hashtags: ["#ประกันชีวิต"], headline: "ซื้อตอนไหนดี", description: "ทักแชทได้เลย", imagePrompt: "a family",
  }),
  model: "m", costThb: 1, outputTokens: 300,
};
const headlineReply = (n: number) => ({
  text: JSON.stringify({ pieces: Array.from({ length: n }, (_, i) => ({ headline: `พาดหัวตัวเลข ${"กขค"[i]}`, imagePrompt: "x", theme: "pink" })) }),
  model: "small", costThb: 0.1, outputTokens: 40,
});
const asked = (messages: { content: string }[]) => Number(/วางแผน (\d+) ชิ้น/.exec(messages[1].content)?.[1] ?? 1);
const callsFor = (task: string) => ai.chat.mock.calls.map(([o]) => o).filter((o) => o.task === task);
const saved = () => store.saveContent.mock.calls.map(([row]) => row);
const answer = (writer: typeof writerReply) => ai.chat.mockImplementation(async (o: { task: string; messages: { content: string }[] }) =>
  (o.task === "content-plan" ? plannerReply(asked(o.messages)) : o.task === "content-headline" ? headlineReply(2) : writer));

beforeEach(() => {
  vi.clearAllMocks();
  viewer.owner = true;
  project.projectPage.mockImplementation(async (p?: string) => ({ ok: true, pageId: p ?? null }));
  project.myPages.mockResolvedValue([{ pageId: "P1", pageName: "เพจ" }, { pageId: EXPAT_PAGE, pageName: "Expat" }]);
  campaigns.getCampaign.mockResolvedValue(campaign);
  campaigns.listCampaignPieces.mockResolvedValue([]);
  contacts.getPageContact.mockResolvedValue(contact);
  answer(writerReply);
  store.saveContent.mockImplementation(async (row: Record<string, unknown>) => ({ id: "x", costThb: row.costThb, ...row }));
});

describe("the round's kind, cleaned on the server", () => {
  it("writes the long ad for an unknown kind, and for none — its output as it always was", async () => {
    for (const kind of [undefined, "poster", 7]) {
      store.saveContent.mockClear();
      expect((await generateContent({ ...sent, kind } as never)).ok).toBe(true);
      const [row] = saved();
      expect(row.output.body).toContain(tableText(premiumTable("/lifeprotect", 35)!));
      expect(row.output.ad.kind).toBeUndefined();
    }
  });

  it("tells the long ad's planner nothing more", async () => {
    await generateContent(sent);
    expect(callsFor("content-plan")[0].messages[1].content).not.toContain("แบบแอด");
  });
});

describe("a ตัวเลขชัดๆ ad", () => {
  const head = headlineSheet("/lifeprotect", 35, { sex: "M", rung: 1 })!;

  it("is the headline sheet's numbersBody under an AI opening, then the CTA and the contacts", async () => {
    answer({ ...writerReply, text: JSON.stringify({ opening: "ตัวเลขที่ครอบครัวควรรู้ ก่อนตัดสินใจ" }) });
    const r = await generateContent({ ...sent, kind: "numbers" });
    expect(r.ok).toBe(true);
    const rows = saved();
    expect(rows).toHaveLength(2);
    for (const [i, row] of rows.entries()) {
      expect(row.output.body).toBe(["ตัวเลขที่ครอบครัวควรรู้ ก่อนตัดสินใจ", numbersBody(head.sheet), NUMBERS_AD_CTA, CONTACT_TH].join("\n.\n"));
      expect(row.output.closing).toBe(NUMBERS_AD_CTA);
      // the headline is the numbers headline call's, the sheet's figures never the model's
      expect(row.output.hooks).toEqual([`พาดหัวตัวเลข ${"กขค"[i]}`]);
      expect(row.output.ad).toMatchObject({ kind: "numbers", age: 35, sex: "M" });
      // the numbers poster in navy (the campaign has no colour), and no picture asked for
      expect(row.output.poster.theme).toBe("navy");
      expect(row.output.poster.blocks.map((b: { kind: string }) => b.kind)).toEqual(["badge", "headline", "sub", "footer"]);
      expect(row.output.imagePrompt).toBe("");
      expect(row.output.figures).toContain(numbersBody(head.sheet));
      expect(row.flags.numbers).toEqual([]);
    }
    expect(callsFor("content-headline")).toHaveLength(1);
    expect(callsFor("content")).toHaveLength(2);
    expect(callsFor("content-plan")[0].messages[1].content).toContain("แบบแอด: ตัวเลขชัดๆ");
  });

  it("gives an opening with a digit up — for the plan's hook, and a fixed line when the hook has one too", async () => {
    answer({ ...writerReply, text: JSON.stringify({ opening: "ทุน 2 ล้าน คุ้มไหม" }) });
    await generateContent({ ...sent, kind: "numbers" });
    // the planner's hooks here are "ฮุกที่ 1"…, digits and all
    expect(saved()[0].output.body.split("\n.\n")[0]).toBe("ตัวเลขจริงจากตารางเบี้ย ดูให้ชัดก่อนตัดสินใจ");
    expect(saved()[0].output.body).not.toContain("2 ล้าน");
  });

  it("is refused before anything is counted at an age the plan cannot price", async () => {
    campaigns.getCampaign.mockResolvedValue({ ...campaign, planHref: "/ishield" });
    expect(headlineSheet("/ishield", 55)).toBeNull();
    expect((await generateContent({ ...sent, kind: "numbers", age: 55 })).ok).toBe(false);
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(ai.chat).not.toHaveBeenCalled();
    expect(store.saveContent).not.toHaveBeenCalled();
  });

  it("is English on an Expat Page's iHealthy campaign, from the English sheet, its money said as the other ads say it", async () => {
    campaigns.getCampaign.mockResolvedValue({ ...campaign, pageId: EXPAT_PAGE, planHref: "/ihealthy-ultra" });
    answer({ ...writerReply, text: JSON.stringify({ opening: "Hospital bills in Thailand add up fast." }) });
    const en = headlineSheet("/ihealthy-ultra", 35, { sex: "M", rung: 1 }, undefined, "en")!;
    const r = await generateContent({ ...sent, kind: "numbers", angle: "" as never });
    expect(r.ok).toBe(true);
    const [row] = saved();
    expect(row.output.lang).toBe("en");
    expect(row.output.body).toContain(thbAfter(numbersBody(en.sheet)));
    expect(row.output.body).toContain(NUMBERS_AD_CTA_EN);
    expect(row.output.body).not.toMatch(/THB \d/);
    expect(row.flags.numbers).toEqual([]);
  });
});

describe("a ความรู้ or เล่าเป็นเรื่อง ad", () => {
  it("has no table: the opening, the points, the CTA, then the contacts", async () => {
    await generateContent({ ...sent, kind: "knowledge", sub: "checklist" });
    const [row] = saved();
    const t = premiumTable("/lifeprotect", 35)!;
    expect(row.output.body).toBe(["หลายคนคิดว่าประกันชีวิตซื้อตอนแก่ก็ได้", "ยิ่งอายุมาก เบี้ยยิ่งสูงขึ้น\nสุขภาพเปลี่ยน อาจซื้อไม่ได้", "ทักแชทมาคุยกันได้เลย", CONTACT_TH, "#ประกันชีวิต"].join("\n.\n"));
    expect(row.output.body).not.toContain(t.rows[0].heading);
    expect(row.output.ad).toMatchObject({ kind: "knowledge", sub: "checklist", age: 35, sex: "M" });
    const [writer] = callsFor("content");
    expect(writer.messages[0].content).toContain("เช็กลิสต์ก่อนซื้อ");
    expect(writer.messages[1].content).not.toContain("ตารางเบี้ย");
    expect(writer.messages[1].content).toContain("แอดนี้เป็นของ");
    expect(callsFor("content-plan")[0].messages[1].content).toContain("แบบแอด: ความรู้");
  });

  it("takes a myth for a knowledge ad without a known sub-kind, and none for a story", async () => {
    await generateContent({ ...sent, kind: "knowledge", sub: "quiz" });
    expect(saved()[0].output.ad.sub).toBe("myth");
    store.saveContent.mockClear();
    await generateContent({ ...sent, kind: "story", sub: "faq" });
    expect(saved()[0].output.ad).toMatchObject({ kind: "story" });
    expect(saved()[0].output.ad.sub).toBeUndefined();
  });

  it("flags a premium the model wrote anyway", async () => {
    answer({ ...writerReply, text: JSON.stringify({ ...JSON.parse(writerReply.text), points: ["เบี้ยแค่ 43,200 บาท/ปี"] }) });
    await generateContent({ ...sent, kind: "story" });
    expect(saved()[0].flags.numbers).toContain("43,200 บาท");
  });
});

describe("an iHealthy round's brief", () => {
  it("stresses the headline plan's own benefits, with the 120-day caution, in both languages", async () => {
    campaigns.getCampaign.mockResolvedValue({ ...campaign, planHref: "/ihealthy-ultra" });
    await generateContent({ ...sent, kind: "knowledge", rung: 3, age: 30 });
    const user = callsFor("content")[0].messages[1].content;
    expect(user).toContain("แผน Gold");
    expect(user).toContain("ค่ารักษาผู้ป่วยนอก (ปรึกษาแพทย์และยา) วงเงินปีละ 12,000 บาท");
    expect(user).toContain("120 วัน");
    expect(saved()[0].flags.numbers).toEqual([]);

    ai.chat.mockClear();
    campaigns.getCampaign.mockResolvedValue({ ...campaign, pageId: EXPAT_PAGE, planHref: "/ihealthy-ultra" });
    await generateContent({ ...sent, kind: "long", angle: "" as never, rung: 0, age: 30 });
    const en = callsFor("content")[0].messages[1].content;
    expect(en).toContain("plan Smart");
    expect(en).not.toContain("Outpatient");
    expect(en).toContain("special waiting period of 120 days");
  });
});
