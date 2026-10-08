import { describe, expect, it } from "vitest";
import { MAX_CHARS, type PosterSpec } from "@/lib/content/poster";
import { applyPosterWords, cleanPosterWords } from "@/lib/content/poster-words";

/**
 * The agent's own poster words (owner, 2026-10-08): typed on the round's form, they replace what
 * the writer put on every poster of the round. A poster with no headline is not a poster, so
 * without one the round is as it always was.
 */

const written: { poster?: PosterSpec; body: string } = {
  body: "เนื้อโพสต์",
  poster: {
    layout: "center", theme: "emerald",
    blocks: [
      { kind: "badge", text: "ของ AI" },
      { kind: "headline", text: "พาดหัวของ AI" },
      { kind: "sub", text: "รองของ AI" },
      { kind: "footer", text: "ท้ายของ AI" },
    ],
    background: "11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.png",
  },
};

describe("cleanPosterWords", () => {
  it("keeps what was typed, trimmed, and drops the blank lines", () => {
    expect(cleanPosterWords({ headline: "  ทักมาได้เลย ", badge: "", sub: "   ", footer: "LINE: abc" }))
      .toEqual({ headline: "ทักมาได้เลย", footer: "LINE: abc" });
  });

  it("is nothing without a headline, whatever else was typed", () => {
    expect(cleanPosterWords({ badge: "ป้าย", sub: "รอง" })).toBeNull();
    expect(cleanPosterWords({ headline: "   " })).toBeNull();
  });

  it("reads the JSON string a form sends, and refuses anything else", () => {
    expect(cleanPosterWords(JSON.stringify({ headline: "หัว" }))).toEqual({ headline: "หัว" });
    for (const bad of [null, undefined, 5, "not json", "[]", "null", [], { headline: 3 }]) expect(cleanPosterWords(bad)).toBeNull();
  });

  it("cuts a line to the length a poster allows, and ignores kinds that are not lines", () => {
    const got = cleanPosterWords({ headline: "ก".repeat(300), extra: "x" });
    expect([...got!.headline!].length).toBeLessThanOrEqual(MAX_CHARS.headline);
    expect(got).not.toHaveProperty("extra");
  });
});

describe("applyPosterWords", () => {
  it("lays the agent's words in place of every line the writer gave, and keeps the rest of the poster", () => {
    const out = applyPosterWords(written, { headline: "หัวของฉัน", footer: "ท้ายของฉัน" });
    expect(out.poster!.blocks).toEqual([
      { kind: "headline", text: "หัวของฉัน" },
      { kind: "footer", text: "ท้ายของฉัน" },
    ]);
    expect(out.poster).toMatchObject({ layout: "center", theme: "emerald", background: written.poster!.background });
    expect(out.body).toBe("เนื้อโพสต์");
  });

  it("orders the lines as a poster stacks them whatever order they were typed in", () => {
    const out = applyPosterWords(written, { footer: "f", headline: "h", sub: "s", badge: "b" });
    expect(out.poster!.blocks.map((b) => b.kind)).toEqual(["badge", "headline", "sub", "footer"]);
  });

  it("leaves the piece alone with no words, and a piece with no poster (a script) too", () => {
    expect(applyPosterWords(written, null)).toBe(written);
    const script: { poster?: PosterSpec; body: string } = { body: "สคริปต์" };
    expect(applyPosterWords(script, { headline: "หัว" })).toBe(script);
  });

  it("does not change the piece it was given", () => {
    const before = JSON.stringify(written);
    applyPosterWords(written, { headline: "หัวของฉัน" });
    expect(JSON.stringify(written)).toBe(before);
  });
});
