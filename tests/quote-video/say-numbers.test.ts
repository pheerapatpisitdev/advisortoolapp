import { describe, expect, it } from "vitest";
import { sayNumbers, thaiNumberWords } from "@/lib/quote-video/say-numbers";

// the voice gets figures as words (owner, 2026-10-14: it misread "850,000" and "1.5 ล้าน")
describe("thaiNumberWords", () => {
  it.each([
    [0, "ศูนย์"], [1, "หนึ่ง"], [10, "สิบ"], [11, "สิบเอ็ด"], [20, "ยี่สิบ"], [21, "ยี่สิบเอ็ด"],
    [99, "เก้าสิบเก้า"], [101, "หนึ่งร้อยเอ็ด"], [812, "แปดร้อยสิบสอง"], [12_345, "หนึ่งหมื่นสองพันสามร้อยสี่สิบห้า"],
    [850_000, "แปดแสนห้าหมื่น"], [1_000_000, "หนึ่งล้าน"], [1_000_001, "หนึ่งล้านเอ็ด"],
    [1_500_000, "หนึ่งล้านห้าแสน"], [21_000_000, "ยี่สิบเอ็ดล้าน"], [50_250_000, "ห้าสิบล้านสองแสนห้าหมื่น"],
  ])("%d → %s", (n, words) => expect(thaiNumberWords(n)).toBe(words));
});

describe("sayNumbers", () => {
  it("says the quote lines' figures in words", () => {
    expect(sayNumbers("ออมแค่วันละ 27 บาท หรือเดือนละ 812 บาท ออมเพียง 19 ปีก็ครบ"))
      .toBe("ออมแค่วันละ ยี่สิบเจ็ด บาท หรือเดือนละ แปดร้อยสิบสอง บาท ออมเพียง สิบเก้า ปีก็ครบ");
    expect(sayNumbers("ทำทุน 850,000 ถ้าเป็นอะไรไป")).toBe("ทำทุน แปดแสนห้าหมื่น ถ้าเป็นอะไรไป");
  });
  it("reads a decimal before ล้าน as one sum", () => {
    expect(sayNumbers("สูงสุดถึง 1.5 ล้านบาทค่ะ")).toBe("สูงสุดถึง หนึ่งล้านห้าแสนบาทค่ะ");
    expect(sayNumbers("ได้ 2 ล้าน")).toBe("ได้ สองล้าน");
    expect(sayNumbers("1.25 ล้าน")).toBe("หนึ่งล้านสองแสนห้าหมื่น");
    expect(sayNumbers("6.5 แสน")).toBe("หกแสนห้าหมื่น");
  });
  it("reads a plain decimal digit by digit", () => {
    expect(sayNumbers("27.50 บาท")).toBe("ยี่สิบเจ็ดจุดห้าศูนย์ บาท");
  });
  it("leaves a line without figures as it is", () => {
    expect(sayNumbers("สนใจ ทักมาคุยกันได้เลยนะคะ")).toBe("สนใจ ทักมาคุยกันได้เลยนะคะ");
  });
});

describe("a split said in whole baht (owner, 2026-10-18)", () => {
  it("adds up to the whole premium rounded, never ฿1 off", async () => {
    const { wholeShares } = await import("@/lib/quote-video/script");
    // 1,000.40 + 12.40 + 30.40 = 1,043.20: row by row 1,000 + 12 + 30 = 1,042
    const said = wholeShares(["1,000.40", "+12.40", "+30.40"]).map((x) => Number(x.replace(/,/g, "")));
    expect(said.reduce((a, b) => a + b, 0)).toBe(1043);
    [1000.4, 12.4, 30.4].forEach((x, i) => expect(Math.abs(said[i] - x)).toBeLessThan(1));
    expect(wholeShares(["2,500.00", "+0.50"])).toEqual(["2,500", "1"]);
  });
});
