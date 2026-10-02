import { describe, expect, it, vi } from "vitest";
import { lifeProtectNamedIn, lifeProtectQa, lifeProtectQaSection } from "@/lib/lifeprotect-knowledge";

/**
 * The company's Q&A sheet for ไลฟ์ โพรเทค+, and the roads by which it reaches a model.
 */
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  }),
}));
const { assembleKnowledge } = await import("@/lib/copilot/knowledge");

const HEADING = "## คำถามที่พบบ่อยของ ไลฟ์ โพรเทค+";

describe("the Q&A sheet", () => {
  it("is all twenty-seven questions, numbered as the sheet numbers them", () => {
    const { items } = lifeProtectQa();
    expect(items.map((i) => i.no)).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
    for (const i of items) {
      expect(i.q.trim(), `ข้อ ${i.no}`).toBe(i.q);
      expect(i.a.length, `ข้อ ${i.no}`).toBeGreaterThan(10);
    }
  });

  it("has the PDF's dropped vowels mended, not copied", () => {
    // pdftotext loses the ำ of ชำระ, จำนวน, สำหรับ — a model reading "ชาระ" repeats it
    const text = JSON.stringify(lifeProtectQa());
    for (const broken of ["ชาระ", "จานวน", "สาหรับ", "กาหนด", "ใบคาขอ", "ขั้นต่า"]) {
      expect(text, broken).not.toContain(broken);
    }
  });

  it("keeps the facts agents are asked about", () => {
    const section = lifeProtectQaSection();
    expect(section).toContain("150,000");
    expect(section).toContain("1 เดือน – 80 ปี");
    expect(section).toContain("101%");
    expect(section).toContain("WLF19H");
    expect(section).toContain("ไม่สามารถยกเลิกได้");
  });
});

describe("which questions open it", () => {
  it("is fetched by the plan's names", () => {
    for (const q of ["ไลฟ์ โพรเทค+ ยกเลิกได้ไหม", "Life Protect x 2 ต่างชาติทำได้ไหม", "protection booster คืออะไร", "WLF09L คือแบบไหน"]) {
      expect(lifeProtectNamedIn(q), q).toBe(true);
    }
    expect(lifeProtectNamedIn("ประกันสุขภาพ iHealthy เบี้ยเท่าไหร่")).toBe(false);
  });

  it("travels with a Life Protect question and not with a health one", async () => {
    expect(await assembleKnowledge("Life Protect เปลี่ยนงวดได้ไหม")).toContain(HEADING);
    expect(await assembleKnowledge("iHealthy Ultra ห้องเดี่ยวเท่าไหร่")).not.toContain(HEADING);
  });

  it("is always open to the Life Protect brain, whose customers never name the plan", async () => {
    expect(await assembleKnowledge("พระทำได้ไหม", { lifeProtect: true })).toContain(HEADING);
  });

  it("keeps the whole library inside its size budget", async () => {
    const text = await assembleKnowledge();
    expect(text).toContain(HEADING);
    expect(text.length).toBeLessThan(40_000);
  });
});
