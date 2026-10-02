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
const { PDF_OFFER, PDF_OFFER_EN, PDF_YES_EN, PDF_NO_EN } = await import("@/lib/assistant/pdf");
import type { AnySlots, WithPdf } from "@/lib/assistant/slots";
type AnyAnswer = Awaited<ReturnType<typeof answerAny>>;

const spoken = (a: AnyAnswer) => a.messages.map((m) => m.text).join("\n\n");
/** A conversation so far, ending with what the customer says now. */
const thread = (...turns: [string, AnyAnswer][]) => (now: string) => [
  ...turns.flatMap(([asked, answer]) => [
    { role: "user" as const, content: asked },
    { role: "assistant" as const, content: spoken(answer) },
  ]),
  { role: "user" as const, content: now },
];

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
    const three = await answerAny(said("Gold please"), two.slots, "facebook", undefined, EXPAT);
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

describe("a Thai customer on an Expat Page", () => {
  it("stays in Thai when they tap a plan button from the Thai menu", async () => {
    const a = await answerAny(said("Gold"), { product: "ihealthy", intent: "quote", age: 35, sex: "F" }, "facebook", undefined, EXPAT);
    expect(a.messages[0].text).toMatch(THAI);
  });
});

describe("a Thai Page", () => {
  it("is untouched by any of this", async () => {
    const a = await answerAny(said("For more information"), null, "facebook", undefined, "103716981993581");
    expect(a.messages[0].text).toMatch(THAI);
  });
});

describe("the quote's PDF on an Expat Page", () => {
  async function quotedInEnglish() {
    const person = await answerAny(said("35 male"), null, "facebook", undefined, EXPAT);
    const quote = await answerAny(thread(["35 male", person])("Gold"), person.slots, "facebook", undefined, EXPAT);
    return { person, quote };
  }

  it("is offered in English after an English quote, for an English file", async () => {
    const { quote } = await quotedInEnglish();
    expect(quote.messages.at(-1)!.text).toBe(PDF_OFFER_EN);
    expect(quote.replies?.slice(0, 2)).toEqual([PDF_YES_EN, PDF_NO_EN]);
    expect((quote.slots as WithPdf<AnySlots>).pdf?.paths?.[0]).toContain("l=en");
  });

  it("is sent when asked for, in English", async () => {
    const { person, quote } = await quotedInEnglish();
    const history = thread(["35 male", person], ["Gold", quote]);
    const sent = await answerAny(history(PDF_YES_EN), quote.slots, "facebook", undefined, EXPAT);
    expect(sent.messages[0].text).not.toMatch(THAI);
    expect(sent.messages[0].file).toContain("l=en");
    const yes = await answerAny(history("yes please"), quote.slots, "facebook", undefined, EXPAT);
    expect(yes.messages[0].file).toContain("l=en");
  });

  it("takes a no in English, and does not offer again", async () => {
    const { person, quote } = await quotedInEnglish();
    const no = await answerAny(thread(["35 male", person], ["Gold", quote])(PDF_NO_EN), quote.slots, "facebook", undefined, EXPAT);
    expect(no.messages[0].text).not.toMatch(THAI);
    expect(no.messages[0].file).toBeUndefined();
    expect((no.slots as WithPdf<AnySlots>).pdf?.declined).toBe(true);
  });

  it("is offered in Thai, for a Thai file, to a customer writing Thai", async () => {
    const person = await answerAny(said("หญิง 35 ค่ะ"), null, "facebook", undefined, EXPAT);
    const quote = await answerAny(thread(["หญิง 35 ค่ะ", person])("เอาแผน Gold"), person.slots, "facebook", undefined, EXPAT);
    expect(quote.messages.at(-1)!.text).toBe(PDF_OFFER);
    expect((quote.slots as WithPdf<AnySlots>).pdf?.paths?.[0]).not.toContain("l=en");
  });
});
