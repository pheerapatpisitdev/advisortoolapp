import { describe, expect, it } from "vitest";
import { overBudget, pictureSummary, startingFormula } from "@/app/studio/ui/form-parts";

describe("the round's line under สร้าง", () => {
  it("warns when a round would cost more than the month has left, and not otherwise", () => {
    expect(overBudget(3.2, 1.5)).toContain("เกินงบที่เหลือ ฿1.50");
    expect(overBudget(1.2, 1.5)).toBeNull();
  });
});

describe("the folded picture section's one line", () => {
  it("names a kept brief, cut short, so it is not shaping rounds out of sight", () => {
    const line = pictureSummary({ format: "post", writer: "Sonnet", painter: "GPT Image", brief: "ครอบครัวในสวนตอนเย็น มุมกว้าง ไม่เอาภาพในโรงพยาบาล" });
    expect(line).toContain("บรีฟ: ครอบครัวในสวน");
    expect(line.endsWith("…")).toBe(true);
  });

  it("says nothing of a brief when no picture is drawn", () => {
    expect(pictureSummary({ format: "post", writer: "Sonnet", painter: null, brief: "x" })).not.toContain("บรีฟ");
  });
});

describe("the formula the picker starts on", () => {
  it("is the last one picked in this browser, 'none' included", () => {
    expect(startingFormula("finish", null)).toBe("finish");
    expect(startingFormula("none", "on")).toBeNull();
  });

  it("is สูตรโปร where it was ticked before there were two, and none otherwise", () => {
    expect(startingFormula(null, "on")).toBe("pro");
    expect(startingFormula(null, "off")).toBeNull();
    expect(startingFormula(null, null)).toBeNull();
  });
});
