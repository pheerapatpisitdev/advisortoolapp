import { describe, expect, it } from "vitest";
import { healthQuote, HEALTH_HAND_OVER } from "@/lib/assistant/ihealthy/quote";
import { iHealthyQuoteText } from "@/lib/ihealthy-cta";
import { iHealthyFacts, planLabel } from "@/lib/ihealthy-facts";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { deathBenefitOf, iHealthyPricing, shownAt } from "@/lib/ihealthy-quote";
import { initialFrom, queryFrom } from "@/lib/ihealthy-link";
import { quotePdfPath } from "@/lib/quote-pdf/link";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";

const WHO = { product: "ihealthy" as const, intent: "quote" as const, age: 35, sex: "F" as const, plan: "GOLD" };

describe("the quotation the bot sends", () => {
  it("says exactly what the sales page would say", () => {
    const reply = healthQuote(WHO);
    const table = iHealthyTable();
    const facts = iHealthyFacts();
    const plan = facts.plans.find((p) => p.code === "GOLD")!;
    const priced = iHealthyPricing(table, {
      base: IHEALTHY_OPENING.base, sex: "F", age: 35, sumAssured: IHEALTHY_OPENING.sumAssured,
      plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage",
    })!;
    const expected = iHealthyQuoteText({
      arrangement: {
        planName: planLabel("GOLD"), annualMax: plan.annualMax, deductible: plan.deductible,
        territory: "ประเทศไทย", coverage: "Full Coverage",
      },
      copayPercent: facts.copayPercent,
      age: 35, sex: "F",
      baseLabel: table.bases.find((b) => b.variant === IHEALTHY_OPENING.base)!.label,
      sumAssured: IHEALTHY_OPENING.sumAssured,
      death: deathBenefitOf(table, IHEALTHY_OPENING.base, 35, IHEALTHY_OPENING.sumAssured),
      mode: "annual",
      minMonthly: table.minMonthly,
      shown: shownAt(priced, "annual"),
    })!;
    expect(reply.messages[0].text).toBe(expected);
    expect(reply.priced).toBe(true);
  });

  it("sends a picture of the same arrangement, sized for a phone", () => {
    const card = healthQuote(WHO).messages[0].card!;
    expect(card).toContain("/api/ihealthy-card?");
    expect(card).toContain("fit=phone");
    const chosen = initialFrom(iHealthyTable(), Object.fromEntries(new URLSearchParams(card.split("?")[1])));
    expect(chosen).toMatchObject({ age: 35, sex: "F", plan: "GOLD", territory: "ประเทศไทย" });
  });

  it("remembers the sales page's PDF of the same arrangement", () => {
    const table = iHealthyTable();
    const v = { ...IHEALTHY_OPENING, age: 35, sex: "F" as const, plan: "GOLD" };
    const pdf = healthQuote(WHO).messages[0].pdfPath!;
    expect(pdf).toContain("page=ihealthy-ultra");
    expect(pdf).toBe(quotePdfPath({ kind: "ihealthy", query: queryFrom(table, v) }));
  });

  it("offers the way on under the picture", () => {
    expect(healthQuote(WHO).replies).toEqual(["ดูแผนอื่น", "ผลประโยชน์แผนนี้", "สนใจสมัคร"]);
  });

  it("quotes a territory the plan is written for", () => {
    const reply = healthQuote({ ...WHO, plan: "DIAMOND", territory: "เอเชีย" });
    expect(reply.messages[0].text).toContain("เอเชีย");
    expect(reply.messages[0].card).toBeDefined();
  });

  it("will not price an age the company does not write this rider at", () => {
    for (const age of [5, 81]) {
      const reply = healthQuote({ ...WHO, age });
      expect(reply.messages[0].card).toBeUndefined();
      expect(reply.messages[0].text).toContain("6-80");
      expect(reply.messages[0].text).toContain(HEALTH_HAND_OVER);
      expect(reply.priced).toBeUndefined();
    }
  });

  it("will not price a plan the company does not sell at this age", () => {
    const reply = healthQuote({ ...WHO, age: 8, plan: "PLATINUM" });
    expect(reply.messages[0].card).toBeUndefined();
    expect(reply.messages[0].text).toContain("อายุ 8");
  });

  it("shows no price at all once the rate table has lapsed", () => {
    const reply = healthQuote(WHO, new Date("2099-01-01"));
    expect(reply.messages[0].card).toBeUndefined();
    expect(reply.messages[0].text).toContain("หมดอายุ");
    expect(reply.messages[0].text).toContain("แอดมินเช็กให้");
  });
});
