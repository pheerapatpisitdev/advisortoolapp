import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

/** What the stubbed model returns: strict JSON to the router, prose to everything else. */
let routed: Record<string, unknown> = { intent: "other" };

const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task === "route" ? JSON.stringify(routed) : "ยินดีครับ",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerQuestion } = await import("@/lib/assistant/lifeprotect/answer");
const { ridersIn, payerIn, mergeRiders, resolveRiders } = await import("@/lib/assistant/lifeprotect/riders");
const { lifeProtectTable } = await import("@/lib/lifeprotect-table");
const { lifeProtectPriced } = await import("@/lib/lifeprotect-card");
const { formatBaht } = await import("@/calc/money");

const said = (content: string) => [{ role: "user" as const, content }];

/** A customer already quoted: a man of 38 and a million, the first thing the adverts say. */
const QUOTED = { intent: "quote" as const, age: 38, sex: "M" as const, coverWanted: 1_000_000 };
/** The same, for a child of eight. */
const CHILD = { intent: "quote" as const, age: 8, sex: "M" as const, coverWanted: 1_000_000 };

const queryOf = (path: string) => new URL(path, "https://x.test").searchParams;

beforeEach(() => {
  chat.mockClear();
  routed = { intent: "other" };
});

/**
 * "เพิ่ม beyond ให้ด้วย" was answered "แอดมินจะเช็กค่าเบี้ยรวมให้" (LINE, 2026-10-07): the bot knew
 * the rider could be bought and could not price it, though the card has priced it since
 * 2026-10-06. What a customer says about a rider is read off the message; the model is not asked.
 */
describe("reading a rider off a message", () => {
  it("takes a flavour named alone, and leaves the contract to the age", () => {
    expect(ridersIn("เพิ่ม beyond ให้ด้วย")).toEqual({ waiver: { option: "BEYOND" } });
    expect(ridersIn("เปลี่ยนเป็นฟิต")).toEqual({ waiver: { option: "FIT" } });
    expect(ridersIn("ขอ WP บียอนด์")).toEqual({ waiver: { code: "WP", option: "BEYOND" } });
    expect(ridersIn("ขอพีบีด้วย")).toEqual({ waiver: { code: "PB" } });
  });

  it("takes a broad question for the default waiver, with nothing named", () => {
    expect(ridersIn("มีสัญญาเพิ่มเติมอะไรบ้างคะ")).toEqual({ waiver: {} });
  });

  it("reads the daily hospital money as the medical rider (owner, 2026-10-07)", () => {
    expect(ridersIn("มีค่าชดเชยรายวันไหม")).toEqual({ medical: "any" });
    expect(ridersIn("นอน รพ. วันละ 1,000")).toEqual({ medical: 1000 });
    expect(ridersIn("เอา MEB 2000")).toEqual({ medical: 2000 });
    expect(ridersIn("นอนโรงพยาบาลแล้วได้เงินวันละ 3000 บาทไหม")).toEqual({ medical: 3000 });
  });

  it("takes both when a message names both", () => {
    expect(ridersIn("เอา beyond กับ MEB 1000")).toEqual({ waiver: { option: "BEYOND" }, medical: 1000 });
  });

  it("takes a refusal as the end of the riders", () => {
    expect(ridersIn("ไม่เอาสัญญาเพิ่มเติม")).toEqual({ none: true });
    expect(ridersIn("ไม่เอา MEB")).toEqual({ none: true });
  });

  it("leaves alone what is not about a rider", () => {
    expect(ridersIn("อยากได้ทุน 1 ล้าน ชาย 35")).toBeUndefined();
    expect(ridersIn("ผู้ชำระเบี้ยต้องแถลงสุขภาพไหม")).toBeUndefined();
    expect(ridersIn("ขอตารางมูลค่า")).toBeUndefined();
  });

  it("reads a parent from the answer to the question about them", () => {
    expect(payerIn("แม่ 35")).toEqual({ sex: "F", age: 35 });
    expect(payerIn("คุณพ่ออายุ 41 ปีค่ะ")).toEqual({ sex: "M", age: 41 });
    expect(payerIn("ผู้ปกครองหญิง 38")).toEqual({ sex: "F", age: 38 });
    expect(payerIn("ได้ครับ")).toBeUndefined();
  });

  it("carries what was chosen and lets a new word change only its own part", () => {
    const first = mergeRiders(undefined, { waiver: { option: "BEYOND" } });
    expect(mergeRiders(first, { medical: 1000 })).toEqual({ waiver: { option: "BEYOND" }, medical: 1000 });
    expect(mergeRiders(first, { waiver: { option: "FIT" } })).toEqual({ waiver: { option: "FIT" } });
    expect(mergeRiders(first, { none: true })).toBeUndefined();
    expect(mergeRiders(first, undefined)).toEqual(first);
  });
});

describe("which rider is priced on whom", () => {
  const table = lifeProtectTable();

  it("gives an adult the waiver for the insured, in the fit flavour, unless told otherwise", () => {
    expect(resolveRiders(table, { age: 38, sex: "M" }, { waiver: {} })).toEqual({
      kind: "ok", riders: { waiver: { code: "WP", option: "FIT" } },
    });
    expect(resolveRiders(table, { age: 38, sex: "M" }, { waiver: { option: "BEYOND" } })).toEqual({
      kind: "ok", riders: { waiver: { code: "WP", option: "BEYOND" } },
    });
  });

  it("asks for the parent before pricing a child's พีบี", () => {
    expect(resolveRiders(table, { age: 8, sex: "M" }, { waiver: {} }).kind).toBe("payer");
    expect(resolveRiders(table, { age: 8, sex: "M" }, { waiver: {}, payer: { sex: "F", age: 35 } })).toEqual({
      kind: "ok", riders: { waiver: { code: "PB", option: "FIT" }, payer: { sex: "F", age: 35 } },
    });
  });

  it("will not price a parent outside the rider's window, or a waiver the age may not buy", () => {
    expect(resolveRiders(table, { age: 8, sex: "M" }, { waiver: {}, payer: { sex: "F", age: 99 } }).kind).toBe("payer");
    expect(resolveRiders(table, { age: 75, sex: "M" }, { waiver: {} }).kind).toBe("unsold");
    // WP starts at sixteen; a child asking for it is not priced a contract nobody sells
    expect(resolveRiders(table, { age: 8, sex: "M" }, { waiver: { code: "WP" } }).kind).toBe("unsold");
  });

  it("takes the daily money at a thousand, or the most the age may have below that", () => {
    expect(resolveRiders(table, { age: 38, sex: "M" }, { medical: "any" })).toEqual({
      kind: "ok", riders: { medical: 1000 },
    });
    expect(resolveRiders(table, { age: 8, sex: "M" }, { medical: "any" })).toEqual({
      kind: "ok", riders: { medical: 500 },
    });
  });

  it("holds a plan the age may not buy to the plans it may, and prices nothing at an age outside 6–65", () => {
    const refused = resolveRiders(table, { age: 8, sex: "M" }, { medical: 3000 });
    expect(refused.kind).toBe("unsold");
    expect(refused.kind === "unsold" && refused.text).toContain("500");
    expect(resolveRiders(table, { age: 70, sex: "M" }, { medical: "any" }).kind).toBe("unsold");
    expect(resolveRiders(table, { age: 4, sex: "M" }, { medical: "any" }).kind).toBe("unsold");
  });

  it("stacks the daily money on a waiver", () => {
    expect(resolveRiders(table, { age: 38, sex: "M" }, { waiver: { option: "BEYOND" }, medical: 2000 })).toEqual({
      kind: "ok", riders: { waiver: { code: "WP", option: "BEYOND" }, medical: 2000 },
    });
  });
});

describe("the card a rider question is answered with", () => {
  it("answers 'เพิ่ม beyond' with the card and table that carry WP Beyond, priced as the page prices it", async () => {
    const answer = await answerQuestion(said("เพิ่ม beyond ให้ด้วย"), QUOTED);
    const [quote, tablePicture] = answer.messages;
    expect(queryOf(quote.card!).get("rider")).toBe("WP.BEYOND");
    // the table is drawn for the same arrangement as the card, never another
    expect(queryOf(tablePicture.card!).get("rider")).toBe("WP.BEYOND");
    // one price on the screen, and it is the page's: the card's input priced by the card's own function
    const priced = lifeProtectPriced({
      kind: "plan", planCode: "LIFEPROTECT", variant: "WLF19H", age: 38, sex: "M", sumAssured: 1_000_000,
      riders: { waiver: { code: "WP", option: "BEYOND" } },
    }, new Date())!;
    expect(quote.text).toContain(formatBaht(priced.paid![0].total));
    expect(quote.text).toContain("สัญญาหลัก");
    expect(quote.text).toContain("ดับบลิวพี บียอนด์");
    // the quote PDF carries no riders yet: a PDF that disagrees with the card is worse than none
    expect(quote.pdfPath).toBeUndefined();
    expect(answer.priced).toBe(true);
    expect(answer.slots.riders).toEqual({ waiver: { option: "BEYOND" } });
    // nothing for the model to word: every figure is the table's
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["route"]);
  });

  it("answers a broad question with the default waiver and offers the ways to change it", async () => {
    const answer = await answerQuestion(said("มีสัญญาเพิ่มเติมอะไรบ้างคะ"), QUOTED);
    expect(queryOf(answer.messages[0].card!).get("rider")).toBe("WP.FIT");
    expect(answer.replies).toContain("เปลี่ยนเป็น Beyond");
    expect(answer.replies).toContain("นอน รพ. วันละ 1,000");
    expect(answer.replies).toContain("ไม่เอาสัญญาเพิ่มเติม");
    // every button is a thing the router reads back, or the button would do nothing
    for (const button of ["เปลี่ยนเป็น Beyond", "นอน รพ. วันละ 1,000", "ไม่เอาสัญญาเพิ่มเติม"]) {
      expect(ridersIn(button), button).toBeDefined();
    }
  });

  it("answers the daily money with the medical rider alone, said as money for the nights in hospital", async () => {
    const answer = await answerQuestion(said("มีค่าชดเชยรายวันไหมคะ"), QUOTED);
    const q = queryOf(answer.messages[0].card!);
    expect(q.get("meb")).toBe("1000");
    expect(q.get("rider")).toBeNull();
    expect(answer.messages[0].text).toContain("นอนโรงพยาบาล");
    expect(answer.messages[0].text).toContain("วันละ 1,000");
    // MEB is renewed yearly at the age's rate, so the level-premium line must not say otherwise
    expect(answer.messages[0].text).toContain("MEB ปรับตามอายุ");
    expect(answer.messages[0].text).not.toContain("เบี้ยคงที่ตลอดระยะเวลาชำระ");
  });

  it("stacks the daily money onto the waiver already chosen, and keeps both for the next question", async () => {
    const first = await answerQuestion(said("เพิ่ม beyond ให้ด้วย"), QUOTED);
    const then = await answerQuestion(said("นอน รพ. วันละ 2,000"), first.slots);
    const q = queryOf(then.messages[0].card!);
    expect([q.get("rider"), q.get("meb")]).toEqual(["WP.BEYOND", "2000"]);

    // a new sum is priced with the same riders, as the page would
    routed = { intent: "quote", coverWanted: 2_000_000 };
    const larger = await answerQuestion(said("ทุน 2 ล้านล่ะ"), then.slots);
    const q2 = queryOf(larger.messages[0].card!);
    expect([q2.get("rider"), q2.get("meb")]).toEqual(["WP.BEYOND", "2000"]);
  });

  it("takes the riders off when the customer says so", async () => {
    const first = await answerQuestion(said("เพิ่ม beyond ให้ด้วย"), QUOTED);
    const then = await answerQuestion(said("ไม่เอาสัญญาเพิ่มเติม"), first.slots);
    const q = queryOf(then.messages[0].card!);
    expect(q.get("rider")).toBeNull();
    expect(q.get("meb")).toBeNull();
    expect(then.slots.riders).toBeUndefined();
    // and the plain quote has its PDF back
    expect(then.messages[0].pdfPath).toBeDefined();
  });

  it("asks for the parent before pricing a child's rider, and prices it when they answer", async () => {
    const ask = await answerQuestion(said("ขอพีบีด้วยค่ะ"), CHILD);
    expect(ask.messages[0].card).toBeUndefined();
    expect(ask.messages[0].text).toContain("ผู้ปกครอง");
    expect(ask.priced).toBeFalsy();

    // the answer is a parent, not a new insured: the child's age must stand
    routed = { intent: "other", age: 35, sex: "F" };
    const then = await answerQuestion(said("แม่ 35"), ask.slots);
    const q = queryOf(then.messages[0].card!);
    expect([q.get("rider"), q.get("payer")]).toEqual(["PB.FIT", "F35"]);
    expect(q.get("age")).toBe("8");
    expect(then.slots.age).toBe(8);
  });

  it("says plainly that an age cannot have the rider, and still sends the price it can", async () => {
    const answer = await answerQuestion(said("มีค่าชดเชยรายวันไหม"), { ...QUOTED, age: 70 });
    const q = queryOf(answer.messages[0].card!);
    expect(q.get("meb")).toBeNull();
    expect(answer.messages[0].text).toContain("6-65");
  });

  it("asks for what the price needs when the riders come before a quote, and remembers them", async () => {
    const answer = await answerQuestion(said("มีค่าชดเชยรายวันไหม"), null);
    expect(answer.messages[0].card).toBeUndefined();
    expect(answer.messages[0].text).toContain("อายุ");
    expect(answer.slots.riders).toEqual({ medical: "any" });

    routed = { intent: "quote", age: 38, sex: "M", coverWanted: 1_000_000 };
    const then = await answerQuestion(said("ชาย 38 ทุน 1 ล้าน"), answer.slots);
    expect(queryOf(then.messages[0].card!).get("meb")).toBe("1000");
  });

  it("does not turn a question about the payer's health into a rider card", async () => {
    const answer = await answerQuestion(said("ในส่วนผู้ชำระเบี้ย แม่ไม่ต้องแถลงสุขภาพใช่มั้ยคะ"), CHILD);
    expect(answer.slots.riders).toBeUndefined();
    expect(answer.messages.every((m) => !m.card)).toBe(true);
  });
});
