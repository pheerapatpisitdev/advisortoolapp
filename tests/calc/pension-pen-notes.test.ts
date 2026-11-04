import { describe, it, expect } from "vitest";
import { quotePension, type PensionAge, type PensionPay } from "@/calc/pension/engine";
import type { PenGeometry } from "@/app/api/card/table/pen-notes";
import {
  PENSION_COLUMNS, pensionBraceRoom, pensionCells, pensionLumpRing, pensionMarks, pensionPenNotes, pensionRings,
} from "@/lib/pension-pen-notes";
import { PENSION_AGES, availablePensionAges } from "@/calc/pension/engine";

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

  it("rings the last paying year, the first pension and each step up", () => {
    expect(pensionRings(rows)).toEqual([
      { row: at(rows, 59), column: "ปีที่" },
      { row: at(rows, 60), column: "บำนาญ" },
      { row: at(rows, 76), column: "บำนาญ" },
      { row: at(rows, 81), column: "บำนาญ" },
      { row: at(rows, 86), column: "บำนาญ" },
    ]);
  });

  it("writes every note the owner approved", () => {
    const n = pensionPenNotes(rows, q.sumAssured, GEO);
    expect(words(n)).toEqual(expect.arrayContaining([
      "เบี้ย", "คงที่", "หยุดส่งเบี้ย", "เริ่มรับบำนาญ อายุ 60",
      "บำนาญเพิ่มเป็น 20% ของทุน", "บำนาญเพิ่มเป็น 25% ของทุน", "บำนาญเพิ่มเป็น 30% ของทุน",
      "รับประกันจ่าย 15 ปีแรก", "(อายุ 60–74)",
    ]));
  });

  it("draws no จุดคุ้มทุน: the owner took it off this plan (2026-10-11)", () => {
    const n = pensionPenNotes(rows, q.sumAssured, GEO);
    expect(words(n).some((w) => /คุ้มทุน|เกินเบี้ย/.test(w))).toBe(false);
    expect(pensionRings(rows).some((r) => r.column === "บำนาญสะสม")).toBe(false);
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

describe("the green notes on the บำนาญ 95 yearly table (owner chose ก, 2026-11-04)", () => {
  /** the picture's own table: the example the owner sent, a man of 44 paying 200,000 for six years */
  const WIDE: PenGeometry & { bubbles: true } = {
    widths: [90, 90, 230, 200, 200, 210, 230, 246], caption: 40, head: 50, row: 36, cellPad: 11, bubbles: true,
  };
  const sent = quotePension({ age: 44, sex: "M", annuityAge: 60, pay: "6", mode: "annual", basis: "premium", amount: 200_000 });
  if (!sent.ok) throw new Error(sent.error);
  const q = sent.quote;
  const text = (b: NonNullable<ReturnType<typeof pensionPenNotes>["bubbles"]>[number]) =>
    b.lines.map((l) => `${l.text}${l.under ?? ""}${l.tail ?? ""}`);

  it("says what each age band pays, to the baht of the owner's picture", () => {
    const green = pensionPenNotes(q.illustration, q.sumAssured, WIDE).bubbles!.filter((b) => b.tone === "green");
    expect(green.map(text)).toEqual([
      ["รับบำนาญอายุ 60-75 ปี", "ปีละ 48,884 บาท", "รวม 782,144 บาท"],
      ["รับบำนาญตั้งแต่อายุ 76-80 ปี", "ปีละ 65,179 บาท", "รวม 325,895 บาท"],
      ["รับบำนาญตั้งแต่อายุ 81-85 ปี", "ปีละ 81,473 บาท", "รวม 407,365 บาท"],
      ["รับบำนาญตั้งแต่อายุ 86-95 ปี", "ปีละ 97,768 บาท", "รวม 977,680 บาท"],
    ]);
  });

  it("points the lump sum at the surrender value of the year before the pension", () => {
    const n = pensionPenNotes(q.illustration, q.sumAssured, WIDE);
    expect(n.bubbles!.filter((b) => b.tone === "lime").map(text)).toEqual([
      ["เลือกรับเป็นเงินก้อน", "ตอนอายุ 59", "1,262,184 บาท"],
    ]);
    const ring = pensionLumpRing(q.illustration);
    expect(ring).toEqual({ row: at(q.illustration, 59), column: "มูลค่าเวนคืน" });
    expect(n.rings).toContainEqual({ ...ring, dark: true });
    expect(n.darkStrokes!.length).toBeGreaterThanOrEqual(1);
  });

  it("takes the place of the guarantee's words and the step-up words, and keeps every arrow and ring", () => {
    const plain = pensionPenNotes(q.illustration, q.sumAssured, { ...WIDE, bubbles: false });
    const n = pensionPenNotes(q.illustration, q.sumAssured, WIDE);
    expect(words(n).some((w) => /รับประกันจ่าย|บำนาญเพิ่มเป็น/.test(w))).toBe(false);
    expect(words(n)).toContain("เริ่มรับบำนาญ อายุ 60");
    expect(n.strokes.length).toBe(plain.strokes.length);
    expect(n.blueStrokes.length).toBe(plain.blueStrokes.length);
    expect(n.rings.filter((r) => !r.dark)).toEqual(plain.rings);
  });

  it("leaves the clip's table alone: a table that does not ask for them gets none", () => {
    const n = pensionPenNotes(q.illustration, q.sumAssured, GEO);
    expect(n.bubbles).toBeUndefined();
    expect(n.rings.some((r) => r.dark)).toBe(false);
    expect(words(n)).toContain("บำนาญเพิ่มเป็น 20% ของทุน");
  });

  it("never lets a note run into a figure or another note, for any age, pension age or way of paying", () => {
    for (const pay of ["6", "untilAnnuity"] as const) {
      for (let age = 20; age <= 65; age++) {
        for (const start of availablePensionAges(age, pay)) {
          expect(PENSION_AGES).toContain(start);
          const r = quotePension({ age, sex: "F", annuityAge: start, pay, mode: "annual", basis: "sumAssured", amount: 1_000_000 });
          if (!r.ok) continue;
          const rows = r.quote.illustration;
          for (const geo of [WIDE, { ...GEO, bubbles: true as const }]) {
            const notes = pensionPenNotes(rows, r.quote.sumAssured, geo);
            const all = notes.bubbles!;
            const edge = (i: number) => geo.widths.slice(0, i).reduce((s, w) => s + w, 0);
            const rowOf = (y: number) => Math.floor((y - geo.caption - geo.head) / geo.row);
            // four green ones, and the size stays readable
            expect(all.filter((b) => b.tone === "green")).toHaveLength(4);
            for (const b of all) {
              expect(b.size, `${age}/${start}/${pay}`).toBeGreaterThanOrEqual(20);
              for (const o of all) {
                if (o === b) continue;
                const apart = b.left + b.width <= o.left || o.left + o.width <= b.left
                  || b.top + b.height <= o.top || o.top + o.height <= b.top;
                expect(apart, `${age}/${start}/${pay}`).toBe(true);
              }
              if (b.tone === "green") {
                expect(b.left + b.width).toBeLessThanOrEqual(edge(PENSION_COLUMNS.indexOf("บำนาญ")));
                expect(rows[rowOf(b.top + 6)].pension).toBeGreaterThan(0);
              } else {
                expect(b.left).toBeGreaterThanOrEqual(edge(PENSION_COLUMNS.indexOf("บำนาญ")));
                expect(rows[rowOf(b.top + b.height - 1)].pension).toBe(0);
              }
            }
            // no green note over a pen word
            for (const l of notes.labels) {
              if (l.left === undefined) continue;
              for (const b of all) {
                const over = l.top < b.top + b.height && l.top + 24 * 1.5 > b.top && l.left < b.left + b.width && b.left < l.left + 200;
                expect(over, `${age}/${start}/${pay}: ${l.text}`).toBe(false);
              }
            }
          }
        }
      }
    }
  });

  it("leaves the lump sum off a table with fewer than four rows before the pension", () => {
    for (const pay of ["6", "untilAnnuity"] as const) {
      for (let age = 20; age <= 65; age++) {
        for (const start of availablePensionAges(age, pay)) {
          const r = quotePension({ age, sex: "M", annuityAge: start, pay, mode: "annual", basis: "sumAssured", amount: 1_000_000 });
          if (!r.ok) continue;
          const lime = pensionPenNotes(r.quote.illustration, r.quote.sumAssured, WIDE).bubbles!.filter((b) => b.tone === "lime");
          expect(lime.length, `${age}/${start}/${pay}`).toBe(start - age >= 4 ? 1 : 0);
        }
      }
    }
  });
});
