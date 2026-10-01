import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

/**
 * Review 2026-10-01: what a model writes is checked for money it was not given.
 *
 * Plan questions and small talk are worded by a model, which the prompts forbid to work out a
 * premium. It did anyway once — 3,790 a month against the engine's 3,861 — so a baht figure
 * the model was never shown is taken out before the customer sees it, and the reply is signed
 * with the model's name rather than passed off as the engine's.
 */

let routed: Record<string, unknown> = { intent: "plan_info" };
/** what the stubbed model writes, given the system prompt it was shown */
let word: (system: string) => string = () => "ยินดีครับ";

const chat = vi.fn(async ({ task, messages }: ChatOptions) => ({
  text: task === "route" || task === "route_health" ? JSON.stringify(routed) : word(String(messages[0].content)),
  model: "stub-model", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { inventedFigures, keepGivenFigures } = await import("@/lib/assistant/common");
const { answerQuestion } = await import("@/lib/assistant/lifeprotect/answer");
const { answerHealth } = await import("@/lib/assistant/ihealthy/answer");

const said = (content: string) => [{ role: "user" as const, content }];
const textOf = (a: { messages: { text: string }[] }) => a.messages.map((m) => m.text).join("\n");

beforeEach(() => {
  chat.mockClear();
  routed = { intent: "plan_info" };
  word = () => "ยินดีครับ";
});

describe("keepGivenFigures", () => {
  const given = "เบี้ยที่คิดและส่งให้ลูกค้าไปแล้วคือ รายเดือน 3,861.00 บาท · รายปี 42,900 บาท\nทุนประกันขั้นต่ำ 500,000 บาท";

  it("leaves a figure the model copied from what it was shown", () => {
    const text = "เบี้ยรายเดือน 3,861.00 บาท เท่าเดิมตลอดสัญญาครับ\nรายปี 42,900 บาท";
    expect(inventedFigures(text, given)).toEqual([]);
    expect(keepGivenFigures(text, given, "fallback")).toBe(text);
  });

  it("reads a copied figure written without its decimals as the same figure", () => {
    expect(inventedFigures("ผ่อนเดือนละ 3,861 บาทครับ", given)).toEqual([]);
  });

  it("takes out a premium the model worked out for itself, and only that line", () => {
    const text = "เบี้ยคงที่ตลอดครับ\nถ้าอายุ 40 เบี้ยประมาณ 4,350 บาทต่อเดือน\nสนใจบอกได้เลยครับ";
    expect(inventedFigures(text, given)).toEqual([4350]);
    expect(keepGivenFigures(text, given, "fallback")).toBe("เบี้ยคงที่ตลอดครับ\nสนใจบอกได้เลยครับ");
  });

  it("catches a grouped figure on a line about paying, with or without the word บาท", () => {
    expect(inventedFigures("จ่ายเดือนละ 3,790 ครับ", given)).toEqual([3790]);
    expect(inventedFigures("เบี้ย ฿3,790", given)).toEqual([3790]);
  });

  it("says the fallback when nothing is left", () => {
    expect(keepGivenFigures("เบี้ยประมาณ 3,790 บาทต่อเดือนครับ", given, "fallback")).toBe("fallback");
  });

  it("does not read ages, terms or counts as money", () => {
    const text = "คุ้มครองถึงอายุ 99 ปี จ่าย 19 ปี ครอบคลุม 70 โรคครับ";
    expect(inventedFigures(text, given)).toEqual([]);
  });

  it("leaves a figure the customer typed, which the model was also shown", () => {
    expect(inventedFigures("งบเดือนละ 2,500 บาท ทำได้ครับ", `${given}\nมีงบเดือนละ 2,500 บาท`)).toEqual([]);
  });
});

describe("the life brain's model-written answers", () => {
  const quoted = { intent: "quote" as const, age: 35, sex: "M" as const, coverWanted: 1_000_000 };

  it("are signed with the model's name", async () => {
    const answer = await answerQuestion(said("คุ้มครองยังไง"), null);
    expect(answer.writtenBy).toBe("stub-model");
  });

  it("keep the engine's own figure, copied from the prompt", async () => {
    let copied = "";
    word = (system) => {
      copied = system.match(/รายเดือน ([\d,.]+) บาท/)![1];
      return `เบี้ยรายเดือน ${copied} บาท เท่าเดิมตลอดระยะเวลาชำระครับ`;
    };
    const answer = await answerQuestion(said("เบี้ยคงที่ไหม"), quoted);
    expect(copied).not.toBe("");
    expect(textOf(answer)).toContain(`${copied} บาท`);
  });

  it("lose a premium the model invented, and fall back to the engine's figures", async () => {
    let engine = "";
    word = (system) => {
      engine = system.match(/รายเดือน ([\d,.]+) บาท/)![1];
      return "เบี้ยประมาณ 3,790 บาทต่อเดือนครับ";
    };
    const answer = await answerQuestion(said("เบี้ยคงที่ไหม"), quoted);
    const text = textOf(answer);
    expect(text).not.toContain("3,790");
    expect(text).toContain(engine);
    expect(answer.writtenBy).toBe("stub-model");
  });

  it("ask for the details when an invented premium was all there was and nothing is quoted yet", async () => {
    word = () => "เบี้ยเริ่มต้นเดือนละ 1,500 บาทครับ";
    const answer = await answerQuestion(said("คุ้มครองยังไง"), null);
    expect(textOf(answer)).not.toContain("1,500");
    expect(textOf(answer)).toContain("ขออายุ เพศ");
  });

  it("small talk is checked the same way", async () => {
    routed = { intent: "other" };
    word = () => "ขอบคุณครับ\nถ้าทำวันนี้เหลือ 2,999 บาทครับ";
    const answer = await answerQuestion(said("ขอบคุณครับ"), null);
    expect(textOf(answer)).toBe("ขอบคุณครับ");
    expect(answer.writtenBy).toBe("stub-model");
  });
});

describe("the health brain's model-written answers", () => {
  it("lose an invented premium and are signed with the model's name", async () => {
    routed = { intent: "plan_info" };
    word = () => "แผนนี้คุ้มครองค่าห้องครับ\nเบี้ยประมาณ 12,345 บาทต่อปี";
    const answer = await answerHealth(said("แผนนี้คุ้มครองยังไง"), null);
    expect(textOf(answer)).toBe("แผนนี้คุ้มครองค่าห้องครับ");
    expect(answer.writtenBy).toBe("stub-model");
  });
});
