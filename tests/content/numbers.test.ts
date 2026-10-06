import { describe, expect, it } from "vitest";
import { anglesFor, angleText, NUMBERS_HREFS } from "@/lib/content/prompt";

describe("anglesFor", () => {
  it("offers ตัวเลขชัดๆ only for a post on a plan that has number cases", () => {
    expect(anglesFor("post", "/lifeprotect").some((a) => a.id === "numbers")).toBe(true);
    expect(anglesFor("ad", "/lifeprotect").some((a) => a.id === "numbers")).toBe(false);
    expect(anglesFor("script", "/lifeprotect").some((a) => a.id === "numbers")).toBe(false);
    expect(anglesFor("post", "/group-insurance").some((a) => a.id === "numbers")).toBe(false);
  });
  it("keeps every other angle everywhere", () => {
    expect(anglesFor("ad", "/plb").map((a) => a.id)).toContain("family");
  });
  it("offers แม่เลี้ยงเดี่ยว on the six life plans only, in every format", () => {
    const has = (href: string, f: "post" | "script" | "ad" = "post") => anglesFor(f, href).some((a) => a.id === "singlemom");
    for (const href of ["/lifeprotect", "/plb", "/easyprotect", "/lifetreasure", "/legacy", "/ishield"]) {
      expect(has(href), href).toBe(true);
      expect(has(href, "ad"), href).toBe(true);
      expect(has(href, "script"), href).toBe(true);
    }
    for (const href of ["/ihealthy-ultra", "/ci123", "/cancer", "/bumnan95", "/group-insurance"]) expect(has(href), href).toBe(false);
  });
  it("tells the model to write แม่เลี้ยงเดี่ยว with respect, about what the child is left with", () => {
    const say = angleText("singlemom", "");
    expect(say).toMatch(/ลูกยังมีเงินก้อน/);
    expect(say).toMatch(/ห้ามเขียนแบบน่าสงสาร/);
    expect(say).toMatch(/ห้ามพูดถึงพ่อของลูก/);
  });
  it("offers พ่อแม่มือใหม่ and คู่แต่งงานใหม่ on the six life plans only", () => {
    const has = (id: string, href: string) => anglesFor("ad", href).some((a) => a.id === id);
    for (const id of ["newparent", "newlywed"]) {
      for (const href of ["/lifeprotect", "/plb", "/easyprotect", "/lifetreasure", "/legacy", "/ishield"]) expect(has(id, href), `${id} ${href}`).toBe(true);
      for (const href of ["/ihealthy-ultra", "/ci123", "/cancer", "/bumnan95"]) expect(has(id, href), `${id} ${href}`).toBe(false);
    }
  });
  it("tells the model to write the new-family angles warmly, without fear", () => {
    expect(angleText("newparent", "")).toMatch(/ห้ามขู่ให้กลัว/);
    expect(angleText("newparent", "")).toMatch(/ลูกยังมีเงินก้อน/);
    expect(angleText("newlywed", "")).toMatch(/ห้ามระบุเพศของคู่/);
    expect(angleText("newlywed", "")).toMatch(/ไม่ต้องแบกภาระคนเดียว/);
  });
  it("offers เบี้ยไม่ทิ้ง only on the plans whose premiums come back", () => {
    const has = (href: string, f: "post" | "script" | "ad" = "post") => anglesFor(f, href).some((a) => a.id === "nowaste");
    for (const href of ["/lifeprotect", "/easyprotect", "/lifetreasure", "/ishield", "/bumnan95"]) {
      expect(has(href), href).toBe(true);
      expect(has(href, "ad"), href).toBe(true);
    }
    for (const href of ["/plb", "/legacy", "/ci123", "/cancer", "/ihealthy-ultra"]) expect(has(href), href).toBe(false);
  });
  it("keeps เบี้ยไม่ทิ้ง from promising a return or an early surrender worth the premiums", () => {
    const say = angleText("nowaste", "");
    expect(say).toMatch(/ห้ามเรียกว่าการลงทุน/);
    expect(say).toMatch(/ห้ามพูดถึงผลตอบแทนเป็นเปอร์เซ็นต์/);
    expect(say).toMatch(/เวนคืนในช่วงปีแรกๆ จะได้น้อยกว่าเบี้ยที่จ่าย/);
  });
  it("covers all ten content plans", () => {
    expect(NUMBERS_HREFS).toHaveLength(10);
  });
});

import { numbersBody, numbersPoster, numbersYardstick, safeHeadline, type NumberSheet } from "@/lib/content/numbers";
import { ENGLISH_RULES } from "@/lib/content/prompt";
import { strayNumbers } from "@/lib/content/check";
import { MAX_CHARS } from "@/lib/content/poster";

const sheet: NumberSheet = {
  product: "Life Protect x 2",
  sumLine: "ประกันชีวิตทุน 1,000,000 บาท",
  annualSatang: 1_854_000,
  premiumLine: "เบี้ย 1,548 บาท ต่อเดือน",
  perDayLine: "ตกวันละ 48 บาท",
  claims: ["เบี้ยไม่เพิ่ม", "เสียชีวิตก่อน 60 รับ 2,000,000 บาท"],
  who: "ชาย 35 ปี จ่ายถึงอายุ 99",
  poster: { big: "เบี้ย 1,548 บาท/เดือน", small: "ทุน 1,000,000 บาท · ตกวันละ 48 บาท" },
};

describe("a number sheet", () => {
  it("reads as the owner's example", () => {
    expect(numbersBody(sheet)).toBe(
      "ประกันชีวิตทุน 1,000,000 บาท\nเบี้ย 1,548 บาท ต่อเดือน\nตกวันละ 48 บาท\nเบี้ยไม่เพิ่ม\nเสียชีวิตก่อน 60 รับ 2,000,000 บาท\n(ชาย 35 ปี จ่ายถึงอายุ 99)",
    );
  });
  it("hands the number check every figure it wrote", () => {
    expect(strayNumbers(numbersBody(sheet) + "\n" + sheet.poster.big + "\n" + sheet.poster.small, numbersYardstick([sheet]))).toEqual([]);
  });
  it("fits the poster's line limits", () => {
    const p = numbersPoster(sheet);
    for (const b of p.blocks) expect(b.text.length).toBeLessThanOrEqual(MAX_CHARS[b.kind]);
    expect(p.blocks.find((b) => b.kind === "headline")?.text).toBe("เบี้ย 1,548 บาท/เดือน");
  });
});

describe("safeHeadline", () => {
  it("keeps a headline without digits", () => {
    expect(safeHeadline("ความคุ้มครองก้อนใหญ่ ในเบี้ยที่จ่ายไหว", "สำรอง")).toBe("ความคุ้มครองก้อนใหญ่ ในเบี้ยที่จ่ายไหว");
  });
  it("falls back on any digit, Thai digits too, or on nothing", () => {
    expect(safeHeadline("วันละ 48 บาทเอง", "สำรอง")).toBe("สำรอง");
    expect(safeHeadline("วันละ ๔๘ บาท", "สำรอง")).toBe("สำรอง");
    expect(safeHeadline("  ", "สำรอง")).toBe("สำรอง");
  });
});

import { NUMBERS_PLANS, numberSheets } from "@/lib/content/numbers-plans";

describe("Life Protect's number sheets", () => {
  const today = new Date("2026-09-24T12:00:00+07:00");
  it("prices the owner's example exactly", () => {
    const [first] = numberSheets("/lifeprotect", 1, today);
    expect(first.sumLine).toBe("ประกันชีวิตคุ้มครอง 2,000,000 บาท");
    expect(first.sumNote).toBe("ทุน 1,000,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60");
    expect(first.premiumLine).toBe("เบี้ย 1,548 บาท ต่อเดือน");
    expect(first.perDayLine).toBe("ตกวันละ 48 บาท");
    // ตลอดชีพ, the owner's word for cover to 99 (2026-09-25)
    expect(first.who).toBe("ชาย 35 ปี จ่ายตลอดชีพ");
  });
  it("gives each piece of a round a different person, wrapping past three", () => {
    const sheets = numberSheets("/lifeprotect", 4, today);
    expect(sheets.map((s) => s.who)).toEqual([
      "ชาย 35 ปี จ่ายตลอดชีพ", "หญิง 30 ปี จ่าย 19 ปี", "ชาย 45 ปี จ่าย 19 ปี", "ชาย 35 ปี จ่ายตลอดชีพ",
    ]);
  });
  it("takes two claim lines a piece, only from the approved list", () => {
    const approved = NUMBERS_PLANS["/lifeprotect"].claims;
    for (const s of numberSheets("/lifeprotect", 3, today)) {
      expect(s.claims).toHaveLength(2);
      for (const c of s.claims) expect(approved.some((a) => a.startsWith(c.slice(0, 8)))).toBe(true);
    }
  });
  it("leads with the doubled sum, and says when it is doubled (owner, 2026-09-24)", () => {
    const [, second] = numberSheets("/lifeprotect", 2, today);
    expect(second.sumLine).toBe("ประกันชีวิตคุ้มครอง 1,000,000 บาท");
    expect(second.sumNote).toBe("ทุน 500,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60");
    expect(second.poster.small).toContain("คุ้มครอง 1,000,000 บาท");
  });
  it("puts the note under the sum line in the body", () => {
    const [first] = numberSheets("/lifeprotect", 1, today);
    expect(numbersBody(first).split("\n").slice(0, 2)).toEqual([
      "ประกันชีวิตคุ้มครอง 2,000,000 บาท", "(ทุน 1,000,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
    ]);
    expect(strayNumbers(numbersBody(first), numbersYardstick([first]))).toEqual([]);
  });
  it("writes nothing once the rate table has lapsed", () => {
    expect(numberSheets("/lifeprotect", 3, new Date("2100-01-01"))).toEqual([]);
  });
  it("has a registry the form's list agrees with", () => {
    expect(Object.keys(NUMBERS_PLANS).sort()).toEqual([...NUMBERS_HREFS].sort());
  });
});

import { FALLBACK_HEADLINES, FALLBACK_HEADLINES_EN, headlineMessages, parseHeadlines } from "@/lib/content/numbers";

describe("headlines", () => {
  it("asks for one digit-free headline per sheet", () => {
    const all = headlineMessages([sheet, sheet]).map((m) => m.content).join("\n");
    expect(all).toContain("ห้ามมีตัวเลข");
    expect(all).toContain("2 ชิ้น");
  });
  it("reads the reply, replacing a headline with digits and filling a missing one", () => {
    const reply = JSON.stringify({ pieces: [
      { headline: "ตัวเลขจริง ไม่ต้องเดา", imagePrompt: "a Thai man at a desk" },
      { headline: "วันละ 48 บาท", imagePrompt: "" },
    ] });
    const out = parseHeadlines(reply, 3);
    expect(out[0]).toEqual({ headline: "ตัวเลขจริง ไม่ต้องเดา", imagePrompt: "a Thai man at a desk" });
    expect(FALLBACK_HEADLINES).toContain(out[1].headline);
    expect(FALLBACK_HEADLINES).toContain(out[2].headline);
    expect(out[2].imagePrompt.length).toBeGreaterThan(0);
  });
  it("survives an unreadable reply", () => {
    expect(parseHeadlines("not json", 2)).toHaveLength(2);
  });
});

describe("English headlines", () => {
  it("falls back to English headlines and closes in English", () => {
    expect(parseHeadlines("not json", 2, "en").map((h) => h.headline)).toEqual(FALLBACK_HEADLINES_EN.slice(0, 2));
    expect(headlineMessages([], "en")[0].content).toContain(ENGLISH_RULES);
    expect(headlineMessages([])[0].content).not.toContain(ENGLISH_RULES);
  });
});

describe("English headlines carry no Thai (final review, 2026-10-02)", () => {
  it("opens the English system prompt in English, and leaves the Thai one as it was", () => {
    const en = headlineMessages([sheet], "en")[0].content as string;
    expect(en.split("\n")[0]).toBe("You write English Facebook post headlines for a life insurance agent in Thailand.");
    expect(en).not.toContain("พาดหัวโพสต์เฟซบุ๊กภาษาไทย");
    const th = headlineMessages([sheet])[0].content as string;
    expect(th.split("\n")[0]).toBe("คุณเขียนพาดหัวโพสต์เฟซบุ๊กภาษาไทยให้ตัวแทนประกันชีวิต");
    expect(headlineMessages([sheet], "th")).toEqual(headlineMessages([sheet]));
  });
  it("throws away an English headline with Thai in it for an English fallback", () => {
    const reply = JSON.stringify({ pieces: [{ headline: "Cover ที่อยู่กับคุณ", imagePrompt: "an expat at home" }, { headline: "Cover that stays", imagePrompt: "x" }] });
    const out = parseHeadlines(reply, 2, "en");
    expect(out[0].headline).toBe(FALLBACK_HEADLINES_EN[0]);
    expect(out[1].headline).toBe("Cover that stays");
    // a Thai round keeps its Thai headline
    expect(parseHeadlines(JSON.stringify({ pieces: [{ headline: "คุ้มครองยาว", imagePrompt: "x" }] }), 1)[0].headline).toBe("คุ้มครองยาว");
  });
  it("falls back to an expat picture for an English piece, a Thai one for a Thai piece", () => {
    expect(parseHeadlines("not json", 1, "en")[0].imagePrompt).toBe(
      "A Western (European) adult living in Thailand reviewing household paperwork at a wooden table at home, natural window light, calm and hopeful mood, no text",
    );
    expect(parseHeadlines("not json", 1)[0].imagePrompt).toMatch(/^A Thai adult/);
  });
});

describe("an English numbers poster (final review, 2026-10-02)", () => {
  const en = (big: string): NumberSheet => ({
    product: "iHealthy Ultra", sumLine: "Medical cover up to THB 1,000,000 a year", annualSatang: 1_200_000, premiumLine: "", perDayLine: "About THB 32 a day in the first year",
    claims: [], who: "Male, 35",
    poster: { big, small: "Up to THB 1,000,000 a year · about THB 32 a day in year one" },
  });
  const sub = (s: NumberSheet) => numbersPoster(s, "navy", "en").blocks.find((b) => b.kind === "sub")?.text;
  it("does not say the day figure twice when it is the big line", () => {
    expect(sub(en("About THB 32 a day in the first year"))).toBe("Up to THB 1,000,000 a year");
  });
  it("keeps the sub line whole when the big line is the monthly premium", () => {
    expect(sub(en("THB 980/month"))).toBe("Up to THB 1,000,000 a year · about THB 32 a day in year one");
  });
});
