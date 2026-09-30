import { describe, expect, it } from "vitest";
import { backgroundPrompt, posterPrompt } from "@/lib/content/background";
import { decodePoster, encodePoster, parsePoster, type PosterSpec } from "@/lib/content/poster";
import { READ_FAILED, aiTextState, blocksKey, codeDrawsWords, comparePosterRead } from "@/lib/content/poster-text";

/**
 * With a brief, the image model draws the whole poster, words and all (owner, 2026-10-01); what
 * it drew is read back and compared, and the piece is held until the agent has looked.
 */

const poster: PosterSpec = {
  layout: "bottom", theme: "navy",
  blocks: [
    { kind: "headline", text: "จ่าย 9 ปี คุ้มครองตลอดชีพ ทุน 1,000,000 บาท" },
    { kind: "sub", text: "เบี้ย 4,914 บาท/เดือน เฉลี่ยวันละ 150 บาท" },
    { kind: "footer", text: "ทักแชทเพื่อวางแผนให้เหมาะกับคุณ" },
  ],
};
const said = "จ่าย 9 ปี คุ้มครองตลอดชีพ ทุน 1,000,000 บาท\nเบี้ย 4,914 บาท/เดือน เฉลี่ยวันละ 150 บาท\nทักแชทเพื่อวางแผนให้เหมาะกับคุณ";

describe("the full-poster prompt", () => {
  const p = posterPrompt({ direction: "a scrapbook collage of family photos, warm tones", poster, layout: "bottom", person: null });

  it("hands the model the owner's direction and every word, in Thai, exactly", () => {
    expect(p).toContain("a scrapbook collage of family photos");
    for (const b of poster.blocks) expect(p).toContain(b.text);
    expect(p).toContain("exactly");
  });

  it("lets it draw words, but only these, and keeps the forbidden list, the square and the strip for the insurer's line", () => {
    expect(p).not.toContain("NO text, letters, numbers or words");
    expect(p).toContain("no other words, numbers");
    expect(p).toContain("coffins");
    expect(p).toContain("1:1 square");
    expect(p).toContain("bottom strip");
  });

  it("keeps a library person as themselves", () => {
    expect(posterPrompt({ direction: "x", poster, layout: "bottom", person: { pose: "auto" } })).toContain("reference photos");
  });

  it("leaves the background-only prompt as it was", () => {
    expect(backgroundPrompt({ scene: "s", layout: "bottom", theme: "navy", request: "x" })).toContain("NO text, letters, numbers or words");
  });
});

describe("reading the drawn poster back", () => {
  it("finds nothing wrong when every word is there and nothing else is", () => {
    expect(comparePosterRead(said, poster)).toEqual([]);
    // a model reads lines and spaces its own way
    expect(comparePosterRead(said.replace(/\n/g, " ").replace(/ /g, "  "), poster)).toEqual([]);
  });

  it("names a line it cannot find, as a likely misspelling", () => {
    const issues = comparePosterRead(said.replace("ตลอดชีพ", "ตลอดชีภ"), poster);
    expect(issues.join("\n")).toContain("จ่าย 9 ปี");
  });

  it("names a figure on the picture that the words do not have", () => {
    const issues = comparePosterRead(said.replace("4,914", "4,941"), poster);
    expect(issues.join("\n")).toContain("4,941");
  });

  it("names words the model added of its own", () => {
    const issues = comparePosterRead(`${said}\nรับประกันผลตอบแทนแน่นอน`, poster);
    expect(issues.join("\n")).toContain("รับประกันผลตอบแทนแน่นอน");
  });

  it("asks the agent to look when nothing could be read", () => {
    expect(comparePosterRead("", poster)).toEqual([READ_FAILED]);
  });
});

describe("the state of a poster's drawn words", () => {
  const drawn = (checked: boolean, over: Partial<PosterSpec> = {}): PosterSpec => ({
    ...poster, ...over, aiText: { blocks: blocksKey(poster), read: said, issues: [], checked },
  });

  it("is none, unchecked, checked, or stale once the words are edited after the drawing", () => {
    expect(aiTextState(poster)).toBe("none");
    expect(aiTextState(drawn(false))).toBe("unchecked");
    expect(aiTextState(drawn(true))).toBe("checked");
    expect(aiTextState(drawn(true, { blocks: [{ kind: "headline", text: "หัวใหม่" }] }))).toBe("stale");
  });

  it("travels to the drawing route as a small mark, not the words read back", () => {
    const url = encodePoster(drawn(false));
    expect(url.length).toBeLessThan(encodePoster(poster).length + 80);
    expect(decodePoster(url)?.aiText).toBeTruthy();
  });

  it("is read from a stored poster, and nothing else is taken for it", () => {
    expect(parsePoster(drawn(false))?.aiText).toEqual({ blocks: blocksKey(poster), read: said, issues: [], checked: false });
    expect(parsePoster({ ...poster, aiText: "yes" })?.aiText).toBeUndefined();
  });
});

describe("who draws the words", () => {
  const drawn: PosterSpec = { ...poster, aiText: { blocks: blocksKey(poster), read: said, issues: [], checked: false } };

  it("is the model when it drew them and its picture is there, and the code otherwise", () => {
    expect(codeDrawsWords(drawn, true)).toBe(false);
    // the picture has gone missing: the code's words on the plain theme, rather than nothing
    expect(codeDrawsWords(drawn, false)).toBe(true);
    expect(codeDrawsWords(poster, true)).toBe(true);
  });
});
