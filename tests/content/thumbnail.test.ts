import { describe, expect, it } from "vitest";
import { MAX_HEADLINE, MAX_SUB, STYLES, ideasMessages, parseIdeas, thumbnailPrompt } from "@/lib/content/thumbnail";

const base = { size: "9:16" as const, style: "bold" as const, headline: "ป่วยหนัก 1 ครั้ง หมดเงินเท่าไหร่?", sub: "เช็กก่อนสาย", scene: "" };

describe("thumbnailPrompt", () => {
  it("carries the words verbatim and says to draw only them", () => {
    const p = thumbnailPrompt(base);
    expect(p).toContain("ป่วยหนัก 1 ครั้ง หมดเงินเท่าไหร่?");
    expect(p).toContain("เช็กก่อนสาย");
    expect(p).toContain("Draw only the words above");
  });
  it("trims overlong words to the limits", () => {
    const p = thumbnailPrompt({ ...base, headline: "ก".repeat(MAX_HEADLINE + 30), sub: "ข".repeat(MAX_SUB + 30) });
    expect(p).toContain("ก".repeat(MAX_HEADLINE));
    expect(p).not.toContain("ก".repeat(MAX_HEADLINE + 1));
    expect(p).not.toContain("ข".repeat(MAX_SUB + 1));
  });
  it("leaves the sub line out when there is none", () => {
    expect(thumbnailPrompt({ ...base, sub: "  " })).not.toContain("Supporting line");
  });
  it("names the ratio and its own safe area", () => {
    const tall = thumbnailPrompt(base);
    const wide = thumbnailPrompt({ ...base, size: "16:9" });
    expect(tall).toContain("9:16");
    expect(tall).toMatch(/top 15%/);
    expect(tall).toMatch(/bottom 25%/);
    expect(wide).toContain("16:9");
    expect(wide).toMatch(/bottom-right/);
    expect(wide).not.toMatch(/top 15%/);
  });
  it("lets a scene replace the default scene but not the rules", () => {
    const p = thumbnailPrompt({ ...base, scene: "a man holding an umbrella in the rain" });
    expect(p).toContain("a man holding an umbrella in the rain");
    expect(p).not.toContain(STYLES.bold.scene);
    expect(p).toContain("Draw only the words above");
    expect(p).toMatch(/top 15%/);
  });
  it("uses the style's scene when none is given, and a different style differs", () => {
    expect(thumbnailPrompt(base)).toContain(STYLES.bold.scene);
    expect(thumbnailPrompt({ ...base, style: "clean" })).toContain(STYLES.clean.scene);
  });
  it("keeps the person recognisable when one is in it", () => {
    const p = thumbnailPrompt({ ...base, person: { pose: "arms" } });
    expect(p).toContain("reference photos");
    expect(p).toContain("same face");
    expect(thumbnailPrompt(base)).not.toContain("reference photos");
  });
  it("flattens newlines in the words so one line stays one line", () => {
    expect(thumbnailPrompt({ ...base, headline: "บรรทัด\nสอง" })).toContain("บรรทัด สอง");
  });
});

describe("parseIdeas", () => {
  it("reads up to five and trims", () => {
    const json = JSON.stringify({ ideas: Array.from({ length: 7 }, (_, i) => ({ headline: ` หัว${i} `, sub: " รอง " })) });
    const out = parseIdeas(json);
    expect(out).toHaveLength(5);
    expect(out[0]).toEqual({ headline: "หัว0", sub: "รอง" });
  });
  it("gives nothing for text that is not the answer", () => {
    expect(parseIdeas("sorry")).toEqual([]);
    expect(parseIdeas('{"ideas":"x"}')).toEqual([]);
    expect(parseIdeas('{"ideas":[{"headline":""}]}')).toEqual([]);
  });
});

describe("ideasMessages", () => {
  it("puts the topic in the user turn, cut to the limit", () => {
    const m = ideasMessages("เรื่อง".repeat(2000));
    expect(m[m.length - 1].role).toBe("user");
    expect(m[m.length - 1].content.length).toBeLessThanOrEqual(4000);
  });
});
