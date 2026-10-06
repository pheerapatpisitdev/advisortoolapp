import { describe, expect, it } from "vitest";
import type { ModePremium } from "@/calc/mode-premiums";
import { lifeProtectCashText, lifeProtectChatQuoteText, lifeProtectMessage, lifeProtectQuoteText } from "@/lib/lifeprotect-cta";

const MONTHLY: ModePremium = { mode: "monthly", total: 258_300, belowMinimum: false };
const ANNUAL: ModePremium = { mode: "annual", total: 600_000, belowMinimum: false };
const base = { sumAssured: 1_000_000, termLabel: "จ่าย 19 ปี", sex: "M" as const, ageMax: 80 };

describe("lifeProtectMessage", () => {
  it("carries the sum, the term, the insured and the headline premium", () => {
    expect(lifeProtectMessage({ ...base, age: 35, premium: MONTHLY }))
      .toBe("สนใจ Life Protect x 2 ทุน 1,000,000 จ่าย 19 ปี อายุ 35 ชาย เบี้ยประมาณ 2,583 บาท/เดือน");
  });

  it("names the yearly premium when that is what is on the card", () => {
    expect(lifeProtectMessage({ ...base, termLabel: "จ่ายถึงอายุ 99", age: 0, premium: ANNUAL }))
      .toBe("สนใจ Life Protect x 2 ทุน 1,000,000 จ่ายถึงอายุ 99 อายุแรกเกิด ชาย เบี้ยประมาณ 6,000 บาท/ปี");
  });

  it("names the rider on the card, so the agent is not asked what the figure covers", () => {
    expect(lifeProtectMessage({ ...base, age: 35, premium: MONTHLY, rider: "สัญญาเพิ่มเติมพีบี ฟิต" }))
      .toBe("สนใจ Life Protect x 2 ทุน 1,000,000 จ่าย 19 ปี อายุ 35 ชาย + สัญญาเพิ่มเติมพีบี ฟิต"
        + " เบี้ยประมาณ 2,583 บาท/เดือน");
  });

  it("asks for something else for an age past the plan's last", () => {
    expect(lifeProtectMessage({ ...base, sex: "F", age: "over", premium: undefined }))
      .toBe("สนใจ Life Protect x 2 ทุน 1,000,000 อายุเกิน 80 ปี ขอแบบที่เหมาะกับอายุนี้");
  });

  it("asks for the current price when no premium may be shown", () => {
    expect(lifeProtectMessage({ ...base, sex: "F", age: 42, premium: undefined }))
      .toBe("สนใจ Life Protect x 2 ทุน 1,000,000 จ่าย 19 ปี อายุ 42 หญิง ขอราคาปัจจุบัน");
  });
});

describe("lifeProtectCashText", () => {
  it("is a message of its own, one row a line", () => {
    expect(lifeProtectCashText([{ age: 60, amount: 2_000 }, { age: 99, amount: 1_547_000 }])).toBe([
      "🏦 หากขายคืนบริษัทจะได้",
      "",
      "- อายุ 60 ปี 2,000 บาท",
      "- อายุ 99 ปี 1,547,000 บาท",
    ].join("\n"));
  });

  it("says nothing when the table has no rows", () => {
    expect(lifeProtectCashText([])).toBeUndefined();
  });
});

describe("lifeProtectQuoteText", () => {
  // ชาย 35 · 1 ล้าน · จ่ายถึงอายุ 99: the figures the page shows for its opening case
  const modes: ModePremium[] = [
    { mode: "monthly", total: 154_800, belowMinimum: false },
    { mode: "annual", total: 1_720_000, belowMinimum: false },
    { mode: "semi", total: 894_400, belowMinimum: false },
  ];
  const death = { beforeAge: 60, sumBefore: 2_000_000, sumFrom: 1_000_000, alreadyPastAge: false };

  it("writes the card's figures in its order, without the cash values", () => {
    const text = lifeProtectQuoteText({
      sumAssured: 1_000_000, termLabel: "จ่ายถึงอายุ 99", age: 35, sex: "M", modes, death,
      cash: [{ age: 60, amount: 123_456 }, { age: 99, amount: 1_000_000 }],
    });
    expect(text).toBe([
      "🛡️ Life Protect x 2",
      "ทุน 1,000,000 บาท เพิ่มเป็น 2,000,000 ถึงอายุ 60",
      "ชาย อายุ 35 · จ่ายถึงอายุ 99",
      "",
      "💰 เบี้ยประมาณ 1,548 บาท/เดือน (ตกวันละ 48 บาท)",
      "รายเดือน 1,548 บาท",
      "(ชำระเบี้ยครั้งแรก 2 งวด 3,096 บาท)",
      "ราย 6 เดือน 8,944 บาท",
      "รายปี 17,200 บาท",
      "",
      "👪 ครอบครัวได้รับเมื่อเสียชีวิต",
      "- เสียชีวิตก่อนอายุ 60 ปี 2,000,000 บาท",
      "- อายุ 60 ปีขึ้นไป 1,000,000 บาท",
      "",
      "📌 เบี้ยคงที่ตลอดระยะเวลาชำระ",
      "เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน",
    ].join("\n"));
  });

  /**
   * The figure a customer reads first is what they pay altogether, with the plan's own price
   * and the rider's share spelled out directly under it — the same two lines, in the same
   * order, as the card on the page.
   */
  it("breaks the headline into the plan and its rider when one is quoted", () => {
    const text = lifeProtectQuoteText({
      sumAssured: 1_000_000, termLabel: "จ่ายถึงอายุ 99", age: 35, sex: "M", modes, death, cash: [],
      parts: {
        base: { mode: "monthly", total: 71_600, belowMinimum: false },
        riders: [{ name: "สัญญาเพิ่มเติมพีบี ฟิต", own: { mode: "monthly", total: 83_200, belowMinimum: false } }],
      },
    });
    expect(text).toContain([
      "💰 เบี้ยประมาณ 1,548 บาท/เดือน (ตกวันละ 48 บาท)",
      "- สัญญาหลัก 716.00 บาท/เดือน",
      "- สัญญาเพิ่มเติมพีบี ฟิต 832.00 บาท/เดือน",
      "รายเดือน 1,548 บาท",
    ].join("\n"));
  });

  /** 1,629.00 + 93.66 + 85.50 is 1,808 dropped to the baht once, 1,807 dropped part by part. */
  it("gives the parts to the satang, so they add up to the total above them", () => {
    const monthly = (total: number) => ({ mode: "monthly" as const, total, belowMinimum: false });
    const text = lifeProtectQuoteText({
      sumAssured: 1_000_000, termLabel: "จ่าย 19 ปี", age: 14, sex: "M", death, cash: [],
      modes: [monthly(180_816)],
      parts: {
        base: monthly(162_900),
        riders: [
          { name: "สัญญาเพิ่มเติมพีบี บียอนด์", own: monthly(9_366) },
          { name: "สัญญาเพิ่มเติมค่ารักษาพยาบาล (MEB) แผน 1,000", own: monthly(8_550) },
        ],
      },
    });
    expect(text).toContain([
      "💰 เบี้ยประมาณ 1,808 บาท/เดือน",
      "- สัญญาหลัก 1,629.00 บาท/เดือน",
      "- สัญญาเพิ่มเติมพีบี บียอนด์ 93.66 บาท/เดือน",
      "- สัญญาเพิ่มเติมค่ารักษาพยาบาล (MEB) แผน 1,000 85.50 บาท/เดือน",
    ].join("\n"));
  });

  it("lists every rider in the headline, one a line under the plan's own share", () => {
    const text = lifeProtectQuoteText({
      sumAssured: 1_000_000, termLabel: "จ่ายถึงอายุ 99", age: 35, sex: "M", modes, death, cash: [],
      parts: {
        base: { mode: "monthly", total: 71_600, belowMinimum: false },
        riders: [
          { name: "สัญญาเพิ่มเติมพีบี ฟิต", own: { mode: "monthly", total: 33_200, belowMinimum: false } },
          { name: "สัญญาเพิ่มเติมค่ารักษาพยาบาล (MEB) แผน 1,000", own: { mode: "monthly", total: 50_000, belowMinimum: false } },
        ],
      },
    });
    expect(text).toContain([
      "- สัญญาหลัก 716.00 บาท/เดือน",
      "- สัญญาเพิ่มเติมพีบี ฟิต 332.00 บาท/เดือน",
      "- สัญญาเพิ่มเติมค่ารักษาพยาบาล (MEB) แผน 1,000 500.00 บาท/เดือน",
    ].join("\n"));
  });

  /** The company collects the first two monthly instalments with the application. */
  it("says paying monthly starts with two instalments, and what they come to", () => {
    const monthly = (total: number) => ({ mode: "monthly" as const, total, belowMinimum: false });
    const text = lifeProtectQuoteText({
      sumAssured: 1_000_000, termLabel: "จ่าย 19 ปี", age: 14, sex: "M", death, cash: [],
      modes: [monthly(180_816)],
    });
    expect(text).toContain("รายเดือน 1,808 บาท\n(ชำระเบี้ยครั้งแรก 2 งวด 3,616 บาท)");
  });

  it("says nothing of a first payment when monthly is not on offer", () => {
    const text = lifeProtectQuoteText({
      sumAssured: 500_000, termLabel: "จ่าย 9 ปี", age: 35, sex: "M", death, cash: [],
      modes: [{ mode: "annual", total: 2_730_000, belowMinimum: false }],
    });
    expect(text).not.toContain("ครั้งแรก");
  });

  it("says nothing of a rider when none is quoted", () => {
    const text = lifeProtectQuoteText({
      sumAssured: 1_000_000, termLabel: "จ่าย 9 ปี", age: 35, sex: "M", modes, death, cash: [],
    });
    expect(text).not.toContain("สัญญาหลัก");
    expect(text).toContain("💰 เบี้ยประมาณ 1,548 บาท/เดือน (ตกวันละ 48 บาท)\nรายเดือน 1,548 บาท");
  });

  it("promises no doubling to an insured already past the age it stops at", () => {
    const past = { beforeAge: 60, sumBefore: 1_000_000, sumFrom: 1_000_000, alreadyPastAge: true };
    const text = lifeProtectQuoteText({ sumAssured: 1_000_000, termLabel: "จ่าย 9 ปี", age: 62, sex: "M", modes, death: past, cash: [] });
    expect(text).toContain("🛡️ Life Protect x 2\nทุน 1,000,000 บาท\nชาย อายุ 62");
    expect(text).not.toContain("เพิ่มเป็น");
  });

  it("leaves the cash-value block out when there is none to show", () => {
    const text = lifeProtectQuoteText({ sumAssured: 1_000_000, termLabel: "จ่าย 9 ปี", age: 0, sex: "F", modes, death, cash: [] });
    expect(text).toContain("หญิง อายุ แรกเกิด · จ่าย 9 ปี");
    expect(text).not.toContain("มูลค่าเงินสด");
  });
});
describe("lifeProtectChatQuoteText", () => {
  // หญิง 42 · 1 ล้าน · จ่ายถึงอายุ 99: the case the owner wrote the wording against
  const modes: ModePremium[] = [
    { mode: "annual", total: 1_780_000, belowMinimum: false },
    { mode: "monthly", total: 160_200, belowMinimum: false },
    { mode: "semi", total: 925_600, belowMinimum: false },
  ];
  const death = { beforeAge: 60, sumBefore: 2_000_000, sumFrom: 1_000_000, alreadyPastAge: false };
  /**
   * The owner's message, less the surrender values at four ages: those went from the page and
   * its card on 2026-10-06, and the chart-and-table picture sent after the quote has every year.
   */
  it("is the owner's message, word for word", () => {
    const text = lifeProtectChatQuoteText({
      sumAssured: 1_000_000, termLabel: "จ่ายถึงอายุ 99", age: 42, sex: "F", modes, death, coverToAge: 99,
    });
    expect(text).toBe([
      "🛡️ Life Protect",
      "ทุน 1,000,000 บาท เพิ่มเป็น 2,000,000 ถึงอายุ 60",
      "ระบบ double ทุน ราคาเบี้ยถูกที่สุดจากประสบการณ์เท่าที่ผู้ขายทำงานมากกว่า 10 ปี",
      "ยังไม่เห็นมีที่ไหนขาย",
      "",
      "หญิง อายุ 42 · อย่างนี้ออมถึงอายุ 99 คุ้มครอง 99 ปี",
      "💰 เบี้ยประมาณ 17,800 บาท/ปี (ตกวันละ 49 บาท)",
      "ทั้งนี้เราสามารถเลือกระยะเวลาในการออมได้",
      "เช่น 9ปี, 19 ปี, 99 ปี",
      "",
      "รายเดือน 1,602 บาท",
      "(ชำระเบี้ยครั้งแรก 2 งวด 3,204 บาท)",
      "ราย 6 เดือน 9,256 บาท",
      "รายปี 17,800 บาท",
      "",
      "👪 ครอบครัวได้รับเมื่อเสียชีวิต (ตุยเย่)",
      "- เสียชีวิตก่อนอายุ 60 ปี ภาระหนี้สินเยอะเลย เพิ่มทุนเป็น 2,000,000 บาท",
      "- อายุ 60 ปีขึ้นไปรับทุน 1,000,000 บาท ตามเบี้ยจริง",
      "",
      "📌 เบี้ยคงที่ตลอดระยะเวลาชำระ",
      "เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน",
      "ลดหย่อนภาษีได้ 100,000 บาท",
    ].join("\n"));
  });

  it("drops the doubling pitch for an insured already past the age it stops at", () => {
    const past = { beforeAge: 60, sumBefore: 1_000_000, sumFrom: 1_000_000, alreadyPastAge: true };
    const text = lifeProtectChatQuoteText({
      sumAssured: 1_000_000, termLabel: "จ่าย 9 ปี", age: 62, sex: "M", modes, death: past, coverToAge: 99,
    });
    expect(text).toContain("🛡️ Life Protect\nทุน 1,000,000 บาท\n\nชาย อายุ 62 · อย่างนี้ออม 9 ปี คุ้มครอง 99 ปี");
    expect(text).not.toContain("double");
    expect(text).not.toContain("เพิ่มทุน");
  });
});
