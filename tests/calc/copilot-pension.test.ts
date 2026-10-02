import { describe, it, expect } from "vitest";
import { asksPensionPrice, pensionNamedIn, pricePension } from "@/lib/copilot/pension-price";
import { answerAny } from "@/lib/assistant/dispatch";
import { quotePension } from "@/calc/pension/engine";

/** The premium the /bumnan95 page shows for the same person, so the chat cannot drift from it. */
function onThePage(age: number, sex: "M" | "F", annuityAge: number, pay: "6" | "untilAnnuity", monthly: number) {
  const r = quotePension({ age, sex, annuityAge, pay, mode: "annual", basis: "monthlyPension", amount: monthly });
  if (!r.ok) throw new Error(r.error);
  return Math.floor(r.quote.annualPremium).toLocaleString("en-US");
}

describe("บำนาญ สมาร์ท 95 in the chat", () => {
  it("prices a monthly income, the way the plan is sold", () => {
    const reply = pricePension("บำนาญ ชาย 40 อยากได้เดือนละ 10,000 รับบำนาญ 60 จ่ายจนรับบำนาญ");
    expect(reply.priced).toBe(true);
    expect(reply.text).toContain(`💰 เบี้ยปีละ **${onThePage(40, "M", 60, "untilAnnuity", 10_000)} บาท**`);
    expect(reply.text).toContain("ทุน 787,402 บาท");
    expect(reply.text).toContain("เดือนละ **10,000 บาท**");
  });

  it("does not read the 95 in the name as the customer's age", () => {
    const reply = pricePension("บำนาญ สมาร์ท 95 ชาย 40 เดือนละ 1 หมื่น เริ่มรับ 60 จ่าย 6 ปี");
    expect(reply.priced).toBe(true);
    expect(reply.text).toContain("ชาย อายุ 40 ปี");
    expect(reply.text).toContain(`💰 เบี้ยปีละ **${onThePage(40, "M", 60, "6", 10_000)} บาท**`);
  });

  it("reads a premium written with จ่าย as a premium, not a pension", () => {
    const reply = pricePension("บำนาญ หญิง 35 จ่ายปีละ 100,000 รับบำนาญ 60 จ่ายจนรับบำนาญ");
    expect(reply.priced).toBe(true);
    const r = quotePension({ age: 35, sex: "F", annuityAge: 60, pay: "untilAnnuity", mode: "annual", basis: "premium", amount: 100_000 });
    if (!r.ok) throw new Error(r.error);
    expect(reply.text).toContain(`ทุน ${r.quote.sumAssured.toLocaleString("en-US")} บาท`);
  });

  it("asks for the paying term rather than guessing it, and offers both as buttons", () => {
    const reply = pricePension("บำนาญ ชาย 40 เดือนละ 10,000 รับบำนาญ 60");
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("6 ปี");
    const asks = reply.guide!.map((g) => g.ask);
    // each button carries everything already said, so pressing it prices
    for (const a of asks) expect(pricePension(a).priced, a).toBe(true);
  });

  it("offers only the pension ages this person can still choose", () => {
    const reply = pricePension("บำนาญ ชาย 52 เดือนละ 10,000 จ่ายจนรับบำนาญ");
    expect(reply.priced).toBe(false);
    expect(reply.guide!.map((g) => g.label)).toEqual(["รับบำนาญอายุ 60", "รับบำนาญอายุ 65", "รับบำนาญอายุ 70"]);
  });

  it("does not take 'ตอนนี้อายุ 55' for the age the pension starts", () => {
    const reply = pricePension("บำนาญ ผู้ชาย ตอนนี้อายุ 55 เดือนละ 10,000 จ่ายจนรับบำนาญ");
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("เริ่มรับบำนาญอายุเท่าไหร่");
  });

  it("passes on the engine's refusal", () => {
    const reply = pricePension("บำนาญ ชาย 50 เดือนละ 10,000 รับบำนาญ 55 จ่ายจนรับบำนาญ");
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("เลือกรับบำนาญอายุ 55 ไม่ได้");
  });

  it("leaves a question about the rules to the library", () => {
    expect(pensionNamedIn("บำนาญ 95 ลดหย่อนภาษีได้ไหม")).toBe(true);
    expect(asksPensionPrice("บำนาญ 95 ลดหย่อนภาษีได้ไหม")).toBe(false);
  });

  it("is answered by the dispatcher even inside a Life Protect conversation", async () => {
    const answer = await answerAny(
      [{ role: "user", content: "บำนาญ ชาย 40 เดือนละ 10,000 รับบำนาญ 60 จ่ายจนรับบำนาญ" }],
      { product: "lifeprotect" } as never,
    );
    expect(answer.priced).toBe(true);
    expect(answer.messages[0].text).toContain("บำนาญ สมาร์ท 95");
    // the conversation it interrupted is still there, beside the note that this quote has no PDF
    const { pdf, ...rest } = answer.slots as typeof answer.slots & { pdf?: unknown };
    expect(rest).toEqual({ product: "lifeprotect" });
    expect(pdf).toEqual({ asked: [], latestHasNoPdf: true });
  });
});

describe("บำนาญ สมาร์ท 95 in the library", () => {
  it("sends its rules when the question names it, and only then", async () => {
    const { assembleKnowledge } = await import("@/lib/copilot/knowledge");
    expect(await assembleKnowledge("บำนาญ 95 รับประกันจ่ายกี่ปี")).toContain("รับประกันจ่ายบำนาญ 15 ปีแรก");
    const other = await assembleKnowledge("PLB รับประกันถึงอายุเท่าไหร่");
    expect(other).not.toContain("รับประกันจ่ายบำนาญ 15 ปีแรก");
    // but the spine still says it can be priced here
    expect(other).toContain("บำนาญ สมาร์ท 95");
  });
});

describe("riders in the chat", () => {
  const main = "บำนาญ ชาย 40 เดือนละ 10,000 รับบำนาญ 60 จ่ายจนรับบำนาญ";
  const page = (riders: Parameters<typeof quotePension>[0]["riders"]) => {
    const r = quotePension({ age: 40, sex: "M", annuityAge: 60, pay: "untilAnnuity", mode: "annual", basis: "monthlyPension", amount: 10_000, riders });
    if (!r.ok) throw new Error(r.error);
    return r.quote;
  };

  it("prices WP Beyond and DCI and leads with what the customer pays", () => {
    const reply = pricePension(`${main} WP Beyond DCI 1 ล้าน`);
    const q = page({ wp: { option: "BEYOND" }, dci: { sumAssured: 1_000_000 } });
    expect(reply.priced).toBe(true);
    expect(reply.text).toContain(`💰 เบี้ยรวมปีละ **${Math.floor(q.totalAnnualPremium).toLocaleString("en-US")} บาท**`);
    expect(reply.text).toContain(`- WP Beyond (ยกเว้นเบี้ย) ${Math.floor(q.riders[0].annual).toLocaleString("en-US")} บาท`);
    expect(reply.text).toContain("DCI (โรคร้ายแรง) 5,520 บาท (เบี้ยปีแรก ปรับขึ้นตามอายุ)");
    // the DCI's million is not read as the contract's sum assured
    expect(reply.text).toContain("ทุน 787,402 บาท");
  });

  it("reads the payer of PB from ภรรยา, and does not take her for the insured", () => {
    const reply = pricePension(`${main} PB fit ภรรยา 38`);
    const q = page({ pb: { option: "FIT", payerAge: 38, payerSex: "F" } });
    expect(reply.priced).toBe(true);
    expect(reply.text).toContain("ชาย อายุ 40 ปี");
    expect(reply.text).toContain(`- PB Fit (ผู้ชำระเบี้ย) ${Math.floor(q.riders[0].annual).toLocaleString("en-US")} บาท`);
  });

  it("asks Fit or Beyond rather than choosing, and each button prices", () => {
    const reply = pricePension(`${main} WP`);
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("Fit");
    const buttons = reply.guide!.filter((g) => g.label.startsWith("WP"));
    expect(buttons.map((b) => b.label)).toEqual(["WP Fit", "WP Beyond"]);
    for (const b of buttons) expect(pricePension(b.ask).priced, b.ask).toBe(true);
  });

  it("asks for the payer when PB is named without one, and keeps the plan", () => {
    const reply = pricePension(`${main} PB Beyond`);
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("ผู้ชำระเบี้ย");
    expect(pricePension(`${main} PB Beyond ผู้ชำระ หญิง 38`).priced).toBe(true);
  });

  it("asks for the DCI sum, with buttons that price", () => {
    const reply = pricePension(`${main} DCI`);
    expect(reply.priced).toBe(false);
    for (const b of reply.guide!) expect(pricePension(b.ask).priced, b.ask).toBe(true);
  });

  it("says what cannot be bought instead of dropping it", () => {
    const reply = pricePension(`${main} WP Fit PB Fit ภรรยา 38`);
    expect(reply.priced).toBe(true);
    expect(reply.text).toContain("ซื้อไม่ได้ — เลือก WP หรือ PB อย่างใดอย่างหนึ่ง");
  });

  it("keeps the riders on the follow-up buttons", () => {
    const reply = pricePension(`${main} WP Beyond DCI 1 ล้าน`);
    for (const g of reply.guide!) {
      expect(g.ask, g.label).toContain("WP Beyond");
      expect(g.ask, g.label).toContain("DCI 1,000,000");
    }
  });

  it("treats a question about what WP is as a question, not a quotation", () => {
    expect(asksPensionPrice("บำนาญ 95 ยกเว้นเบี้ยคืออะไร")).toBe(false);
  });
});
