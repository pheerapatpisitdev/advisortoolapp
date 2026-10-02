import { describe, expect, it } from "vitest";
import { healthQuote } from "@/lib/assistant/ihealthy/quote";
import {
  cheaperEn, fullTableLinkEn, healthMenuEn, healthQuoteEn, otherPlansEn, territoryAnswerEn,
} from "@/lib/assistant/ihealthy-en/quote";
import { HAND_OVER_EN } from "@/lib/assistant/ihealthy-en/words";

const KNOWN = { product: "ihealthy" as const, intent: "quote" as const, age: 35, sex: "F" as const, lang: "en" as const };
const THAI = /[฀-๿]/;

describe("an English quote", () => {
  it("quotes Gold with the engine's own figures, in English", () => {
    const en = healthQuoteEn({ ...KNOWN, plan: "GOLD" });
    const th = healthQuote({ ...KNOWN, plan: "GOLD" });
    expect(en.messages[0].text).not.toMatch(THAI);
    expect(en.messages[0].text).toContain("Gold");
    expect(en.messages[0].card).toContain("l=en");
    expect(en.priced).toBe(true);
    expect(en.quote).toEqual(th.quote);
    expect(en.replies).toEqual(["See other plans", "Plan benefits", "I want to apply"]);
  });

  it("an age out of range is handed over, in English, unpriced", () => {
    const r = healthMenuEn(85, "M");
    expect(r.messages[0].text).toContain(HAND_OVER_EN);
    expect(r.messages[0].card).toBeUndefined();
    expect(healthQuoteEn({ ...KNOWN, age: 85, plan: "GOLD" }).priced).toBeFalsy();
  });
});

describe("the English menu", () => {
  it("three plans, English, English card", () => {
    const m = healthMenuEn(35, "F");
    expect(m.replies).toEqual(["Bronze", "Silver", "Gold"]);
    expect(m.messages[0].text).not.toMatch(THAI);
    expect(m.messages[0].text).toContain("THB");
    expect(m.messages[0].card).toMatch(/\/api\/ihealthy-card\/table\?.*l=en/);
  });
});

describe("the other English plan answers", () => {
  it("other plans, cheaper, territory and full table speak English", () => {
    const replies = [
      otherPlansEn(35, "F"), cheaperEn(35, "F", "SILVER"), cheaperEn(35, "F", "BRONZE"),
      territoryAnswerEn({ ...KNOWN, plan: "BRONZE" }, "ทั่วโลก"), fullTableLinkEn({ ...KNOWN }),
    ];
    for (const r of replies) for (const m of r.messages) expect(m.text).not.toMatch(THAI);
  });

  it("a territory the plan sells re-prices it", () => {
    const r = territoryAnswerEn({ ...KNOWN, plan: "DIAMOND" }, "เอเชีย");
    expect(r.priced).toBe(true);
    expect(r.slots.territory).toBe("เอเชีย");
  });
});
