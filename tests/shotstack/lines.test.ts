import { describe, expect, it } from "vitest";
import { thaiLines } from "@/lib/shotstack/lines";
import { textEms } from "@/lib/quote-video/caption";

describe("thaiLines", () => {
  it("keeps a line that fits whole", () => {
    expect(thaiLines("เคยปฏิเสธเพราะแข็งแรงดี", 14)).toEqual(["เคยปฏิเสธเพราะแข็งแรงดี"]);
  });

  it("breaks at the space rather than inside แข็งแรง", () => {
    expect(thaiLines("เคยปฏิเสธ เพราะสุขภาพแข็งแรง", 11)).toEqual(["เคยปฏิเสธ", "เพราะสุขภาพแข็งแรง"]);
  });

  it("breaks Thai with no spaces between words, never mid-word", () => {
    const lines = thaiLines("วางแผนการเงินเพื่อครอบครัวและค่ารักษา", 12);
    expect(lines).toEqual(["วางแผนการเงินเพื่อ", "ครอบครัวและค่ารักษา"]);
  });

  it("keeps every line inside the width and loses no letter", () => {
    const text = "ถ้าวันหนึ่งคุณไม่อยู่ครอบครัวจะได้รับเงินก้อนหนึ่งล้านบาทเพื่อส่งลูกเรียนจนจบปริญญา";
    const lines = thaiLines(text, 12);
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(textEms(l)).toBeLessThanOrEqual(12);
    expect(lines.join("")).toBe(text);
    expect(lines.some((l) => l.endsWith("ก้อ"))).toBe(false);
  });

  it("gives nothing for an empty line", () => {
    expect(thaiLines("   ", 10)).toEqual([]);
  });
});
