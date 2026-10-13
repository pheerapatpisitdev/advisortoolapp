import { describe, expect, it } from "vitest";
import { quotePension } from "@/calc/pension/engine";
import { resolveBudget } from "@/lib/quote-video/budget";
import { checkedPension, pensionVideoFacts, roughBaht, type PensionVideoInput } from "@/lib/quote-video/pension";
import { pensionTablePlan } from "@/lib/quote-video/pension-table";
import { pageCaption, quoteVideoFacts, quoteVideoScript } from "@/lib/quote-video/script";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";

/** the /bumnan95 page's own example: a man of 40, 10,000 a month from 60, paying until then */
const PAGE: PensionVideoInput = { product: "PENSION", age: 40, sex: "M", annuityAge: 60, pay: "untilAnnuity", sumAssured: 0, monthly: 10_000 };

describe("บำนาญ 95 in วิดีโอนำเสนอ", () => {
  it("prices the monthly pension typed as the page does", () => {
    const c = checkedPension(PAGE);
    if (typeof c === "string") throw new Error(c);
    const page = quotePension({ age: 40, sex: "M", annuityAge: 60, pay: "untilAnnuity", mode: "annual", basis: "monthlyPension", amount: 10_000 });
    if (!page.ok) throw new Error(page.error);
    expect(c.sumAssured).toBe(page.quote.sumAssured);
    expect(c.monthly).toBeUndefined();
    const f = pensionVideoFacts(c)!;
    expect(f.lead).toMatchObject({ label: "บำนาญเดือนละ", amount: "10,000" });
    expect(f.prices.map((p) => p.label)).toEqual(["รายปี", "ราย 6 เดือน", "ราย 3 เดือน", "รายเดือน"]);
    expect(f.prices[0].amount).toBe(Math.floor(page.quote.annualPremium).toLocaleString("en-US"));
    expect(f.pension?.bands.map((b) => b.percent)).toEqual([15, 20, 25, 30]);
    expect(f.pension?.guaranteeTo).toBe(74);
    expect(f.coverStyle).toBe("steps");
  });

  it("refuses a pension age the person cannot choose, in words", () => {
    expect(checkedPension({ ...PAGE, age: 60, annuityAge: 55 })).toMatch(/เลือกรับบำนาญอายุ 55/);
    expect(checkedPension({ ...PAGE, monthly: 100 })).toMatch(/ต่ำกว่าขั้นต่ำ/);
  });

  it("speaks the total pension roughly, never against the premiums (owner 2026-10-13, 1ก)", () => {
    const c = checkedPension(PAGE) as PensionVideoInput;
    const f = quoteVideoFacts(c)!;
    const lines = quoteVideoScript(f, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "cover", "value", "contact"]);
    expect(lines[0].voice).toContain("รับบำนาญเดือนละ 10,000 บาท");
    expect(lines[3].voice).toContain("ประมาณ 6 ล้านบาท");
    expect(lines.join(" ")).not.toMatch(/คุ้มทุน|เบี้ยรวม/);
    expect(quoteVideoScript(f, "", "M")[0].voice).toContain("ครับ");
    expect(quoteVideoScript(f, "", "F", "short").map((l) => l.key)).toEqual(["lead", "price", "contact"]);
    expect(pageCaption(f)).toContain("บำนาญเดือนละ 10,000 บาท");
    expect(roughBaht(6_023_625)).toBe("6 ล้าน");
    expect(roughBaht(1_250_000)).toBe("1.3 ล้าน");
  });

  it("works the sum out of a budget with the engine", () => {
    const c = resolveBudget({ ...PAGE, sumAssured: 500_000, monthly: undefined }, { baht: 5_000, per: "month" });
    if (typeof c === "string") throw new Error(c);
    const f = quoteVideoFacts(c)!;
    expect(Number(f.budget?.amount.replace(/,/g, ""))).toBeLessThanOrEqual(5_000);
  });

  it("walks the classic table down to the pension, then to 95", () => {
    const f = quoteVideoFacts(checkedPension(PAGE) as PensionVideoInput)!;
    const value = quoteVideoScript(f, "").find((l) => l.key === "value")!;
    const { plan } = pensionTablePlan(f, value.voice, 12);
    expect(plan.moves).toHaveLength(2);
    expect(plan.moves[0].to).toBeLessThan(plan.moves[1].to);
    expect(plan.moves[1].at).toBeGreaterThan(plan.moves[0].at + plan.moves[0].dur);
  });

  it("opens the Studio form from the page's shortcut", () => {
    const href = videoStartHref({ product: "PENSION", sex: "F", age: 35, sumAssured: 787_402, annuityAge: 65, pay: "6" });
    const q = Object.fromEntries(new URL(href, "https://x").searchParams);
    expect(videoStartFrom(q)).toEqual({ product: "PENSION", sex: "F", age: 35, sumAssured: 787_402, annuityAge: 65, pay: "6" });
  });
});
