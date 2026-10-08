import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Which of the two machines a question is handed to.
 *
 * That decision is the whole of what this module owns. Whether the premium is right is the
 * dispatcher's own business and its own tests; what matters here is that a question about
 * money reaches the engine and never a model, and that a question about a rule does not get
 * sent down the pricing path because it happened to contain the word "เท่าไหร่".
 */

const asked = { dispatch: 0, model: 0 };
let lastSlots: unknown;

vi.mock("@/lib/assistant/dispatch", () => ({
  answerAny: async (_history: unknown, slots: unknown) => {
    asked.dispatch += 1;
    lastSlots = slots;
    return {
      messages: [
        { text: "เบี้ยปีละ 23,400 บาท", card: "/api/card?x=1" },
        { text: "อีกท่านปีละ 19,100 บาท", card: "/api/card?x=2" },
      ],
      priced: true,
      slots: { product: "lifeprotect", age: 35, sex: "M" },
    };
  },
}));
vi.mock("@/lib/ai/client", () => ({
  chat: async () => { asked.model += 1; return { text: "ตอบจากคลัง", model: "test-model" }; },
  BudgetExceeded: class extends Error {},
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  }),
}));

const { answerFromKnowledge } = await import("@/lib/copilot/answer");

beforeEach(() => {
  asked.dispatch = 0;
  asked.model = 0;
  lastSlots = undefined;
});

describe("a question about money", () => {
  for (const q of [
    "ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่",
    "Life Protect ราคาเท่าไหร่",
    "จ่ายเดือนละกี่บาท",
    "ค่างวดรายปีเท่าไร",
    "คิดให้หน่อย ชาย 40 ทุน 2 ล้าน",
    "what is the premium for age 40",
  ]) {
    it(`sends "${q}" to the engine and not to a model`, async () => {
      const a = await answerFromKnowledge(q);
      expect(asked.dispatch).toBe(1);
      expect(asked.model).toBe(0);
      expect(a.priced).toBe(true);
      expect(a.text).toContain("23,400");
    });
  }

  it("carries every picture the engine drew, not only the first", async () => {
    // a couple priced together is two quotations and two cards
    expect((await answerFromKnowledge("เบี้ยเท่าไหร่")).cards).toEqual(["/api/card?x=1", "/api/card?x=2"]);
  });

  it("hands back what the engine now knows, so the next question continues the quotation", async () => {
    const a = await answerFromKnowledge("ชาย 35 เบี้ยเท่าไหร่");
    expect(a.slots).toMatchObject({ product: "lifeprotect", age: 35 });
  });
});

describe("a question the engine draws a picture for", () => {
  for (const q of [
    "ขอดูตารางมูลค่าหน่อย",
    "ขอตารางผลประโยชน์",
    "มีแบบถูกกว่านี้ไหม",
    "จ่ายกี่ปี",
  ]) {
    it(`sends "${q}" to the engine — a model cannot draw a table`, async () => {
      await answerFromKnowledge(q);
      expect(asked.dispatch).toBe(1);
      expect(asked.model).toBe(0);
    });
  }
});

describe("a question asked while a quotation is half-built", () => {
  it("goes to the engine even with no money word in it at all", async () => {
    // "ทุน 1 ล้าน" after "Life Protect ชาย 35" names no price and is entirely about one
    await answerFromKnowledge("ทุน 1 ล้าน", [], { product: "lifeprotect", age: 35, sex: "M" } as never);
    expect(asked.dispatch).toBe(1);
    expect(asked.model).toBe(0);
    expect(lastSlots).toMatchObject({ age: 35 });
  });
});

describe("a message that names a plan's subject but not the plan", () => {
  /**
   * The inbox reads the subject as well as the name (dispatch.ts: `named ?? productByTopic`);
   * the page read only the name. On 2026-10-08 "มีประกันโรคร้ายแรงไหม" opened a chat on the
   * website, went to the library, came back with no conversation, and every turn after it —
   * "20ปี", "ชายอายุ 35", "1000000", "ขอดูตาราง" — went to the library too: eleven messages,
   * a premium in prose and never a card.
   */
  for (const q of ["มีประกันโรคร้ายแรงไหม", "ประกันมรดกทุน 1,000,000"]) {
    it(`sends "${q}" to the engine, as the inbox does`, async () => {
      await answerFromKnowledge(q);
      expect(asked.dispatch).toBe(1);
      expect(asked.model).toBe(0);
    });
  }
});

describe("a question about a rule", () => {
  /**
   * These name no plan, so no brain owns them and the library answers directly.
   *
   * The ones that do name a plan go to that plan's brain instead — the dispatcher's own first
   * test, and the page asks it too so that the two doors cannot answer the same question
   * differently. See `tests/calc/one-library.test.ts`.
   */
  for (const q of [
    "DCI ซื้อได้ถึงอายุเท่าไหร่",
    "HIC ซื้อคู่กับ MEB ได้ไหม",
    "รับประกันถึงอายุเท่าไร",
  ]) {
    it(`answers "${q}" from the knowledge, not the engine`, async () => {
      const a = await answerFromKnowledge(q);
      expect(asked.model).toBe(1);
      expect(asked.dispatch).toBe(0);
      expect(a.priced).toBeFalsy();
      expect(a.model).toBe("test-model");
    });
  }
});

describe("a plan without a brain", () => {
  /**
   * These four used to be priced by this page, before the dispatcher was asked. They are
   * priced inside the dispatcher now, so that the page's inbox gets the same figure from the
   * same code — which is what `tests/calc/one-library.test.ts` presses, against the real one.
   *
   * What is left to prove here is the half that was always non-negotiable and is easy to lose
   * in a move: the question reaches the engine, and never a model. "iShield ทุน 1 ล้าน" came
   * back once priced as Life Protect, card and all, because a model was asked to place it.
   */
  it("goes to the engine, and never to a model", async () => {
    for (const ask of [
      "iShield ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่",
      "PLB ทุน 1 ล้าน เบี้ยเท่าไหร่",
      "Life Treasure ชาย 40 เบี้ยเท่าไหร่",
      "iSmart 80/6 เบี้ยเท่าไหร่",
    ]) {
      asked.dispatch = 0;
      asked.model = 0;
      await answerFromKnowledge(ask);
      expect(asked.dispatch, ask).toBe(1);
      expect(asked.model, ask).toBe(0);
    }
  });

  it("still prices the two it does sell", async () => {
    await answerFromKnowledge("Life Protect ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่");
    expect(asked.dispatch).toBe(1);
    expect(asked.model).toBe(0);
  });

  it("hands a plan's own question to that plan, money or no money", async () => {
    /**
     * "มีประกันสุขภาพไหม" was answered here out of the library, which listed the rider codes
     * with their age ranges — true, and a catalogue. The inbox answered the same question
     * with "ขออายุกับเพศหน่อยครับ เดี๋ยวดูเบี้ยให้เลย". One question, two doors, two kinds of
     * reply, because this gate only ever asked about money.
     */
    for (const q of ["มีประกันสุขภาพไหม", "Life Protect ทุนขั้นต่ำเท่าไหร่", "iHealthy มีระยะเวลารอคอยกี่วัน"]) {
      asked.dispatch = 0;
      asked.model = 0;
      await answerFromKnowledge(q);
      expect(asked.dispatch, q).toBe(1);
      expect(asked.model, q).toBe(0);
    }
  });
});
