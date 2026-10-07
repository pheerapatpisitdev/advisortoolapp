import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

let routed: Record<string, unknown> = { intent: "other" };
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task === "route" ? JSON.stringify(routed) : "(โมเดลเขียน)",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerAny } = await import("@/lib/assistant/dispatch");
const { productNamedIn } = await import("@/lib/assistant/choose");
const { priceNamedPlan } = await import("@/lib/copilot/price");
const { cleanSlots } = await import("@/lib/chat/public-input");
const { TAX_RELIEF } = await import("@/lib/assistant/common");
const { CHOOSE_LIFE } = await import("@/lib/assistant/choose");

const said = (content: string) => [{ role: "user" as const, content }];
const product = (a: { slots: unknown }) => (a.slots as { product?: string }).product;
const spoken = (a: { messages: { text: string }[] }) => a.messages.map((m) => m.text).join("\n");

beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

describe("naming Protection Life", () => {
  it("is PLB even when the generic word for life insurance is beside it", () => {
    expect(productNamedIn("Protection Life ประกันชีวิต")).toBe("plb");
    expect(productNamedIn("พีแอลบี")).toBe("plb");
    expect(productNamedIn("ประกันชีวิต")).toBe("lifeprotect");
  });

  it("starts a PLB conversation that asks for the person", async () => {
    const a = await answerAny(said("PLB"), null, "facebook");
    expect(product(a)).toBe("plb");
    expect(spoken(a)).toContain("อายุกับเพศ");
    expect(chat).not.toHaveBeenCalled();
  });

  it("prices a complete ask through the brain, with the words the one-message pricer gives", async () => {
    const asked = "PLB ชาย 35 ทุน 1 ล้าน ชำระ 10 ปี";
    const a = await answerAny(said(asked), null, "web");
    expect(product(a)).toBe("plb");
    expect(a.priced).toBe(true);
    expect(a.messages[0].text).toBe(priceNamedPlan(asked, "PLB", "Protection Life (PLB)").text);
    expect(chat).not.toHaveBeenCalled();
  });

  it("keeps iSmart on the stateless path", async () => {
    const a = await answerAny(said("iSmart 80/6 ชาย 40 ทุน 1 ล้าน จ่าย 6 ปี เบี้ยเท่าไหร่"), null, "web");
    expect(product(a)).toBe("undecided");
    expect(a.priced).toBe(true);
  });
});

describe("moving between Life Protect and PLB", () => {
  const inLife = { product: "lifeprotect" as const, intent: "quote" as const, age: 40, sex: "M" as const, coverWanted: 1_000_000 };

  it("brings the person and nothing else from Life Protect, and prices nothing", async () => {
    const a = await answerAny(said("PLB"), inLife, "facebook");
    expect(a.slots).toMatchObject({ product: "plb", age: 40, sex: "M" });
    expect((a.slots as { sumAssured?: number }).sumAssured).toBeUndefined();
    expect(a.priced).toBeFalsy();
  });

  it("goes back to Life Protect by its name, with only the person", async () => {
    const plb = { product: "plb" as const, age: 40, sex: "M" as const, sumAssured: 2_000_000, variant: "PLB10", priced: true as const };
    routed = { intent: "other" };
    const a = await answerAny(said("ขอดู Life Protect ครับ"), plb, "facebook");
    expect(product(a)).toBe("lifeprotect");
    expect(a.slots).toMatchObject({ age: 40, sex: "M" });
    expect((a.slots as { coverWanted?: number }).coverWanted).toBeUndefined();
  });

  it("stays on PLB when the customer says 'ประกันชีวิต' without naming Life Protect", async () => {
    const plb = { product: "plb" as const, age: 40, sex: "M" as const, sumAssured: 2_000_000, variant: "PLB10", priced: true as const };
    const a = await answerAny(said("ประกันชีวิต ลดหย่อนภาษีได้ไหม"), plb, "facebook");
    expect(product(a)).toBe("plb");
    expect(spoken(a)).toBe(TAX_RELIEF.replace(/\*\*/g, ""));
    expect(chat).not.toHaveBeenCalled();
  });
});

describe("the channels", () => {
  it("sends no intro picture with a PLB quotation", async () => {
    const a = await answerAny(said("PLB ชาย 35 ทุน 1 ล้าน ชำระ 10 ปี"), null, "facebook");
    expect(a.messages.some((m) => m.card?.startsWith("/intro/"))).toBe(false);
  });

  it("lets a PLB conversation round-trip through the website's slot check", async () => {
    const a = await answerAny(said("PLB ชาย 35 ทุน 1 ล้าน ชำระ 10 ปี"), null, "web");
    const back = cleanSlots(JSON.parse(JSON.stringify(a.slots)));
    expect(back).toMatchObject({ product: "plb", age: 35, sex: "M", sumAssured: 1_000_000, variant: "PLB10" });
    expect(cleanSlots({ product: "nonsense", age: 35 })).toBeNull();
  });
});

/** The whole-branch review (2026-10-07). */
describe("the other plans, inside a PLB conversation", () => {
  const inPlb = { product: "plb" as const, age: 35, sex: "M" as const, sumAssured: 1_000_000, variant: "PLB10", priced: true as const };

  it("still quotes iSmart, Life Treasure and Easy Protect as themselves", async () => {
    for (const [asked, name] of [
      ["iSmart 80/6 ชาย 40 ทุน 1 ล้าน จ่าย 6 ปี เบี้ยเท่าไหร่", "iSmart"],
      ["Life Treasure หญิง 40 ทุน 10 ล้าน จ่าย 12 ปี เบี้ยเท่าไหร่", "Life Treasure"],
      ["อีซี่ โพรเทค ชาย 30 ทุน 1 ล้าน เบี้ยเท่าไหร่", "อีซี่ โพรเทค"],
    ]) {
      const a = await answerAny(said(asked), inPlb, "facebook");
      expect(a.priced, asked).toBe(true);
      expect(product(a), asked).toBe("undecided");
      expect(spoken(a), asked).toContain(name);
    }
  });

  it("is not carried off by the generic words เบี้ยทิ้ง or ออม, only by a plan's own name", async () => {
    for (const asked of ["แบบนี้เป็นเบี้ยทิ้งใช่ไหม", "ไม่มีเงินออมเหรอ"]) {
      expect(product(await answerAny(said(asked), inPlb, "facebook")), asked).toBe("plb");
    }
    expect(product(await answerAny(said("ขอดู iShield หน่อย"), inPlb, "facebook"))).toBe("ishield");
    expect(product(await answerAny(said("ขอดูมรดกเพื่อครอบครัว"), inPlb, "facebook"))).toBe("legacy");
  });
});

describe("a question that compares two plans by name", () => {
  it("belongs to whoever is already answering", async () => {
    expect(productNamedIn("Protection Life ต่างกับ Life Protect ยังไง")).toBeUndefined();
    const inLife = { product: "lifeprotect" as const, intent: "quote" as const, age: 40, sex: "M" as const, coverWanted: 1_000_000 };
    const a = await answerAny(said("Protection Life ต่างกับ Life Protect ยังไง"), inLife, "facebook");
    expect(product(a)).toBe("lifeprotect");
  });
});

describe("a question about the plan, as against a request for a price", () => {
  it("goes to the library, as it did before PLB had a brain", async () => {
    for (const asked of ["PLB คืออะไร", "Protection Life รับอายุถึงกี่ปี"]) {
      const a = await answerAny(said(asked), null, "web");
      expect(a.fromLibrary, asked).toBe(true);
      expect(product(a), asked).toBe("plb");
    }
  });

  it("still asks for the person when the question is about the price", async () => {
    const a = await answerAny(said("PLB เบี้ยเท่าไหร่"), null, "facebook");
    expect(a.fromLibrary).toBeUndefined();
    expect(spoken(a)).toContain("อายุกับเพศ");
  });
});

describe("the page's own over-age message", () => {
  it("reaches PLB's answer, which points at Life Protect", async () => {
    const a = await answerAny(said("สนใจ Protection Life ทุน 1,000,000 อายุเกิน 59 ปี ขอแบบที่เหมาะกับอายุนี้"), null, "facebook");
    expect(a.replies).toContain(CHOOSE_LIFE);
  });
});
