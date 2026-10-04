import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task.startsWith("route") ? JSON.stringify({ intent: "other" }) : "ยินดีครับ",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerAny } = await import("@/lib/assistant/dispatch");
const { welcomeOf } = await import("@/lib/assistant/page-welcome");

const LUCKYPLANNER = "105982528649026";
const OTHER_PAGE = "1431905706931225"; // ประกัน Talk
const said = (content: string) => [{ role: "user" as const, content }];

beforeEach(() => { chat.mockClear(); });

describe("LuckyPlanner greets a first message that says nothing with Life Protect", () => {
  it.each(["สวัสดีครับ", "สนใจครับ", "ขอรายละเอียด", "hi"])("%s", async (first) => {
    const a = await answerAny(said(first), null, "facebook", undefined, LUCKYPLANNER);
    expect(a.messages).toHaveLength(1);
    expect(a.messages[0].opening).toBe(true);
    expect(a.messages[0].text).toContain("Life Protect");
    expect(a.messages[0].text).toContain("เพศกับอายุ");
    expect(a.messages[0].text).not.toContain("1.");
    expect(a.replies ?? []).toEqual([]);
    expect(chat).not.toHaveBeenCalled();
  });

  it("then prices Life Protect for the person who answers it", async () => {
    const first = await answerAny(said("สวัสดีครับ"), null, "facebook", undefined, LUCKYPLANNER);
    const history = [
      { role: "user" as const, content: "สวัสดีครับ" },
      { role: "assistant" as const, content: first.messages[0].text },
      { role: "user" as const, content: "ช 35" },
    ];
    const a = await answerAny(history, first.slots, "facebook", undefined, LUCKYPLANNER);
    expect((a.slots as { product: string }).product).toBe("lifeprotect");
    expect(a.messages.some((m) => m.opening)).toBe(false);
  });

  it("sends its pictures from the site, the agent's first", () => {
    const pictures = welcomeOf(LUCKYPLANNER)!.pictures;
    expect(pictures[0]).toBe("/welcome/luckyplanner/agent.jpg");
    for (const p of pictures) expect(existsSync(join(process.cwd(), "public", p))).toBe(true);
  });
});

describe("what LuckyPlanner does not greet", () => {
  it.each([
    "ชาย 35", // a person: priced, not greeted
    "ทุน 1 ล้าน", // a figure
    "เวนคืนได้ไหม", // a question
    "สนใจ iShield", // another plan, named
    "ค่าห้องเท่าไหร่", // another subject
  ])("%s", async (first) => {
    const a = await answerAny(said(first), null, "facebook", undefined, LUCKYPLANNER);
    expect(a.messages.some((m) => m.opening)).toBe(false);
  });

  it("a customer an advertisement already placed", async () => {
    const a = await answerAny(said("สวัสดีครับ"), null, "facebook", "legacy", LUCKYPLANNER);
    expect(a.messages.some((m) => m.opening)).toBe(false);
    expect((a.slots as { product: string }).product).toBe("legacy");
  });

  it("a conversation already under way", async () => {
    const a = await answerAny(said("สวัสดีครับ"), { product: "undecided" }, "facebook", undefined, LUCKYPLANNER);
    expect(a.messages.some((m) => m.opening)).toBe(false);
  });

  it("anybody on another Page, who still gets the choice of three", async () => {
    const a = await answerAny(said("สวัสดีครับ"), null, "facebook", undefined, OTHER_PAGE);
    expect(a.messages.some((m) => m.opening)).toBe(false);
    expect(a.messages.at(-1)!.text).toContain("ที่ผมดูแลมี 3 แบบ");
  });
});
