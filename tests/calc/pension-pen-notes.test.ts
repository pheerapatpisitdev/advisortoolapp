import { describe, it, expect } from "vitest";
import { quotePension, type PensionAge, type PensionPay } from "@/calc/pension/engine";
import type { PenGeometry } from "@/app/api/card/table/pen-notes";
import {
  PENSION_COLUMNS, pensionBraceRoom, pensionCells, pensionMarks, pensionPenNotes, pensionRings,
} from "@/lib/pension-pen-notes";

/** The page's example, or another, priced as the calculator prices it. */
function quote(age = 40, annuityAge: PensionAge = 60, pay: PensionPay = "untilAnnuity") {
  const r = quotePension({ age, sex: "M", annuityAge, pay, mode: "annual", basis: "monthlyPension", amount: 10_000 });
  if (!r.ok) throw new Error(r.error);
  return r.quote;
}

/** a desktop table, in picture units: wide enough columns, one row height */
const GEO: PenGeometry = { widths: [60, 60, 230, 130, 130, 150, 200, 150], caption: 0, head: 60, row: 52, cellPad: 8 };

const at = (rows: { age: number }[], age: number) => rows.findIndex((r) => r.age === age);
const words = (n: ReturnType<typeof pensionPenNotes>) => n.labels.map((l) => l.text);

describe("the pen notes on the บำนาญ 95 yearly table", () => {
  const q = quote();
  const rows = q.illustration;
  const m = pensionMarks(rows);

  it("finds the contract's milestones in the page's example", () => {
    expect(rows[m.lastPaid].age).toBe(59);
    expect(rows[m.start].age).toBe(60);
    expect(rows[m.guaranteeEnd].age).toBe(74);
    expect(m.steps.map((n) => rows[n].age)).toEqual([76, 81, 86]);
    // 2,874,011 received by 81 against 2,724,410 paid in
    expect(rows[m.breakEven].age).toBe(81);
    expect(rows[m.breakEven - 1].cumPension).toBeLessThan(q.totalPremium);
    expect(m.steady).toBe(true);
  });

  it("rings the last premium, the first pension, each step up and the break-even total", () => {
    expect(pensionRings(rows)).toEqual([
      { row: at(rows, 59), column: "เบี้ย" },
      { row: at(rows, 60), column: "บำนาญ" },
      { row: at(rows, 76), column: "บำนาญ" },
      { row: at(rows, 81), column: "บำนาญ" },
      { row: at(rows, 86), column: "บำนาญ" },
      { row: at(rows, 81), column: "บำนาญสะสม" },
    ]);
  });

  it("writes every note the owner approved", () => {
    const n = pensionPenNotes(rows, q.sumAssured, GEO);
    expect(words(n)).toEqual(expect.arrayContaining([
      "เบี้ย", "คงที่", "หยุดส่งเบี้ย", "เริ่มรับบำนาญ อายุ 60",
      "บำนาญเพิ่มเป็น 20% ของทุน", "บำนาญเพิ่มเป็น 25% ของทุน", "บำนาญเพิ่มเป็น 30% ของทุน",
      "จุดคุ้มทุน", "รับประกันจ่าย 15 ปีแรก", "(อายุ 60–74)",
    ]));
    expect(n.labels.find((l) => l.text === "จุดคุ้มทุน")?.mark).toBe(true);
  });

  it("writes the guarantee in blue, beside a blue brace over its fifteen years", () => {
    const n = pensionPenNotes(rows, q.sumAssured, GEO);
    const blue = n.labels.filter((l) => l.ink === "blue");
    expect(blue.map((l) => l.text)[0]).toBe("รับประกันจ่าย 15 ปีแรก");
    expect(n.blueStrokes.length).toBeGreaterThanOrEqual(1);
    // the words stay inside the guarantee's rows
    const first = GEO.head + at(rows, 60) * GEO.row;
    const last = GEO.head + (at(rows, 74) + 1) * GEO.row;
    for (const l of blue) {
      expect(l.top).toBeGreaterThanOrEqual(first);
      expect(l.top).toBeLessThan(last);
    }
  });

  it("never writes two notes into the same rows", () => {
    for (const [age, annuityAge, pay] of [[40, 60, "untilAnnuity"], [40, 60, "6"], [55, 70, "untilAnnuity"], [30, 55, "6"], [45, 65, "untilAnnuity"]] as const) {
      const p = quote(age, annuityAge, pay);
      const n = pensionPenNotes(p.illustration, p.sumAssured, GEO);
      // labels written from the left edge of the free cells, by row
      const left = n.labels.filter((l) => l.left !== undefined && l.left < GEO.widths[0] + GEO.widths[1] + 30);
      const tops = left.map((l) => Math.round(l.top));
      expect(new Set(tops).size, `${age}/${annuityAge}/${pay}`).toBe(tops.length);
      // and never over a figure in the premium or running-total columns
      for (const l of left) {
        const row = Math.floor((l.top + 18 - GEO.head) / GEO.row);
        const cells = pensionCells(p.illustration[row]);
        expect(cells["เบี้ย"] + cells["เบี้ยสะสม"], `${age}/${annuityAge}/${pay} ${l.text}`).toBe("");
      }
    }
  });

  it("keeps the premium brace on a six-year plan, and moves with the pension age", () => {
    const six = quote(40, 60, "6");
    expect(pensionBraceRoom(six.illustration)).toBe(true);
    const late = quote(55, 70);
    const lm = pensionMarks(late.illustration);
    expect(late.illustration[lm.start].age).toBe(70);
    expect(late.illustration[lm.guaranteeEnd].age).toBe(84);
    expect(words(pensionPenNotes(late.illustration, late.sumAssured, GEO))).toContain("เริ่มรับบำนาญ อายุ 70");
  });

  it("leaves a cell blank where the year has nothing in it", () => {
    const c = pensionCells(rows[at(rows, 90)]);
    expect(c["เบี้ย"]).toBe("");
    expect(c["คุ้มครองชีวิต"]).toBe("");
    expect(c["บำนาญ"]).toBe("236,221");
    expect(Object.keys(c)).toEqual([...PENSION_COLUMNS]);
  });
});
