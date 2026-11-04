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
const { asksForEnglish, asksForThai } = await import("@/lib/assistant/expat");
const { ONLY_PERSON_EN, SWITCHED_EN, SWITCHED_TH } = await import("@/lib/assistant/ihealthy-en/switch");
const { APPLY_STEPS_EN, ASK_DETAILS_EN, FULL_TABLE_EN } = await import("@/lib/assistant/ihealthy-en/words");
const { WANTS_IN } = await import("@/lib/assistant/common");
const { CHOOSE_LIFE } = await import("@/lib/assistant/choose");
import type { AnySlots } from "@/lib/assistant/slots";

const said = (content: string) => [{ role: "user" as const, content }];
const THAI = /[฀-๿]/;
/** the customer on LINE (2026-11-03): หญิง 69, quoted the iHealthy menu in Thai */
const QUOTED: AnySlots = { product: "ihealthy", intent: "quote", age: 69, sex: "F" };
const lang = (s: AnySlots) => (s as { lang?: string }).lang;

beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

describe("a request for English", () => {
  it.each([
    "ภาษาอังกฤษ", "อังกฤษ", "ขอเป็นภาษาอังกฤษครับ", "คุยภาษาอังกฤษได้ไหมคะ", "ภาษาอังกฤษ หน่อยครับ",
    "English", "English please", "english pls", "Can you speak English?", "Speak English please",
    "in English please", "Do you speak English", "I don't speak Thai",
    "Quote ภาษาอังกฤษ ihealthy ultra เพศชาย อายุ 62", "เพศชาย 35 ปี Healthty ultra อังกฤษ\n\nตาราง benefit",
    "ขอตารางภาษาอังกฤษ", "benefit table in English",
  ])("is read in %s", (text) => {
    expect(asksForEnglish(text)).toBe(true);
  });

  it.each([
    "มีเอกสารภาษาอังกฤษไหม", "ประกันอังกฤษ", "How much for a 35 year old man?", "OPD กี่บาท", "Gold",
    "Is the policy in English?", "สอนภาษาอังกฤษ", "ไปอังกฤษ 30 ปี คุ้มครองไหม", "เรียนที่อังกฤษ ชาย 20",
    "มีกรมธรรม์ภาษาอังกฤษไหม ชาย 40",
  ])("is not read in %s", (text) => {
    expect(asksForEnglish(text)).toBe(false);
  });

  it.each(["ภาษาไทย", "ไทยครับ", "ขอภาษาไทยค่ะ", "Thai please", "speak Thai"])("for Thai is read in %s", (text) => {
    expect(asksForThai(text)).toBe(true);
  });

  it.each(["คนไทยซื้อได้ไหม", "ไทยประกันชีวิต", "Thailand"])("for Thai is not read in %s", (text) => {
    expect(asksForThai(text)).toBe(false);
  });
});

describe("English on LINE", () => {
  it("sends the same premium again in English, without asking for the person", async () => {
    const a = await answerAny(said("ภาษาอังกฤษ"), QUOTED, "line");
    expect(a.messages[0].text.startsWith(SWITCHED_EN)).toBe(true);
    expect(a.messages[0].text).toContain("Female, age 69");
    expect(a.messages[0].text).toContain("THB");
    expect(a.messages.map((m) => m.text).join("\n")).not.toMatch(THAI);
    expect(a.messages[0].card).toContain("l=en");
    expect(a.slots).toMatchObject({ product: "ihealthy", age: 69, sex: "F", lang: "en" });
  });

  it("keeps to English after the switch: a plan tapped, then the menu's Thai apply button", async () => {
    const switched = await answerAny(said("ภาษาอังกฤษ"), QUOTED, "line");
    const plan = await answerAny(said("Bronze"), switched.slots, "line");
    expect(plan.priced).toBe(true);
    expect(plan.messages.map((m) => m.text).join("\n")).not.toMatch(THAI);
    expect(lang(plan.slots)).toBe("en");

    const apply = await answerAny(said(WANTS_IN), plan.slots, "line");
    expect(apply.messages[0].text).toBe(APPLY_STEPS_EN);
    expect(lang(apply.slots)).toBe("en");
  });

  it("goes back to Thai when asked, with the premium in Thai", async () => {
    const switched = await answerAny(said("English please"), QUOTED, "line");
    const back = await answerAny(said("ภาษาไทย"), switched.slots, "line");
    expect(back.messages[0].text.startsWith(SWITCHED_TH)).toBe(true);
    expect(back.messages[0].text).toContain("69");
    expect(lang(back.slots)).toBeUndefined();
  });

  it("stays in English when the customer writes Thai, until they ask for Thai (owner chose ก)", async () => {
    const switched = await answerAny(said("English please"), QUOTED, "line");
    routed = { intent: "plan_info" };
    const next = await answerAny(said("ค่าห้องเท่าไหร่ครับ"), switched.slots, "line");
    expect(lang(next.slots)).toBe("en");
  });

  it("takes a Thai request to apply in English, without the button", async () => {
    const switched = await answerAny(said("English please"), QUOTED, "line");
    const apply = await answerAny(said("สนใจสมัครเลยครับ"), switched.slots, "line");
    expect(apply.messages[0].text).toBe(APPLY_STEPS_EN);
  });

  it("asks for the person in English when nothing is known yet", async () => {
    const a = await answerAny(said("English please"), null, "line");
    expect(a.messages[0].text).toBe(`${SWITCHED_EN}\n\n${ASK_DETAILS_EN}`);
    expect(lang(a.slots)).toBe("en");
  });

  it("hands a Life Protect conversation to the agent in English, its quotation kept", async () => {
    const life: AnySlots = { product: "lifeprotect", intent: "quote", age: 40, sex: "M" } as AnySlots;
    const a = await answerAny(said("ภาษาอังกฤษ"), life, "line");
    expect(a.messages[0].text).toBe(ONLY_PERSON_EN);
    expect(a.slots).toMatchObject({ product: "lifeprotect", age: 40 });
    expect(lang(a.slots)).toBeUndefined();
  });

  it("hands the menu's Life Protect button to the agent while in English", async () => {
    const switched = await answerAny(said("ภาษาอังกฤษ"), QUOTED, "line");
    const a = await answerAny(said(CHOOSE_LIFE), switched.slots, "line");
    expect(a.messages[0].text).toBe(ONLY_PERSON_EN);
    expect(lang(a.slots)).toBe("en");
  });
});

describe("a request for English inside a longer message (LINE, 2026-11-04)", () => {
  it("prices the person it names, in English, from a Thai conversation", async () => {
    const a = await answerAny(said("Quote ภาษาอังกฤษ ihealthy ultra เพศชาย อายุ 62"), null, "line");
    expect(a.messages[0].text.startsWith(SWITCHED_EN)).toBe(true);
    expect(a.messages[0].text).toContain("Male, age 62");
    expect(a.slots).toMatchObject({ age: 62, sex: "M", lang: "en" });
  });

  it("sends the full table for a new person, with their premium, already in English", async () => {
    const stored: AnySlots = { product: "ihealthy", intent: "quote", age: 62, sex: "M", plan: "GOLD", lang: "en" };
    const a = await answerAny(said("เพศชาย 35 ปี Healthty ultra อังกฤษ\n\nตาราง benefit"), stored, "line");
    expect(chat).not.toHaveBeenCalled();
    expect(a.messages[0].text).toBe(FULL_TABLE_EN);
    expect(a.messages[0].file).toContain("age=35");
    expect(a.messages[0].file).toContain("l=en");
    expect(a.messages[1].text).toContain("39,160");
    expect(a.messages.map((m) => m.text).join("\n")).not.toMatch(THAI);
    expect(a.slots).toMatchObject({ age: 35, plan: "GOLD", lang: "en" });
  });

  it("sends the sheet alone when the person has not changed", async () => {
    const stored: AnySlots = { product: "ihealthy", intent: "quote", age: 35, sex: "M", plan: "GOLD", lang: "en" };
    const a = await answerAny(said("ขอตาราง benefit"), stored, "line");
    expect(a.messages).toHaveLength(1);
    expect(a.messages[0].text).toBe(FULL_TABLE_EN);
  });

  it("reads a new person typed in Thai while in English", async () => {
    const stored: AnySlots = { product: "ihealthy", intent: "quote", age: 62, sex: "M", plan: "GOLD", lang: "en" };
    const a = await answerAny(said("หญิง 40"), stored, "line");
    expect(a.messages[0].text).toContain("Female, age 40");
    expect(lang(a.slots)).toBe("en");
  });

  it("hands another plan named in the message to the agent", async () => {
    const a = await answerAny(said("Life Protect ภาษาอังกฤษ ชาย 40"), null, "line");
    expect(a.messages[0].text).toBe(ONLY_PERSON_EN);
  });
});

describe("the Thai health brain", () => {
  const gold: AnySlots = { product: "ihealthy", intent: "quote", age: 62, sex: "M", plan: "GOLD" };

  it("quotes again when the person changes and the plan stays in the slots", async () => {
    routed = { intent: "other", age: 35, sex: "M", plan: "GOLD" };
    const a = await answerAny(said("เปลี่ยนเป็นชาย 35"), gold, "line");
    expect(a.priced).toBe(true);
    expect(a.messages[0].text).toContain("39,160");
  });

  it("takes ตาราง benefit as the full table, for the person the message names", async () => {
    const a = await answerAny(said("ชาย 35 ตาราง benefit"), gold, "line");
    expect(a.messages[0].file).toContain("age=35");
    expect(a.messages[0].file).not.toContain("l=en");
  });
});

describe("English never asked for", () => {
  it("leaves a Thai Page answering an English question in Thai (owner chose ก)", async () => {
    const a = await answerAny(said("For more information"), null, "facebook", undefined, "103716981993581");
    expect(a.messages[0].text).toMatch(THAI);
  });
});
