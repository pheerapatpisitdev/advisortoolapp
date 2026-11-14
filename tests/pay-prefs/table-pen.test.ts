import { describe, expect, it } from "vitest";
import { canonicalCardUrl, PENSION_TABLE_KEYS, QUOTE_CARD_KEYS } from "@/app/api/card/canonical";
import { cardPath, pensionTablePath, valueTablePath } from "@/lib/card-link";
import { quoteVideoFacts, type VideoInput } from "@/lib/quote-video/script";
import { tableNotes } from "@/lib/quote-video/table-pen";

/**
 * แสดงคำอธิบายในตาราง (owner, 2026-11-14, ก ก): an agent who switched the pen notes off gets
 * tables without braces, words or pen rings — on the table picture, the pension picture and the
 * clip's table; everybody else's addresses and clips stay exactly as they were.
 */
const plan = { kind: "plan" as const, planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M" as const, sumAssured: 1_000_000 };
const day = new Date("2026-11-14T12:00:00+07:00");

describe("the table notes switch", () => {
  it("asks the value table for no notes with pen=0, and changes no address while they are on", () => {
    expect(valueTablePath(plan)).not.toContain("pen=");
    expect(valueTablePath({ ...plan, pen: true })).toBe(valueTablePath(plan));
    expect(valueTablePath({ ...plan, pen: false })).toContain("pen=0");
    // the quote card has no notes, so its address never carries the switch
    expect(cardPath({ ...plan, pen: false })).not.toContain("pen=");
  });

  it("asks the pension picture the same way", () => {
    const pension = { age: 40, sex: "M" as const, start: 60, pay: "6" as const, sumAssured: 1_000_000 };
    expect(pensionTablePath(pension)).not.toContain("pen=");
    expect(pensionTablePath({ ...pension, pen: false })).toContain("pen=0");
  });

  it("keeps pen=0 through the pictures' canonical check", () => {
    const table = new URL(valueTablePath({ ...plan, pen: false }), "https://www.advisortool.app");
    expect(canonicalCardUrl(table, QUOTE_CARD_KEYS)).toBeNull();
    const pension = new URL(pensionTablePath({ age: 40, sex: "M", start: 60, pay: "6", sumAssured: 1_000_000, pen: false }), "https://www.advisortool.app");
    expect(canonicalCardUrl(pension, PENSION_TABLE_KEYS)).toBeNull();
  });

  it("draws a clip's table without pen notes only when the agent switched them off", () => {
    const v: VideoInput = { product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 };
    const on = quoteVideoFacts(v, day)!;
    const off = quoteVideoFacts({ ...v, pen: false }, day)!;
    expect(on.pen).toBeUndefined();
    expect(tableNotes(on).length).toBeGreaterThan(0);
    expect(off.pen).toBe(false);
    expect(tableNotes(off)).toEqual([]);
    expect(quoteVideoFacts({ ...v, pen: true }, day)).toEqual(on);
  });
});
