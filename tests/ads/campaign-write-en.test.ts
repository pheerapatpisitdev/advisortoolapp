import { beforeEach, describe, expect, it, vi } from "vitest";
import { headlineFigures, headlineOwner, premiumTable, tableText } from "@/lib/content/premium-table";
import { ENGLISH_RULES } from "@/lib/content/prompt";
import { DISCLAIMER_EN } from "@/lib/content/output";

/**
 * An English campaign's round (spec 2026-10-06): iHealthy Ultra on an Expat Page is written in
 * English — the expat brief, the planner and the writers told lang "en" with the English owner
 * line, the English table and contacts placed by code, the piece saved marked English with the
 * English regulator line, and its writer's words held to the English flags. The same mocks as
 * campaign-write.test.ts: the planner and the writers run for real, only the AI is mocked.
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

const EXPAT_PAGE = "112110731809903";
const campaign = {
  id: "c1", createdAt: "2026-10-06T00:00:00Z", pageId: EXPAT_PAGE, planHref: "/ihealthy-ultra", name: null,
  angles: 1, tones: 1, theme: null, hint: "Retiring in Thailand", agentId: null,
  brandVoice: "Warm and plain", writer: null, painter: null, person: null,
};
const contact = { agentName: "Phet", lineId: "expatphet", inboxUrl: "https://m.me/112110731809903" };
const sent = {
  href: "/lifeprotect", format: "ad" as const, angle: "expat_visa" as const, custom: "", length: null, count: 2, hookTemplateId: null,
  reader: "", age: 30, sex: "F" as const, rung: 3, campaignId: "c1",
};

const plannerReply = (n: number) => ({
  text: JSON.stringify({ plans: Array.from({ length: n }, (_, i) => ({ angle: `Angle ${i + 1}`, hook: `Hook ${i + 1}` })) }),
  model: "small", costThb: 0.2, outputTokens: 50,
});
const writerReply = {
  text: JSON.stringify({
    opening: "Living in Thailand without hospital cover?", bullets: ["🥇 Lump-sum medical cover each year", "🥇 Renewable up to age 98"],
    cta: "Message us for a free quote — tell us your sex and age", hashtags: ["#ExpatThailand"], headline: "Cover for life here", description: "Message us today", imagePrompt: "an expat",
  }),
  model: "m", costThb: 1, outputTokens: 300,
};
const asked = (messages: { content: string }[]) => Number(/วางแผน (\d+) ชิ้น/.exec(messages[1].content)?.[1] ?? 1);
const callsFor = (task: string) => ai.chat.mock.calls.map(([o]) => o).filter((o) => o.task === task);
const saved = () => store.saveContent.mock.calls.map(([row]) => row);
const writes = (own: Record<string, unknown>) => {
  const reply = { ...writerReply, text: JSON.stringify({ ...JSON.parse(writerReply.text), ...own }) };
  ai.chat.mockImplementation(async (o: { task: string; messages: { content: string }[] }) =>
    (o.task === "content-plan" ? plannerReply(asked(o.messages)) : reply));
};

beforeEach(() => {
  vi.clearAllMocks();
  viewer.owner = true;
  project.projectPage.mockImplementation(async (p?: string) => ({ ok: true, pageId: p ?? null }));
  project.myPages.mockResolvedValue([{ pageId: EXPAT_PAGE, pageName: "Expat Insurance Thailand by Phet" }]);
  campaigns.getCampaign.mockResolvedValue(campaign);
  campaigns.listCampaignPieces.mockResolvedValue([]);
  contacts.getPageContact.mockResolvedValue(contact);
  ai.chat.mockImplementation(async (o: { task: string; messages: { content: string }[] }) =>
    (o.task === "content-plan" ? plannerReply(asked(o.messages)) : writerReply));
  store.saveContent.mockImplementation(async (row: Record<string, unknown>) => ({ id: "x", costThb: row.costThb, ...row }));
});

describe("an English campaign's round", () => {
  const t = premiumTable("/ihealthy-ultra", 30, undefined, "en")!;
  const owner = headlineOwner(t, { sex: "F", rung: 3 });

  it("tells the planner English, with the expat brief and the English owner line", async () => {
    const r = await generateContent(sent);
    expect(r.ok).toBe(true);
    const [planner] = callsFor("content-plan");
    expect(planner.messages[0].content).toContain(ENGLISH_RULES);
    const user = planner.messages[1].content;
    expect(user).toContain(`This ad is for: ${owner.line}`);
    expect(user).toContain("ข้อมูลสำหรับลูกค้าชาวต่างชาติ");
    // the English menu's angle is kept
    expect(user).toContain("ประกันสุขภาพกับวีซ่า");
    expect(user).not.toContain("แอดนี้เป็นของ");
  });

  it("tells each writer English: the English rules, the expat brief, the English table, headline and owner line", async () => {
    await generateContent(sent);
    const writers = callsFor("content");
    expect(writers).toHaveLength(2);
    for (const w of writers) {
      const [system, user] = w.messages;
      expect(system.content).toContain("You write English Facebook ads");
      expect(system.content).toContain(ENGLISH_RULES);
      expect(system.content).toContain("best-selling");
      expect(user.content).toContain("ข้อมูลสำหรับลูกค้าชาวต่างชาติ");
      expect(user.content).toContain(tableText(t));
      expect(user.content).toContain(headlineFigures(t, { sex: "F", rung: 3 }));
      expect(user.content).toContain(`This ad is for: ${owner.line}`);
      expect(user.content).not.toContain("m.me");
    }
  });

  it("saves English ads: lang en, the English regulator line, the English figures and contacts", async () => {
    await generateContent(sent);
    const rows = saved();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toMatchObject({ campaignId: "c1", pageId: EXPAT_PAGE, planHref: "/ihealthy-ultra", format: "ad" });
      expect(row.output.lang).toBe("en");
      expect(row.output.disclaimer).toBe(DISCLAIMER_EN);
      expect(row.output.poster.lang).toBe("en");
      expect(row.output.body).toContain(tableText(t));
      // ตกเดือนละ is the engine's monthly-mode premium (owner, 2026-10-06), not the year ÷ 12
      expect(row.output.body).toContain(`💰 First-year premium 43,415 THB/yr (${Math.floor(t.rows[3].femaleMonth!).toLocaleString("en-US")} THB a month) (Female, 30)`);
      expect(row.output.body).toContain("👉 Phet\n📲 Line: @expatphet\n👉 Inbox: https://m.me/112110731809903");
      expect(row.output.ad).toMatchObject({ age: 30, sex: "F", head: "Medical cover up to 25,000,000 THB a year" });
      expect(row.flags.numbers).toEqual([]);
    }
  });

  it("puts THB after the number in the writer's own words, its headline too, and tells the planner so", async () => {
    writes({ opening: "Medical cover up to THB 25,000,000 a year", headline: "Up to THB 25,000,000" });
    await generateContent(sent);
    const [row] = saved();
    expect(row.output.body.split("\n")[0]).toBe("Medical cover up to 25,000,000 THB a year");
    expect(row.output.hooks[0]).toBe("Up to 25,000,000 THB");
    expect(row.flags.numbers).toEqual([]);
    expect(callsFor("content-plan")[0].messages[1].content).toContain("write money as the number then THB");
  });

  it("ends on Message us when the Page has no contacts", async () => {
    contacts.getPageContact.mockResolvedValue(null);
    await generateContent(sent);
    expect(saved()[0].output.body).toContain("\n.\nMessage us");
  });

  it("flags a premium or another person in the writer's English words", async () => {
    writes({ opening: "Only 89 THB a day for a 35-year-old woman", bullets: ["🥇 Just 1,618 THB per month"] });
    await generateContent(sent);
    const [row] = saved();
    expect(row.flags.numbers).toEqual(expect.arrayContaining(["89 THB", "1,618 THB", "35-year-old woman"]));
  });

  it("an angle off the English ad menu is the AI's pick", async () => {
    await generateContent({ ...sent, angle: "tax" as never });
    expect(callsFor("content-plan")[0].messages[1].content).not.toContain("ลดหย่อนภาษี");
  });

  it("leaves another plan on an Expat Page Thai", async () => {
    campaigns.getCampaign.mockResolvedValue({ ...campaign, planHref: "/lifeprotect" });
    await generateContent({ ...sent, angle: "family" as never });
    const [planner] = callsFor("content-plan");
    expect(planner.messages[0].content).not.toContain(ENGLISH_RULES);
    expect(planner.messages[1].content).toContain("แอดนี้เป็นของ");
    const [row] = saved();
    expect(row.output.lang).toBeUndefined();
    expect(row.output.body).toContain(tableText(premiumTable("/lifeprotect", 30)!));
  });
});
