import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

let routed: Record<string, unknown> = { intent: "other" };
let worded = "Happy to help!";
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task.startsWith("route") ? JSON.stringify(routed) : worded,
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerHealthEn } = await import("@/lib/assistant/ihealthy-en/answer");
const { GREETING_EN, APPLY_HAND_OVER_EN } = await import("@/lib/assistant/ihealthy-en/words");

const said = (content: string) => [{ role: "user" as const, content }];
const THAI = /[฀-๿]/;
const KNOWN = { product: "ihealthy" as const, intent: "quote" as const, age: 35, sex: "M" as const, lang: "en" as const };

beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; worded = "Happy to help!"; });

describe("the English health brain", () => {
  it("greets the ad's button in English and asks for age and gender, without a model", async () => {
    const a = await answerHealthEn(said("For more information"), null);
    expect(a.messages[0].text).toBe(GREETING_EN);
    expect(a.slots.lang).toBe("en");
    expect(chat).not.toHaveBeenCalled();
  });

  it("35 male → English menu", async () => {
    const a = await answerHealthEn(said("35 male"), null);
    expect(a.replies).toEqual(["Bronze", "Silver", "Gold"]);
    expect(a.slots).toMatchObject({ age: 35, sex: "M", lang: "en" });
  });

  it("asks only for what is missing", async () => {
    const a = await answerHealthEn(said("I'm 35"), null);
    expect(a.messages[0].text).toMatch(/gender/i);
    expect(a.messages[0].text).not.toMatch(/\bage\b/i);
  });

  it("Gold → English quote", async () => {
    const a = await answerHealthEn(said("Gold"), KNOWN);
    expect(a.priced).toBe(true);
    expect(a.messages[0].card).toContain("l=en");
    expect(a.slots.plan).toBe("GOLD");
  });

  it("apply → hand over, no Thai form", async () => {
    const a = await answerHealthEn(said("I want to apply"), { ...KNOWN, plan: "GOLD" });
    expect(a.messages.map((m) => m.text).join("\n")).not.toContain("ktaxaform");
    expect(a.messages[0].text).toBe(APPLY_HAND_OVER_EN);
    expect(a.slots.formSent).toBe(true);
  });

  it("a model reply with an invented figure loses that line", async () => {
    worded = "Gold costs 99,999 THB a year.\nIt covers inpatient care.";
    const a = await answerHealthEn(said("what does gold cover for inpatient care?"), { ...KNOWN, plan: "GOLD" });
    expect(a.messages[0].text).not.toContain("99,999");
  });

  it("tells the plan-info model to answer in English, with the contract in English", async () => {
    routed = { intent: "plan_info" };
    await answerHealthEn(said("does it cover outpatient visits at a clinic?"), KNOWN);
    const system = chat.mock.calls.find(([o]) => o.task === "plan_info_health_en")?.[0].messages[0].content ?? "";
    expect(system).toContain("Reply in English only");
    expect(system).not.toMatch(THAI);
  });

  it.each([
    "For more information", "35 male", "Gold", "See other plans", "too expensive", "Asia please",
    "I want to apply", "do I need to declare diabetes?", "can I use it for my visa?",
    "thanks, I'll think about it", "Plan benefits", "is there a picture?", "full benefit table",
  ])("no Thai in the reply to %s", async (q) => {
    const a = await answerHealthEn(said(q), { ...KNOWN, plan: "GOLD" });
    for (const m of a.messages) expect(m.text).not.toMatch(THAI);
  });
});
