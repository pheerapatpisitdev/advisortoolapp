import { describe, expect, it, vi } from "vitest";

/**
 * The line under a website answer says which machine wrote it (review 2026-10-01).
 *
 * Every answer the dispatcher returned was signed "เครื่องคิดเบี้ยของระบบ", including the free
 * prose a brain had a model write — plan questions and small talk. That line tells a reader
 * the figures above it were computed, so it is kept for the engine's own words.
 */

let reply: Record<string, unknown> = {};

vi.mock("@/lib/assistant/dispatch", () => ({
  answerAny: async () => reply,
}));
vi.mock("@/lib/ai/client", () => ({
  chat: async () => ({ text: "ตอบจากคลัง", model: "library-model" }),
  BudgetExceeded: class extends Error {},
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }),
      insert: async () => ({ error: null }),
    }),
  }),
}));
vi.mock("next/server", () => ({ after: () => undefined }));

const { answerFromKnowledge } = await import("@/lib/copilot/answer");

describe("who an answer is signed by", () => {
  it("is the engine for a quotation", async () => {
    reply = { messages: [{ text: "เบี้ยปีละ 23,400 บาท" }], priced: true, slots: { product: "lifeprotect" } };
    expect((await answerFromKnowledge("Life Protect ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่")).model).toBe("เครื่องคิดเบี้ยของระบบ");
  });

  it("is the model, when a brain had a model word the answer", async () => {
    reply = { messages: [{ text: "คุ้มครองถึงอายุ 99 ครับ" }], writtenBy: "small-model", slots: { product: "lifeprotect" } };
    expect((await answerFromKnowledge("Life Protect คุ้มครองยังไง")).model).toBe("small-model");
  });

  it("is the library, when the model's name did not come back", async () => {
    reply = { messages: [{ text: "คุ้มครองถึงอายุ 99 ครับ" }], writtenBy: "", slots: { product: "lifeprotect" } };
    expect((await answerFromKnowledge("Life Protect คุ้มครองยังไง")).model).toBe("คลังความรู้ของระบบ");
  });

  it("is still the library for an answer the library wrote", async () => {
    reply = { messages: [{ text: "ได้ครับ" }], fromLibrary: true, slots: { product: "undecided" } };
    expect((await answerFromKnowledge("Life Protect ซื้อคู่กับ MEB ได้ไหม")).model).toBe("คลังความรู้ของระบบ");
  });
});
