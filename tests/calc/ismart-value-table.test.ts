import { describe, expect, it } from "vitest";
import { valueTableCard } from "@/lib/quote-card";
import { cashValueSchedule } from "@/calc/cash-value";
import { getPlan } from "@/calc/plans/registry";

/**
 * iSmart's year-by-year table, against the company's own sheet.
 *
 * The workbook was saved with a quotation still in it — หญิง อายุ 44, ทุน 1,000,000, เบี้ย
 * 287,000 — so its ตารางแสดงผลประโยชน์ holds figures computed by the company's own formulas
 * for a case anybody can check by opening the file. Those are the figures pinned here.
 *
 * Two of its columns are the reason this plan needed a table of its own shape. It hands money
 * back every year, which no other plan on the site does, and it covers twice the sum assured
 * rather than once — ตารางแสดงผลประโยชน์ H reads MAX(2 × ทุน, 101% × เบี้ยสะสม, มูลค่าเวนคืน).
 */

const CARD = { kind: "plan" as const, planCode: "ISMART", variant: "W80F06", age: 44, sex: "F" as const, sumAssured: 1_000_000 };

describe("the table iSmart is drawn as", () => {
  const card = valueTableCard(CARD)!;

  it("exists at all, now that the surrender table has been read in", () => {
    expect(card).toBeTruthy();
    expect(getPlan("ISMART")?.coverTopUp).toEqual({
      premiumPercent: 101, includeCashValue: true, sumAssuredMultiple: 2,
    });
  });

  it("has a column for the money handed back, which the other plans have no need of", () => {
    expect(card.columns).toEqual(["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "จ่ายคืน", "เวนคืนได้", "คุ้มครอง"]);
    // and the plans that pay nothing back keep the six they had
    const lifeProtect = valueTableCard({ ...CARD, planCode: "LIFEPROTECT", variant: "WLF99H", age: 35, sex: "M" })!;
    expect(lifeProtect.columns).toEqual(["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"]);
    expect(lifeProtect.rows[0].payout).toBeUndefined();
  });

  it("runs from the first year to age 80, which is where the cover ends", () => {
    expect(card.rows).toHaveLength(36);
    expect(card.rows[0]).toMatchObject({ year: 1, age: 44 });
    expect(card.rows[35]).toMatchObject({ year: 36, age: 79 });
  });

  it("pays the premium for six years and then stops", () => {
    expect(card.premiumLine).toBe("เบี้ย 287,000 บาทต่อปี · ชำระ 6 ปี");
    expect(card.rows.slice(0, 6).map((r) => r.due)).toEqual(Array(6).fill("287,000"));
    expect(card.rows[6].due).toBe("—");
    // the running total is shown for the paying years only (owner, 2026-10-09), then a dash
    expect(card.rows[5].paid).toBe("1,722,000");
    expect(card.rows[6].paid).toBeNull();
    expect(card.rows[35].paid).toBeNull();
  });

  it("hands back 1% of the sum for five years and 2% after that", () => {
    // ตารางแสดงผลประโยชน์ F, and data/rules/ismart.json survivalPayout
    expect(card.rows.slice(0, 5).map((r) => r.payout)).toEqual(Array(5).fill("10,000"));
    expect(card.rows.slice(5, 35).map((r) => r.payout)).toEqual(Array(30).fill("20,000"));
  });

  it("carries the whole contract in the last year's payout, the way the company's sheet does", () => {
    // its column is headed "เงินจ่ายคืน… และเงินครบกำหนดสัญญา", and 200% of the sum is what it holds
    expect(card.rows[35].payout).toBe("2,000,000");
    expect(card.rows[35].cash).toBe("2,000,000");
  });

  it("covers twice the sum assured, not once", () => {
    // ตารางแสดงผลประโยชน์ H. 101% of every premium paid is 1,739,220, so the 2× floor wins
    // in every year of this contract
    expect(new Set(card.rows.map((r) => r.cover))).toEqual(new Set(["2,000,000"]));
  });

  it("takes its surrender values from the company's own table", () => {
    const schedule = cashValueSchedule("ISMART", "W80F06", "F", 44, 1_000_000);
    expect(schedule).toHaveLength(36);
    expect(card.rows.map((r) => r.cash))
      .toEqual(schedule.map((s) => s.amount.toLocaleString("en-US")));
  });

  it("counts the money already handed back when it marks the break-even year", () => {
    /**
     * Surrender value alone first covers the premiums in year 26; by then 470,000 has been
     * paid back as well, and the true crossing is ten years earlier. Highlighting the later
     * year would tell the customer this plan is worse than it is, in the one figure they
     * look for.
     */
    const marked = card.rows.filter((r) => r.breakEven);
    expect(marked).toHaveLength(1);
    expect(marked[0]).toMatchObject({ year: 16, age: 59 });

    const surrenderOnly = card.rows.find((r) => Number((r.cash ?? "0").replace(/,/g, "")) >= 1_722_000)!;
    expect(surrenderOnly.year).toBeGreaterThan(marked[0].year);
  });
});
