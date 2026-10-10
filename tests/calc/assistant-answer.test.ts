import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

/** What the stubbed model returns: strict JSON to the router, prose to everything else. */
let routed: Record<string, unknown> = { intent: "other" };
let worded = "ยินดีครับ";

const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task === "route" ? JSON.stringify(routed) : worded,
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerQuestion } = await import("@/lib/assistant/lifeprotect/answer");
const { ABOUT_INSURER, BUDGET_INVITE } = await import("@/lib/assistant/common");
const { asksValueTable, lifeProtectVariantIn } = await import("@/lib/assistant/lifeprotect/route");
const { wantsToBuy } = await import("@/lib/assistant/common");
const { lifeProtectTable } = await import("@/lib/lifeprotect-table");
const { lifeProtectChatQuoteText } = await import("@/lib/lifeprotect-cta");
const { deathBenefitOf, lifeProtectModes, termAt } = await import("@/lib/lifeprotect-quote");
const { formatBaht } = await import("@/calc/money");
const { quotePdfPath } = await import("@/lib/quote-pdf/link");

const said = (content: string) => [{ role: "user" as const, content }];

beforeEach(() => {
  chat.mockClear();
  routed = { intent: "other" };
  worded = "ยินดีครับ";
});

/**
 * The money a customer says they have.
 *
 * "ผมมีเดือนละ 1000 สามารถทำประกันแบบไหนได้บ้างครับ" was answered with a quotation for a
 * million baht of cover at 2,781 a month. The figure he named is the one thing the rate table
 * can be read backwards from, so it is.
 */
describe("a budget instead of a sum", () => {
  it("quotes the cover it buys as a card and a table, inside the money named", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(
      said("ผมมีเดือนละ1000 สามารถทำประกันแบบไหนได้บ้างครับ"),
      { intent: "quote", age: 38, sex: "M" },
    );
    const table = lifeProtectTable();
    const text = answer.messages.map((m) => m.text).join("\n");
    // the quotation proper, then its chart and table, as for a sum named outright
    expect(answer.priced).toBe(true);
    expect(answer.messages.find((m) => (m.card && !m.card.includes("/api/card/table?")))).toBeDefined();
    expect(answer.messages.find((m) => m.card?.includes("/api/card/table?"))).toBeDefined();
    // the term in play is the first offer, paying 19 years; the other terms are not listed after
    // it (owner, 2026-10-10)
    expect(text).toContain("แบบจ่าย 19 ปี");
    expect(text).not.toContain("งบเท่ากัน");
    for (const variant of ["WLF09H", "WLF99H"]) {
      expect(text, variant).not.toContain(`• ${table.terms.find((t) => t.variant === variant)!.label} —`);
    }
    // the plan's own monthly floor, which is over this budget, is said where it applies
    expect(text).toContain("ขั้นต่ำ");
    // the slots hold the sum behind the card, so the table, the form and "แพงไป" read the same figure
    expect(answer.slots.takenSum).toBeGreaterThan(0);
    expect(answer.slots.budget).toEqual({ baht: 1000, per: "month" });
    // the figures are the table's own: only the cheap router was asked anything
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["route"]);
  });

  it("buys the biggest sum in 50,000 steps whose premium fits, and the next step does not", async () => {
    routed = { intent: "other" };
    const table = lifeProtectTable();
    const answer = await answerQuestion(said("งบปีละ 100,000"), { intent: "quote", age: 35, sex: "M" });
    const sum = answer.slots.takenSum!;
    const annual = (s: number) =>
      lifeProtectModes(table, termAt(table, "WLF19H"), { sex: "M", age: 35, sumAssured: s })!.find((m) => m.mode === "annual")!.total;
    expect(sum % 50_000).toBe(0);
    expect(annual(sum)).toBeLessThanOrEqual(100_000 * 100);
    expect(annual(sum + 50_000)).toBeGreaterThan(100_000 * 100);
    // and the card is drawn for that very sum
    expect(answer.messages.find((m) => (m.card && !m.card.includes("/api/card/table?")))!.card).toContain(`sum=${sum}`);
  });

  it("reads a budget by the day as that many baht over a year, and says it back by the day", async () => {
    const { budgetIn } = await import("@/lib/assistant/common");
    for (const day of [30, 50, 100, 150, 200]) {
      for (const text of [`สนใจประกันมรดก ${day} บาทต่อวัน`, `วันละ ${day} บาท`, `${day}บาท/วัน`]) {
        expect(budgetIn(text), text).toEqual({ baht: day * 365, per: "year", perDay: day });
      }
    }
    // the hospital rider's own "วันละ" is not a budget, and neither is a bare number
    expect(budgetIn("MEB วันละ 1000")).toBeUndefined();
    expect(budgetIn("นอน รพ. วันละ 2,000")).toBeUndefined();
    expect(budgetIn("อายุ 30")).toBeUndefined();
    // a monthly or yearly budget is read as before
    expect(budgetIn("เดือนละ 1000")).toEqual({ baht: 1000, per: "month" });
  });

  it.each([30, 50, 100, 150, 200])("prices %i baht a day as the annual instalment it adds up to", async (day) => {
    routed = { intent: "other" };
    const table = lifeProtectTable();
    const answer = await answerQuestion(said(`${day} บาทต่อวัน`), { intent: "quote", age: 35, sex: "M" });
    const text = answer.messages.map((m) => m.text).join("\n");
    expect(answer.slots.budget).toEqual({ baht: day * 365, per: "year", perDay: day });
    expect(text).toContain(`วันละ ${day} บาท (ปีละ ${(day * 365).toLocaleString("en-US")} บาท)`);
    // never over the year it adds up to, and never below the plan's smallest sum
    expect(answer.priced).toBe(true);
    const sum = answer.slots.takenSum!;
    expect(sum).toBeGreaterThanOrEqual(150_000);
    const annual = lifeProtectModes(table, termAt(table, "WLF19H"), { sex: "M", age: 35, sumAssured: sum })!.find((m) => m.mode === "annual")!.total;
    expect(annual).toBeLessThanOrEqual(day * 365 * 100);
  });

  it("quotes 350 baht a day, and hands a budget that buys past 10 million to the admin", async () => {
    routed = { intent: "other" };
    const ok = await answerQuestion(said("วันละ 350 บาท"), { intent: "quote", age: 35, sex: "M" });
    expect(ok.priced).toBe(true);
    expect(ok.slots.takenSum!).toBeLessThanOrEqual(10_000_000);
    for (const text of ["วันละ 3,500 บาท", "วันละ 2,000 บาท", "งบปีละ 1,000,000"]) {
      const big = await answerQuestion(said(text), { intent: "quote", age: 35, sex: "M" });
      const said_ = big.messages.map((m) => m.text).join("\n");
      expect(big.priced, text).toBeFalsy();
      expect(big.messages.some((m) => m.card), text).toBe(false);
      expect(said_, text).toContain("แอดมิน");
      expect(said_, text).not.toMatch(/\d{2},\d{3},\d{3}/);
      expect(big.slots.takenSum, text).toBeUndefined();
    }
  });

  it("asks for sex and age first when the day's budget comes alone", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("สนใจประกันมรดก 30 บาทต่อวัน"), null);
    const text = answer.messages.map((m) => m.text).join("\n");
    expect(text).toContain("รับทราบ");
    expect(text).toContain("เพศกับอายุ");
    expect(text).toContain("ช/ญ 35");
    expect(answer.slots.budget?.perDay).toBe(30);
    expect(answer.slots.age).toBeUndefined();
  });

  it("stays on the budget when the customer taps another term", async () => {
    routed = { intent: "other" };
    const first = await answerQuestion(said("งบเดือนละ 5,000"), { intent: "quote", age: 35, sex: "M" });
    routed = { intent: "other", variant: "WLF99H" };
    const then = await answerQuestion(
      [...said("งบเดือนละ 5,000"), { role: "assistant" as const, content: "..." }, { role: "user" as const, content: "ถึงอายุ 99" }],
      first.slots,
    );
    expect(then.slots.variant).toBe("WLF99H");
    // the longest term buys more than the nineteen-year one for the same 5,000 a month
    expect(then.slots.takenSum!).toBeGreaterThan(first.slots.takenSum!);
    expect(then.messages.find((m) => (m.card && !m.card.includes("/api/card/table?")))!.card).toContain("WLF99H");
  });

  it("asks who it is pricing for when only the money is known, and remembers it", async () => {
    routed = { intent: "other" };
    const first = await answerQuestion(said("มีงบเดือนละ 2,000 ครับ"), null);
    expect(first.messages[0].text).toContain("เพศกับอายุ");
    expect(first.slots.budget).toEqual({ baht: 2000, per: "month" });

    routed = { intent: "quote", age: 40, sex: "F" };
    const then = await answerQuestion(said("หญิง 40"), first.slots);
    expect(then.messages[0].text).toContain("ทุน");
    expect(then.messages[0].text).toContain("2,000");
  });

  it("says so plainly when the money does not reach the smallest contract", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("งบเดือนละ 400"), { intent: "quote", age: 55, sex: "M" });
    const text = answer.messages.map((m) => m.text).join("\n");
    expect(text).toContain("ขั้นต่ำ");
    expect(text).toContain("150,000");
  });

  it("never lifts a budget to the smallest sum: it says the budget is short", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("งบเดือนละ 400"), { intent: "quote", age: 55, sex: "M" });
    expect(answer.priced).toBeFalsy();
    expect(answer.messages.some((m) => m.card)).toBe(false);
    expect(answer.slots.takenSum).toBeUndefined();
  });

  it("invites a budget once, after the first quote and its table, and not to a couple", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const first = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(first.messages.at(-1)!.text).toBe(BUDGET_INVITE);
    expect(first.messages.at(-2)!.card).toContain("/api/card/table?");
    expect(first.slots.budgetAsked).toBe(true);

    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 2_000_000 };
    const again = await answerQuestion(said("ทุน 2 ล้านล่ะ"), first.slots);
    expect(again.messages.some((m) => m.text === BUDGET_INVITE)).toBe(false);

    routed = { intent: "quote", coverWanted: 1_000_000 };
    const couple = await answerQuestion(said("ผญ 32 ผช33ค่ะ"), null);
    expect(couple.messages.some((m) => m.text === BUDGET_INVITE)).toBe(false);
  });

  it("leaves a sum said outright alone", async () => {
    routed = { intent: "quote", age: 38, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("ทุน 1 ล้าน จ่ายเดือนละได้ไหม"), { intent: "quote", age: 38, sex: "M" });
    expect(answer.priced).toBe(true);
  });
});

describe("a quote", () => {
  beforeEach(() => { routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 }; });

  it("says the owner's wording, with the rate table's figures", async () => {
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    const table = lifeProtectTable();
    // no term named: the owner's first offer is paying 19 years
    const term = termAt(table, "WLF19H");
    // two million reaching the family; before sixty that is a sum assured of one
    const SUM = 1_000_000;
    const expected = lifeProtectChatQuoteText({
      sumAssured: SUM,
      termLabel: term.label,
      age: 35,
      sex: "M",
      modes: lifeProtectModes(table, term, { sex: "M", age: 35, sumAssured: SUM })!,
      death: deathBenefitOf(table, 35, SUM),
      coverToAge: table.coverToAge,
    });
    expect(answer.messages[0].text).toContain(expected);
    expect(answer.priced).toBe(true);
  });

  /**
   * The chart moved off the card onto the table's picture (owner, 2026-10-06), and the
   * surrender values at four ages left the quote with it — so the picture follows the card.
   */
  it("follows the card with the chart and table of the same arrangement", async () => {
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(answer.messages[1].text).toContain("กราฟและตารางมูลค่าทุกปี");
    expect(answer.messages[1].card)
      .toMatch(/^\/api\/card\/table\?plan=LIFEPROTECT&variant=WLF19H&age=35&sex=M&sum=1000000&fig=1&v=[0-9a-z]+-[0-9]+$/);
    expect(answer.messages[0].text).not.toContain("มูลค่าเงินสดสะสม");
  });

  it("asks a model to read the message, never to word the price", async () => {
    await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(chat).toHaveBeenCalledOnce();
    expect(chat.mock.calls[0][0].task).toBe("route");
  });

  it("sends a card of the same arrangement", async () => {
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(answer.messages[0].card)
      .toMatch(/^\/api\/card\?plan=LIFEPROTECT&variant=WLF19H&age=35&sex=M&sum=1000000&v=[0-9a-z]+-[0-9]+$/);
    // and the sales page's PDF of the same arrangement, remembered for when it is asked for
    expect(answer.messages[0].pdfPath).toBe(quotePdfPath({
      kind: "plan", planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000,
    }));
  });

  it("offers the two terms it did not quote", async () => {
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(answer.messages[0].text).toContain("💬 ถ้าอยากดู\nแบบออม 9 ปี หรือ จ่ายถึงอายุ 99\nคุ้มครองถึง 99 ปี\n\n✅ เงินไม่ทิ้ง");
  });

  it("quotes the term the customer named", async () => {
    const answer = await answerQuestion(said("จ่าย 19 ปีเท่าไหร่"), { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 });
    expect(answer.messages[0].text).toContain("ออม 19 ปี คุ้มครอง 99 ปี");
    expect(answer.messages[0].card).toContain("variant=WLF19H");
  });

  it("keeps the age and sum from the turn before", async () => {
    routed = { intent: "quote" };
    const answer = await answerQuestion(said("จ่าย 9 ปีล่ะ"), { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 });
    expect(answer.messages[0].card).toContain("variant=WLF09H");
    expect(answer.priced).toBe(true);
  });

  it("asks for what it is missing instead of guessing", async () => {
    routed = { intent: "quote" };
    const answer = await answerQuestion(said("ขอราคาหน่อย"), null);
    expect(answer.messages[0].text).toContain("อายุ");
    expect(answer.messages[0].card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
  });

  it("repeats the sum the advert's button named, and asks only for what is missing", async () => {
    routed = { intent: "quote", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("สนใจประกันมรดก ทุน 1,000,000"), null);
    expect(answer.messages[0].text).toContain("ทุน 1,000,000 บาท");
    expect(answer.messages[0].text).toContain("เพศ");
    expect(answer.messages[0].text).toContain("อายุ");
    expect(answer.messages[0].text).not.toContain("ทุนประกันที่สนใจ");
    expect(answer.messages[0].card).toBeUndefined();
  });

  it("asks for the one field left when the rest is known", async () => {
    routed = { intent: "quote" };
    const answer = await answerQuestion(said("ชาย"), { intent: "quote", sex: "M", coverWanted: 1_000_000 });
    expect(answer.messages[0].text).toContain("อายุ");
    expect(answer.messages[0].text).not.toContain("เพศ");
  });

  it("says no price at all for an age the plan does not issue to", async () => {
    routed = { intent: "quote", age: 95, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("อายุ 95 ทุนล้าน"), null);
    expect(answer.messages[0].card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
    expect(answer.messages[0].text).toContain("อายุ");
  });

  it("states the floor as what the family would receive, not as a sum assured", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 50_000 };
    const answer = await answerQuestion(said("ทุน 5 หมื่น"), null);
    expect(answer.messages[0].card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
    expect(answer.messages[0].text).toContain("300,000");
  });

  it("reads the advert's own million as a sum assured, the way its artwork does", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("สนใจประกันมรดก ทุน 1,000,000 ชาย 35"), null);
    expect(answer.messages[0].text).toContain("ทุน 1,000,000 บาท\n💵 แถมฟรี เพิ่มเป็น 2,000,000");
    expect(answer.messages[0].card).toContain("sum=1000000");
  });

  it("reads the customer's number as what the family receives, not as the sum assured", async () => {
    routed = { intent: "quote", age: 45, sex: "F", coverWanted: 3_000_000 };
    const answer = await answerQuestion(said("ทุน3ล้าน"), null);
    expect(answer.messages[0].text).toContain("ทุน 1,500,000 บาท\n💵 แถมฟรี เพิ่มเป็น 3,000,000");
    expect(answer.messages[0].card).toContain("sum=1500000");
  });

  it("does not halve for an insured the plan no longer doubles for", async () => {
    // past the booster age the cover is the sum assured, so there is nothing to divide by
    routed = { intent: "quote", age: 65, sex: "M", coverWanted: 2_000_000 };
    const answer = await answerQuestion(said("อายุ 65 อยากให้ครอบครัวได้ 2 ล้าน"), null);
    expect(answer.messages[0].card).toContain("sum=2000000");
  });

  it("turns down a package this chat does not sell, rather than quoting another one", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("แบบ x 1.5 จ่าย 9 ปี"), null);
    expect(answer.messages[0].card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
    expect(answer.messages[0].text).toContain("x 2");
  });
});

describe("who stands behind the policy", () => {
  it("names the insurer rather than agreeing with whatever the customer guessed", async () => {
    routed = { intent: "other" };
    worded = "ใช่ครับ ยินดีให้บริการครับ";
    const answer = await answerQuestion(said("กรุงไทยแอกซ่าใช่ไหม"), null);
    expect(answer.messages[0].text).toContain("กรุงไทย-แอกซ่า ประกันชีวิต");
    expect(answer.messages[0].text).not.toContain("ยินดีให้บริการ");
  });

  it("corrects a rival's name instead of confirming it", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("เมืองไทยประกันชีวิตใช่ไหมครับ"), null);
    expect(answer.messages[0].text).toContain("กรุงไทย-แอกซ่า ประกันชีวิต");
  });

  it("names the insurer alone, with no agents or licence numbers", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("ของบริษัทอะไรครับ"), null);
    expect(answer.messages).toHaveLength(1);
    expect(answer.messages[0].text).toBe(ABOUT_INSURER);
    expect(answer.messages[0].text).toContain("รับประกันโดย บริษัท กรุงไทย-แอกซ่า ประกันชีวิต จำกัด (มหาชน)");
    expect(answer.messages[0].text).toContain("AXA Group ดำเนินธุรกิจใน 51 ประเทศ");
    expect(answer.messages[0].text).not.toContain("6001028534");
    expect(answer.messages[0].text).not.toContain("ใบอนุญาต");
    // the question was answered; it does not then ask for details it may already have
    expect(answer.messages[0].text).not.toContain("บอกเพศกับอายุ");
    // the licences carry a national id beside the number; it must never reach a customer
    expect(answer.messages[0].text).not.toMatch(/\b1[0-9]{12}\b/);
  });

  it("hears the short way people actually ask it", async () => {
    // real customers, this morning: the sentence is elliptical, the question is the same
    for (const asked of ["ของอะไรครับ", "ประกันของใครคะ", "เจ้าไหนครับ", "ของค่ายไหน", "ขอโทษค่ะ บ.ชื่ออะไรคะ", "บ. อะไรครับ", "บ.ไหน", "บไหนคะ", "บ ไหนครับ", "บจก.ไหน", "บมจ.ไหน", "ประกันบ.ไหน"]) {
      routed = { intent: "other" };
      const answer = await answerQuestion(said(asked), null);
      expect(answer.messages[0].text, asked).toContain("กรุงไทย-แอกซ่า ประกันชีวิต");
    }
  });

  /**
   * The words a customer puts between "บริษัท" and "อะไร".
   *
   * One on the advertisement wrote "บริษัท ประกัน ของ อะไร" and was told what the bot was
   * rather than who the insurer is — the question reached the model, which is forbidden to
   * name one. The filler is spelled out, so a question about underwriting keeps going to the
   * brain that can answer it.
   */
  it("hears the question with words in the middle of it", async () => {
    for (const asked of ["บริษัท ประกัน ของ อะไร", "บริษัทนี้ชื่ออะไรครับ", "ประกัน ของ บริษัท ไหน"]) {
      routed = { intent: "other" };
      const answer = await answerQuestion(said(asked), null);
      expect(answer.messages[0].text, asked).toContain("กรุงไทย-แอกซ่า ประกันชีวิต");
    }
  });

  it("does not hear a question about the company's own doings as a question about its name", async () => {
    for (const asked of ["บริษัทจะตรวจสุขภาพไหม", "บริษัทพิจารณากี่วัน", "แบบไหนดีครับ"]) {
      routed = { intent: "plan_info" };
      worded = "ตอบตามข้อมูลครับ";
      const answer = await answerQuestion(said(asked), null);
      expect(answer.messages[0].text, asked).not.toContain("กรุงไทย-แอกซ่า");
    }
  });

  it("does not hear a question about where to buy as a question about who sells", async () => {
    for (const asked of ["ซื้อได้ที่ไหนครับ", "สมัครที่ไหน", "คุ้มครองอะไรบ้าง", "ต้องเตรียมอะไรบ้าง"]) {
      routed = { intent: "plan_info" };
      worded = "ตอบตามข้อมูลครับ";
      const answer = await answerQuestion(said(asked), null);
      expect(answer.messages[0].text, asked).not.toContain("กรุงไทย-แอกซ่า");
    }
  });

  it("names the insurer and leaves the licence to a person", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("มีใบอนุญาตตัวแทนไหม บริษัทน่าเชื่อถือหรือเปล่า"), null);
    expect(answer.messages[0].text).toContain("กรุงไทย-แอกซ่า ประกันชีวิต");
    expect(answer.messages[0].text).toContain("เดี๋ยวแอดมินดูให้");
    expect(answer.messages[0].text).not.toContain("6001028534");
  });

  it("never asks a model who the insurer is", async () => {
    routed = { intent: "plan_info" };
    chat.mockClear();
    await answerQuestion(said("ของบริษัทอะไรครับ"), null);
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["route"]);
  });

  it("still prices a quote that merely mentions a rival by name", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(answer.priced).toBe(true);
  });
});

describe("asking how long the premium runs", () => {
  it("answers with the term on the table, not the quotation again", async () => {
    routed = { intent: "quote" };
    const answer = await answerQuestion(
      said("ต้องจ่ายถึงกี่ปี"),
      { intent: "quote", age: 30, sex: "F", coverWanted: 2_000_000, variant: "WLF09H" },
    );
    expect(answer.messages).toHaveLength(1);
    expect(answer.messages[0].text).toContain("จ่าย 9 ปี");
    expect(answer.messages[0].card).toBeUndefined();
    expect(answer.messages[0].text).not.toContain("มูลค่าเงินสดสะสม");
  });

  it("names all three when no term has been chosen", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("ต้องจ่ายกี่ปี"), null);
    expect(answer.messages[0].text).toContain("จ่าย 9 ปี");
    expect(answer.messages[0].text).toContain("จ่าย 19 ปี");
    expect(answer.messages[0].text).toContain("จ่ายถึงอายุ 99");
  });

  it("says the to-99 term keeps running, and offers the shorter ones", async () => {
    routed = { intent: "quote" };
    const answer = await answerQuestion(
      said("ต้องจ่ายนานแค่ไหน"),
      { intent: "quote", age: 30, sex: "F", coverWanted: 2_000_000, variant: "WLF99H" },
    );
    expect(answer.messages[0].text).toContain("จ่ายถึงอายุ 99");
    expect(answer.messages[0].text).toContain("9 ปี");
  });

  it("still prices a term the customer names outright", async () => {
    routed = { intent: "quote", age: 30, sex: "F", coverWanted: 2_000_000, variant: "WLF19H" };
    const answer = await answerQuestion(said("จ่าย 19 ปีเท่าไหร่"), null);
    expect(answer.priced).toBe(true);
    expect(answer.messages[0].card).toContain("variant=WLF19H");
  });
});

describe("leaving to think it over", () => {
  it("leaves the door open by name once a quotation is in hand, and asks nothing", async () => {
    chat.mockClear();
    const answer = await answerQuestion(said("เดี๋ยวคิดดูก่อนนะคะ"), { intent: "quote", age: 38, sex: "M", coverWanted: 2_000_000 });
    expect(answer.messages).toHaveLength(1);
    expect(answer.messages[0].text).toBe("ได้เลยครับ ถ้าตัดสินใจแล้วหรืออยากได้ใบเสนออย่างเป็นทางการ ทักมาได้เลยนะครับ");
    expect(chat).not.toHaveBeenCalled();
    expect(answer.slots.coverWanted).toBe(2_000_000);
  });

  it("just says come back when nothing has been priced", async () => {
    chat.mockClear();
    const answer = await answerQuestion(said("ไว้จะติดต่อกลับค่ะ"), null);
    expect(answer.messages[0].text).toBe("ได้เลยครับ สะดวกเมื่อไหร่ทักมาได้เลยนะครับ");
    expect(chat).not.toHaveBeenCalled();
  });
});

describe("what the model is told about the plan", () => {
  it("carries no example premium that could be handed to a customer as their own", async () => {
    routed = { intent: "plan_info" };
    await answerQuestion(said("คุ้มครองยังไง"), null);
    const system = chat.mock.calls.at(-1)![0].messages[0].content as string;
    expect(system).toContain("Life Protect x 2");
    expect(system).not.toContain("ตัวอย่าง");
    expect(system).not.toMatch(/\d,\d{3} ?บาท\/เดือน|เดือนละ \d/);
  });
});

describe("a couple written one to a line", () => {
  it("is priced even when the model could not read the turn", async () => {
    // the router's own fallback: no age, no sex, no people — the code reads them instead
    routed = { intent: "other" };
    const known = { intent: "quote" as const, coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("ญ40\nช49"), known);
    expect(answer.priced).toBe(true);
    // two quotes, then a table for each
    expect(answer.messages).toHaveLength(4);
    expect(answer.messages[0].card).toContain("age=40&sex=F");
    expect(answer.messages[1].card).toContain("age=49&sex=M");
  });
});

describe("the buttons under a cheaper arrangement", () => {
  const known = { intent: "quote" as const, age: 35, sex: "M" as const, coverWanted: 2_000_000 };

  it("offer the smaller arrangement and the table", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("แพงไป"), known);
    expect(answer.replies).toEqual(["เอาแบบนี้", "ขอตารางมูลค่า"]);
  });

  it("take the offer when tapped, rather than hearing the title as a new complaint", async () => {
    routed = { intent: "other" };
    const offered = await answerQuestion(said("แพงไป"), known);
    const taken = await answerQuestion(said(offered.replies![0]), offered.slots);
    expect(taken.priced).toBe(true);
    expect(taken.messages[0].card).toContain("sum=500000");
  });
});

describe("the buttons under a quotation", () => {
  beforeEach(() => { routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 }; });

  /** The table came with the quote (2026-10-06), so the button for it would ask for it twice. */
  it("offers the terms not taken and the way on", async () => {
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(answer.replies).toEqual(["จ่าย 9 ปี", "จ่ายถึงอายุ 99", "สนใจสมัคร"]);
  });

  /** A couple was sent two cards and a button for the tables (owner, 2026-10-06: send them along). */
  it("sends a couple both tables after both quotes, each saying whose it is, and offers no button for them", async () => {
    routed = { intent: "quote", coverWanted: 2_000_000 };
    const answer = await answerQuestion(said("ผญ 32 ผช33ค่ะ"), null);
    expect(answer.messages).toHaveLength(4);
    expect(answer.messages.map((m) => m.card?.split("?")[0])).toEqual(["/api/card", "/api/card", "/api/card/table", "/api/card/table"]);
    expect(answer.messages[2].card).toContain("age=32&sex=F");
    expect(answer.messages[3].card).toContain("age=33&sex=M");
    // the tables carry the little people; the quote cards, which have no chart, do not
    expect(answer.messages.map((m) => m.card?.includes("&fig=1&v="))).toEqual([false, false, true, true]);
    expect(answer.messages[2].text).toContain("ของหญิง อายุ 32");
    expect(answer.messages[3].text).toContain("ของชาย อายุ 33");
    expect(answer.replies).not.toContain("ขอตารางมูลค่า");
  });

  it("sends the table of the one a couple could be priced for", async () => {
    routed = { intent: "quote", coverWanted: 2_000_000 };
    const answer = await answerQuestion(said("ญ 37 กับ ช 95"), null);
    expect(answer.messages.filter((m) => m.card?.includes("/api/card/table"))).toHaveLength(1);
    expect(answer.messages.at(-1)!.card).toContain("age=37&sex=F");
  });

  it("never offers the term the customer is already looking at", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000, variant: "WLF19H" };
    const answer = await answerQuestion(said("จ่าย 19 ปีเท่าไหร่"), null);
    expect(answer.replies).not.toContain("จ่าย 19 ปี");
    expect(answer.replies).toContain("จ่ายถึงอายุ 99");
  });

  it("says only what the bot can read back: a tap arrives as its own title", async () => {
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    for (const title of answer.replies!) {
      expect(title.length, title).toBeLessThanOrEqual(20);
      const heard = asksValueTable(title) || lifeProtectVariantIn(title) !== undefined || wantsToBuy(title, true);
      expect(heard, title).toBe(true);
    }
  });

  it("offers none when there was no price to put them under", async () => {
    routed = { intent: "quote", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("ขอเบี้ยหน่อย"), null);
    expect(answer.replies).toBeUndefined();
  });
});

describe("the value table", () => {
  const known = { intent: "quote" as const, age: 35, sex: "M" as const, coverWanted: 2_000_000 };

  it("is sent as a picture of the same contract the quotation priced", async () => {
    const answer = await answerQuestion(said("ขอตารางมูลค่าหน่อยครับ"), known);
    // the router reads the turn, but no model writes the words or the figures
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["route"]);
    expect(answer.messages).toHaveLength(1);
    expect(answer.messages[0].card)
      .toMatch(/^\/api\/card\/table\?plan=LIFEPROTECT&variant=WLF19H&age=35&sex=M&sum=1000000&fig=1&v=[0-9a-z]+-[0-9]+$/);
    expect(answer.messages[0].text).toContain("ตารางมูลค่าทุกปี");
  });

  it("follows the term the customer is looking at", async () => {
    const answer = await answerQuestion(said("ขอตารางมูลค่า"), { ...known, variant: "WLF19H" });
    expect(answer.messages[0].card).toContain("variant=WLF19H");
  });

  it("keeps the halved offer's own sum once it has been taken", async () => {
    routed = { intent: "other" };
    const offered = (await answerQuestion(said("แพงไป"), known)).slots;
    const taken = (await answerQuestion(said("เอา"), offered)).slots;
    const answer = await answerQuestion(said("ขอตารางมูลค่า"), taken);
    expect(answer.messages[0].card).toContain("sum=500000");
  });

  it("asks for what it is missing rather than drawing a table of nothing", async () => {
    const answer = await answerQuestion(said("ขอตารางมูลค่า"), null);
    expect(answer.messages[0].card).toBeUndefined();
  });
});

describe("deciding to buy", () => {
  const FORM = "https://ktaxaform.vercel.app/?ref=sa-9f3a";
  const quoted = { intent: "quote" as const, age: 38, sex: "M" as const, coverWanted: 2_000_000 };

  it("hands over the application form, in the agency's own words, without a model", async () => {
    const answer = await answerQuestion(said("เอาแผนนี้ครับ"), quoted);
    expect(chat).not.toHaveBeenCalled();
    const [steps, ...rest] = answer.messages.map((m) => m.text);
    // the owner's buying steps (2026-09-26): the form, the ID card, the e-KYC SMS, payment
    expect(steps).toContain("1️⃣ กรอกฟอร์มออนไลน์ตามลิงก์ด้านล่าง");
    expect(steps).toContain("บัตรประชาชนตัวจริงที่ยังไม่หมดอายุ");
    expect(steps).toContain("e-KYC");
    expect(steps).toContain("QR Code");
    expect(rest).toEqual([
      FORM,
      "กรอกเสร็จแล้วแจ้งในแชทนี้ได้เลย เดี๋ยวแอดมินเช็กข้อมูลแล้วดูแลขั้นตอนต่อให้ครับ",
    ]);
    expect(answer.slots.formSent).toBe(true);
    expect(answer.slots.coverWanted).toBe(2_000_000);
  });

  it("answers which documents it takes with the same steps", async () => {
    const answer = await answerQuestion(said("ใช้เอกสารอะไรบ้างครับ"), quoted);
    expect(chat).not.toHaveBeenCalled();
    expect(answer.messages[0].text).toContain("บัตรประชาชน");
    expect(answer.messages[1].text).toBe(FORM);
  });

  it("does the same for someone asking what to do next", async () => {
    const answer = await answerQuestion(said("ต้องทำยังไงต่อ"), quoted);
    expect(chat).not.toHaveBeenCalled();
    expect(answer.messages[1].text).toBe(FORM);
  });

  it("reads ตกลง after a quotation as a decision", async () => {
    const answer = await answerQuestion(said("ตกลงค่ะ"), quoted);
    expect(chat).not.toHaveBeenCalled();
    expect(answer.messages[1].text).toBe(FORM);
  });

  it("still lets a pending cheaper offer be taken by ตกลง first", async () => {
    const offered = (await answerQuestion(said("แพงไป"), quoted)).slots;
    const taken = await answerQuestion(said("ตกลง"), offered);
    expect(taken.priced).toBe(true);
    expect(taken.slots.formSent).toBeUndefined();
  });

  it("offers the premium too when nothing has been priced yet", async () => {
    const answer = await answerQuestion(said("สมัครยังไงคะ"), null);
    expect(chat).not.toHaveBeenCalled();
    expect(answer.messages[1].text).toBe(FORM);
    expect(answer.messages[2].text).toBe("กรอกเสร็จแล้วแจ้งในแชทนี้ได้เลย เดี๋ยวแอดมินเช็กข้อมูลแล้วดูแลขั้นตอนต่อให้ครับ ถ้าอยากทราบเบี้ยก่อน บอกเพศกับอายุมาได้เลยครับ เดี๋ยวคิดให้");
  });

  it("acknowledges a filled-in form without promising anything", async () => {
    const answer = await answerQuestion(said("กรอกแล้วครับ"), { ...quoted, formSent: true });
    expect(chat).not.toHaveBeenCalled();
    expect(answer.messages).toHaveLength(1);
    expect(answer.messages[0].text).toBe("ขอบคุณครับ 🙏 เดี๋ยวแอดมินเช็กข้อมูลแล้วติดต่อกลับในแชทนี้ครับ");
    expect(answer.slots.formSent).toBe(true);
  });

  it("does not read กรอกแล้ว as the form when no form was sent", async () => {
    const answer = await answerQuestion(said("กรอกแล้วครับ"), quoted);
    expect(answer.messages[0].text).not.toContain("เช็กข้อมูล");
  });
});

describe("the price being too much", () => {
  const known = { intent: "quote" as const, age: 38, sex: "M" as const, coverWanted: 2_000_000 };
  const monthlyFor = (variant: string, sum: number) => {
    const table = lifeProtectTable();
    const m = lifeProtectModes(table, termAt(table, variant), { sex: "M", age: 38, sumAssured: sum })!;
    return formatBaht(m.find((x) => x.mode === "monthly")!.total);
  };

  it("shows the halved premium exactly as the quotation will, half-baht and all", async () => {
    routed = { intent: "other" };
    const offered = await answerQuestion(said("แพงไป"), known);
    routed = { intent: "other" };
    const taken = await answerQuestion(said("เอา"), offered.slots);
    // 9,550 a year is 859.50 a month; the quotation floors it and so must the offer
    const shown = offered.messages[0].text.match(/ลดทุนลงครึ่งหนึ่ง.*?ประมาณ ([\d,]+) บาท\/เดือน/)![1];
    expect(taken.messages[0].text).toContain(`รายเดือน ${shown} บาท`);
  });

  it("points the first quote, paying 19 years, at the to-99 premium for the same cover", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("แพงไป"), known);
    expect(answer.messages[0].text).toContain("ถ้าเปลี่ยนเป็นแบบจ่ายถึงอายุ 99");
    expect(answer.messages[0].text).toContain(`${monthlyFor("WLF99H", 1_000_000)} บาท/เดือน`);
  });

  it("names the to-99 term as the cheapest by the year, and offers half the cover with a real figure", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("แพงไปหน่อย มีถูกกว่านี้ไหม"), { ...known, variant: "WLF99H" });
    const text = answer.messages[0].text;
    expect(text).toContain("ถูกที่สุดแล้ว");
    expect(text).toContain("ทุน 500,000 บาท (ครอบครัวได้รับ 1,000,000)");
    expect(text).toContain(`${monthlyFor("WLF99H", 500_000)} บาท/เดือน`);
    expect(answer.slots.offer).toEqual({ coverWanted: 1_000_000, sumAssured: 500_000, variant: "WLF99H" });
    expect(answer.messages[0].card).toBeUndefined();
  });

  it("does not offer the shorter terms, which cost more a year", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("แพงไป"), known);
    expect(answer.messages[0].text).not.toContain("จ่าย 9 ปี");
    expect(answer.messages[0].text).not.toContain("จ่าย 19 ปี");
  });

  it("points someone on a short term at the to-99 premium for the same cover", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("แพงไปหน่อย"), { ...known, variant: "WLF09H" });
    expect(answer.messages[0].text).toContain("จ่ายถึงอายุ 99");
    expect(answer.messages[0].text).toContain(`${monthlyFor("WLF99H", 1_000_000)} บาท/เดือน`);
  });

  it("prices the halved arrangement on a bare yes", async () => {
    routed = { intent: "other" };
    const offered = (await answerQuestion(said("แพงไป"), known)).slots;
    const taken = await answerQuestion(said("เอา"), offered);
    expect(taken.priced).toBe(true);
    expect(taken.messages[0].card).toContain("sum=500000");
    expect(taken.messages[0].card).toContain("variant=WLF99H");
  });

  it("takes the offer once: a second yes is the decision to buy, not the same quotation again", async () => {
    routed = { intent: "other" };
    const offered = (await answerQuestion(said("แพงไป"), known)).slots;
    const first = await answerQuestion(said("โอเค"), offered);
    expect(first.priced).toBe(true);
    expect(first.slots.offer).toBeUndefined();
    const second = await answerQuestion(said("ตกลง"), first.slots);
    expect(second.priced).toBeFalsy();
    expect(second.messages[1].text).toBe("https://ktaxaform.vercel.app/?ref=sa-9f3a");
    expect(second.slots.takenSum).toBe(first.slots.takenSum);
  });

  it("still remembers the taken sum when a later follow-up names the same cover", async () => {
    routed = { intent: "other" };
    const offered = (await answerQuestion(said("แพงไป"), known)).slots;
    const taken = (await answerQuestion(said("เอา"), offered)).slots;
    routed = { intent: "quote", variant: "WLF19H" };
    const again = await answerQuestion(said("จ่าย 19 ปีล่ะ"), taken);
    expect(again.messages[0].card).toContain("sum=500000");
  });

  it("drops the offer when the customer steps back", async () => {
    routed = { intent: "other" };
    const offered = (await answerQuestion(said("แพงไป"), known)).slots;
    const left = await answerQuestion(said("เดี๋ยวคิดดูก่อน"), offered);
    expect(left.slots.offer).toBeUndefined();
  });

  it("keeps the offer's own sum when the customer names its cover, despite the one-million rule", async () => {
    routed = { intent: "other" };
    const offered = (await answerQuestion(said("แพงไป"), known)).slots;
    // "1 ล้าน" alone would be read as a sum assured of a million; after the offer it is the offer
    routed = { intent: "quote", coverWanted: 1_000_000 };
    const taken = await answerQuestion(said("เอาแบบ 1 ล้าน"), offered);
    expect(taken.messages[0].card).toContain("sum=500000");
  });

  it("says so when the cover is already at the floor", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("แพงไป"), { intent: "quote", age: 38, sex: "M", coverWanted: 300_000 });
    expect(answer.messages[0].text).toContain("ขั้นต่ำ");
    expect(answer.slots.offer).toBeUndefined();
  });

  it("asks for the details first when nothing has been priced", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("แพงไป"), null);
    expect(answer.messages[0].text).toContain("อายุ");
  });
});

describe("a couple in one message", () => {
  it("prices each of them, in the order they were named", async () => {
    routed = { intent: "quote", coverWanted: 2_000_000 };
    const answer = await answerQuestion(said("ผญ 32 ผช33ค่ะ"), null);
    // the two quotes, then their tables (pinned below)
    expect(answer.messages).toHaveLength(4);
    expect(answer.messages[0].text).toContain("หญิง อายุ 32");
    expect(answer.messages[1].text).toContain("ชาย อายุ 33");
    expect(answer.messages[0].card).toContain("age=32&sex=F");
    expect(answer.messages[1].card).toContain("age=33&sex=M");
    expect(answer.priced).toBe(true);
  });

  it("offers the other terms once, under the last price", async () => {
    routed = { intent: "quote", coverWanted: 2_000_000 };
    const answer = await answerQuestion(said("42 ญ กับช 56"), null);
    expect(answer.messages[0].text).not.toContain("ถ้าอยากดู");
    expect(answer.messages[1].text).toContain("ถ้าอยากดู");
  });

  it("prices the one it can when the other is out of range", async () => {
    routed = { intent: "quote", coverWanted: 2_000_000 };
    const answer = await answerQuestion(said("ญ 37 กับ ช 95"), null);
    expect(answer.messages[0].card).toBeDefined();
    expect(answer.messages[1].card).toBeUndefined();
    expect(answer.messages[1].text).toContain("95");
  });
});

describe("a question asked alongside a price", () => {
  it("is answered after the quote, not instead of it", async () => {
    routed = { intent: "quote", age: 37, sex: "F", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("ญ 37 ลดหย่อนภาษีได้ไหม"), null);
    // the quote, its chart and table, then the answer
    expect(answer.messages).toHaveLength(4);
    expect(answer.messages[0].card).toBeDefined();
    expect(answer.messages[1].card).toContain("/api/card/table?");
    expect(answer.messages[2].text).toContain("100,000");
    // and the invitation to name a budget stays the last word
    expect(answer.messages[3].text).toBe(BUDGET_INVITE);
  });
});

describe("everything else", () => {
  it("answers a question about the plan in the model's words", async () => {
    routed = { intent: "plan_info" };
    worded = "คุ้มครองถึงอายุ 99 ปีครับ";
    const answer = await answerQuestion(said("คุ้มครองถึงกี่ขวบ"), null);
    expect(answer.messages[0].text).toBe("คุ้มครองถึงอายุ 99 ปีครับ");
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["route", "plan_info"]);
  });

  it("tells the model what the customer already gave, so it stops asking", async () => {
    routed = { intent: "plan_info" };
    chat.mockClear();
    await answerQuestion(
      said("เบี้ยประกันคงที่ไหมคะ"),
      { intent: "quote", age: 30, sex: "F", coverWanted: 2_000_000, variant: "WLF09H" },
    );
    const system = chat.mock.calls[1][0].messages[0].content as string;
    expect(system).toContain("หญิง · อายุ 30 ปี · ครอบครัวได้รับ 2,000,000 บาท · จ่าย 9 ปี");
    expect(system).toContain("ห้ามขอข้อมูลที่ทราบแล้วซ้ำอีก");
  });

  it("says what this customer's family receives either side of sixty, so a check is answered right", async () => {
    routed = { intent: "quote", coverWanted: 1_500_000 };
    chat.mockClear();
    const answer = await answerQuestion(
      said("หลังอายุ 60 แล้ว ทุนเหลือ 1,500,000 ใช่ไหม"),
      { intent: "quote", age: 56, sex: "F", coverWanted: 3_000_000, variant: "WLF19H" },
    );
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["route", "plan_info"]);
    expect(answer.slots.coverWanted).toBe(3_000_000);
    const system = chat.mock.calls[1][0].messages[0].content as string;
    expect(system).toContain("เสียชีวิตก่อนอายุ 60 ครอบครัวได้รับ 3,000,000 บาท");
    expect(system).toContain("ตั้งแต่อายุ 60 ปีขึ้นไปได้รับ 1,500,000 บาท");
  });

  it("puts the engine's own premium in front of the model, so it cannot invent one", async () => {
    routed = { intent: "plan_info" };
    chat.mockClear();
    await answerQuestion(
      said("เบี้ยประกันคงที่ไหมคะ"),
      { intent: "quote", age: 30, sex: "F", coverWanted: 2_000_000, variant: "WLF09H" },
    );
    const system = chat.mock.calls[1][0].messages[0].content as string;
    // the figures the quotation actually carried, not a rounding of them
    expect(system).toContain("รายเดือน 3,861 บาท");
    expect(system).toContain("รายปี 42,900 บาท");
    expect(system).toContain("ห้ามคำนวณเอง");
    // and what staying to the end pays, which the model had been guessing
    expect(system).toContain("อยู่ครบสัญญาถึงอายุ 99 รับเงินคืน 1,000,000 บาท");
  });

  it("splits a model's paragraphs into bubbles without ever sending an empty one", async () => {
    routed = { intent: "plan_info" };
    worded = "บรรทัดหนึ่งครับ\n\nบรรทัดสองครับ";
    const two = await answerQuestion(said("คุ้มครองยังไง"), null);
    expect(two.messages.map((m) => m.text)).toEqual(["บรรทัดหนึ่งครับ", "บรรทัดสองครับ"]);

    worded = "หนึ่ง\n\nสอง\n\nสาม\n\nสี่\n\nห้า";
    const many = await answerQuestion(said("คุ้มครองยังไง"), null);
    expect(many.messages).toHaveLength(3);
    expect(many.messages[2].text).toBe("สาม\n\nสี่\n\nห้า");
    expect(many.messages.every((m) => m.text.trim().length > 0)).toBe(true);
  });

  it("forbids figures outright until something has been priced", async () => {
    routed = { intent: "plan_info" };
    chat.mockClear();
    await answerQuestion(said("คุ้มครองยังไง"), { intent: "quote", coverWanted: 2_000_000 });
    const system = chat.mock.calls[1][0].messages[0].content as string;
    expect(system).toContain("ห้ามตอบตัวเลขเบี้ยเอง");
    /**
     * No premium in the prompt for a model to read out. Written as the shape of one rather
     * than as the word "รายเดือน": the library travels with this prompt now, and it names the
     * floor on a monthly instalment — a limit on paying, not a price, and worded so.
     */
    expect(system).not.toMatch(/เบี้ย[^\n]{0,40}\d{1,3},\d{3}/);
  });

  it("asks only for the gaps when the customer is half known", async () => {
    routed = { intent: "plan_info" };
    chat.mockClear();
    await answerQuestion(said("คุ้มครองยังไง"), { intent: "quote", coverWanted: 2_000_000 });
    const system = chat.mock.calls[1][0].messages[0].content as string;
    expect(system).toContain("ครอบครัวได้รับ 2,000,000 บาท");
    expect(system).toContain("ให้ขอเฉพาะข้อมูลที่ยังขาด");
  });

  it("says nothing about a customer it knows nothing about", async () => {
    routed = { intent: "plan_info" };
    chat.mockClear();
    await answerQuestion(said("คุ้มครองยังไง"), null);
    const system = chat.mock.calls[1][0].messages[0].content as string;
    expect(system).not.toContain("ข้อมูลของลูกค้ารายนี้ที่ทราบแล้ว");
  });

  it("hands the plan's own figures to the model rather than letting it recall them", async () => {
    routed = { intent: "plan_info" };
    await answerQuestion(said("คุ้มครองถึงกี่ขวบ"), null);
    const system = chat.mock.calls[1][0].messages[0].content as string;
    expect(system).toContain("Life Protect x 2");
    expect(system).toContain("ห้ามคิดตัวเลขเอง");
  });

  it("greets without pricing anything", async () => {
    routed = { intent: "other" };
    worded = "สวัสดีครับ";
    const answer = await answerQuestion(said("สวัสดี"), null);
    expect(answer.messages[0].text).toBe("สวัสดีครับ");
    expect(answer.messages[0].card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
  });

  it("tells small talk what the customer already gave, so a goodbye is not an intake form", async () => {
    routed = { intent: "other" };
    chat.mockClear();
    // a stall never reaches the model, and a thank-you only reaches the one that words the reply
    await answerQuestion(said("ขอบคุณค่ะ"), { intent: "quote", age: 38, sex: "M", coverWanted: 2_000_000 });
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["small_talk"]);
    const system = chat.mock.calls[0][0].messages[0].content as string;
    expect(system).toContain("ชาย · อายุ 38 ปี · ครอบครัวได้รับ 2,000,000 บาท");
    expect(system).toContain("ห้ามขอข้อมูลที่ทราบแล้วซ้ำอีก");
  });

  /**
   * "ขอบคุณค่ะ สำหรับข้อมูล", from a customer the bot had just quoted, was answered with the
   * quotation again (Messenger, 2026-10-07). The router reads the whole thread, so it hands
   * back the age, the sex and the sum from the turns before — and a turn that "supplies" all
   * three, after a quote, is a request for a quote.
   */
  it("does not quote again to a customer who only says thank you", async () => {
    routed = { intent: "other", age: 72, sex: "M", coverWanted: 1_000_000 };
    worded = "ยินดีครับ 😊";
    const before = { intent: "quote" as const, age: 72, sex: "M" as const, coverWanted: 1_000_000 };
    for (const t of ["ขอบคุณค่ะ สำหรับข้อมูล", "ขอบคุณครับ", "ขอบคุณมากๆค่ะ 🙏", "ขอบคุณนะคะ"]) {
      chat.mockClear();
      const answer = await answerQuestion(said(t), before);
      expect(answer.priced, t).toBeFalsy();
      expect(answer.messages, t).toHaveLength(1);
      expect(answer.messages[0].card, t).toBeUndefined();
      expect(answer.messages[0].text, t).toBe("ยินดีครับ 😊");
      expect(answer.slots.coverWanted, t).toBe(1_000_000);
    }
  });

  /**
   * "สอบถามเงื่อนไขเพิ่มเติมครับ ต้องตรวจสุขภาพหรือไม่ มีระยะเวลารอคอยหรือไม่", from a customer
   * quoted a minute before, was answered with the quotation again (Messenger, 2026-10-07).
   * "สอบถาม" is on the list of words that ask for a price, and the router hands back the sum
   * from the turn before, so a question about conditions read as a request to price.
   */
  it("answers a question about conditions without quoting again", async () => {
    routed = { intent: "other", age: 51, sex: "M", coverWanted: 1_000_000 };
    const before = { intent: "quote" as const, age: 51, sex: "M" as const, coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("สอบถามเงื่อนไขเพิ่มเติมครับ ต้องตรวจสุขภาพหรือไม่ มีระยะเวลารอคอยหรือไม่"), before);
    expect(answer.priced).toBeFalsy();
    expect(answer.messages.some((m) => m.card)).toBe(false);
    const text = answer.messages.map((m) => m.text).join("\n");
    // the page's own answer to the health check, and the owner's to the waiting period:
    // the cover starts when the policy is approved
    expect(text).toContain("ขึ้นกับอายุ ทุน และประวัติสุขภาพ");
    expect(text).toContain("คุ้มครองทันทีหลังกรมธรรม์อนุมัติ");
    // and no number of days, which this plan does not have
    expect(text).not.toMatch(/\d+\s*วัน/);
  });

  it("still gives the declaration, not the check-up answer, to someone with a condition", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("เป็นเบาหวาน ต้องตรวจสุขภาพไหม"), { intent: "quote", age: 51, sex: "M", coverWanted: 1_000_000 });
    const text = answer.messages.map((m) => m.text).join("\n");
    expect(text).toContain("แถลงข้อมูลสุขภาพ");
    expect(text).not.toContain("ขึ้นกับอายุ ทุน");
  });

  it("still answers a thank-you that carries a question or a figure", async () => {
    routed = { intent: "quote", age: 50, sex: "M", coverWanted: 2_000_000 };
    const answer = await answerQuestion(said("ขอบคุณค่ะ แล้วทุน 2 ล้านล่ะ"), { intent: "quote", age: 50, sex: "M", coverWanted: 1_000_000 });
    expect(answer.priced).toBe(true);
  });

  it("falls back to asking for the details when the model says nothing", async () => {
    routed = { intent: "other" };
    worded = "   ";
    const answer = await answerQuestion(said("..."), null);
    expect(answer.messages[0].text).toContain("อายุ");
  });
});
