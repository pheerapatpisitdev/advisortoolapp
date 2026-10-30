import { describe, expect, it, vi } from "vitest";
import { quickQuote, quickQuoteSection, quickQuoteTopicsFor } from "@/lib/quickquote-knowledge";

/**
 * The company's Quick Quote 2023 handbook, and who may read it.
 */
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  }),
}));
const { assembleKnowledge } = await import("@/lib/copilot/knowledge");

const HEADING = "## คู่มือผลิตภัณฑ์ฉบับพกพา Quick Quote 2023";
const codes = (q: string) => quickQuoteTopicsFor(q).map((t) => t.code);

describe("the handbook", () => {
  it("has the PDF's dropped vowels mended, not copied", () => {
    const text = JSON.stringify(quickQuote());
    for (const broken of ["ชาระ", "จานวน", "สาหรับ", "กาหนด", "ใบคาขอ", "ขั้นต่า", "สาเนา", "ตารวจ", "ทางาน"]) {
      expect(text, broken).not.toContain(broken);
    }
  });

  it("leaves out the plans the owner took out", () => {
    const text = JSON.stringify(quickQuote());
    for (const gone of ["iCare", "ไอแคร์", "LifeReady", "Life Ready", "ไลฟ์เรดดี้", "Bumnan Ready", "บำนาญ เรดดี้", "Ultimate Growth", "อัลติเมท"]) {
      expect(text, gone).not.toContain(gone);
    }
  });

  it("carries no premium rate", () => {
    const text = JSON.stringify(quickQuote());
    expect(text).not.toMatch(/ต่อ(จำนวนเงินเอาประกันภัย|ทุน)\s*1,000\s*บาท/);
    expect(text).not.toMatch(/บาทต่อพัน/);
    // the payment-mode factors of the premium example
    expect(text).not.toMatch(/0\.52|0\.27|0\.09/);
  });

  it("keeps the facts agents are asked about", () => {
    const all = quickQuote().topics.map((t) => t.lines.join("\n")).join("\n");
    expect(all).toContain("16–50 ปี 10,000,000");
    expect(all).toContain("ทุนสูงสุด 30,000,000 บาท");
    expect(all).toContain("ทุนรวมทุกกรมธรรม์ไม่เกิน 4,000,000 บาท");
    expect(all).toContain("อยู่ในไทยไม่ต่ำกว่า 2 ปี");
    expect(all).toContain("ใช้วันที่ 28");
    expect(all).toContain("Free look");
  });
});

describe("which questions open it", () => {
  it("opens by topic", () => {
    expect(codes("อายุ 45 ทุน 5 ล้าน ต้องตรวจสุขภาพไหม")).toContain("NONMED");
    expect(codes("ลูก 5 ขวบ ทำได้ทุนสูงสุดเท่าไหร่")).toContain("JUVENILE");
    expect(codes("พระทำประกันได้ไหม")).toContain("MONK");
    expect(codes("ต่างชาติทำประกันได้ไหม")).toContain("FOREIGNER");
    expect(codes("BMI เกินต้องทำยังไง")).toContain("BMI");
    expect(codes("MEA Extra แผน 3200 ค่าห้องเท่าไหร่")).toContain("MEAX");
    expect(codes("PA Platinum คุ้มครองอะไร")).toContain("PA");
    expect(codes("12PL คืออะไร")).toContain("12PL");
  });

  it("does not read the word for a hospital as a monk", () => {
    expect(codes("โรงพยาบาลพระรามเก้าใช้ได้ไหม")).not.toContain("MONK");
  });

  it("opens nothing for a question about something else, or no question", () => {
    expect(quickQuoteSection("iHealthy Ultra ห้องเดี่ยวราคาเท่าไหร่")).toBe("");
    expect(quickQuoteSection("")).toBe("");
  });

  it("reaches agents on the website and nobody else", async () => {
    const q = "อายุ 45 ทุน 5 ล้าน ต้องตรวจสุขภาพไหม";
    expect(await assembleKnowledge(q, { agent: true })).toContain(HEADING);
    expect(await assembleKnowledge(q)).not.toContain(HEADING);
    expect(await assembleKnowledge(q, { lifeProtect: true })).not.toContain(HEADING);
  });

  it("stays ahead of the illness lists, whose `### ` headings are counted after `## รายชื่อโรค`", async () => {
    // naming DCI opens its illness list, so `## รายชื่อโรค` is there to be compared with
    const text = await assembleKnowledge("พระซื้อ DCI ได้ไหม ต้องตรวจสุขภาพไหม", { agent: true });
    const lists = text.indexOf("## รายชื่อโรค");
    expect(lists).toBeGreaterThan(-1);
    expect(text.indexOf(HEADING)).toBeGreaterThan(-1);
    expect(text.indexOf(HEADING)).toBeLessThan(lists);
  });
});
