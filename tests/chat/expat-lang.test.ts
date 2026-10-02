import { describe, expect, it } from "vitest";
import { isExpatPage, languageOf } from "@/lib/assistant/expat";
import { spokenBy } from "@/lib/assistant/voice";

describe("expat pages", () => {
  it("knows the three Expat Pages and nothing else", () => {
    expect(isExpatPage("112079600278201")).toBe(true);
    expect(isExpatPage("112110731809903")).toBe(true);
    expect(isExpatPage("107330411059217")).toBe(true);
    expect(isExpatPage("103716981993581")).toBe(false);
    expect(isExpatPage(undefined)).toBe(false);
  });
});

describe("languageOf", () => {
  it.each([
    ["For more information", undefined, "en"],
    ["สนใจครับ", undefined, "th"],
    ["35", "th", "th"],
    ["35", "en", "en"],
    ["35", undefined, "en"],
    ["👍", "th", "th"],
    ["我想了解保险", undefined, "en"],
    ["Gold แผนนี้", "en", "th"],
    ["Gold", "th", "th"],
    ["Bronze", "th", "th"],
    ["ok", "th", "th"],
    ["Gold", undefined, "en"],
    ["Gold", "en", "en"],
  ] as const)("%s (was %s) → %s", (text, prev, want) => {
    expect(languageOf(text, prev)).toBe(want);
  });
});

describe("the woman-voice rewrite", () => {
  it("leaves English untouched", () => {
    const text = "Hi! Could you share your age and gender? I'll work out your premium.";
    expect(spokenBy("female", text)).toBe(text);
  });
});
