import { describe, expect, it } from "vitest";
import {
  HEALTH_PLAN_INFO_SYSTEM, HEALTH_SMALL_TALK_SYSTEM, healthFactsFor,
} from "@/lib/assistant/ihealthy/prompts";
import { iHealthyFacts } from "@/lib/ihealthy-facts";

const WHO = { product: "ihealthy" as const, intent: "plan_info" as const, age: 35, sex: "F" as const };

describe("what the model is forbidden", () => {
  for (const [name, prompt] of [
    ["plan info", HEALTH_PLAN_INFO_SYSTEM], ["small talk", HEALTH_SMALL_TALK_SYSTEM],
  ] as const) {
    it(`${name} never judges whether a person will be accepted`, () => {
      expect(prompt).toContain("ห้ามประเมินว่าโรค");
    });
    it(`${name} never gives medical advice`, () => {
      expect(prompt).toContain("ห้ามวินิจฉัย");
    });
    it(`${name} tells the truth when asked outright whether it is a person`, () => {
      expect(prompt).toContain("ผู้ช่วยตอบของเพจ");
    });
    it(`${name} never states a figure of its own`, () => {
      expect(prompt).toContain("ห้ามคิดตัวเลขเอง");
    });
  }

  // the hospital network is answered from Krungthai-AXA's list (src/lib/assistant/hospitals.ts)
  it("sends the claim to be checked and answered in this chat", () => {
    expect(HEALTH_PLAN_INFO_SYSTEM).toContain("การเคลม");
    expect(HEALTH_PLAN_INFO_SYSTEM).toContain("เดี๋ยวแอดมินเช็กให้แล้วกลับมาตอบในแชทนี้");
  });
});

describe("the facts the model is given", () => {
  it("carries the contract's own terms", () => {
    const { terms } = iHealthyFacts();
    const text = healthFactsFor(WHO);
    expect(text).toContain(String(terms.waitingDays));
    expect(text).toContain(String(terms.renewalToAge));
    expect(text).toContain(String(terms.noClaimDiscountPercent));
  });

  it("carries every benefit row of the plan that was chosen, and no other plan's", () => {
    const text = healthFactsFor({ ...WHO, plan: "GOLD" });
    expect(text).toContain("Gold");
    expect(text).toContain("หมวดที่ 1");
    expect(text).not.toContain("Platinum");
  });

  it("never narrows the plans to a child's two when the age is unknown", () => {
    // `plansFor` at the table's lowest age sells only Smart and Bronze, and a prompt built
    // from that had the bot tell a grown customer those were the only plans there are
    const text = healthFactsFor({ product: "ihealthy", intent: "quote" });
    for (const name of ["Smart", "Bronze", "Silver", "Gold", "Diamond", "Platinum"]) {
      expect(text).toContain(name);
    }
    expect(text).toContain("ขึ้นกับอายุ");
  });

  it("carries the headline rows of the menu plans before one is chosen", () => {
    const text = healthFactsFor(WHO);
    expect(text).toContain("Bronze");
    expect(text).toContain("Gold");
  });

  it("hands over the premium it already sent, to be copied and never recomputed", () => {
    const text = healthFactsFor({ ...WHO, plan: "GOLD" });
    expect(text).toContain("รายปี");
    expect(text).toContain("ห้ามคำนวณเอง");
  });

  it("says nothing about a premium before one has been sent", () => {
    expect(healthFactsFor({ product: "ihealthy", intent: "other" })).not.toContain("ห้ามคำนวณเอง");
  });
});
