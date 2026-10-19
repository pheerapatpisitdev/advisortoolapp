import { describe, expect, it } from "vitest";
import { barPens, GS_TABLE_COLUMNS as C, tablePens, type Box, type TableMeasure } from "@/lib/global-saving-pens";

/** a made-up yearly table: 100px columns, a 60px heading, 30px rows, figures 50px wide at the right of their cells */
const ROW = 30, HEAD = 60, COL = 100;
const cell = (y: number, c: number): Box => ({ x: c * COL, y: HEAD + (y - 1) * ROW, w: COL, h: ROW });
const blank = (y: number, c: number) =>
  (c === C.premium && y > 8) || (c === C.paid && y > 8) || (c === C.tax && y > 8)
  || (c >= C.bonusFirst && c <= C.bonusLast && y !== 10 && y !== 15)
  // the −1% scenario pays no bonus: a dash, which the page does not mark
  || (c === C.bonusFirst && (y === 10 || y === 15));
const measure: TableMeasure = {
  cell,
  text: (y, c) => (blank(y, c) ? null : { x: c * COL + COL - 58, y: HEAD + (y - 1) * ROW + 6, w: 50, h: 18 }),
};
const facts = { premYears: 8, term: 15, payback: 501, maturity: 400_909, bonusYears: [10, 15] };

describe("the yearly table's pen notes", () => {
  const d = tablePens(measure, facts);

  it("draws in both inks, with nothing out of reach", () => {
    expect(d.strokes.some((s) => s.ink === "red")).toBe(true);
    expect(d.strokes.some((s) => s.ink === "blue")).toBe(true);
    for (const s of d.strokes) expect(s.d).not.toMatch(/NaN|Infinity/);
  });

  it("says the three guaranteed and paid facts, and what each bonus is", () => {
    const text = d.labels.map((l) => l.lines.join(" "));
    expect(text.join("\n")).toContain("จ่ายแค่ 8 ปี");
    expect(text.join("\n")).toContain("ปีละ 501 บาท (การันตี)");
    expect(text.join("\n")).toContain("400,909 บาท (การันตี)");
    expect(text.join("\n")).toContain("สิ้นปีที่ 10");
    expect(text.join("\n")).toContain("ตอนครบสัญญา");
    expect(d.labels.filter((l) => l.ink === "blue")).toHaveLength(2);
  });

  it("writes only into cells the table leaves empty", () => {
    for (const l of d.labels) {
      const c = Math.floor(l.x / COL), y = Math.floor((l.y - HEAD) / ROW) + 1;
      expect(blank(y, c) || blank(y + 1, c), `${l.lines[0]} at year ${y}, column ${c}`).toBe(true);
    }
  });

  it("underlines the bonuses from the first real figure, not the dash", () => {
    const unders = d.strokes.filter((s) => s.ink === "red" && s.width === 1.8);
    expect(unders).toHaveLength(2);
    const startX = Number(unders[0].d.match(/^M([\d.]+)/)![1]);
    expect(startX).toBeGreaterThan((C.bonusFirst + 1) * COL);
  });
});

describe("the bar chart's pen notes", () => {
  const bars = [0, 1, 2, 3, 4].map((i) => ({ x: i * 110, y: 120, w: 100, h: 100 }));
  it("runs the blue line across every bar at the guaranteed level, and rings the top bonus in red", () => {
    const d = barPens({ guaranteed: bars, totals: bars.map((b) => ({ x: b.x + 25, y: 96, w: 50, h: 20 })), topBonus: { x: 440, y: 20, w: 100, h: 100 } }, 407_916);
    expect(d.strokes[0]).toMatchObject({ ink: "blue" });
    expect(d.strokes[0].d).toMatch(/^M2\.0 120\.0 L538\.0 121\.0$/);
    expect(d.labels.map((l) => l.lines.join(" "))).toEqual(["การันตี 407,916 เท่ากันทุกกรณี", "ส่วนสีฟ้าบนแท่ง = โบนัสดัชนี (ไม่การันตี)"]);
  });

  it("lifts the words above the second bar's figure and splits the red note on a phone", () => {
    const thin = [0, 1, 2, 3, 4].map((i) => ({ x: i * 70, y: 120, w: 64, h: 100 }));
    const d = barPens({ guaranteed: thin, totals: [{ x: 10, y: 96, w: 50, h: 20 }, { x: 80, y: 70, w: 50, h: 20 }], topBonus: { x: 280, y: 60, w: 64, h: 60 } }, 407_916);
    expect(d.labels[0].y).toBe(24);
    expect(d.labels[1].lines).toHaveLength(2);
  });

  it("leaves the red note off when no scenario pays a bonus", () => {
    const d = barPens({ guaranteed: bars, totals: bars.map((b) => ({ x: b.x + 25, y: 96, w: 50, h: 20 })), topBonus: null }, 407_916);
    expect(d.strokes.every((s) => s.ink === "blue")).toBe(true);
  });
});
