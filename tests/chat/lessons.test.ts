import { describe, expect, it } from "vitest";
import { matchLesson, normalizeQuestion, teachable, type Lesson } from "@/lib/assistant/lessons";
import { answerAny } from "@/lib/assistant/dispatch";

/** Answers the owner taught word for word (/admin/teach, owner 2026-10-11). */
const LUCKY = "105982528649026";
const lesson = (id: string, question: string, answer: string, more: Partial<Lesson> = {}): Lesson =>
  ({ id, question, answer, phrasings: [], pageId: null, ...more });

const BRANCH = lesson("branch", "สาขาอุดรมีไหม", "มีตัวแทนดูแลทั่วประเทศรวมถึงอุดรธานีค่ะ", {
  pageId: LUCKY, phrasings: ["อยู่อุดร สมัครได้ไหม"],
});
const TAX = lesson("tax", "ลดหย่อนภาษีได้ไหม", "เบี้ยประกันชีวิตลดหย่อนภาษีได้สูงสุด 100,000 บาท/ปีครับ");
const SUM = lesson("sum", "ทุนประกันขั้นต่ำเท่าไหร่", "ทุนต่ำสุด 150,000 บาทครับ");
const ALL = [BRANCH, TAX, SUM];

describe("a question as compared", () => {
  it("drops spaces, punctuation, invisible characters and the particles it ends on", () => {
    expect(normalizeQuestion("สาขา อุดร มีไหมคะ??")).toBe(normalizeQuestion("สาขาอุดรมี​ไหม"));
    expect(normalizeQuestion("ลดหย่อนภาษีได้ไหมครับ")).toBe(normalizeQuestion("ลดหย่อนภาษีได้ไหม"));
  });
  it("reads Thai digits as Arabic ones", () => {
    expect(normalizeQuestion("ทุน ๑ ล้าน")).toBe(normalizeQuestion("ทุน 1 ล้าน"));
  });
});

describe("which lesson a message asks", () => {
  it("answers the question as taught, with any closing particle", () => {
    expect(matchLesson("ลดหย่อนภาษีได้ไหมคะ", ALL, LUCKY)?.id).toBe("tax");
    expect(matchLesson("ลดหย่อน ภาษี ได้ไหม ครับ", ALL, LUCKY)?.id).toBe("tax");
  });
  it("answers another way of asking it", () => {
    expect(matchLesson("อยู่อุดร สมัครได้ไหมคะ", ALL, LUCKY)?.id).toBe("branch");
  });
  it("answers the question with a few words around it", () => {
    expect(matchLesson("สวัสดีค่ะ ลดหย่อนภาษีได้ไหม", ALL, LUCKY)?.id).toBe("tax");
  });
  it("leaves a much longer message to the bot", () => {
    expect(matchLesson("ลดหย่อนภาษีได้ไหม แล้วถ้าจ่ายรายเดือนต้องเตรียมเอกสารอะไรบ้างคะ", ALL, LUCKY)).toBeUndefined();
  });
  it("never takes a message with a figure the question did not have", () => {
    expect(matchLesson("ช 47 ทุนประกันขั้นต่ำเท่าไหร่", ALL, LUCKY)).toBeUndefined();
    expect(matchLesson("ทุนประกันขั้นต่ำเท่าไหร่ 1 ล้านได้ไหม", ALL, LUCKY)).toBeUndefined();
  });
  it("keeps a Page's lesson to that Page", () => {
    expect(matchLesson("สาขาอุดรมีไหม", ALL, "112079600278201")).toBeUndefined();
    expect(matchLesson("สาขาอุดรมีไหม", ALL, undefined)).toBeUndefined();
    expect(matchLesson("ลดหย่อนภาษีได้ไหม", ALL, undefined)?.id).toBe("tax");
  });
  it("prefers the Page's own lesson over one taught for every Page", () => {
    const everywhere = lesson("everywhere", "สาขาอุดรมีไหม", "ไม่มีสาขาครับ");
    expect(matchLesson("สาขาอุดรมีไหม", [everywhere, BRANCH], LUCKY)?.id).toBe("branch");
  });
  it("does not answer a message that is nothing but a particle", () => {
    expect(matchLesson("ค่ะ", ALL, LUCKY)).toBeUndefined();
  });
});

describe("what can be taught", () => {
  it("refuses a question with a figure in it", () => {
    expect(teachable("ช 47")).toBe(false);
    expect(teachable("ทุน 1 ล้านเท่าไหร่")).toBe(false);
    expect(teachable("ครับ")).toBe(false);
    expect(teachable("สาขาอุดรมีไหม")).toBe(true);
  });
});

describe("a taught answer in the conversation", () => {
  it("is sent word for word, and the conversation carries on where it was", async () => {
    const slots = { product: "lifeprotect", age: 47, sex: "M", intent: "quote" } as never;
    const a = await answerAny([{ role: "user", content: "สาขาอุดรมีไหมคะ" }], slots, "facebook", undefined, LUCKY, undefined, ALL);
    expect(a.taught).toBe("branch");
    expect(a.messages.map((m) => m.text)).toEqual(["มีตัวแทนดูแลทั่วประเทศรวมถึงอุดรธานีค่ะ"]);
    expect(a.slots).toMatchObject({ product: "lifeprotect", age: 47, sex: "M" });
  });
  it("comes before the Page's greeting", async () => {
    const welcome = { mode: "one_plan", product: "lifeprotect", text: "สวัสดีครับ", pictures: [] } as never;
    const a = await answerAny([{ role: "user", content: "ลดหย่อนภาษีได้ไหม" }], null, "facebook", undefined, LUCKY, welcome, ALL);
    expect(a.taught).toBe("tax");
  });
  it("leaves the quotation to the calculator", async () => {
    const a = await answerAny([{ role: "user", content: "มีงบออมเงิน 30 บาทต่อวัน" }], null, "facebook", undefined, LUCKY, undefined, ALL);
    expect(a.taught).toBeUndefined();
  });
});
