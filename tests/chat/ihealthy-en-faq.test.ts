import { describe, expect, it } from "vitest";
import { FAQ_EN, healthFaqAnswerEn } from "@/lib/assistant/ihealthy-en/faq";
import {
  HEALTH_PLAN_INFO_SYSTEM_EN, HEALTH_SMALL_TALK_SYSTEM_EN, healthFactsForEn,
} from "@/lib/assistant/ihealthy-en/prompts";

const THAI = /[฀-๿]/;

describe("the English FAQ", () => {
  it.each([
    ["Can I join if I have diabetes?", "health"],
    ["Can I use this for my retirement visa?", "visa"],
    ["Am I covered when I travel home?", "abroad"],
    ["How long is the waiting period?", "waiting"],
    ["Does the premium go up every year?", "rises"],
    ["Can I pay monthly?", "monthly"],
    ["Can I use it for tax?", "tax"],
  ])("%s → %s", (q, key) => expect(FAQ_EN.find((e) => e.match.test(q))?.key).toBe(key));

  it("answers nothing it was not asked", () => {
    expect(healthFaqAnswerEn("35 male")).toBeUndefined();
    expect(healthFaqAnswerEn("Gold")).toBeUndefined();
  });

  it("never names a visa or promises one", () => {
    const a = healthFaqAnswerEn("is this ok for my visa?")!;
    expect(a).not.toMatch(/guarant|non-?o\b|\bO-?A\b|\bO-?X\b|LTR|retirement visa/i);
  });

  it("says abroad is emergencies within 90 days, never worldwide", () => {
    const a = healthFaqAnswerEn("am I covered abroad?")!;
    expect(a).toContain("90 days");
    expect(a).toMatch(/emergenc/i);
    expect(a).not.toMatch(/worldwide/i);
  });

  it("asks for the condition, the treatment and the medication, instead of asking for nothing", () => {
    const a = healthFaqAnswerEn("I have diabetes, can I apply?")!;
    expect(a).toMatch(/condition/i);
    expect(a).toMatch(/treatment/i);
    expect(a).toMatch(/medication/i);
    expect(a).not.toMatch(/don'?t send|do not send/i);
  });

  it("never says a condition is covered", () => {
    expect(healthFaqAnswerEn("I have high blood pressure, am I covered?")).not.toMatch(/you are covered|will be covered|accepted/i);
  });

  it("every answer is English", () => {
    for (const e of FAQ_EN) expect(e.answer()).not.toMatch(THAI);
  });
});

describe("what the model reads", () => {
  it("the facts are English, with and without a plan", () => {
    expect(healthFactsForEn({ product: "ihealthy", intent: "plan_info" })).not.toMatch(THAI);
    expect(healthFactsForEn({ product: "ihealthy", intent: "plan_info", age: 35, sex: "F" })).not.toMatch(THAI);
    expect(healthFactsForEn({ product: "ihealthy", intent: "plan_info", age: 35, sex: "F", plan: "GOLD" })).not.toMatch(THAI);
  });

  it("the rules carry the expat lines", () => {
    for (const p of [HEALTH_PLAN_INFO_SYSTEM_EN, HEALTH_SMALL_TALK_SYSTEM_EN]) {
      expect(p).toContain("English");
      expect(p).toMatch(/visa/i);
      expect(p).toContain("90 days");
    }
  });
});
