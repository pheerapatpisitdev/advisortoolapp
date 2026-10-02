import { describe, expect, it } from "vitest";
import { backgroundPrompt, posterPrompt, stripThai } from "@/lib/content/background";
import { parsePoster } from "@/lib/content/poster";
import { CLASSIC } from "@/lib/content/looks";

describe("backgroundPrompt", () => {
  const base = { scene: "A Thai father reading to his daughter at bedtime", layout: "bottom" as const, theme: "navy" as const };

  it("forbids any lettering and keeps the text's side of the frame calm", () => {
    const p = backgroundPrompt(base);
    expect(p).toContain("NO text, letters, numbers or words");
    expect(p).toContain("bottom half of the frame calm");
    expect(backgroundPrompt({ ...base, layout: "top" })).toContain("top half of the frame calm");
  });

  it("never hands the model a Thai word, which it would try to draw", () => {
    const p = backgroundPrompt({ ...base, scene: "A family at home ครอบครัว", request: "ขอแสงเช้า morning light" });
    expect(p).not.toMatch(/[฀-๿]/);
    expect(p).toContain("morning light");
  });

  it("keeps an insurance advertisement away from fear and money", () => {
    const p = backgroundPrompt(base);
    expect(p).toContain("coffins");
    expect(p).toContain("piles of cash");
  });

  it("has a scene even when the piece has none", () => {
    expect(backgroundPrompt({ ...base, scene: "ภาพครอบครัว" })).toContain("Thai family at home");
  });

  it("strips Thai and tidies the spaces it leaves", () => {
    expect(stripThai("a ครอบครัว b")).toBe("a b");
  });
});

describe("a poster's background", () => {
  const headline = [{ kind: "headline", text: "วันละ 20 บาท" }];

  it("keeps a picture the bucket could have written", () => {
    const bg = "3f2504e0-4f89-11d3-9a0c-0305e82c3301/9b2c1d4e-0000-4000-8000-000000000001.png";
    expect(parsePoster({ blocks: headline, background: bg })!.background).toBe(bg);
  });

  it("drops any other path, so the drawing route reads only its own bucket's files", () => {
    for (const bad of ["../../etc/passwd", "https://evil.example/x.png", "a/b/c.png", "x.png"]) {
      expect(parsePoster({ blocks: headline, background: bad })!.background, bad).toBeUndefined();
    }
  });
});

describe("English pieces", () => {
  const en = { scene: "", layout: "bottom" as const, theme: "navy" as const, lang: "en" as const };

  it("asks for English lettering and expat people on an English piece", () => {
    const bg = backgroundPrompt(en);
    expect(bg).toContain("English headline text");
    expect(bg).not.toContain("Thai headline text");
    expect(bg).toContain("Western (European) expats living in Thailand, in a Thai setting");
    expect(bg).toContain("A believable everyday moment of a Western (European) expat living in Thailand, warm and unposed.");
    const p = posterPrompt({ direction: "clean", poster: { blocks: [{ kind: "headline", text: "Cover that stays" }] }, layout: "bottom", lang: "en" });
    expect(p).toContain("The words on the image, in English");
    expect(p).toContain("the English lettering");
    expect(p).toContain("Keep every word whole and correctly spelled");
    expect(p).not.toMatch(/Thai lettering|Thai typeface|Thai word/);
  });

  it("covers the look and owner-request branches", () => {
    const lk = backgroundPrompt({ ...en, look: { ...CLASSIC, style: "film" } });
    expect(lk).not.toContain("Thai headline text");
    expect(lk).toContain("English headline text");
    const rq = backgroundPrompt({ ...en, request: "a quiet beach" });
    expect(rq).toContain("English headline text");
    expect(rq).not.toContain("Thai headline text");
  });

  it("leaves a Thai piece's prompts as they were", () => {
    expect(backgroundPrompt({ ...en, lang: undefined })).toContain("Thai headline text");
    expect(backgroundPrompt({ ...en, lang: undefined })).toContain("Thai people in a Thai setting");
    expect(backgroundPrompt({ ...en, request: "x", lang: undefined })).toContain("Thai headline text");
    const p = posterPrompt({ direction: "d", poster: { blocks: [{ kind: "headline", text: "x" }] }, layout: "bottom" });
    expect(p).toContain("the Thai lettering together");
    expect(p).toContain("in a clean, modern, clearly legible Thai typeface");
  });

  it("draws expats, not Thai people, for every people subject of a look on an English piece", () => {
    const say = { thai: "Western (European) expats living in Thailand", solo: "one Western (European) adult", couple: "a Western (European) couple", family: "a Western (European) family with young children", elders: "older Western (European) parents" } as const;
    for (const subject of ["thai", "solo", "couple", "family", "elders"] as const) {
      const look = { ...CLASSIC, style: "film" as const, subject };
      const en2 = backgroundPrompt({ ...en, look });
      expect(en2, subject).toContain(say[subject]);
      expect(en2, subject).not.toMatch(/Thai (people|adult|couple|family|parents)/);
      expect(backgroundPrompt({ ...en, lang: undefined, look }), subject).toContain(
        { thai: "Thai people, with", solo: "one Thai adult", couple: "a Thai couple", family: "a Thai family", elders: "elderly Thai parents" }[subject],
      );
    }
  });
});
