import { describe, expect, it } from "vitest";
import { answerIShield, type IShieldSlots } from "@/lib/assistant/ishield/answer";
import { ADMIN_CHECKS } from "@/lib/assistant/ishield/faq";

/**
 * After a quotation, iShield answers the question instead of sending the quotation again
 * (owner, 2026-10-11: fixed sentences, no model).
 */
const quotedFor = (...said: string[]): IShieldSlots => {
  let slots: IShieldSlots | null = null;
  for (const m of said) slots = answerIShield(m, slots, "facebook").slots as IShieldSlots;
  return slots!;
};
const reply = (asked: string, slots: IShieldSlots | null) =>
  answerIShield(asked, slots, "facebook").messages.map((m) => m.text).join("\n");
const QUOTE = /เบี้ย [\d,]+ บาท\/เดือน/;

describe("an iShield question after a quotation", () => {
  const slots = quotedFor("ชาย 35", "ทุน 1 ล้าน");

  it("places an illness in the list, with what it pays on the customer's sum", () => {
    const r = reply("เป็นมะเร็งเคลมได้ไหม", slots);
    expect(r).toContain("คุ้มครองมะเร็งครับ");
    expect(r).toContain("โรคมะเร็งระยะลุกลาม");
    expect(r).toContain("1,000,000 บาท");
    expect(r).toContain("250,000 บาท");
    expect(r).toContain("90 วันแรก");
    expect(r).not.toContain("ไม่ใช่มะเร็ง");
    expect(r).not.toMatch(QUOTE);
  });

  it("answers the page's own questions in the page's words", () => {
    expect(reply("เบี้ยขึ้นทุกปีไหม", slots)).toContain("เบี้ยล็อกที่อายุ");
    expect(reply("ทำวันนี้คุ้มครองเลยไหม", slots)).toContain("90 วันแรก");
    expect(reply("เคลมได้กี่ครั้ง", slots)).toContain("คนละโรค");
    expect(reply("ไม่ป่วยเลยเงินหายไหม", slots)).toContain("รับคืนเต็มทุนประกัน");
    expect(reply("อยากได้ค่าห้องด้วย", slots)).toContain("ไม่ใช่ค่ารักษา");
  });

  it("hands what it cannot answer to the admin, without guessing", () => {
    expect(reply("ลดหย่อนภาษีได้ไหม", slots)).toBe(ADMIN_CHECKS);
    expect(reply("กรมธรรม์ส่งมาทางไหน", slots)).toBe(ADMIN_CHECKS);
  });

  it("still answers a money question with the quotation", () => {
    expect(reply("เบี้ยรายเดือนเท่าไหร่", slots)).toMatch(QUOTE);
  });

  it("prices a new person named beside the question", () => {
    expect(reply("ชาย 40 มะเร็งคุ้มครองไหม", slots)).toContain("ชายอายุ 40 ปี");
  });

  it("answers an illness before any quotation, without a sum", () => {
    const r = reply("มะเร็งคุ้มครองไหม", null);
    expect(r).toContain("คุ้มครองมะเร็งครับ");
    expect(r).not.toContain("บาท");
  });

  it("does not send a question asked before a quotation to the admin", () => {
    expect(reply("สมัครยังไง", null)).not.toBe(ADMIN_CHECKS);
  });
});
