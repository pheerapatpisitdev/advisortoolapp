import { describe, expect, it } from "vitest";
import { DISCLAIMER, DISCLAIMER_EN, langOf } from "@/lib/content/output";
import { englishOutput } from "@/lib/content/lang";

const thai = { hooks: ["Hook"], body: "b", closing: "c", hashtags: [], imagePrompt: "", disclaimer: DISCLAIMER };

describe("englishOutput", () => {
  it("stamps lang, the English disclaimer, and always a poster", () => {
    const o = englishOutput(thai, "iHealthy Ultra");
    expect(o).toMatchObject({ lang: "en", disclaimer: DISCLAIMER_EN, poster: { lang: "en" } });
    expect(o.poster!.blocks.some((b) => b.text === "Message us to ask")).toBe(true);
  });

  it("keeps the writer's own poster and marks it", () => {
    const poster = { layout: "bottom" as const, theme: "rose" as const, blocks: [{ kind: "headline" as const, text: "Mine" }] };
    const o = englishOutput({ ...thai, poster }, "iHealthy Ultra");
    expect(o.poster).toEqual({ ...poster, lang: "en" });
  });
});

describe("langOf", () => {
  it("is Thai unless the piece says en", () => {
    expect(langOf(undefined)).toBe("th");
    expect(langOf({})).toBe("th");
    expect(langOf({ lang: "en" })).toBe("en");
  });
});
