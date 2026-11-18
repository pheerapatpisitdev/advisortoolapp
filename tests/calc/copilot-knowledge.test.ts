import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the assistant is allowed to know.
 *
 * These assert against the real rule files rather than fixtures, on purpose: the point of
 * this module is that its answers are the same facts the calculator prices from, and a
 * fixture would let the two drift apart without a test noticing.
 */

let notes: { question: string; answer: string }[] = [];
let readFails = false;

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: async () =>
            readFails ? { data: null, error: { message: "down" } } : { data: notes, error: null },
        }),
      }),
    }),
  }),
}));

const { assembleKnowledge, knowledgePlans } = await import("@/lib/copilot/knowledge");

beforeEach(() => {
  notes = [];
  readFails = false;
});

describe("the plans it can speak about", () => {
  it("is every plan that has rules, and they all have a name", async () => {
    const plans = knowledgePlans();
    expect(plans.length).toBeGreaterThanOrEqual(5);
    expect(plans.every((p) => p.code && p.name)).toBe(true);
  });
});

describe("what it knows about a rider", () => {
  it("carries the age range and the minimum the workbook gives DCI", async () => {
    const text = await assembleKnowledge();
    expect(text).toContain("**DCI**");
    expect(text).toMatch(/\*\*DCI\*\*[^\n]*อายุ 20–65 ปี/);
    expect(text).toMatch(/\*\*DCI\*\*[^\n]*ทุนขั้นต่ำ 200,000/);
    expect(text).toMatch(/\*\*DCI\*\*[^\n]*คุ้มครองถึงอายุ 75/);
  });
});

describe("the rules an agent rings up to ask about", () => {
  it("says which riders may not be bought together, in the company's own words", async () => {
    const text = await assembleKnowledge();
    expect(text).toContain("HIC ห้ามซื้อคู่กับ MEX, MEB, IHU");
    expect(text).toContain("ไม่สามารถซื้อคู่กับ MEX, MEB หรือ iHealthy Ultra");
  });

  it("says which must be bought together", async () => {
    expect(await assembleKnowledge()).toContain("HIC ต้องซื้อคู่กับ CPR");
  });

  it("says which are a choice of one", async () => {
    expect(await assembleKnowledge()).toContain("PB กับ WP เลือกได้อย่างใดอย่างหนึ่งเท่านั้น");
  });

  it("states a combined limit without inventing the half the rule does not have", async () => {
    const text = await assembleKnowledge();
    expect(text).toContain("AP + ECARE รวมกันไม่เกิน 5 เท่าของทุนหลัก และไม่เกิน 10,000,000 บาท");
    // DCI + CPR is a ceiling with no multiple; it must not read "ไม่เกิน undefined เท่า"
    expect(text).toContain("DCI + CPR รวมกันไม่เกิน 10,000,000 บาท");
    expect(text).not.toContain("undefined");
  });
});

describe("the answers the agency already gives", () => {
  it("includes both brains' standard answers, with the health ones resolved from functions", async () => {
    const text = await assembleKnowledge();
    expect(text).toContain("[Life Protect x 2 · tax]");
    expect(text).toContain("[iHealthy Ultra · waiting]");
    // a function that was printed rather than called would show up as this
    expect(text).not.toContain("() =>");
    expect(text).not.toContain("[object");
  });
});

describe("the agent's own notes", () => {
  it("are included and marked as theirs, not as the company's", async () => {
    notes = [{ question: "ลูกค้าบอกแพงไป", answer: "ถามกลับว่าเทียบกับอะไร แล้วเสนอทุนที่เล็กลง" }];
    const text = await assembleKnowledge();
    expect(text).toContain("บันทึกของตัวแทนเอง");
    expect(text).toContain("ไม่ใช่เอกสารบริษัท");
    expect(text).toContain("ลูกค้าบอกแพงไป");
  });

  it("are left out entirely when there are none, rather than leaving an empty heading", async () => {
    expect(await assembleKnowledge()).not.toContain("บันทึกของตัวแทนเอง");
  });

  it("do not take the plan rules down with them when the database is unreachable", async () => {
    readFails = true;
    const text = await assembleKnowledge();
    expect(text).toContain("**DCI**");
    expect(text).not.toContain("บันทึกของตัวแทนเอง");
  });
});

describe("what it must never carry", () => {
  it("holds no premium figures — those come from the engine, never from a prompt", async () => {
    const text = await assembleKnowledge();
    // the rate tables are 2.7MB; anything near that size has leaked in
    // 41,000 since 12 พีแอล joined the chat (2026-11-18): its section is about 700 characters
    expect(text.length).toBeLessThan(41_000);
    expect(text).not.toContain("rateTable");
    expect(text).not.toContain("premiums");
  });
});
