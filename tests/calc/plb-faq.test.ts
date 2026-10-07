import { describe, expect, it } from "vitest";
import { TAX_RELIEF } from "@/lib/assistant/common";
import { asksWaiting, plbFaqAnswer, PLB_WAITING } from "@/lib/assistant/plb/faq";
import { faqAnswer } from "@/lib/assistant/lifeprotect/faq";

describe("PLB's written answers", () => {
  it("says there is no money back, and why", () => {
    for (const t of ["มีเงินคืนไหม", "ครบสัญญาแล้วได้อะไรคืน", "เวนคืนได้ไหม", "อยู่ครบแล้วสัญญาสิ้นสุดเลยเหรอ"]) {
      const a = plbFaqAnswer(t);
      expect(a, t).toContain("ไม่มีเงินคืน");
      expect(a, t).toContain("ไม่มีมูลค่าเวนคืน");
    }
  });

  it("answers tax relief with the one sentence Life Protect uses", () => {
    expect(plbFaqAnswer("ลดหย่อนภาษีได้ไหม")).toBe(TAX_RELIEF);
    expect(faqAnswer("ลดหย่อนภาษีได้ไหม")).toBe(TAX_RELIEF);
    expect(TAX_RELIEF).toContain("สูงสุด 100,000 บาทต่อปี");
  });

  it("does not guess the waiting period: PLB's is not confirmed", () => {
    expect(asksWaiting("มีระยะรอคอยไหม")).toBe(true);
    expect(asksWaiting("ระยะรอ กี่วัน")).toBe(true);
    expect(asksWaiting("ขอทุน 1 ล้าน")).toBe(false);
    expect(plbFaqAnswer("มีระยะรอคอยไหม")).toBe(PLB_WAITING);
    expect(PLB_WAITING).toContain("ยังไม่มีข้อมูลที่ยืนยันได้");
    expect(PLB_WAITING).not.toMatch(/\d+\s*วัน/);
  });

  it("says the cover lasts as long as the premium is paid", () => {
    expect(plbFaqAnswer("คุ้มครองกี่ปี")).toContain("คุ้มครองเท่ากับที่จ่ายเบี้ย");
    expect(plbFaqAnswer("คุ้มครองถึงอายุเท่าไหร่")).toContain("คุ้มครองเท่ากับที่จ่ายเบี้ย");
  });

  it("leaves everything else to the quotation", () => {
    for (const t of ["ขอตารางมูลค่า", "ชาย 35 ทุน 1 ล้าน", "ชำระ 10 ปี", "ขอบคุณค่ะ"]) {
      expect(plbFaqAnswer(t), t).toBeUndefined();
    }
  });
});
