import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

/**
 * A customer of US nationality on an Expat Page is told of FATCA and the partner, and is not
 * quoted (owner chose ข ข ก, 2026-11-26; mockup https://claude.ai/artifact/YY9Q7HJ9znRjZexpDYra7y).
 * The messages are the ones customers really wrote there, October and November 2026.
 */
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task.startsWith("route") ? JSON.stringify({ intent: "other" }) : "Happy to help!",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});
const noted: string[] = [];
vi.mock("@/lib/assistant/unanswered", async () => {
  const actual = await vi.importActual<typeof import("@/lib/assistant/unanswered")>("@/lib/assistant/unanswered");
  return { ...actual, noteAfterAnswer: (e: { question: string }) => { noted.push(e.question); } };
});

const { answerAny } = await import("@/lib/assistant/dispatch");
const { saysNotUs, saysUs } = await import("@/lib/assistant/ihealthy-en/us");
const { FATCA_EN, FATCA_TH, US_CHECK_EN, US_PREPARING_EN, US_DETAILS_EN, US_WANTS_EN, US_WANTS_TH, STALL_EN } = await import("@/lib/assistant/ihealthy-en/words");

const PAGE = "112079600278201";
type Slots = Parameters<typeof answerAny>[1];
const say = (content: string, slots: Slots = null, page = PAGE) =>
  answerAny([{ role: "user", content }], slots, "facebook", undefined, page);
const texts = (a: { messages: { text: string }[] }) => a.messages.map((m) => m.text);

beforeEach(() => { chat.mockClear(); noted.length = 0; });

describe("what says US nationality", () => {
  it.each([
    "Nationality : US", "Nationality: us", "Nationality - USA", "nationality U.S.", "Nationality is United States",
    "3.Nationality and tel no. American 0812345678", "3.Nationality and tel no.-USA",
    "I'm 43\nUSA\nED visa", "43, USA, ED visa", "45 male, Nationality : US", "45 male USA", "Male 69 y o (15/06/1957)from USA Long stay in Bkk", "45 male american", "usa", "american", "Nationality: Us", "45 male from USA",
    "1. 11 July, 1989\n2. DTV visa\n3. USA. I prefer to write here, not phone call.\n4. Chiang Mai",
    "I am a 56-year-old American applying for Thailand's LTR Wealthy Pensioner visa.",
    "27/03/1985 Male\n\nStudent visa\n\nAmerican - 0812345678\n\nBangkok",
    "IPOnly coverage 3-4 mthb Dob 15-06-1957- residence BKK. uSA male-long stay visa",
    "Can US citizens apply?", "I'm a US citizen", "i have a us passport", "I hold an American passport", "Can Americans buy this?",
    "My wife is American", "I'm from the United States", "Nationality: US/UK", "Nationality: British and American",
    "สัญชาติอเมริกัน อายุ 45", "สัญชาติ : US", "ถือพาสปอร์ตอเมริกา", "แฟนเป็นคนอเมริกัน", "สามีเป็นชาวสหรัฐ",
  ])("%j", (text) => expect(saysUs(text)).toBe(true));

  it.each([
    "I have insurance in USA but not here", "High Ded ok\nIP only\nCoverage max 4mil Thb\n\nHave US ins  coverage", "so how much for the two of us ??", "best price for both of us", "Can you take us to Nakornping hospital", "Please call us", "Can you tell us more?",
    "Send us passport requirements", "What about us?", "500 USD a month", "Is the American Hospital covered?",
    "Nationality: Irish", "Nationality: Filipino", "Nationality: Australian", "Nationality: British, I have US insurance",
    "Nationality: British\nI travel to the US every year", "Does it cover Europe, Asia, USA?", "Does it cover treatment in America?",
    "I'm not American", "Nationality: not US", "I am not a US citizen", "I'm South American", "I'm married to an American, I'm British",
    "I live in the US", "35 male", "Worldwide excluding USA", "I worked 5 years in USA", "ไม่ใช่สัญชาติอเมริกัน", "คุ้มครองที่อเมริกาไหม",
    "Pre-existing conditions: none", "USA is not included?", "I had surgery in USA, 45 male",
    "Do you need a copy of my passport from us?", "What passport documents do you need from us", "I'm moving from the US to Phuket", "Do you need us to send passport?",
  ])("not %j", (text) => expect(saysUs(text)).toBe(false));

  it("reads a correction", () => {
    for (const t of ["I'm not American", "Nationality: British", "I hold a British passport", "I'm Australian", "my wife is Thai, 40 female", "ไม่ใช่สัญชาติอเมริกัน", "สัญชาติอังกฤษ"]) {
      expect(saysNotUs(t), t).toBe(true);
    }
    for (const t of ["I live in Thailand", "Thai Privilege visa", "yes please", "Nationality: US", "how much?", "Nationality: US/UK"]) {
      expect(saysNotUs(t), t).toBe(false);
    }
  });
});

describe("the answer", () => {
  it("is the owner's, with no price, card or button, and no model", async () => {
    const a = await say("45 male, Nationality : US");
    expect(texts(a)).toEqual([FATCA_EN]);
    expect(a.messages.some((m) => m.card || m.file || m.pdfPath)).toBe(false);
    expect(a.replies ?? []).toEqual([]);
    expect(chat).not.toHaveBeenCalled();
    expect(a.slots).toMatchObject({ us: "told", age: 45, sex: "M", lang: "en" });
  });

  it("answers FATCA alone and leaves the other question to the admin", async () => {
    const a = await say("3. USA. I prefer to write here.\nDoes your insurance offer direct billing, or do I have to pay upfront?");
    expect(texts(a)).toEqual([FATCA_EN]);
    expect(noted).toHaveLength(1);
    expect(noted[0]).toMatch(/direct billing/);
  });

  it("comes after a quote too, and the quote's PDF is not sent afterwards", async () => {
    const q = await say("45 male gold");
    expect(texts(q).join()).toMatch(/PDF/);
    const a = await say("My nationality is USA", q.slots);
    expect(texts(a)).toEqual([FATCA_EN]);
    const pdf = await say("Send me the PDF", a.slots);
    expect(pdf.messages.some((m) => m.file)).toBe(false);
  });

  it("is in Thai for a customer writing Thai", async () => {
    const a = await say("ผมสัญชาติอเมริกัน อายุ 45 ครับ");
    expect(texts(a)).toEqual([FATCA_TH]);
    const b = await say("สนใจครับ", a.slots);
    expect(texts(b)).toEqual([US_WANTS_TH]);
  });

  it("is only for the Expat Pages", async () => {
    const a = await say("สัญชาติอเมริกัน", null, "999");
    expect(texts(a)).not.toContain(FATCA_TH);
  });
});

describe("after it", () => {
  const told = { product: "ihealthy", intent: "other", lang: "en", age: 45, sex: "M", us: "told" } as unknown as Slots;
  const wants = { ...(told as object), us: "wants" } as unknown as Slots;

  it.each(["Yes please", "yes", "OK", "I'm interested", "Please send the information and fees", "How much?", "Check insurance premiums", "I want to apply", "Gold", "👍"])(
    "%j takes the details and is written down for the admin", async (t) => {
      const a = await say(t, told);
      expect(texts(a)).toEqual([US_WANTS_EN]);
      expect((a.slots as { us?: string }).us).toBe("wants");
      expect(noted.join()).toMatch(/AXA Insurance/);
      expect(chat).not.toHaveBeenCalled();
    });

  it("takes a no", async () => {
    expect(texts(await say("No thanks", told))).toEqual([STALL_EN]);
    expect(texts(await say("not interested", told))).toEqual([STALL_EN]);
    expect(texts(await say("No pre-existing conditions", wants))).toEqual([US_DETAILS_EN]);
  });

  it("leaves a question to the admin", async () => {
    const a = await say("Does it cover diabetes?", told);
    expect(texts(a)).toEqual([US_CHECK_EN]);
    expect(noted).toEqual(["Does it cover diabetes?"]);
  });

  it("thanks for the details, and does not price them", async () => {
    const a = await say("1. 11 July 1989 male\n2. DTV visa\n3. USA\n4. Chiang Mai\n5. none", wants);
    expect(texts(a)).toEqual([US_DETAILS_EN]);
  });

  it("says the fees are being prepared when asked again", async () => {
    expect(texts(await say("45 male gold how much", wants))).toEqual([US_PREPARING_EN]);
  });

  it("quotes again once the customer says another nationality", async () => {
    const a = await say("Sorry, I'm British. 45 male", wants);
    expect(a.messages.some((m) => m.card)).toBe(true);
    expect((a.slots as { us?: string }).us).toBeUndefined();
  });

  it("does not price another person as the customer", async () => {
    const a = await say("What about my wife? She is British", wants);
    expect(a.messages.some((m) => m.card)).toBe(false);
    expect((a.slots as { age?: number }).age).toBeUndefined();
  });
});
