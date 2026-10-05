import { beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetExceeded } from "@/lib/ai/client";
import { BANNED_SUPERLATIVES, assembleLongAd, briefWithoutPremiums, longAdMessages, parseLongAd, type LongAd, type LongAdContext } from "@/lib/content/ads";
import type { PiecePlan } from "@/lib/content/plan";
import { headlineFigures, premiumTable, tableText } from "@/lib/content/premium-table";
import { NUMBERS_PLANS } from "@/lib/content/numbers-plans";
import { personPhrases, premiumAmounts } from "@/lib/content/check";
import { briefFor } from "@/lib/content/brief";

const ai = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), chat: ai.chat }));
const { writeLongAds, DISCLAIMER } = await import("@/lib/content/write");

const table = [
  "แผนคุ้มครองมรดก 3,000,000 บาท",
  "🙆‍♀️ หญิง = 9,060 บาท/ปี (ตกเดือนละ 755)",
  "🕵️‍♂️ ชาย = 11,684 บาท/ปี (ตกเดือนละ 974)",
].join("\n");
const headline = "มรดกเพื่อครอบครัว\n💁‍♀️ แผนคุ้มครองมรดก 3,000,000 บาท\n💰 เบี้ยปีแรก 9,060 บาท/ปี (ตกเดือนละ 755) (หญิง อายุ 30 ปี)";
const contact = "👉 คุณเอ\n📲 Line: @abc\n👉 Inbox: https://m.me/123";
const owner = "หญิง อายุ 30 ปี · แผนคุ้มครองมรดก 3,000,000 บาท";
const ctx: LongAdContext = { table, headline, owner, contact, reader: "พ่อแม่มือใหม่", focus: "", voice: "" };
const plan: PiecePlan = { angle: "ครอบครัวไปต่อได้", hook: "ถ้าพรุ่งนี้ไม่มีเรา" };

const ad: LongAd = {
  opening: "ถ้าพรุ่งนี้ไม่มีเรา ครอบครัวจะไปต่ออย่างไร",
  bullets: ["🥇 เงินก้อนให้ครอบครัว", "🥇 ลดหย่อนภาษีได้"],
  cta: "ทักแชทเช็คเบี้ยฟรี แจ้งเพศ อายุ",
  hashtags: ["#ประกันชีวิต", "#มรดก"],
  headline: "มรดกให้ลูก", description: "ทักแชทได้เลย", imagePrompt: "a family", poster: undefined,
};

describe("longAdMessages", () => {
  const [system, user] = longAdMessages("ข้อมูลแบบประกัน", plan, { table, headline, owner, reader: ctx.reader, focus: "ทุนประกัน 1,000,000 ชาย 35 ปี", voice: "" });
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
  it("says whose ad it is, and that this line wins over the campaign's focus — the 2026-10-05 ad", () => {
    expect(user.content).toContain(`แอดนี้เป็นของ: ${owner}`);
    expect(user.content).toContain("ห้ามพูดถึงอายุ เพศ หรือทุนอื่น");
    expect(user.content).toContain("สิ่งที่อยากเน้น: ทุนประกัน 1,000,000 ชาย 35 ปี");
    // the owner line comes before the focus, and the focus is told it gives way
    expect(user.content.indexOf("แอดนี้เป็นของ")).toBeLessThan(user.content.indexOf("สิ่งที่อยากเน้น"));
    expect(user.content).toMatch(/ถ้าสิ่งที่อยากเน้น.*ให้ยึด/);
  });
});

describe("briefWithoutPremiums — the writer never sees a premium to copy", () => {
  const brief = briefFor("/lifeprotect")!.text;
  const kept = briefWithoutPremiums(brief);

  it("drops Life Protect's premium sample lines", () => {
    for (const gone of ["เบี้ยเฉลี่ยวันละ 20 บาท", "4,914 บาท/เดือน", "2,583 บาท/เดือน", "1,548 บาท/เดือน", "1,260 บาท/เดือน", "วันละ 48 บาท"]) {
      expect(brief, gone).toContain(gone);
      expect(kept, gone).not.toContain(gone);
    }
  });

  it("keeps the coverage, the ages, the terms and the cautions", () => {
    for (const stays of [
      "รับอายุ 0–80 ปี · คุ้มครองตลอดชีพ · ทุนสองเท่าถ้าเสียชีวิตก่อนอายุ 60",
      "ตัวอย่างทุนสองเท่า: ทุน 1,000,000 บาท ครอบครัวได้ 2,000,000 บาท",
      "เบี้ยเท่าเดิมทุกปี และจ่ายจบได้ใน 9 หรือ 19 ปี (หรือจ่ายตลอดชีพ)",
      "ทุนสองเท่าได้เฉพาะเสียชีวิตก่อนอายุที่กำหนด",
      "## Life Protect x 2",
    ]) expect(kept, stays).toContain(stays);
  });

  it("keeps a benefit paid by the day, a pension by the month, a discount in percent and years of paying", () => {
    const lines = "- ชดเชยนอนโรงพยาบาลวันละ 1,000–10,000 บาท\n- อยากได้บำนาญเดือนละ 10,000 บาท\n- ไม่เคลม 3 ปีติดต่อกัน ลดเบี้ย 10%\n- จ่ายเบี้ยแค่ 6 ปี แล้วคุ้มครองยาวตลอดชีพ";
    expect(briefWithoutPremiums(lines)).toBe(lines);
  });

  it("cuts only the premium clause, keeping the rest of the line's facts", () => {
    expect(briefWithoutPremiums("- ทุน 1,000,000 บาท ชำระเบี้ย 5 ปี (คุ้มครองถึงอายุ 40): เบี้ยเฉลี่ยวันละ 15 บาท"))
      .toBe("- ทุน 1,000,000 บาท ชำระเบี้ย 5 ปี (คุ้มครองถึงอายุ 40)");
  });

  it("drops a sample person's line, but keeps a fact found only there without the person", () => {
    expect(briefWithoutPremiums("- ผู้ชายอายุ 35 ทุน 1,000,000 บาท จ่าย 9 ปี: เบี้ย 4,914 บาท/เดือน (เฉลี่ยวันละ 150 บาท)")).toBe("");
    expect(briefWithoutPremiums("- เริ่มต้น: ผู้หญิงอายุ 35 ทุน 500,000 บาท (คุ้มครอง 1,000,000 บาท) เบี้ยเฉลี่ยวันละ 20 บาท")).toBe("");
    expect(briefWithoutPremiums("- ผู้ชายอายุ 35 ทุน 1,000,000 บาท ชำระเบี้ย 5 ปี (คุ้มครองถึงอายุ 40): เบี้ยเฉลี่ยวันละ 15 บาท"))
      .toBe("- ทุน 1,000,000 บาท ชำระเบี้ย 5 ปี (คุ้มครองถึงอายุ 40)");
    expect(briefWithoutPremiums("- ผู้ชายอายุ 45 ทุน 10,000,000 บาท ชำระเบี้ย 6 ปี: เบี้ย 86,400 บาท/เดือน (เฉลี่ยวันละ 2,631 บาท) (ส่งต่อได้ 1.7 เท่าของเบี้ยที่จ่ายรายปี)"))
      .toBe("- ทุน 10,000,000 บาท ชำระเบี้ย 6 ปี (ส่งต่อได้ 1.7 เท่าของเบี้ยที่จ่ายรายปี)");
  });

  it("keeps CI 123's caution, PLB's cover ages and Life Treasure's multiples, without their premiums — review 2026-10-05", () => {
    const ci = briefWithoutPremiums(briefFor("/ci123")!.text);
    expect(ci).toContain("เบี้ยส่วน CI 123 คิดตามอายุจริง ปรับขึ้นเมื่ออายุมากขึ้น — ทุกราคาเป็นเบี้ยปีแรก");
    const plb = briefWithoutPremiums(briefFor("/plb")!.text);
    for (const age of [40, 45, 47, 50]) expect(plb).toContain(`คุ้มครองถึงอายุ ${age}`);
    expect(plb).not.toMatch(/วันละ \d+ บาท/);
    const lt = briefWithoutPremiums(briefFor("/lifetreasure")!.text);
    for (const x of ["1.7", "1.8", "1.5"]) expect(lt).toContain(`ส่งต่อได้ ${x} เท่า`);
    for (const gone of ["86,400", "2,631", "42,750", "33,300"]) expect(lt).not.toContain(gone);
    const pension = briefWithoutPremiums(briefFor("/bumnan95")!.text);
    expect(pension).toContain("บำนาญเดือนละ 10,000 บาท");
    expect(pension).toContain("ทุน 787,402 บาท");
    expect(pension).not.toContain("374");
  });

  it("shows no sample person in any plan's ad brief — the root of the 2026-10-05 ad's second sample", () => {
    for (const href of Object.keys(NUMBERS_PLANS)) {
      const b = briefFor(href);
      if (!b) continue;
      expect(personPhrases(briefWithoutPremiums(b.text)), href).toEqual([]);
    }
    const lp = briefWithoutPremiums(briefFor("/lifeprotect")!.text);
    expect(lp).not.toContain("ทุน 500,000 บาท (คุ้มครอง 1,000,000 บาท)");
    expect(lp).not.toMatch(/ผู้(หญิง|ชาย)/);
    expect(lp).not.toMatch(/:\s*\(|:$/m);
  });

  it("no plan's brief keeps a line with a premium in it", () => {
    for (const href of Object.keys(NUMBERS_PLANS)) {
      const b = briefFor(href);
      if (!b) continue;
      for (const line of briefWithoutPremiums(b.text).split("\n")) {
        expect(premiumAmounts(line), href).toEqual([]);
        expect(line, href).not.toMatch(/\d\s*บาท\/(เดือน|ปี)|เบี้ย(ปีแรก)?(เฉลี่ย)?วันละ \d/);
      }
    }
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
  const intact = (out: string) => {
    expect([...out].length).toBeLessThanOrEqual(2200);
    expect(out).toContain(table);
    expect(out).toContain(headline);
    expect(out).toContain(contact);
    expect(out.endsWith("\n.")).toBe(false);
    expect(out).not.toContain("\n.\n.\n");
  };
  it("drops the hashtags first", () => {
    const long = { ...ad, bullets: Array.from({ length: 8 }, () => "🥇 " + "ก".repeat(120)), opening: "ข".repeat(900), hashtags: ["#" + "ค".repeat(300)] };
    const out = assembleLongAd(long, figures);
    intact(out);
    expect(out).not.toContain("#ค");
    expect(out).toContain(long.cta);
  });
  it("drops bullets from the last, keeping the cta, when the bullets are what make it too long", () => {
    const bullets = Array.from({ length: 8 }, (_, i) => `🥇 ${i}` + "ก".repeat(250));
    const out = assembleLongAd({ ...ad, bullets, hashtags: [] }, figures);
    intact(out);
    expect(out).toContain(ad.cta);
    expect(out).toContain(bullets[0]);
    expect(out).not.toContain(bullets[7]);
  });
  it("shortens a 2,500-character single-line opening and keeps the table and contacts whole", () => {
    const out = assembleLongAd({ ...ad, opening: "ข".repeat(2500), hashtags: [] }, figures);
    intact(out);
    expect(out.startsWith("ข")).toBe(true);
    expect(out).not.toContain("ข".repeat(2500));
  });
  it("keeps whole opening lines from the top while they fit", () => {
    const opening = ["หนึ่ง", "ก".repeat(1500), "ข".repeat(1500)].join("\n");
    const out = assembleLongAd({ ...ad, bullets: [], hashtags: [], opening }, figures);
    intact(out);
    expect(out).toContain("หนึ่ง\n" + "ก".repeat(1500));
    expect(out).not.toContain("ข".repeat(1500));
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

  it("leaves every plan's real table and headline figures as they are, through the owner's wording", async () => {
    // ownerWording (ตลอดชีพ, no ครับ/ค่ะ) runs over the whole assembled body, table included
    ai.chat.mockResolvedValue(reply("เปิดเรื่อง"));
    let tried = 0;
    for (const href of Object.keys(NUMBERS_PLANS)) {
      for (const age of [0, 1, 20, 30, 45, 55, 60, 70, 80]) {
        const t = premiumTable(href, age);
        if (!t) continue;
        tried++;
        const c = { ...ctx, table: tableText(t), headline: headlineFigures(t) };
        const [a] = (await writeLongAds({ brief: "brief", plans: [plan], ctx: c })).pieces;
        expect(a.output.body, `${href} at ${age}`).toContain(c.table);
        expect(a.output.body, `${href} at ${age}`).toContain(c.headline);
      }
    }
    expect(tried).toBeGreaterThan(30);
  });

  it("hands back the model's own words apart, without the code's figures — final review 4", async () => {
    ai.chat.mockResolvedValue({
      ...reply("เปิดเรื่อง"),
      text: JSON.stringify({
        opening: "เปิดเรื่อง", bullets: ["ข้อหนึ่ง"], cta: "ทักแชท", hashtags: ["#a"], headline: "หัวข้อ", description: "รอง", imagePrompt: "a family",
        poster: { layout: "bottom", blocks: [{ kind: "headline", text: "บนโปสเตอร์" }] },
      }),
    });
    const [a] = (await writeLongAds({ brief: "brief", plans: [plan], ctx })).pieces;
    expect(a.modelText).toBe(["เปิดเรื่อง", "🥇 ข้อหนึ่ง", "ทักแชท", "#a", "หัวข้อ", "รอง", "บนโปสเตอร์"].join("\n"));
    expect(a.modelText).not.toContain("9,060");
    expect(a.output).not.toHaveProperty("modelText");
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
