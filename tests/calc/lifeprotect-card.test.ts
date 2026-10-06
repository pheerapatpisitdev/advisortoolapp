import { describe, expect, it } from "vitest";
import { formatBaht, formatSatang } from "@/calc/money";
import { cardInputFrom, cardPath, quoteCard, valueTableCard, type PlanCardInput } from "@/lib/quote-card";
import { valueTablePath } from "@/lib/card-link";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import {
  addModes, lifeProtectModes, medicalModes, pickedRider, riderModes, termAt, totalModes,
} from "@/lib/lifeprotect-quote";

/**
 * The Life Protect card pictures its sales page, riders and all (owner, 2026-10-06): the
 * figures here are worked out the way LifeProtectCalculator works them out, from the same
 * table, and the card must say the same.
 */

/** The rate table behind these figures lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-05");

const MAN35: PlanCardInput = {
  kind: "plan", planCode: "LIFEPROTECT", variant: "WLF99H", age: 35, sex: "M", sumAssured: 1_000_000,
};
const WITH_PB: PlanCardInput = { ...MAN35, riders: { waiver: { code: "PB", option: "FIT" } } };
const WITH_MEB: PlanCardInput = { ...MAN35, riders: { medical: 1000 } };
const CHILD10: PlanCardInput = {
  ...MAN35, age: 10, riders: { waiver: { code: "PB", option: "FIT" }, payer: { sex: "F", age: 38 } },
};

const query = (path: string) => new URLSearchParams(path.split("?")[1]);

/** What the page puts in the box for the same choices. */
function pagePaid(input: PlanCardInput) {
  const table = lifeProtectTable(WHILE_CURRENT);
  const term = termAt(table, input.variant);
  const who = { sex: input.sex, age: input.age, sumAssured: input.sumAssured };
  const base = lifeProtectModes(table, term, who)!;
  const annual = base.find((m) => m.mode === "annual")!.total;
  const picked = pickedRider(table, input.riders?.waiver);
  const rider = picked ? riderModes(table, term, who, picked, annual, input.riders?.payer) : undefined;
  const meb = input.riders?.medical !== undefined
    ? medicalModes(table, table.medical!, input.age, input.riders.medical) : undefined;
  return { base, rider, meb, paid: totalModes(table, base, addModes(rider, meb)) };
}

describe("a Life Protect card link", () => {
  it("carries the riders the page priced, and reads them back", () => {
    for (const input of [WITH_PB, WITH_MEB, CHILD10]) {
      const path = cardPath(input);
      expect(cardInputFrom(query(path))).toEqual(input);
      expect(cardInputFrom(query(valueTablePath(input)))).toEqual(input);
    }
    expect(cardPath(CHILD10)).toContain("sum=1000000&rider=PB.FIT&payer=F38&v=");
  });

  it("refuses riders on any other plan, and riders in a shape no link of ours has", () => {
    const easy = "plan=EASYPROTECT&variant=W99F06A&age=35&sex=M&sum=1000000";
    expect(cardInputFrom(new URLSearchParams(`${easy}&rider=PB.FIT`))).toBeUndefined();
    const lp = "plan=LIFEPROTECT&variant=WLF99H&age=35&sex=M&sum=1000000";
    expect(cardInputFrom(new URLSearchParams(`${lp}&rider=PB`))).toBeUndefined();
    expect(cardInputFrom(new URLSearchParams(`${lp}&payer=X40`))).toBeUndefined();
    expect(cardInputFrom(new URLSearchParams(`${lp}&meb=abc`))).toBeUndefined();
  });

  it("draws nothing for riders the page could not have priced", () => {
    // a child's พีบี is priced off a parent, and a parent is named only for a child's
    expect(quoteCard({ ...CHILD10, riders: { waiver: { code: "PB", option: "FIT" } } }, WHILE_CURRENT)).toBeUndefined();
    expect(quoteCard({ ...WITH_PB, riders: { ...WITH_PB.riders, payer: { sex: "M", age: 40 } } }, WHILE_CURRENT))
      .toBeUndefined();
    expect(quoteCard({ ...MAN35, riders: { waiver: { code: "PB", option: "NOPE" } } }, WHILE_CURRENT)).toBeUndefined();
    // พีบี is sold to an adult paying for themself from 20, and MEB up to 65
    expect(quoteCard({ ...WITH_PB, age: 17 }, WHILE_CURRENT)).toBeUndefined();
    expect(quoteCard({ ...WITH_MEB, age: 70 }, WHILE_CURRENT)).toBeUndefined();
    expect(quoteCard({ ...MAN35, riders: { medical: 1234 } }, WHILE_CURRENT)).toBeUndefined();
  });
});

describe("a Life Protect card", () => {
  it("puts the page's box under the price, with nothing but the plan", () => {
    const card = quoteCard(MAN35, WHILE_CURRENT)!;
    expect(card.premium).toEqual({ amount: "1,548", per: "ต่อเดือน" });
    expect(card.summary).toEqual({
      title: "เบี้ยประกันที่ต้องชำระ",
      rows: [
        { label: "รายปี", amount: "17,200", main: false },
        { label: "ราย 6 เดือน", amount: "8,944", main: false },
        { label: "รายเดือน", amount: "1,548", main: true, after: "ชำระเบี้ยครั้งแรก 2 งวด 3,096 บาท" },
      ],
    });
    expect(card.priceNote).toBeUndefined();
    expect(card.footNotes).toEqual(["เบี้ยคงที่ตลอดระยะเวลาชำระ · เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน"]);
  });

  it("headlines plan and waiver together, and splits them at the foot of the box", () => {
    const { base, rider, paid } = pagePaid(WITH_PB);
    const monthly = (m: typeof paid | undefined) => m!.find((x) => x.mode === "monthly")!.total;
    const card = quoteCard(WITH_PB, WHILE_CURRENT)!;
    expect(card.premium).toEqual({ amount: formatBaht(monthly(paid)), per: "ต่อเดือน" });
    expect(card.summary!.rows.map((r) => r.amount)).toEqual(
      [...paid].sort((a, b) => b.total - a.total).map((m) => formatBaht(m.total)),
    );
    expect(card.summary!.split).toEqual({
      title: "แยกตามสัญญา · รายเดือน",
      rows: [
        { label: "สัญญาหลัก", amount: formatSatang(monthly(base)) },
        { label: "สัญญาเพิ่มเติมพีบี ฟิต", amount: `+${formatSatang(monthly(rider))}` },
      ],
    });
    expect(card.priceNote).toBe("พีบีช่วยเรื่องการชำระเบี้ย ไม่ได้เพิ่มทุนที่ครอบครัวได้รับ");
  });

  it("names the parent a child's พีบี is priced off, and says why to start early", () => {
    const card = quoteCard(CHILD10, WHILE_CURRENT)!;
    expect(card.summary!.split!.rows[1].label).toBe("สัญญาเพิ่มเติมพีบี ฟิต (ผู้ชำระเบี้ยหญิง 38 ปี)");
    expect(card.footNotes![0]).toBe("✦ เบี้ยล็อกที่อายุ 10 ตลอดระยะเวลาชำระ ยิ่งเริ่มเร็วยิ่งถูก");
  });

  it("adds the medical plan, and says its premium is not level", () => {
    const { meb } = pagePaid(WITH_MEB);
    const card = quoteCard(WITH_MEB, WHILE_CURRENT)!;
    expect(card.summary!.split!.rows[1]).toEqual({
      label: "สัญญาเพิ่มเติมค่ารักษาพยาบาล (MEB) แผน 1,000",
      amount: `+${formatSatang(meb!.find((m) => m.mode === "monthly")!.total)}`,
    });
    expect(card.priceNote).toBeUndefined();
    expect(card.footNotes!.at(-1)).toContain("เบี้ย MEB ปรับตามอายุทุกปีที่ต่อสัญญา");
  });

  it("gives the value table the riders' column the page's table has", () => {
    const { rider } = pagePaid(WITH_PB);
    const table = valueTableCard(WITH_PB, WHILE_CURRENT)!;
    expect(table.columns).toEqual(["ปีที่", "อายุ", "เบี้ย/ปี", "สัญญาเพิ่มเติม", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"]);
    const riderAnnual = formatBaht(rider!.find((m) => m.mode === "annual")!.total);
    expect(table.rows[0].rider).toBe(riderAnnual);
    expect(table.premiumLine).toContain(`สัญญาเพิ่มเติมปีแรก ${riderAnnual} บาท`);
    // the plan alone keeps the plain table
    expect(valueTableCard(MAN35, WHILE_CURRENT)!.columns).not.toContain("สัญญาเพิ่มเติม");
  });

  it("shows no price once the rate table has lapsed, riders or not", () => {
    const card = quoteCard(WITH_PB, new Date("2027-04-01"))!;
    expect(card.premium).toBeNull();
    expect(card.summary).toBeNull();
    expect(card.priceNote).toBeUndefined();
  });
});
