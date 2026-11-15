import { describe, expect, it } from "vitest";
import { LANGS } from "@/lib/ihealthy-lang";
import { PA_FAMILIES, paFamily, paQuoteText, paRows } from "@/lib/pa-plans";
import { PA_WORDS, paRowLabel } from "@/lib/pa-words";

/** the /pa page in five languages (owner, 2026-11-15, ก ก on mockup SZvzGB3ZFMdjHbCA2G3rzW) */
const THAI = /[฀-๿]/;

/** every string a language's words hold, its functions called with sample figures */
function allText(lang: (typeof LANGS)[number]): string[] {
  const w = PA_WORDS[lang];
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (typeof v === "function" && v !== w.quote) out.push(String(v(10, "PA Platinum", 16, 64)));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(w);
  return out;
}

describe("PA page words", () => {
  it("keeps Thai as the page was built, and the Thai quote as the bot's", () => {
    const f = paFamily("platinum");
    const facts = { family: f, plan: f.plans[1], cls: 1, age: 35 };
    expect(PA_WORDS.th.quote(facts)).toBe(paQuoteText(facts));
    expect(PA_WORDS.th.sum(2_000_000)).toBe("2 ล้าน");
    expect(PA_WORDS.th.sum(700_000)).toBe("7 แสน");
  });

  it.each(LANGS.filter((l) => l !== "th"))("has no Thai left in %s", (lang) => {
    for (const s of allText(lang)) expect(s, s).not.toMatch(THAI);
  });

  it.each([...LANGS])("copies the %s quote with every figure of the plan", (lang) => {
    const f = paFamily("platinum");
    const text = PA_WORDS[lang].quote({ family: f, plan: f.plans[1], cls: 1, age: 35 })!;
    for (const n of ["8,000", "22", "2,000,000", "1,000,000", "120,000", "2,000", "52", "2,500,000", "Platinum 02"]) {
      expect(text).toContain(n);
    }
    if (lang !== "th") expect(text).not.toMatch(THAI);
  });

  it.each([...LANGS])("copies no %s quote outside the ages or classes, and no medical line on Max", (lang) => {
    const q = PA_WORDS[lang].quote;
    const f = paFamily("platinum");
    expect(q({ family: f, plan: f.plans[1], cls: 1, age: 10 })).toBeUndefined();
    expect(q({ family: f, plan: f.plans[1], cls: 3, age: 35 })).toBeUndefined();
    const m = paFamily("max");
    const lines = q({ family: m, plan: m.plans[0], cls: 1, age: 30 })!.split("\n").filter((l) => l.startsWith("- "));
    expect(lines).toHaveLength(4);
  });

  it("labels every cover row in every language", () => {
    for (const lang of LANGS) {
      for (const fam of PA_FAMILIES) {
        for (const r of paRows(fam.plans[0])) expect(paRowLabel(PA_WORDS[lang], r.key).length).toBeGreaterThan(3);
      }
    }
    expect(paRowLabel(PA_WORDS.en, "weekly")).toContain("52 weeks");
    expect([1, 2].map(PA_WORDS.en.age)).toEqual(["1 year", "2 years"]);
  });

  it("writes plan sums and ages the way each language counts", () => {
    expect([1_000_000, 700_000].map(PA_WORDS.en.sum)).toEqual(["1M", "700K"]);
    expect([1_000_000, 700_000].map(PA_WORDS.zh.sum)).toEqual(["100万", "70万"]);
    expect([1_000_000, 700_000].map(PA_WORDS.ru.sum)).toEqual(["1 млн", "700 тыс."]);
    expect([1_000_000, 700_000].map(PA_WORDS.my.sum)).toEqual(["1 သန်း", "7 သိန်း"]);
    expect([0, 1, 2, 5, 11, 21, 22, 35].map(PA_WORDS.ru.age)).toEqual([
      "До 1 года", "1 год", "2 года", "5 лет", "11 лет", "21 год", "22 года", "35 лет",
    ]);
  });
});
