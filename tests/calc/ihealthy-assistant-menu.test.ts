import { describe, expect, it } from "vitest";
import { healthMenu, otherPlansReply } from "@/lib/assistant/ihealthy/menu";
import { formatBaht } from "@/calc/money";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iHealthyPricing } from "@/lib/ihealthy-quote";
import { initialFrom } from "@/lib/ihealthy-link";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";

/**
 * The engine's own answer, so the menu is asserted against it rather than against a figure.
 *
 * The arrangement comes from the page's own opening rather than a copy of it kept here. It
 * was a copy, and the day the opening changed base this test failed for the one reason a test
 * must never fail: it was asserting yesterday's arrangement against today's menu.
 */
const priceOf = (plan: string, age = 35, sex: "M" | "F" = "F") => {
  const table = iHealthyTable();
  const priced = iHealthyPricing(table, {
    base: IHEALTHY_OPENING.base, sex, age, sumAssured: IHEALTHY_OPENING.sumAssured,
    plan, territory: "ประเทศไทย", coverage: "Full Coverage",
  })!;
  return formatBaht(priced.total.find((m) => m.mode === "annual")!.total);
};

describe("the menu an age and a sex earn", () => {
  it("offers the three plans the adverts sell, priced by the engine", () => {
    const reply = healthMenu(35, "F");
    const text = reply.messages[0].text;
    expect(reply.replies).toEqual(["Bronze", "Silver", "Gold"]);
    for (const [name, code] of [["Bronze", "BRONZE"], ["Silver", "SILVER"], ["Gold", "GOLD"]]) {
      expect(text).toContain(`${name} ${priceOf(code)}`);
    }
    expect(text).toContain("หญิง 35 ปี");
  });

  it("says what the total is made of, because the menu is a total", () => {
    expect(healthMenu(35, "F").messages[0].text).toContain("รวมสัญญาหลัก");
  });

  /**
   * The sentence used to name the sum itself, and went on naming 150,000 for months after the
   * opening moved to the 50,000-baht package — a customer who chose the package was told a
   * sum no price on the screen was quoted for. It is the priced arrangement's own sum now.
   */
  it("names the sum it actually priced, not a sum from an older opening", () => {
    const table = iHealthyTable();
    const text = healthMenu(35, "F").messages[0].text;
    const base = table.bases.find((b) => b.variant === IHEALTHY_OPENING.base)!;
    expect(text).toContain(`ทุน ${IHEALTHY_OPENING.sumAssured.toLocaleString("en-US")}`);
    expect(text).toContain(base.label);
    for (const stale of table.bases.filter((b) => b.variant !== IHEALTHY_OPENING.base)) {
      expect(text).not.toContain(`ทุน ${stale.saMin.toLocaleString("en-US")}`);
    }
  });

  it("sends the comparison table as a picture of the same three", () => {
    const card = healthMenu(35, "F").messages[0].card!;
    expect(card).toContain("/api/ihealthy-card/table?");
    expect(card).toContain("fit=phone");
    const asked = initialFrom(iHealthyTable(), Object.fromEntries(new URLSearchParams(card.split("?")[1])));
    expect(asked).toMatchObject({ age: 35, sex: "F" });
  });

  it("offers a child only the two plans a child may buy", () => {
    const reply = healthMenu(8, "M");
    expect(reply.replies).toEqual(["Smart", "Bronze"]);
    expect(reply.messages[0].text).toContain(`Smart ${priceOf("SMART", 8, "M")}`);
  });

  it("never carries a price, and never a picture, for an age off the table", () => {
    for (const age of [5, 81]) {
      const reply = healthMenu(age, "F");
      expect(reply.messages[0].card).toBeUndefined();
      expect(reply.messages[0].text).toContain("6-80");
    }
  });

  it("shows no price at all once the rate table has lapsed", () => {
    const reply = healthMenu(35, "F", new Date("2099-01-01"));
    expect(reply.messages[0].card).toBeUndefined();
    expect(reply.messages[0].text).toContain("หมดอายุ");
    expect(reply.messages[0].text).toContain("แอดมินเช็กให้");
  });
});

describe("the plans the menu did not offer", () => {
  it("names them with their prices and puts them on buttons", () => {
    const reply = otherPlansReply(35, "F");
    expect(reply.replies).toEqual(["Smart", "Diamond", "Platinum"]);
    expect(reply.messages[0].text).toContain(`Smart ${priceOf("SMART")}`);
  });

  it("says so plainly when an age has no others", () => {
    const reply = otherPlansReply(8, "M");
    expect(reply.replies).toEqual(["Smart", "Bronze"]);
    expect(reply.messages[0].text).toContain("อายุ 8");
  });
});
