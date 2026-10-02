import { describe, expect, it } from "vitest";
import { DISCLAIMER, DISCLAIMER_EN, INSURER_LINE, INSURER_LINE_EN, TAX_LINE, captionParts, footer, fullText } from "@/lib/content/output";

const piece = { hooks: ["เปิด"], body: "เนื้อ", closing: "ปิด", hashtags: ["#a"], imagePrompt: "", disclaimer: DISCLAIMER };

describe("the lines under a piece", () => {
  it("names the insurer under every piece, old ones included", () => {
    expect(fullText(piece)).toContain("รับประกันภัยโดย บมจ. กรุงไทย-แอกซ่า ประกันชีวิต");
    expect(fullText(piece).endsWith(INSURER_LINE)).toBe(true);
  });

  it("adds the tax line when the words talk about tax, whatever angle was picked", () => {
    expect(footer({ ...piece, body: "ลดหย่อนภาษีได้" })).toContain(TAX_LINE);
    expect(footer(piece)).not.toContain(TAX_LINE);
  });

  it("does not repeat a tax line the piece already carries", () => {
    const f = footer({ ...piece, body: "ภาษี", disclaimer: `${DISCLAIMER}\n${TAX_LINE}` });
    expect(f.split(TAX_LINE).length - 1).toBe(1);
  });
});

describe("a caption as the feed draws it", () => {
  it("marks each hashtag, and keeps every other character as it was", () => {
    const parts = captionParts("โพสต์\n\n#ประกันชีวิต #โรคร้ายแรง ท้าย");
    expect(parts).toEqual([
      { text: "โพสต์\n\n", tag: false },
      { text: "#ประกันชีวิต", tag: true },
      { text: " ", tag: false },
      { text: "#โรคร้ายแรง", tag: true },
      { text: " ท้าย", tag: false },
    ]);
    expect(parts.map((p) => p.text).join("")).toBe("โพสต์\n\n#ประกันชีวิต #โรคร้ายแรง ท้าย");
  });

  it("does not mark a lone # or one inside a word", () => {
    expect(captionParts("ข้อ # 1 และ C#").every((p) => !p.tag)).toBe(true);
  });
});

describe("an English piece's footer", () => {
  it("ends on the English disclaimer and insurer, with no tax line", () => {
    const out = { hooks: ["Tax time"], body: "about tax", closing: "", hashtags: [], imagePrompt: "", disclaimer: DISCLAIMER_EN, lang: "en" as const };
    expect(footer(out)).toBe(`${DISCLAIMER_EN}\n${INSURER_LINE_EN}`);
    expect(fullText(out)).not.toMatch(/[\u0E00-\u0E7F]/);
  });

  it("leaves a Thai piece's footer as before: no lang means the Thai insurer", () => {
    expect(footer(piece).endsWith(INSURER_LINE)).toBe(true);
    expect(footer(piece)).not.toContain(INSURER_LINE_EN);
  });
});
