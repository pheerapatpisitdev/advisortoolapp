import { describe, expect, it } from "vitest";
import { PLAN_INFO_SYSTEM, SMALL_TALK_SYSTEM } from "@/lib/assistant/lifeprotect/prompts";
import { VOICE } from "@/lib/assistant/prompts";

/**
 * The prompts are the only place the model is allowed to speak from, so what they forbid is
 * worth holding still. Each of these was written after the bot did the opposite in a
 * rehearsal.
 */
describe("what the model is told", () => {
  it("forbids sending a premium question to the agent, because the engine answers those", () => {
    expect(PLAN_INFO_SYSTEM).toContain("ห้ามบอกให้ลูกค้าไปถามตัวแทนเรื่องเบี้ยประกัน");
    expect(PLAN_INFO_SYSTEM).toContain("ไม่ต้องปิดท้ายทุกข้อความด้วยการให้ไปถามตัวแทน");
  });

  it("tells the truth when asked outright whether it is a person", () => {
    expect(PLAN_INFO_SYSTEM).toContain("ถ้าลูกค้าถามตรงๆ ว่าเป็นคนหรือบอท");
    expect(PLAN_INFO_SYSTEM).toContain("ผู้ช่วยตอบของเพจ");
  });

  it("lets a customer leave without being asked for anything", () => {
    expect(SMALL_TALK_SYSTEM).toContain("ขอคิดดูก่อน");
    expect(SMALL_TALK_SYSTEM).toContain("ห้ามขอข้อมูล ห้ามชวนคุยต่อ ห้ามขาย");
  });

  it("still names what a person must answer", () => {
    expect(PLAN_INFO_SYSTEM).toContain("การเคลม");
    expect(PLAN_INFO_SYSTEM).toContain("การพิจารณาสุขภาพ");
  });

  for (const [name, prompt] of [["plan info", PLAN_INFO_SYSTEM], ["small talk", SMALL_TALK_SYSTEM]] as const) {
    it(`forbids ${name} from promising to send something later`, () => {
      expect(prompt).toContain("ห้ามสัญญาว่าจะสรุปหรือส่งอะไรให้ทีหลัง");
    });
  }

  for (const [name, prompt] of [["plan info", PLAN_INFO_SYSTEM], ["small talk", SMALL_TALK_SYSTEM]] as const) {
    it(`never tells ${name} to promise the form link`, () => {
      // the code sends the form; a model that promises it leaves the customer waiting
      expect(prompt).not.toContain("เดี๋ยวส่งลิงก์ฟอร์ม");
    });
  }

  for (const [name, prompt] of [["plan info", PLAN_INFO_SYSTEM], ["small talk", SMALL_TALK_SYSTEM]] as const) {
    it(`keeps ${name} away from the company, an invented identity and a figure of its own`, () => {
      expect(prompt).toContain("ห้ามยืนยันหรือปฏิเสธชื่อบริษัทที่ลูกค้าเอ่ยถึง");
      // asked outright, it names the insurer rather than refusing: "บ.ชื่ออะไรคะ" got
      // "ในส่วนนี้ผมไม่สามารถแจ้งชื่อบริษัทได้ครับ" from a model told only what not to say
      expect(prompt).toContain("รับประกันโดย บริษัท กรุงไทย-แอกซ่า ประกันชีวิต จำกัด (มหาชน)");
      expect(prompt).toContain("ห้ามอ้างว่ามีใบอนุญาตตัวแทนหรือนายหน้า");
      expect(prompt).toContain("ห้ามบอกว่าตัวเองเป็นคน");
    });
  }
});

describe("plain language, and where it has to stop", () => {
  /**
   * Telling the assistant to speak like a person was right and nearly cost a contract answer.
   *
   * The instruction included "ห้ามไล่รหัสสัญญาอย่าง IHU MEB MEX ให้เรียกด้วยชื่อที่คนเข้าใจ".
   * The model obeyed: it renamed MEB "แบบประกันคุ้มครองโรคร้ายแรง", which MEB is not, and then
   * answered "HIC ซื้อคู่กับ MEB ได้ไหม" with "ซื้อคู่กันได้ครับ" — the opposite of the rule,
   * in the voice of somebody who had checked. It had answered the same question correctly that
   * morning.
   *
   * A name is an identifier, not a word to be translated. These lines are what stands between
   * the plain voice and the contract, and this is what holds them there.
   */
  for (const [what, needle] of [
    ["rider names are quoted, never invented", "ห้ามตั้งชื่อไทยขึ้นเอง"],
    ["and never guessed at from the code", "ห้ามเดาว่ารหัสไหนคุ้มครองอะไร"],
    ["a pairing rule is repeated, not summarised", "ห้ามสรุปใหม่ ห้ามอนุมานจากชื่อ"],
    ["and a refusal is never softened", "ต้องตอบว่าไม่ได้ ห้ามอ่อนข้อให้"],
    ["figures are carried across as they are", "ห้ามปัดเศษหรือเล่าใหม่"],
  ] as const) {
    it(what, () => {
      expect(VOICE).toContain(needle);
    });
  }

  it("still asks for the customer's own words everywhere else", () => {
    expect(VOICE).toContain("พูดแบบคนทั่วไป");
    expect(VOICE).toContain("วงเงินคุ้มครอง (ทุนประกัน)");
  });
});

describe("how the model calls the customer", () => {
  it("says คุณ until the sex is known, then คุณผู้ชาย or คุณผู้หญิง", async () => {
    const { addressLine } = await import("@/lib/assistant/prompts");
    expect(VOICE).toContain('เรียกลูกค้าว่า "คุณ" จนกว่าจะรู้เพศ');
    expect(addressLine(undefined)).toBe("");
    expect(addressLine("M")).toContain('"คุณผู้ชาย"');
    expect(addressLine("M")).not.toContain("คุณผู้หญิง");
    expect(addressLine("F")).toContain('"คุณผู้หญิง"');
    expect(addressLine("F")).not.toContain("คุณผู้ชาย");
  });
});
