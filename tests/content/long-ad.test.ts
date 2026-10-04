import { beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetExceeded } from "@/lib/ai/client";
import { BANNED_SUPERLATIVES, assembleLongAd, longAdMessages, parseLongAd, type LongAd, type LongAdContext } from "@/lib/content/ads";
import type { PiecePlan } from "@/lib/content/plan";

const ai = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), chat: ai.chat }));
const { writeLongAds, DISCLAIMER } = await import("@/lib/content/write");

const table = [
  "แผนคุ้มครองมรดก 3,000,000 บาท",
  "🙆‍♀️ หญิง = 9,060 บาท/ปี (ตกเดือนละ 755)",
  "🕵️‍♂️ ชาย = 11,684 บาท/ปี (ตกเดือนละ 974)",
].join("\n");
const headline = "💁‍♀️ คุ้มครองชีวิต 3,000,000 บาท\n💰 ออมเพียง 9,060 บาท/ปี";
const contact = "👉 คุณเอ\n📲 Line: @abc\n👉 Inbox: https://m.me/123";
const ctx: LongAdContext = { table, headline, contact, reader: "พ่อแม่มือใหม่", focus: "", voice: "" };
const plan: PiecePlan = { angle: "ครอบครัวไปต่อได้", hook: "ถ้าพรุ่งนี้ไม่มีเรา" };

const ad: LongAd = {
  opening: "ถ้าพรุ่งนี้ไม่มีเรา ครอบครัวจะไปต่ออย่างไร",
  bullets: ["🥇 เงินก้อนให้ครอบครัว", "🥇 ลดหย่อนภาษีได้"],
  cta: "ทักแชทเช็คเบี้ยฟรี แจ้งเพศ อายุ",
  hashtags: ["#ประกันชีวิต", "#มรดก"],
  headline: "มรดกให้ลูก", description: "ทักแชทได้เลย", imagePrompt: "a family", poster: undefined,
};

describe("longAdMessages", () => {
  const [system, user] = longAdMessages("ข้อมูลแบบประกัน", plan, { table, headline, reader: ctx.reader, focus: "", voice: "" });
  it("tells the writer the format, that the code writes the premiums, and the banned claims", () => {
    expect(system.content).toContain("ห้ามเขียนเบี้ย");
    expect(system.content).toContain("🥇");
    expect(system.content).toContain("กฎโฆษณาของ Facebook");
    for (const s of BANNED_SUPERLATIVES) expect(system.content).toContain(s);
  });
  it("shows the table and the hook, and never the contacts", () => {
    expect(user.content).toContain(table);
    expect(user.content).toContain(plan.hook);
    expect(user.content).not.toContain("m.me");
  });
});

describe("parseLongAd", () => {
  const base = { opening: "เปิด", bullets: ["ข้อหนึ่ง"], cta: "ทัก", hashtags: ["แท็ก"], headline: "หัว", description: "รอง" };
  it("prefixes 🥇, adds #, and cuts to 8 bullets and 12 hashtags", () => {
    const a = parseLongAd(JSON.stringify({ ...base, bullets: Array.from({ length: 10 }, (_, i) => (i === 0 ? "🥇 ok" : `ข้อ ${i}`)), hashtags: Array.from({ length: 15 }, (_, i) => `t${i}`) }))!;
    expect(a.bullets).toHaveLength(8);
    expect(a.bullets.every((b) => b.startsWith("🥇"))).toBe(true);
    expect(a.bullets[0]).toBe("🥇 ok");
    expect(a.hashtags).toHaveLength(12);
    expect(a.hashtags.every((h) => h.startsWith("#"))).toBe(true);
  });
  it("is null without a headline or an opening", () => {
    expect(parseLongAd(JSON.stringify({ ...base, headline: "" }))).toBeNull();
    expect(parseLongAd(JSON.stringify({ ...base, opening: "" }))).toBeNull();
  });
});

describe("assembleLongAd", () => {
  const figures = { headline, table, contact };
  it("puts the blocks in order, joined by the spacer, the table verbatim", () => {
    const out = assembleLongAd(ad, figures);
    expect(out).toBe([ad.opening, headline, ad.bullets.join("\n"), table, ad.cta, contact, "#ประกันชีวิต #มรดก"].join("\n.\n"));
    for (const f of ["9,060", "755", "11,684", "974"]) expect(out).toContain(f);
  });
  it("stays within 2,200 characters, dropping the hashtags first", () => {
    const long = { ...ad, bullets: Array.from({ length: 8 }, () => "🥇 " + "ก".repeat(120)), opening: "ข".repeat(900), hashtags: ["#" + "ค".repeat(300)] };
    const out = assembleLongAd(long, figures);
    expect([...out].length).toBeLessThanOrEqual(2200);
    expect(out).not.toContain("#ค");
    expect(out).toContain(table);
  });
  it("cuts at a line boundary when even the body is too long", () => {
    const long = { ...ad, opening: "ข".repeat(2500), hashtags: [] };
    const out = assembleLongAd(long, figures);
    expect([...out].length).toBeLessThanOrEqual(2200);
  });
});

describe("writeLongAds", () => {
  const reply = (opening: string) => ({
    text: JSON.stringify({ opening, bullets: ["ข้อหนึ่ง"], cta: "ทักแชทเช็คเบี้ยฟรี", hashtags: ["#a"], headline: "หัวข้อ", description: "รอง", imagePrompt: "a family" }),
    model: "m", costThb: 1.5, outputTokens: 100,
  });
  beforeEach(() => vi.clearAllMocks());

  it("assembles each piece with the code's figures and never shows the model the contacts", async () => {
    ai.chat.mockResolvedValue(reply("เปิดเรื่อง"));
    const round = await writeLongAds({ brief: "brief", plans: [plan, { angle: "อีกมุม", hook: "ฮุกสอง" }], ctx });
    expect(ai.chat).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(ai.chat.mock.calls[0][0].messages)).not.toContain("m.me");
    const [a] = round.pieces;
    expect(a.output.body).toContain(table);
    expect(a.output.body).toContain(contact);
    expect(a.output.body.startsWith("เปิดเรื่อง")).toBe(true);
    expect(a.output.hooks).toEqual(["หัวข้อ"]);
    expect(a.output.closing).toBe("รอง");
    expect(a.output.angle).toBe(plan.angle);
    expect(a.output.hashtags).toEqual([]);
    expect(a.output.disclaimer).toBe(DISCLAIMER);
    expect(a.output.ad).toEqual({ angle: plan.angle, tone: "" });
    expect(a.costThb).toBe(1.5);
  });

  it("keeps the ones written when the budget stops the rest", async () => {
    ai.chat.mockResolvedValueOnce(reply("เปิด")).mockRejectedValueOnce(new BudgetExceeded());
    const round = await writeLongAds({ brief: "brief", plans: [plan, plan], ctx });
    expect(round.pieces).toHaveLength(1);
    expect(round.budgetHit).toBe(1);
  });

  it("throws the budget refusal when nothing was written", async () => {
    ai.chat.mockRejectedValue(new BudgetExceeded());
    await expect(writeLongAds({ brief: "brief", plans: [plan], ctx })).rejects.toBeInstanceOf(BudgetExceeded);
  });
});
