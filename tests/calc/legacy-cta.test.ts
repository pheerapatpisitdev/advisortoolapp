import { describe, expect, it } from "vitest";
import type { ModePremium } from "@/calc/mode-premiums";
import { FACEBOOK_PAGE, displayPremium, legacyMessage, legacyQuoteText, messengerUrl, perDay } from "@/lib/legacy-cta";

/** ชาย 38 ปี มรดก 3 ล้าน — every mode is issuable */
const AFFORDABLE: ModePremium[] = [
  { mode: "annual", total: 1_668_750, belowMinimum: false },
  { mode: "semi", total: 867_750, belowMinimum: false },
  { mode: "monthly", total: 150_187, belowMinimum: false },
];

/** หญิง 30 ปี มรดก 1 ล้าน — the monthly instalment is under the company's 1,000 baht floor */
const UNDER_FLOOR: ModePremium[] = [
  { mode: "annual", total: 412_300, belowMinimum: false },
  { mode: "semi", total: 214_396, belowMinimum: false },
  { mode: "monthly", total: 37_107, belowMinimum: true },
];

describe("displayPremium", () => {
  it("headlines the monthly instalment when the company will take it", () => {
    expect(displayPremium(AFFORDABLE, false)).toEqual(AFFORDABLE[2]);
  });

  it("falls back to the yearly premium when the monthly instalment is under the minimum", () => {
    expect(displayPremium(UNDER_FLOOR, false)).toEqual(UNDER_FLOOR[0]);
  });

  it("shows no price at all once the rate table has expired", () => {
    expect(displayPremium(AFFORDABLE, true)).toBeUndefined();
  });

  it("shows no price when the bundle could not be quoted", () => {
    expect(displayPremium(undefined, false)).toBeUndefined();
  });
});

describe("perDay", () => {
  it("turns a yearly premium into whole baht a day", () => {
    // ชาย 38 · 3 ล้าน: 16,687.50 บาท/ปี ÷ 365 = 45.7 → 46
    expect(perDay(1_668_750)).toBe(46);
  });

  it("rounds up, so the figure is never one the premium undershoots", () => {
    // หญิง 30 · 1 ล้าน: 4,123 บาท/ปี ÷ 365 = 11.3 → 12
    expect(perDay(412_300)).toBe(12);
  });
});

const RANGE = { min: 20, max: 65 };

describe("legacyMessage", () => {
  it("carries the sum, the insured and the headline premium", () => {
    expect(legacyMessage({ millions: 3, age: 38, sex: "M", range: RANGE, premium: AFFORDABLE[2] }))
      .toBe("สนใจมรดกเพื่อครอบครัว 3 ล้าน อายุ 38 ชาย เบี้ยประมาณ 1,501 บาท/เดือน");
  });

  it("names the yearly premium when that is what is on the card", () => {
    expect(legacyMessage({ millions: 1, age: 30, sex: "F", range: RANGE, premium: UNDER_FLOOR[0] }))
      .toBe("สนใจมรดกเพื่อครอบครัว 1 ล้าน อายุ 30 หญิง เบี้ยประมาณ 4,123 บาท/ปี");
  });

  it("asks about the sum alone before an age has been picked", () => {
    expect(legacyMessage({ millions: 3, age: "", sex: "M", range: RANGE, premium: undefined }))
      .toBe("สนใจมรดกเพื่อครอบครัว 3 ล้าน");
  });

  /**
   * The picker offers the ages the bundle takes and one way out for everyone else, so an
   * age outside the range arrives as "other" — a real person the agent should still call
   * back, not a number to quote.
   */
  it("asks for something else when the age is outside what the bundle takes", () => {
    expect(legacyMessage({ millions: 3, age: "other", sex: "F", range: RANGE, premium: undefined }))
      .toBe("สนใจมรดกเพื่อครอบครัว 3 ล้าน อายุนอกช่วง 20–65 ปี ขอแบบที่เหมาะกับอายุนี้");
  });

  it("asks for the current price when no premium may be shown", () => {
    expect(legacyMessage({ millions: 3, age: 38, sex: "M", range: RANGE, premium: undefined }))
      .toBe("สนใจมรดกเพื่อครอบครัว 3 ล้าน อายุ 38 ชาย ขอราคาปัจจุบัน");
  });
});

describe("contact links", () => {
  const text = "สนใจมรดกเพื่อครอบครัว 3 ล้าน";

  it("opens the agency's Page in Messenger with the message ready to send", () => {
    expect(messengerUrl(text)).toBe(`https://m.me/${FACEBOOK_PAGE}?text=` + encodeURIComponent(text));
  });
});

describe("legacyQuoteText", () => {
  it("writes every figure on the card, and only the instalments the company will take", () => {
    // หญิง 30 · 1 ล้าน: the monthly instalment is under the floor, so the card headlines the year
    const text = legacyQuoteText({
      millions: 1, age: 30, sex: "F",
      modes: UNDER_FLOOR,
      minMonthly: 1_000,
      critical: 850_000,
      death: { beforeAge: 60, sumBefore: 1_000_000, sumFrom: 150_000, alreadyPastAge: false, riderCoverEnds: { age: 65, sum: 150_000 } },
      diseaseCount: 31,
    });
    expect(text).toBe([
      "🛡️ มรดกเพื่อครอบครัว 1 ล้าน",
      "หญิง อายุ 30",
      "💰 เบี้ยประมาณ 4,123 บาท/ปี (ตกวันละ 12 บาท)",
      "รายเดือน 371 บาท (ต่ำกว่าขั้นต่ำ 1,000 บาท บริษัทไม่รับชำระรายเดือน)",
      "ราย 6 เดือน 2,143 บาท",
      "รายปี 4,123 บาท",
      "",
      "🏥 ตรวจพบโรคร้ายแรง รับเงินสดเอง 850,000 บาท",
      "(จ่ายครั้งเดียวแล้วสัญญาโรคร้ายแรงสิ้นสุด ประกันชีวิตหลักยังอยู่ต่อให้ครอบครัว)",
      "",
      "👪 ครอบครัวได้รับเมื่อเสียชีวิต",
      "- เสียชีวิตก่อนอายุ 60 ปี 1,000,000 บาท",
      "- อายุ 60–64 ปี 150,000 บาท",
      "- อายุ 65 ปีขึ้นไป 150,000 บาท",
      "",
      "📌 เบี้ยปีแรก ส่วนสัญญาโรคร้ายแรงคิดตามอายุ จึงปรับขึ้นในปีถัดไป",
      "โรคร้ายแรงเป็นไปตามคำนิยาม 1 ใน 31 โรคในกรมธรรม์",
    ].join("\n"));
  });

  it("names every instalment plainly when the company takes them all", () => {
    const text = legacyQuoteText({
      millions: 3, age: 38, sex: "M", modes: AFFORDABLE, minMonthly: 1_000, critical: 2_550_000,
      death: { beforeAge: 60, sumBefore: 3_000_000, sumFrom: 450_000, alreadyPastAge: false },
      diseaseCount: 31,
    });
    expect(text).toContain("💰 เบี้ยประมาณ 1,501 บาท/เดือน (ตกวันละ 46 บาท)\nรายเดือน 1,501 บาท\n(ชำระเบี้ยครั้งแรก 2 งวด 3,003 บาท)\nราย 6 เดือน 8,677 บาท\nรายปี 16,687 บาท");
    expect(text).not.toContain("ต่ำกว่าขั้นต่ำ");
  });
});