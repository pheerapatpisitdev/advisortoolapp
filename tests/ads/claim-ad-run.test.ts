import { beforeEach, describe, expect, it, vi } from "vitest";
import { premiumTable, tableText } from "@/lib/content/premium-table";
import { CLAIM_CAUTION_EN } from "@/lib/content/claim-ad";
import { DISCLAIMER, DISCLAIMER_EN } from "@/lib/content/output";

/**
 * A round of รีวิวเคลม ads written into a campaign (spec 2026-10-06 claim review): the owner's
 * campaign on a Page still connected, the facts the drawer read, one writer call per angle line,
 * the story assembled with the table (when on), the Page's contacts and the caution, then the
 * stickered papers put on each ad's poster for the owner to check. Only the AI, the stores and
 * who is calling are mocked.
 */

const project = vi.hoisted(() => ({ myPages: vi.fn() }));
const campaigns = vi.hoisted(() => ({ getCampaign: vi.fn(), listCampaignPieces: vi.fn(), updateCampaign: vi.fn() }));
const contacts = vi.hoisted(() => ({ getPageContact: vi.fn() }));
const ai = vi.hoisted(() => ({ chat: vi.fn() }));
const viewer = vi.hoisted(() => ({ owner: true }));
const store = vi.hoisted(() => ({
  saveContent: vi.fn(),
  getContent: vi.fn(),
  saveOutputIf: vi.fn(),
  saveBackground: vi.fn(),
  removeBackground: vi.fn(async () => {}),
  contentSpentThisMonth: vi.fn(async () => 0),
  contentCap: vi.fn(async () => 1000),
  holdContentBudget: vi.fn(async () => ({ ok: true, id: "hold-1" })),
  releaseContentBudget: vi.fn(async () => {}),
  listWords: vi.fn(async () => []),
  recentHooks: vi.fn(async (): Promise<string[]> => []),
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
vi.mock("@/lib/auth/pages", async (orig) => ({ ...(await orig<typeof import("@/lib/auth/pages")>()), myPages: project.myPages }));
vi.mock("@/lib/ads/campaign-store", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/campaign-store")>()), ...campaigns }));
vi.mock("@/lib/ads/page-contact", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/page-contact")>()), ...contacts }));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), chat: ai.chat }));
vi.mock("@/lib/content/store", async (orig) => ({ ...(await orig<typeof import("@/lib/content/store")>()), ...store }));
vi.mock("@/lib/content/claim-ad", async (orig) => {
  const real = await orig<typeof import("@/lib/content/claim-ad")>();
  return { ...real, claimAdMessages: vi.fn(real.claimAdMessages) };
});

const { writeClaimAds } = await import("@/lib/ads/claim-ad-run");
const { claimAdMessages } = await import("@/lib/content/claim-ad");

const campaign = {
  id: "c1", createdAt: "2026-10-06T00:00:00Z", pageId: "P1", planHref: "/lifeprotect", name: null,
  angles: 1, tones: 1, theme: "emerald", hint: null, agentId: null, brandVoice: null, writer: null, painter: null, person: null,
};
const contact = { agentName: "คุณเอ", lineId: "abc123", inboxUrl: "https://m.me/104857600123456" };
const facts = {
  kind: "ipd", illness: "ไข้เลือดออก", nights: "3", billTotal: "48,000", paid: "45,000", selfPaid: "3,000",
  daysToApprove: "5", who: "ผู้หญิง วัย 40+", note: "",
};
const paper = { bytes: Buffer.from("png"), mimeType: "image/png", ratio: 0.75 };
const input = {
  campaignId: "c1", facts, count: 2, angle: "", custom: "", reader: "", withTable: true, age: 30, sex: "F" as const,
  papers: [paper],
};

const writerReply = (o: Record<string, unknown> = {}) => ({
  text: JSON.stringify({
    headline: "นอน รพ. 3 คืน", story: ["ไข้เลือดออก นอนโรงพยาบาล 3 คืน", "ประกันจ่ายให้ 45,000 บาท"], cta: "ทักแชทถามเรื่องเคลมได้",
    description: "ทักแชทถามเรื่องเคลม", imagePrompt: "a family at home", poster: { headline: "นอน รพ. 3 คืน", footer: "ทักแชท", theme: "navy" }, ...o,
  }),
  model: "m", costThb: 1, outputTokens: 300,
});
const saved = () => store.saveContent.mock.calls.map(([row]) => row);

beforeEach(() => {
  vi.clearAllMocks();
  viewer.owner = true;
  project.myPages.mockResolvedValue([{ pageId: "P1", pageName: "เพจ" }]);
  campaigns.getCampaign.mockResolvedValue(campaign);
  contacts.getPageContact.mockResolvedValue(contact);
  ai.chat.mockResolvedValue(writerReply());
  let n = 0;
  store.saveContent.mockImplementation(async (row: Record<string, unknown>) => ({ id: `x${++n}`, costThb: row.costThb, ...row }));
  store.saveBackground.mockImplementation(async (id: string) => `${id}/paper.png`);
  store.saveOutputIf.mockImplementation(async (id: string, output: Record<string, unknown>) => ({ id, costThb: 1, output }));
});

function nothingSpent() {
  expect(store.holdContentBudget).not.toHaveBeenCalled();
  expect(ai.chat).not.toHaveBeenCalled();
  expect(store.saveContent).not.toHaveBeenCalled();
}

describe("a claim ad round is refused before anything is spent", () => {
  it("for anyone but the owner", async () => {
    viewer.owner = false;
    expect(await writeClaimAds(input)).toEqual({ ok: false, error: "ไม่มีสิทธิ์ใช้ส่วนนี้" });
    expect(campaigns.getCampaign).not.toHaveBeenCalled();
    nothingSpent();
  });

  it("when the campaign is not found", async () => {
    campaigns.getCampaign.mockResolvedValue(null);
    expect(await writeClaimAds(input)).toEqual({ ok: false, error: "ไม่พบแคมเปญนี้" });
    nothingSpent();
  });

  it("when its Page is no longer connected", async () => {
    project.myPages.mockResolvedValue([{ pageId: "P2", pageName: "เพจอื่น" }]);
    expect(await writeClaimAds(input)).toEqual({ ok: false, error: "เพจนี้ไม่ได้เชื่อมกับระบบแล้ว" });
    nothingSpent();
  });

  it("when the facts tell nothing", async () => {
    const r = await writeClaimAds({ ...input, facts: { kind: "ipd" } });
    expect(r).toEqual({ ok: false, error: "AI อ่านโรคหรือยอดเงินจากเอกสารไม่ได้ — ลองรูปที่ชัดขึ้น หรือเล่าในช่อง “เล่าเพิ่ม” นะครับ" });
    nothingSpent();
  });

  it("with the table on at an age the plan prices on no rung", async () => {
    campaigns.getCampaign.mockResolvedValue({ ...campaign, planHref: "/ishield" });
    expect(premiumTable("/ishield", 55)).toBeNull();
    expect(await writeClaimAds({ ...input, age: 55 })).toEqual({ ok: false, error: "อายุ 55 ปี แบบนี้คิดเบี้ยไม่ได้ ลองอายุอื่น" });
    nothingSpent();
  });

  it("with the table on for a plan that has no table at all says so, not the age", async () => {
    campaigns.getCampaign.mockResolvedValue({ ...campaign, planHref: "/no-such-plan" });
    expect(await writeClaimAds(input)).toEqual({
      ok: false, error: "แบบประกันนี้ยังไม่มีตารางเบี้ยสำหรับแอด — ปิด “ใส่ตารางเบี้ย” แล้วลองใหม่",
    });
    nothingSpent();
  });
});

describe("a Thai round with the table", () => {
  const table = premiumTable("/lifeprotect", 30)!;

  it("saves each ad into the campaign as a claim, the table and contacts in its body, its papers to check", async () => {
    const r = await writeClaimAds(input);
    expect(r.ok && r.items).toHaveLength(2);
    expect(ai.chat).toHaveBeenCalledTimes(2);
    const rows = saved();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toMatchObject({ planHref: "claim-review", format: "ad", campaignId: "c1", pageId: "P1" });
      expect(row.output.ad).toMatchObject({ kind: "claim", claimTable: true, tone: "", reader: "", age: 30, sex: "F" });
      expect(row.output.body).toContain(tableText(table));
      expect(row.output.body).toContain("👉 คุณเอ\n📲 Line: @abc123");
      expect(row.output.body.endsWith(DISCLAIMER)).toBe(true);
      expect(row.output.hooks).toEqual(["นอน รพ. 3 คืน"]);
      expect(row.output.closing).toBe("ทักแชทถามเรื่องเคลม");
      // the campaign's colour on the poster
      expect(row.output.poster.theme).toBe("emerald");
      expect(row.output.figures).toContain(tableText(table));
      expect(row.flags.numbers).toEqual([]);
    }
    // every ad its own copy of the papers, waiting for the owner's ตรวจแล้ว
    expect(store.saveBackground).toHaveBeenCalledTimes(2);
    expect(store.saveBackground.mock.calls.map(([id]) => id)).toEqual(["x1", "x2"]);
    if (!r.ok) throw new Error(r.error);
    for (const item of r.items) {
      expect(item.output.paperChecked).toBe(false);
      expect(item.output.poster?.documents).toEqual([{ path: `${item.id}/paper.png`, ratio: 0.75 }]);
    }
  });

  it("holds the round's price under the content budget, on the campaign's writer", async () => {
    campaigns.getCampaign.mockResolvedValue({ ...campaign, writer: "claude-sonnet-5" });
    await writeClaimAds(input);
    expect(store.holdContentBudget).toHaveBeenCalledTimes(1);
    expect(store.releaseContentBudget).toHaveBeenCalledWith("hold-1");
    expect(ai.chat.mock.calls[0][0].prefer).toBe("claude-sonnet-5");
  });

  it("flags a table premium the model restated in its story", async () => {
    const premium = table.rows[0].female!.toLocaleString("en-US");
    ai.chat.mockResolvedValue(writerReply({ story: ["ไข้เลือดออก นอน 3 คืน", `เบี้ยแค่ ${premium} บาท/ปี`] }));
    await writeClaimAds({ ...input, count: 1 });
    expect(saved()[0].flags.numbers.join(" ")).toContain(premium);
  });
});

describe("a Thai round without the table", () => {
  it("carries no premium and no age", async () => {
    await writeClaimAds({ ...input, withTable: false, age: undefined, sex: undefined });
    for (const row of saved()) {
      expect(row.output.body).not.toContain("บาท/ปี");
      expect(row.output.ad.age).toBeUndefined();
      expect(row.output.ad.sex).toBeUndefined();
      expect(row.output.ad.claimTable).toBe(false);
    }
  });

  it("is not refused at an age no table prices, since no table is drawn", async () => {
    campaigns.getCampaign.mockResolvedValue({ ...campaign, planHref: "/ishield" });
    const r = await writeClaimAds({ ...input, withTable: false, age: 55 });
    expect(r.ok).toBe(true);
  });
});

describe("an Expat campaign", () => {
  it("writes in English and ends on the English claim caution", async () => {
    campaigns.getCampaign.mockResolvedValue({ ...campaign, pageId: "112110731809903", planHref: "/ihealthy-ultra" });
    project.myPages.mockResolvedValue([{ pageId: "112110731809903", pageName: "Expat" }]);
    ai.chat.mockResolvedValue(writerReply({
      headline: "Three nights, paid", story: ["Dengue fever, three nights in hospital", "The insurer paid 45,000 THB"],
      cta: "Message us about claims", description: "Ask us about claims",
    }));
    await writeClaimAds({ ...input, count: 1 });
    expect(vi.mocked(claimAdMessages).mock.calls[0][4]).toBe("en");
    const [row] = saved();
    expect(row.output.body.endsWith(CLAIM_CAUTION_EN)).toBe(true);
    expect(row.output.lang).toBe("en");
    expect(row.output.disclaimer).toBe(DISCLAIMER_EN);
    expect(row.output.poster.lang).toBe("en");
  });
});
