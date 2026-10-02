import { describe, expect, it } from "vitest";
import { iHealthyCard, iHealthyTableCard } from "@/lib/ihealthy-card";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";

const query = (extra: Record<string, string> = {}) =>
  new URLSearchParams({ age: "35", sex: "F", plan: "GOLD", fit: "phone", ...extra });

describe("the comparison table on its own", () => {
  it("says who it is for and what it rides on", () => {
    const card = iHealthyTableCard(query());
    expect(card.headLine).toBe("iHealthy Ultra · เปรียบเทียบแผน");
    expect(card.insuredWho).toBe("หญิง 35 ปี");
    expect(card.insuredLine).toContain(IHEALTHY_OPENING.sumAssured.toLocaleString("en-US"));
    expect(card.insuredLine).toContain("ประเทศไทย");
  });

  it("singles out no plan, because none has been chosen", () => {
    const card = iHealthyTableCard(query());
    expect(card.columns.map((c) => c.name)).toEqual(["Bronze", "Silver", "Gold"]);
    expect(card.columns.every((c) => c.selected === false)).toBe(true);
  });

  it("says the same thing as the table under a quote card", () => {
    const q = query();
    const quote = iHealthyCard(new URLSearchParams(q));
    const table = iHealthyTableCard(new URLSearchParams(q));
    expect(table.rows).toEqual(quote.rows);
    expect(table.premiumRows).toEqual(quote.premiumRows);
  });

  it("shows a child only the plans a child may buy", () => {
    const card = iHealthyTableCard(query({ age: "8", plan: "SMART" }));
    expect(card.columns.map((c) => c.name)).toEqual(["Smart", "Bronze"]);
  });
});

describe("the comparison table in English", () => {
  it("is headed, and says who it is for, in English", () => {
    const card = iHealthyTableCard(query({ l: "en" }));
    expect(card.headLine).toBe("iHealthy Ultra · Compare plans");
    expect(card.insuredWho).not.toMatch(/[฀-๿]/);
    expect(card.insuredLine).not.toMatch(/[฀-๿]/);
  });

  it("is still Thai without l", () => {
    expect(iHealthyTableCard(query()).headLine).toBe("iHealthy Ultra · เปรียบเทียบแผน");
  });
});
