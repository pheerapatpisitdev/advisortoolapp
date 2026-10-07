import { describe, expect, it } from "vitest";
import { LIFE_QUOTES, quoteFor } from "@/lib/life-quotes";

describe("the line that closes a value table", () => {
  it("has the thirty lines, none of them numbered", () => {
    expect(LIFE_QUOTES).toHaveLength(30);
    expect(new Set(LIFE_QUOTES).size).toBe(30);
    for (const q of LIFE_QUOTES) expect(q).not.toMatch(/^\s*\d+[.)]/);
  });

  it("is the same line every time the same arrangement is asked for", () => {
    expect(quoteFor("PLB|PLB05|27|M|1000000")).toBe(quoteFor("PLB|PLB05|27|M|1000000"));
  });

  it("lands different arrangements on different lines", () => {
    const seen = new Set<string>();
    for (let age = 20; age < 60; age++) seen.add(quoteFor(`LIFEPROTECT|WLF19H|${age}|M|1000000`));
    expect(seen.size).toBeGreaterThan(15);
  });
});
