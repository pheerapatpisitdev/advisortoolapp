import { describe, expect, it } from "vitest";
import { quote } from "@/calc/quote";
import { planNamedIn, priceNamedPlan } from "@/lib/copilot/price";
import { valueTableCard } from "@/lib/quote-card";
import { quotePdfPath } from "@/lib/quote-pdf/link";

/**
 * The figures this page gives against the figures the engine gives.
 *
 * Not a fixture in sight: every expected number is computed here by the same `quote()` the
 * calculator page calls, so the chat and the calculator cannot drift apart without this
 * failing. A premium that is merely plausible is the failure mode that matters.
 */

const baht = (satang: number) => Math.round(satang / 100).toLocaleString("en-US");

describe("recognising which plan was named", () => {
  for (const [text, code] of [
    ["PLB ทุน 1 ล้าน", "PLB"],
    ["Protection Life ชาย 35", "PLB"],
    ["iSmart 80/6 เบี้ยเท่าไหร่", "ISMART"],
    ["ไอสมาร์ท ทุน 1 ล้าน", "ISMART"],
    ["Life Treasure ชาย 40", "LIFETREASURE"],
    ["iShield ทุน 1 ล้าน", "ISHIELD"],
  ] as const) {
    it(`reads "${text}" as ${code}`, () => {
      expect(planNamedIn(text)?.code).toBe(code);
    });
  }

  it("leaves Life Protect alone, which has a brain of its own", () => {
    expect(planNamedIn("Life Protect ชาย 35 ทุน 1 ล้าน")).toBeUndefined();
  });
});

describe("iSmart, which has one package and needs no choosing", () => {
  it("quotes the same figure the engine does", () => {
    const reply = priceNamedPlan("iSmart ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISMART", "iSmart 80/6");
    expect(reply.priced).toBe(true);
    const expected = quote({
      planCode: "ISMART", variant: "W80F06", age: 35, sex: "M",
      mode: "annual", sumAssured: 1_000_000, riders: [],
    });
    expect(reply.text).toContain(baht(expected.totalAnnual));
  });

  it("draws both pictures, the quote and the year-by-year table", () => {
    const reply = priceNamedPlan("iSmart ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISMART", "iSmart 80/6");
    expect(reply.cards).toHaveLength(2);
    expect(reply.cards?.[0]).toContain("/api/card?");
    expect(reply.cards?.[0]).toContain("plan=ISMART");
    expect(reply.cards?.[1]).toContain("/api/card/table?");
    // the table carries the little people on its chart; the quote card has no chart to put them on
    expect(reply.cards?.[1]).toContain("&fig=1&v=");
    expect(reply.cards?.[0]).not.toContain("fig=");
  });

  it("has no PDF, because no sales page prints iSmart", () => {
    const reply = priceNamedPlan("iSmart ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISMART", "iSmart 80/6");
    expect(reply.pdfPath).toBeUndefined();
  });
});

describe("a plan sold on several paying terms", () => {
  it("asks which one rather than picking, because the term is most of the premium", () => {
    const reply = priceNamedPlan("Life Treasure ชาย 40 ทุน 10 ล้าน เบี้ยเท่าไหร่", "LIFETREASURE", "Life Treasure");
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("ระยะเวลาชำระเบี้ย");
    expect(reply.text).not.toMatch(/\d[\d,]{4,}\s*บาท\*\*/);
  });

  it("quotes once the term is named, and matches the engine on that term", () => {
    const reply = priceNamedPlan(
      "Life Treasure ชาย 40 ทุน 10 ล้าน จ่าย 12 ปี เบี้ยเท่าไหร่", "LIFETREASURE", "Life Treasure");
    expect(reply.priced).toBe(true);
    const expected = quote({
      planCode: "LIFETREASURE", variant: "H99F12A", age: 40, sex: "M",
      mode: "annual", sumAssured: 10_000_000, riders: [],
    });
    expect(reply.text).toContain(baht(expected.totalAnnual));
    expect(reply.cards?.[0]).toContain("variant=H99F12A");
    expect(reply.pdfPath).toBe(quotePdfPath({
      kind: "plan", planCode: "LIFETREASURE", variant: "H99F12A", age: 40, sex: "M", sumAssured: 10_000_000,
    }));
    expect(reply.pdfPath).toContain("page=lifetreasure");
  });

  it("names every term on offer when it asks", () => {
    const reply = priceNamedPlan("PLB ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", "PLB", "Protection Life (PLB)");
    expect(reply.priced).toBe(false);
    for (const years of ["5", "10", "12", "15"]) expect(reply.text).toContain(`${years} ปี`);
  });

  it("quotes PLB on the term it was given", () => {
    const reply = priceNamedPlan("PLB ชาย 35 ทุน 1 ล้าน จ่าย 10 ปี", "PLB", "Protection Life (PLB)");
    expect(reply.priced).toBe(true);
    const expected = quote({
      planCode: "PLB", variant: "PLB10", age: 35, sex: "M",
      mode: "annual", sumAssured: 1_000_000, riders: [],
    });
    expect(reply.text).toContain(baht(expected.totalAnnual));
  });
});

describe("iShield, which is filled in the other way round", () => {
  it("says so rather than reading the sum as a sum", () => {
    const reply = priceNamedPlan("iShield ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISHIELD", "iShield");
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("กรอกเบี้ยที่อยากจ่าย");
    expect(reply.text).toContain("/other-plans");
    expect(reply.cards).toBeUndefined();
  });
});

describe("what is missing is named", () => {
  it("asks for the person when only a plan and a sum were given", () => {
    const reply = priceNamedPlan("iSmart ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISMART", "iSmart 80/6");
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("อายุกับเพศ");
  });

  it("asks for the sum when only a person was given", () => {
    const reply = priceNamedPlan("iSmart ชาย 35 เบี้ยเท่าไหร่", "ISMART", "iSmart 80/6");
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("ทุนประกัน");
  });
});

describe("an arrangement the plan will not write", () => {
  it("passes the engine's own refusal on rather than a number", () => {
    // iSmart is sold from 25 to 65; a child is outside it
    const reply = priceNamedPlan("iSmart ชาย 5 ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISMART", "iSmart 80/6");
    expect(reply.priced).toBe(false);
    expect(reply.text).not.toMatch(/💰/);
  });
});

/**
 * What a sweep across every plan, every package and every age turned up.
 *
 * Each of these was a real answer this page gave before it was fixed, and each of them
 * looked completely ordinary on the way out — which is why they are pinned here by name.
 */
describe("bugs the sweep found", () => {
  it("offers the table only where the engine can actually draw one", () => {
    /**
     * /api/card/table answers 400 for an arrangement it cannot draw, and the customer is sent
     * a broken picture — so the link is offered on the drawing function's own say-so rather
     * than on a list of plans kept here. Every plan has a table today; the guard is what stops
     * the next one added from shipping the bug again.
     */
    for (const [text, code, label] of [
      ["Life Treasure ชาย 40 ทุน 10 ล้าน จ่าย 6 ปี เบี้ยเท่าไหร่", "LIFETREASURE", "Life Treasure"],
      ["iSmart ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISMART", "iSmart 80/6"],
      ["PLB ชาย 35 ทุน 1 ล้าน จ่าย 10 ปี เบี้ยเท่าไหร่", "PLB", "Protection Life (PLB)"],
    ] as const) {
      const reply = priceNamedPlan(text, code, label);
      expect(reply.priced, label).toBe(true);
      const drawn = valueTableCard({
        kind: "plan",
        planCode: code,
        variant: new URL(`https://x${reply.cards![0]}`).searchParams.get("variant")!,
        age: 35,
        sex: "M",
        sumAssured: code === "LIFETREASURE" ? 10_000_000 : 1_000_000,
      });
      expect(reply.cards, label).toHaveLength(drawn ? 2 : 1);
      if (drawn) {
        expect(reply.cards?.[1], label).toContain("/api/card/table");
        expect(reply.cards?.[1], label).toContain("&fig=1&v=");
      }
    }
  });

  it("never quotes an instalment below the company's floor", () => {
    // a million of PLB comes to 462 a month, which no branch will accept, and every
    // calculator on the site drops it
    const reply = priceNamedPlan("PLB ชาย 35 ทุน 1 ล้าน จ่าย 10 ปี เบี้ยเท่าไหร่", "PLB", "Protection Life (PLB)");
    expect(reply.text).toContain("ราย 6 เดือน");
    expect(reply.text).not.toContain("รายเดือน");
    expect(reply.text).not.toContain("ต่ำกว่าขั้นต่ำ");
  });

  it("gives an example sum the plan will actually accept", () => {
    // "ทุน 1 ล้าน" was the example for every plan, and Life Treasure starts at ten million
    const reply = priceNamedPlan("Life Treasure เบี้ยเท่าไหร่", "LIFETREASURE", "Life Treasure");
    expect(reply.text).toContain("ทุน 10 ล้าน");
    const askedFor = priceNamedPlan("Life Treasure ชาย 40 ทุน 10 ล้าน จ่าย 6 ปี", "LIFETREASURE", "Life Treasure");
    expect(askedFor.priced).toBe(true);
  });

  it("reads the paying term even when it is written bare", () => {
    // "PLB หญิง 30 ทุน 5 แสน 15 ปี" says everything; asking again for the term is rude
    const bare = priceNamedPlan("PLB หญิง 30 ทุน 500,000 15 ปี เบี้ย", "PLB", "Protection Life (PLB)");
    const said = priceNamedPlan("PLB หญิง 30 ทุน 500,000 ผ่อน 15 ปี เบี้ย", "PLB", "Protection Life (PLB)");
    expect(bare.priced).toBe(true);
    expect(bare.text).toBe(said.text);
  });

  it("does not mistake an age for a paying term", () => {
    // Life Treasure sells an eighteen-year package, and this is an eighteen-year-old
    const young = priceNamedPlan("Life Treasure ชาย 18 ปี ทุน 10 ล้าน เบี้ยเท่าไหร่", "LIFETREASURE", "Life Treasure");
    expect(young.priced).toBe(false);
    expect(young.text).toContain("ระยะเวลาชำระเบี้ย");

    // and someone who is both says so, and is understood
    const both = priceNamedPlan("Life Treasure ชาย 18 ปี ทุน 10 ล้าน จ่าย 18 ปี", "LIFETREASURE", "Life Treasure");
    expect(both.priced).toBe(true);
    expect(both.text).toContain("ชำระเบี้ย 18 ปี");
    expect(both.text).toContain("อายุ 18 ปี");
  });

  it("knows the Thai spellings people type", () => {
    for (const [text, code] of [
      ["พีแอลบี เบี้ยเท่าไหร่", "PLB"],
      ["ไลฟ์ ทรีเชอร์ เบี้ย", "LIFETREASURE"],
      ["ไลฟ์เทรเชอร์ เบี้ย", "LIFETREASURE"],
      ["ไอ สมาร์ท เบี้ย", "ISMART"],
      ["ไอ ชิลด์ เบี้ย", "ISHIELD"],
    ] as const) {
      expect(planNamedIn(text)?.code, text).toBe(code);
    }
  });
});
