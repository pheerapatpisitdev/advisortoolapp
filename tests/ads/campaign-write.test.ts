import { beforeEach, describe, expect, it, vi } from "vitest";
import { headlineFigures, headlineOwner, premiumTable, tableText } from "@/lib/content/premium-table";
import { MAX_READER } from "@/lib/content/prompt";
import { OVERHEAD_THB, writerOf } from "@/lib/content/models";
import { BudgetExceeded } from "@/lib/ai/client";

/**
 * A round of long-form ads (Ads Studio, 2026-10-05): the premium table for the age, Organic's
 * planner for an angle and a hook per ad, then one long-ad writer per plan, saved into the
 * campaign. Of what the browser sends only the count, the angle, the reader and the age are
 * read; the campaign's product, Page, focus, voice and writer stand in for the rest. An age the
 * plan cannot price is refused before anything is counted, held or written. The planner and the
 * writers run for real here; only the AI behind them is mocked.
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

const { generateContent, saveContentEdits } = await import("@/app/studio/actions");

const campaign = {
  id: "c1", createdAt: "2026-10-04T00:00:00Z", pageId: "P1", planHref: "/lifeprotect", name: null,
  angles: 3, tones: 1, theme: null, hint: "เน้นครอบครัว", agentId: null,
  brandVoice: "อบอุ่น เป็นกันเอง", writer: null, painter: null, person: null,
};
const contact = { agentName: "คุณเอ", lineId: "abc123", inboxUrl: "https://m.me/104857600123456" };

/** an earlier ad of the campaign, whose headline the planner is told not to repeat */
const earlier = { id: "old", status: "trashed", output: { hooks: ["หัวเก่าของแคมเปญ"], body: "", closing: "", hashtags: [], imagePrompt: "", disclaimer: "" } };

// what the browser may send: another product and Page, and values an ad round does not read
const sent = {
  href: "/ishield", format: "ad" as const, angle: "family" as const, custom: "", length: null, count: 2, hookTemplateId: null,
  page: "P9", adAngles: 1, adTones: 2, writer: "nope", theme: "pink", fact: "เรื่องจริงจากเบราว์เซอร์",
  reader: "พ่อแม่มือใหม่", age: 30, campaignId: "c1",
};

const plannerReply = (n: number) => ({
  text: JSON.stringify({ plans: Array.from({ length: n }, (_, i) => ({ angle: `มุมที่ ${i + 1}`, hook: `ฮุกที่ ${i + 1}` })) }),
  model: "small", costThb: 0.2, outputTokens: 50,
});
const writerReply = {
  text: JSON.stringify({
    opening: "ถ้าพรุ่งนี้ไม่มีเรา ครอบครัวจะไปต่ออย่างไร", bullets: ["🥇 เงินก้อนให้ครอบครัว", "🥇 ลดหย่อนภาษีได้"],
    cta: "ทักแชทเช็คเบี้ยฟรี แจ้งเพศ อายุ", hashtags: ["#ประกันชีวิต"], headline: "มรดกให้ลูก", description: "ทักแชทได้เลย", imagePrompt: "a family",
  }),
  model: "m", costThb: 1, outputTokens: 300,
};
/** the planner is asked for "วางแผน N ชิ้น…" and answers with N plans; every other call is a writer */
const asked = (messages: { content: string }[]) => Number(/วางแผน (\d+) ชิ้น/.exec(messages[1].content)?.[1] ?? 1);
const callsFor = (task: string) => ai.chat.mock.calls.map(([o]) => o).filter((o) => o.task === task);
const saved = () => store.saveContent.mock.calls.map(([row]) => row);
/** the writer answers with these words of its own in place of the usual ones */
const writes = (own: Record<string, unknown>) => {
  const reply = { ...writerReply, text: JSON.stringify({ ...JSON.parse(writerReply.text), ...own }) };
  ai.chat.mockImplementation(async (o: { task: string; messages: { content: string }[] }) =>
    (o.task === "content-plan" ? plannerReply(asked(o.messages)) : reply));
};

beforeEach(() => {
  vi.clearAllMocks();
  viewer.owner = true;
  project.projectPage.mockImplementation(async (p?: string) => ({ ok: true, pageId: p ?? null }));
  project.myPages.mockResolvedValue([{ pageId: "P1", pageName: "เพจ" }]);
  campaigns.getCampaign.mockResolvedValue(campaign);
  campaigns.listCampaignPieces.mockResolvedValue([earlier]);
  contacts.getPageContact.mockResolvedValue(contact);
  ai.chat.mockImplementation(async (o: { task: string; messages: { content: string }[] }) =>
    (o.task === "content-plan" ? plannerReply(asked(o.messages)) : writerReply));
  store.saveContent.mockImplementation(async (row: Record<string, unknown>) => ({ id: "x", costThb: row.costThb, ...row }));
  store.usedHooks.mockResolvedValue(["ฮุกของเพจ"]);
});

function nothingSpent() {
  expect(quota.takeRound).not.toHaveBeenCalled();
  expect(store.holdContentBudget).not.toHaveBeenCalled();
  expect(ai.chat).not.toHaveBeenCalled();
  expect(store.saveContent).not.toHaveBeenCalled();
}

describe("an ad round is refused before anything is counted", () => {
  it("without a campaign", async () => {
    expect(await generateContent({ ...sent, campaignId: undefined })).toEqual({ ok: false, error: "โฆษณาย้ายไปทำใน Ads Studio แล้ว" });
    nothingSpent();
  });

  it("for anyone but the owner", async () => {
    viewer.owner = false;
    expect(await generateContent(sent)).toEqual({ ok: false, error: "ไม่มีสิทธิ์ใช้ส่วนนี้" });
    expect(campaigns.getCampaign).not.toHaveBeenCalled();
    nothingSpent();
  });

  it("when the campaign is not found", async () => {
    campaigns.getCampaign.mockResolvedValue(null);
    expect(await generateContent(sent)).toEqual({ ok: false, error: "ไม่พบแคมเปญนี้" });
    nothingSpent();
  });

  it("when its Page is no longer connected", async () => {
    project.myPages.mockResolvedValue([{ pageId: "P2", pageName: "เพจอื่น" }]);
    expect(await generateContent(sent)).toEqual({ ok: false, error: "เพจนี้ไม่ได้เชื่อมกับระบบแล้ว" });
    expect(project.projectPage).not.toHaveBeenCalled();
    nothingSpent();
  });

  it("at an age the plan prices on no rung — review focus 1", async () => {
    // iShield sells only to 51
    campaigns.getCampaign.mockResolvedValue({ ...campaign, planHref: "/ishield" });
    expect(premiumTable("/ishield", 55)).toBeNull();
    expect(await generateContent({ ...sent, age: 55 })).toEqual({ ok: false, error: "อายุ 55 ปี แบบนี้คิดเบี้ยไม่ได้ ลองอายุอื่น" });
    nothingSpent();
  });

  it("for a plan with no premium table at all, saying so rather than blaming the age — final review 9", async () => {
    campaigns.getCampaign.mockResolvedValue({ ...campaign, planHref: "/no-table" });
    expect(await generateContent(sent)).toEqual({ ok: false, error: "แบบประกันนี้ยังไม่มีตารางเบี้ยสำหรับแอด" });
    nothingSpent();
  });

  it("but a campaign without dimensions is written — they are no longer read", async () => {
    const r = await generateContent(sent);
    expect(r.ok).toBe(true);
  });
});

describe("a round of long ads", () => {
  const table = tableText(premiumTable("/lifeprotect", 30)!);
  const headline = headlineFigures(premiumTable("/lifeprotect", 30)!);

  it("saves two ads into the campaign, on its Page and product, each with the table and the Page's contacts", async () => {
    const r = await generateContent(sent);
    expect(r.ok && r.items).toHaveLength(2);
    expect(project.projectPage).toHaveBeenCalledWith("P1");
    expect(callsFor("content")).toHaveLength(2);
    const rows = saved();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toMatchObject({ campaignId: "c1", pageId: "P1", planHref: "/lifeprotect", format: "ad" });
      expect(row.output.body).toContain(table);
      expect(row.output.body).toContain(headline);
      expect(row.output.body).toContain("👉 คุณเอ\n📲 Line: @abc123\n👉 Inbox: https://m.me/104857600123456");
    }
    // the browser's story is not an ad's
    expect(JSON.stringify(ai.chat.mock.calls)).not.toContain("เรื่องจริงจากเบราว์เซอร์");
  });

  it("keeps the figures it was written from, and names its angle, reader and age — no combination", async () => {
    await generateContent(sent);
    const [row] = saved();
    expect(row.output.figures).toContain(`${table}\n${headline}`);
    expect(row.output.ad).toEqual({ angle: "มุมที่ 1", tone: "", reader: "พ่อแม่มือใหม่", age: 30, sex: "F", head: premiumTable("/lifeprotect", 30)!.rows[2].heading });
    expect(saved()[1].output.ad.angle).toBe("มุมที่ 2");
  });

  it("flags none of its own figures, the contacts' digits included", async () => {
    await generateContent(sent);
    for (const row of saved()) expect(row.flags.numbers).toEqual([]);
  });


  it("flags a premium of the table the model restated in its opening — final review 4", async () => {
    writes({ opening: "ทุน 2 ล้าน เบี้ยแค่ 43,200 บาท/ปี ครอบครัวไปต่อได้" });
    await generateContent(sent);
    for (const row of saved()) expect(row.flags.numbers).toEqual(["43,200 บาท"]);
  });

  it("flags one restated as a month, in a bullet or on the poster", async () => {
    writes({
      bullets: ["🥇 ตกเดือนละ 3,600 บาทเท่านั้น"],
      poster: { layout: "bottom", blocks: [{ kind: "headline", text: "เบี้ย 21,600 บาท/ปี" }] },
    });
    await generateContent(sent);
    const [row] = saved();
    expect(row.flags.numbers).toContain("3,600 บาท");
    expect(row.flags.numbers).toContain("21,600 บาท");
  });

  it("leaves coverage named from the brief alone, and never flags the table the code placed", async () => {
    writes({ opening: "ทุน 1,000,000 บาท ครอบครัวได้ 2,000,000 บาท", bullets: ["🥇 จ่ายจบได้ใน 9 หรือ 19 ปี"] });
    await generateContent(sent);
    for (const row of saved()) {
      expect(row.flags.numbers).toEqual([]);
      expect(row.output.body).toContain(table);
    }
  });

  it("does not save the model's words apart from the piece", async () => {
    await generateContent(sent);
    for (const row of saved()) {
      expect(row).not.toHaveProperty("modelText");
      expect(row.output).not.toHaveProperty("modelText");
    }
  });

  it("tells the planner the campaign's earlier headlines and the Page's hooks to avoid, its focus before the angle, and the reader", async () => {
    await generateContent(sent);
    const [planner] = callsFor("content-plan");
    const user = planner.messages[1].content;
    expect(user).toContain("หัวเก่าของแคมเปญ");
    expect(user).toContain("ฮุกของเพจ");
    expect(user).toContain("มุมที่เจ้าของเพจอยากเล่า: เน้นครอบครัว — คุ้มครองครอบครัว");
    expect(user).toContain("พ่อแม่มือใหม่");
    expect(user).toContain("วางแผน 2 ชิ้น");
  });

  it("an earlier pieces read that fails still writes, without them to avoid", async () => {
    campaigns.listCampaignPieces.mockRejectedValue(new Error("db down"));
    const r = await generateContent(sent);
    expect(r.ok).toBe(true);
    expect(callsFor("content-plan")[0].messages[1].content).toContain("ฮุกของเพจ");
  });

  it("gives each writer the campaign's focus and voice, the table and the reader, but not the contacts", async () => {
    await generateContent(sent);
    const user = callsFor("content")[0].messages[1].content;
    expect(user).toContain("สิ่งที่อยากเน้น: เน้นครอบครัว");
    expect(user).toContain("น้ำเสียงแบรนด์: อบอุ่น เป็นกันเอง");
    expect(user).toContain(table);
    expect(user).toContain("กลุ่มคนที่พูดด้วย: พ่อแม่มือใหม่");
    expect(user).not.toContain("m.me");
  });

  it("a Page with no contacts ends on the plain invitation", async () => {
    contacts.getPageContact.mockResolvedValue(null);
    await generateContent(sent);
    expect(saved()[0].output.body).toContain("ทักแชทได้เลย");
  });

  it("a Page's contacts that cannot be read fail the round before the AI is asked", async () => {
    contacts.getPageContact.mockRejectedValue(new Error("db down"));
    const r = await generateContent(sent);
    expect(r.ok).toBe(false);
    expect(ai.chat).not.toHaveBeenCalled();
    expect(store.saveContent).not.toHaveBeenCalled();
    expect(store.releaseContentBudget).toHaveBeenCalledWith("hold-1");
  });

  it("holds the round's price for the ads it will write", async () => {
    await generateContent(sent);
    const writer = writerOf(undefined, 1000);
    expect((store.holdContentBudget.mock.calls[0] as unknown[])[0] as number).toBeCloseTo(2 * (writer.thb + OVERHEAD_THB));
  });

  it("stopped by the month's AI budget part way keeps what was written and says so", async () => {
    let writers = 0;
    ai.chat.mockImplementation(async (o: { task: string; messages: { content: string }[] }) => {
      if (o.task === "content-plan") return plannerReply(asked(o.messages));
      if (writers++ === 0) return writerReply;
      throw new BudgetExceeded();
    });
    const r = await generateContent(sent);
    expect(r).toMatchObject({ ok: false, saved: 1, error: expect.stringContaining("ถึงงบค่า AI ของเดือนนี้แล้ว") });
    expect(store.releaseContentBudget).toHaveBeenCalledWith("hold-1");
  });

  it("does not move the campaign's old queue on", async () => {
    await generateContent(sent);
    expect(campaigns.updateCampaign).not.toHaveBeenCalled();
  });
});

describe("the inputs of an ad round, cleaned", () => {
  it.each([
    [9, 4], [4, 4], [0, 1], ["x", 1], [2.4, 2],
  ])("count %s writes %s", async (count, n) => {
    await generateContent({ ...sent, count: count as number });
    expect(callsFor("content-plan")[0].messages[1].content).toContain(n > 1 ? `วางแผน ${n} ชิ้น` : "วางแผน 1 ชิ้น");
    expect(saved()).toHaveLength(n);
  });

  it.each([
    [31.7, 31], ["x", 30], [undefined, 30], [95, 80], [-3, 0],
  ])("age %s is priced as %s", async (age, settled) => {
    await generateContent({ ...sent, age: age as number });
    const t = premiumTable("/lifeprotect", settled)!;
    expect(saved()[0].output.body).toContain(tableText(t));
    expect(saved()[0].output.ad.age).toBe(settled);
  });

  it("a man of 35 on the 1,000,000 row: the headline, the writer's owner line and the piece all say so — the 2026-10-05 ad", async () => {
    const t = premiumTable("/lifeprotect", 35)!;
    const rung = t.rows.findIndex((r) => r.heading === "ประกันชีวิตคุ้มครอง 1,000,000 บาท");
    await generateContent({ ...sent, age: 35, sex: "M", rung });
    const [row] = saved();
    expect(row.output.body).toContain(headlineFigures(t, { sex: "M", rung }));
    expect(row.output.body).toContain("(ชาย อายุ 35 ปี)");
    expect(row.output.body).toContain(tableText(t));
    expect(row.output.ad).toMatchObject({ age: 35, sex: "M", head: "ประกันชีวิตคุ้มครอง 1,000,000 บาท" });
    const user = callsFor("content")[0].messages[1].content;
    expect(user).toContain(`แอดนี้เป็นของ: ${headlineOwner(t, { sex: "M", rung }).line}`);
    expect(user).toContain("ชาย อายุ 35 ปี · ประกันชีวิตคุ้มครอง 1,000,000 บาท");
  });

  it("tells the planner whose ad it is too, the same line as the writer — its hooks become the openings", async () => {
    const t = premiumTable("/lifeprotect", 35)!;
    await generateContent({ ...sent, age: 35, sex: "M", rung: 1 });
    const planner = callsFor("content-plan")[0].messages[1].content;
    expect(planner).toContain(`แอดนี้เป็นของ: ${headlineOwner(t, { sex: "M", rung: 1 }).line}`);
    expect(planner).toContain("ชาย อายุ 35 ปี · ประกันชีวิตคุ้มครอง 1,000,000 บาท");
    expect(planner).toContain("ห้ามพูดถึงอายุ เพศ หรือทุนอื่น");
    // the focus still goes first, as before
    expect(planner).toContain("มุมที่เจ้าของเพจอยากเล่า: เน้นครอบครัว — คุ้มครองครอบครัว\nแอดนี้เป็นของ:");
  });

  it.each([
    [{ sex: "X", rung: 99 }, "F", 2], [{ sex: undefined, rung: "1" }, "F", 2], [{ sex: "M", rung: -1 }, "M", 2],
    [{ sex: "M", rung: 1.5 }, "M", 2], [{ sex: "M", rung: 5 }, "M", 5], [{ sex: "F", rung: 0 }, "F", 0],
  ])("sex and rung %o are cleaned to %s on row %s", async (pick, sex, rung) => {
    await generateContent({ ...sent, ...(pick as object) });
    const t = premiumTable("/lifeprotect", 30)!;
    const [row] = saved();
    expect(row.output.body).toContain(headlineFigures(t, { sex: sex as "F" | "M", rung }));
    expect(row.output.ad).toMatchObject({ sex, head: t.rows[rung].heading });
  });

  it("neither the planner nor the writer is shown the brief's premium samples, though the yardstick keeps them", async () => {
    // the model copied "เบี้ยเดือนละ 1,548 บาท" from the brief's sample cases (2026-10-05)
    writes({ bullets: ["🥇 เบี้ยเดือนละ 1,548 บาท"] });
    await generateContent(sent);
    for (const call of [...callsFor("content-plan"), ...callsFor("content")]) {
      const user = call.messages[1].content;
      expect(user).toContain("ตัวอย่างทุนสองเท่า");
      expect(user).not.toContain("1,548 บาท/เดือน");
      expect(user).not.toContain("เบี้ยเฉลี่ยวันละ 20 บาท");
    }
    // a premium the brief has is still flagged in the model's words
    for (const row of saved()) expect(row.flags.numbers).toEqual(["1,548 บาท"]);
  });

  it("the reader is cut to its length, and a custom angle to 120", async () => {
    const reader = "ก".repeat(MAX_READER + 30);
    await generateContent({ ...sent, reader, angle: "custom", custom: "ข".repeat(200) });
    expect(saved()[0].output.ad.reader).toBe("ก".repeat(MAX_READER));
    const user = callsFor("content-plan")[0].messages[1].content;
    expect(user).toContain(`เน้นครอบครัว — ${"ข".repeat(120)}`);
    expect(user).not.toContain("ข".repeat(121));
  });

  it("ตัวเลขชัดๆ, a post's angle, becomes the AI's pick rather than a refusal", async () => {
    const r = await generateContent({ ...sent, angle: "numbers" });
    expect(r.ok).toBe(true);
    expect(callsFor("content-plan")[0].messages[1].content).toContain("มุมที่เจ้าของเพจอยากเล่า: เน้นครอบครัว\n");
  });

  it("without a focus the angle is told alone", async () => {
    campaigns.getCampaign.mockResolvedValue({ ...campaign, hint: null });
    await generateContent(sent);
    expect(callsFor("content-plan")[0].messages[1].content).toContain("มุมที่เจ้าของเพจอยากเล่า: คุ้มครองครอบครัว\n");
  });
});

describe("an ad edited later — review focus 2", () => {
  /** the piece as it was saved, read back for an edit */
  async function editUnchanged(): Promise<{ numbers: string[] }> {
    const [row] = saved();
    const item = { ...row, id: "x", createdAt: "", status: "draft", publish: null, agentId: null, plan: null, flags: row.flags };
    store.getContent.mockResolvedValue(item);
    store.saveOutputIf.mockImplementation(async (_id: string, output: unknown, flags: unknown) => ({ ...item, output, flags }));
    const o = row.output;
    const r = await saveContentEdits("x", { hooks: o.hooks, body: o.body, closing: o.closing, hashtags: o.hashtags, poster: o.poster });
    expect(r.ok).toBe(true);
    return store.saveOutputIf.mock.calls[0][2];
  }

  it("keeps the table's figures allowed", async () => {
    await generateContent(sent);
    expect((await editUnchanged()).numbers).toEqual([]);
  });

  it("with satang in the table (Legacy at 55) flags no figure, when written or edited", async () => {
    campaigns.getCampaign.mockResolvedValue({ ...campaign, planHref: "/legacy" });
    const t = premiumTable("/legacy", 55)!;
    expect(tableText(t)).toMatch(/\d\.50 บาท\/ปี/);
    await generateContent({ ...sent, age: 55 });
    const [row] = saved();
    expect(row.output.body).toContain(tableText(t));
    expect(row.flags.numbers).toEqual([]);
    expect((await editUnchanged()).numbers).toEqual([]);
  });

  it("still flags a premium the owner types in", async () => {
    await generateContent(sent);
    const [row] = saved();
    store.getContent.mockResolvedValue({ ...row, id: "x", status: "draft", publish: null, flags: row.flags });
    store.saveOutputIf.mockImplementation(async (_id: string, output: unknown, flags: unknown) => ({ ...row, output, flags }));
    const o = row.output;
    await saveContentEdits("x", { hooks: o.hooks, body: `${o.body}\nเบี้ยแค่ 1,234 บาท`, closing: o.closing, hashtags: o.hashtags });
    expect(store.saveOutputIf.mock.calls[0][2].numbers).toContain("1,234 บาท");
  });
});

describe("a post or a script", () => {
  it("is written as before: no campaign is read, none is saved", async () => {
    await generateContent({ ...sent, format: "post" }).catch(() => {});
    expect(campaigns.getCampaign).not.toHaveBeenCalled();
    expect(contacts.getPageContact).not.toHaveBeenCalled();
    for (const row of saved()) expect(row.campaignId ?? null).toBeNull();
  });
});
