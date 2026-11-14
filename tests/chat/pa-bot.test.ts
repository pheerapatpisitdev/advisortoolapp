import { describe, expect, it, vi } from "vitest";

/**
 * The PA answers on LINE and Messenger (owner, 2026-11-14, ก ก ก on mockup
 * 1ax81iJFMjK7tG4dAX95sk): the six scenes of the mockup, through the one dispatcher both use.
 * The library is stubbed: a rules question must reach it, and nothing else may.
 */
const library = vi.hoisted(() => ({ asked: [] as string[] }));
vi.mock("@/lib/copilot/library", () => ({
  answerFromLibrary: async (_h: unknown, asked: string) => {
    library.asked.push(asked);
    return "คำตอบจากคลังความรู้";
  },
}));

const { answerAny } = await import("@/lib/assistant/dispatch");
const { pricePa, paNamedIn, paSection } = await import("@/lib/copilot/pa-price");
const { assembleKnowledge } = await import("@/lib/copilot/knowledge");
type Msg = { role: "user" | "assistant"; content: string };

async function say(lines: string[], channel: "line" | "facebook" = "line") {
  const history: Msg[] = [];
  let last;
  for (const line of lines) {
    history.push({ role: "user", content: line });
    last = await answerAny([...history], null, channel);
    history.push({ role: "assistant", content: last.messages.map((m) => m.text).join("\n") });
  }
  return { last: last!, text: last!.messages.map((m) => m.text).join("\n") };
}

describe("the PA scenes", () => {
  it("1: a broad question gets the three families and is asked age, job and sum", async () => {
    const { text, last } = await say(["มีประกันอุบัติเหตุไหมครับ"]);
    expect(text).toContain("PA Classic");
    expect(text).toContain("PA Platinum");
    expect(text).toContain("PA Max");
    expect(text).toContain("อายุ อาชีพ และทุน");
    expect(last.guide).toBeUndefined();
  });

  it("2: age, desk job and a sum, said after scene 1, compare the three at that sum (1ก 2ก)", async () => {
    const { text } = await say(["มีประกันอุบัติเหตุไหมครับ", "32 ปี ทำงานออฟฟิศ อยากได้ทุน 1 ล้าน"]);
    expect(text).toContain("PA ทุน 1 ล้าน");
    expect(text).toContain("PA Max 01 — 2,250 / 2,250");
    expect(text).toContain("PA Classic B — 4,500 / 5,500");
    expect(text).toContain("PA Platinum 01 — 4,800 / 6,000");
    expect(text).toContain("งานออฟฟิศส่วนใหญ่อยู่ขั้น 1");
    expect(text).toContain("บริษัทเป็นผู้กำหนด");
  });

  it("3: a plan picked by name gives the full quote with the age carried", async () => {
    const { text, last } = await say([
      "มีประกันอุบัติเหตุไหมครับ", "32 ปี ทำงานออฟฟิศ อยากได้ทุน 1 ล้าน", "เอา Platinum 2 ล้านครับ",
    ]);
    expect(text).toContain("PA Platinum 02");
    expect(text).toContain("อายุ 32 ปี");
    expect(text).toContain("8,000 บาท/ปี");
    expect(text).toContain("ขั้น 2: 9,600");
    expect(text).toContain("สัปดาห์ละ 2,000");
    expect(text).toContain("ปีที่ 6 ทุนชีวิต 2,500,000");
    expect(last.priced).toBe(true);
    expect(last.guide?.map((g) => g.ask)).toContain("PA Platinum 03 อายุ 32");
  });

  it("4: a child is offered PA Classic only", async () => {
    const { text } = await say(["ลูก 8 ขวบ ทำประกันอุบัติเหตุได้ไหม"]);
    expect(text).toContain("Classic A ทุน 7 แสน — 3,500 / 4,300 บาท (ขั้น 3: 5,150)");
    expect(text).toContain("Classic B ทุน 1 ล้าน — 4,500 / 5,500");
    expect(text).toContain("รับตั้งแต่อายุ 16 ปี");
    expect(text).not.toContain("PA Max 01");
  });

  it("5: a risky job is never classed by the bot; แอดมิน checks, ranges meanwhile", async () => {
    const { text, last } = await say(["ขับวินมอไซค์ อายุ 40 ทำ PA ได้ไหมครับ"]);
    expect(text).toContain("เดี๋ยวแอดมินเช็กให้แล้วกลับมาตอบในแชทนี้");
    expect(text).toContain("Max 01 2,250 บาท/ปี");
    expect(text).toContain("Classic B 4,500–5,500");
    expect(text).toContain("ขั้น 4");
    expect(last.priced).toBe(false);
  });

  it("6: a rules question goes to the library, with no buttons", async () => {
    library.asked = [];
    const { last } = await say(["ขี่มอไซค์ล้มเอง PA จ่ายไหม"]);
    expect(library.asked).toEqual(["ขี่มอไซค์ล้มเอง PA จ่ายไหม"]);
    expect(last.guide).toBeUndefined();
    expect(last.fromLibrary).toBe(true);
  });

  it("answers the same on Messenger", async () => {
    const { text } = await say(["PA ทุน 1 ล้าน อายุ 30"], "facebook");
    expect(text).toContain("PA Max 01 — 2,250");
  });
});

describe("what PA does not catch", () => {
  it("leaves iHealthy's Platinum and other plans alone", () => {
    expect(paNamedIn("iHealthy Ultra Platinum ราคาเท่าไหร่")).toBe(false);
    expect(paNamedIn("เสียชีวิตจากอุบัติเหตุ Life Protect จ่ายไหม")).toBe(false);
    expect(paNamedIn("ประกันอุบัติเหตุ")).toBe(true);
    expect(paNamedIn("ทำ PA ได้ไหม")).toBe(true);
  });

  it("does not take an age said earlier as a reason to quote a rules question", () => {
    expect(pricePa("PA คุ้มครองต่างประเทศไหม", ["อายุ 32"])).toBeUndefined();
  });

  it("refuses past 64", () => {
    expect(pricePa("PA อายุ 70 ทุน 1 ล้าน")?.text).toContain("ไม่เกิน 64 ปี");
  });

  it("does not quote Classic B at class 3", () => {
    expect(pricePa("PA Classic B อายุ 30")?.text).toContain("ขั้น 2: 5,500");
    expect(pricePa("PA Classic B อายุ 30")?.text).not.toContain("ขั้น 3");
    expect(pricePa("PA Classic A อายุ 30")?.text).toContain("ขั้น 3: 5,150");
  });
});

describe("wanting to apply", () => {
  it("is left to the form, not answered with PA again", async () => {
    const { text } = await say(["สนใจสมัคร PA"]);
    expect(text).not.toContain("มีครับ 🙏 ประกันอุบัติเหตุ");
  });
});

describe("PA in the library", () => {
  it("is fetched by name and carries the rules, not a guess at classes", async () => {
    expect(paSection()).toContain("ขั้นอาชีพบริษัทเป็นผู้กำหนด");
    expect(paSection()).toContain("### PA Max");
    expect(await assembleKnowledge("PA ขี่มอไซค์ล้มจ่ายไหม")).toContain("ประกันอุบัติเหตุ PA (กรุงไทย-แอกซ่า");
    expect(await assembleKnowledge("Life Protect ยกเลิกได้ไหม")).not.toContain("### PA Max");
  });
});
