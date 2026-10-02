import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

let routed: Record<string, unknown> = { intent: "other" };
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task.startsWith("route") ? JSON.stringify(routed) : "ยินดีครับ",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerAny } = await import("@/lib/assistant/dispatch");
const { GREETING_EN } = await import("@/lib/assistant/ihealthy-en/words");

const said = (content: string) => [{ role: "user" as const, content }];
const THAI = /[฀-๿]/;
const EXPAT = "112079600278201";

beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

describe("an Expat Page", () => {
  it("meets an English opener with the English greeting, not the three-plan menu", async () => {
    const a = await answerAny(said("For more information"), null, "facebook", undefined, EXPAT);
    expect(a.messages[0].text).toBe(GREETING_EN);
    expect(a.slots).toMatchObject({ product: "ihealthy", lang: "en" });
  });

  it("sends Thai to the Thai health brain", async () => {
    routed = { intent: "other" };
    const a = await answerAny(said("สนใจประกันสุขภาพค่ะ"), null, "facebook", undefined, EXPAT);
    expect(a.messages[0].text).toMatch(THAI);
    expect((a.slots as { product: string }).product).toBe("ihealthy");
    expect((a.slots as { lang?: string }).lang).toBeUndefined();
  });

  it("keeps age and sex across English → Thai → English", async () => {
    const one = await answerAny(said("35 male"), null, "facebook", undefined, EXPAT);
    routed = { intent: "plan_info" };
    const two = await answerAny(said("ค่าห้องเท่าไหร่"), one.slots, "facebook", undefined, EXPAT);
    routed = { intent: "other" };
    const three = await answerAny(said("Gold"), two.slots, "facebook", undefined, EXPAT);
    expect(three.priced).toBe(true);
    expect(three.messages[0].text).not.toMatch(THAI);
  });

  it("answers a number alone in the conversation's language", async () => {
    const a = await answerAny(said("35"), { product: "ihealthy", intent: "quote", sex: "M", lang: "en" }, "facebook", undefined, EXPAT);
    expect(a.messages[0].text).not.toMatch(THAI);
  });

  it("carries a person from a non-health session into the health brain", async () => {
    const a = await answerAny(said("Gold"), { product: "undecided", age: 40, sex: "F" }, "facebook", undefined, EXPAT);
    expect(a.priced).toBe(true);
  });
});

describe("a Thai Page", () => {
  it("is untouched by any of this", async () => {
    const a = await answerAny(said("For more information"), null, "facebook", undefined, "103716981993581");
    expect(a.messages[0].text).toMatch(THAI);
  });
});
