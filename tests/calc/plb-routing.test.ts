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
    const plb = { product: "plb" as const, age: 40, sex: "M" as const, sumAssured: 2_000_000, variant: "PLB10" };
    routed = { intent: "other" };
    const a = await answerAny(said("ขอดู Life Protect ครับ"), plb, "facebook");
    expect(product(a)).toBe("lifeprotect");
    expect(a.slots).toMatchObject({ age: 40, sex: "M" });
    expect((a.slots as { coverWanted?: number }).coverWanted).toBeUndefined();
  });

  it("stays on PLB when the customer says 'ประกันชีวิต' without naming Life Protect", async () => {
    const plb = { product: "plb" as const, age: 40, sex: "M" as const, sumAssured: 2_000_000, variant: "PLB10" };
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
