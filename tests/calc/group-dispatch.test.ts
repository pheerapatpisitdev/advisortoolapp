import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

/**
 * Where a question about a company's staff goes, which is: straight back out, with a link.
 *
 * The owner's decision is that group cover is sold by a person, so the chat's whole job is
 * the handover. That makes the strongest assertion in this file the one about `chat` never
 * being called — no model runs, so there is no answer for a model to get wrong, and the
 * question costs nothing.
 *
 * The model is stubbed anyway, because the individual plans below still use it and the point
 * of half these tests is that they are untouched.
 */

let routed: Record<string, unknown> = { intent: "other" };
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task.startsWith("route") ? JSON.stringify(routed) : "ยินดีครับ",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  }),
}));

const { answerAny } = await import("@/lib/assistant/dispatch");

const said = (content: string) => [{ role: "user" as const, content }];
const textOf = (a: { messages: { text: string }[] }) => a.messages.map((m) => m.text).join("\n");

beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

describe("a company asking about cover for its staff", () => {
  /**
   * The regression this began as.
   *
   * Before the guard, this message named the individual health plan — "ประกันสุขภาพ" is
   * inside it — and went to that brain, which asked for an age and a sex and quoted one
   * person's premium to a company.
   */
  it("is not taken to the individual health plan", async () => {
    const answer = await answerAny(said("ประกันสุขภาพกลุ่มมีไหม"), null);
    expect(answer.slots.product).not.toBe("ihealthy");
    expect(textOf(answer)).not.toContain("ขออายุกับเพศ");
  });

  it("gets the page and a person, without a model being asked anything", async () => {
    const answer = await answerAny(said("ประกันกลุ่มสำหรับพนักงานมีไหม"), null);
    const text = textOf(answer);
    expect(text).toContain("/group-insurance");
    expect(text).toContain("แอดมิน");
    expect(chat).not.toHaveBeenCalled();
  });

  /**
   * The same three bubbles however hard the question pushes. A customer insisting is the
   * case the old version handled by asking a model to hold the line; this one has no line to
   * hold, because there is no model and no facts.
   */
  it("says the same thing to a question that asks for the detail outright", async () => {
    const a = await answerAny(said("ประกันกลุ่มมีไหม"), null);
    const b = await answerAny(said("ประกันสุขภาพกลุ่ม ลักษณะธุรกิจ 1 พนักงาน 30 คน เบี้ยคนละเท่าไหร่ ขอตารางความคุ้มครองด้วย"), null);
    expect(textOf(b)).toBe(textOf(a));
    expect(textOf(b)).not.toMatch(/\d{3}/);
    expect(chat).not.toHaveBeenCalled();
  });

  /**
   * Answered ahead of a settled conversation, because this is not a change of plan but a
   * change of product — and the quotation the customer was building is still there after it.
   */
  it("answers mid-quotation without throwing the quotation away", async () => {
    const stored = { product: "ihealthy" as const, intent: "quote" as const, age: 35, sex: "F" as const, plan: "GOLD" };
    const answer = await answerAny(said("แล้วแบบทำให้พนักงานทั้งบริษัทมีไหม"), stored);
    expect(textOf(answer)).toContain("/group-insurance");
    expect(answer.slots).toMatchObject(stored);
    expect(chat).not.toHaveBeenCalled();
  });
});

describe("an individual customer, who must be unaffected", () => {
  it("still reaches the health brain by the plan's own name", async () => {
    const answer = await answerAny(said("ประกันสุขภาพมีไหม"), null);
    expect(answer.slots.product).toBe("ihealthy");
  });

  it("still reaches it by subject alone", async () => {
    const answer = await answerAny(said("ค่าห้องวันละเท่าไหร่"), null);
    expect(answer.slots.product).toBe("ihealthy");
  });

  it("is not handed a company's link for asking about groups of illnesses", async () => {
    const answer = await answerAny(said("โรคร้ายแรงกลุ่มไหนบ้าง"), null);
    expect(textOf(answer)).not.toContain("/group-insurance");
  });
});
