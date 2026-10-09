import { describe, expect, it } from "vitest";
import { valueTableCard, type PlanCardInput } from "@/lib/quote-card";
import { needsBraceRoom, penNotes, type PenGeometry } from "@/app/api/card/table/pen-notes";

const WHILE_CURRENT = new Date("2026-09-05");
const MAN35: PlanCardInput = { kind: "plan", planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 };
const GEO: PenGeometry = { widths: [124, 124, 281, 314, 314, 339], caption: 40, head: 44, row: 36, cellPad: 11 };

const notesFor = (input: PlanCardInput) => {
  const card = valueTableCard(input, WHILE_CURRENT)!;
  return { card, notes: penNotes(card, GEO) };
};
const texts = (input: PlanCardInput) => notesFor(input).notes.labels.map((l) => l.text);

describe("the red-pen notes on the value table (owner's markup, 2026-10-09)", () => {
  it("writes all four on a contract paid for 19 years", () => {
    const { notes } = notesFor(MAN35);
    expect(texts(MAN35)).toEqual(["เบี้ยคงที่", "หยุดส่งเบี้ย", "อนุมัติ คุ้มครองเลย"]);
    // the last paying year and the first year's cover are ringed
    expect(notes.rings).toEqual([{ row: 18, column: "ปีที่" }, { row: 0, column: "คุ้มครอง" }]);
    // brace, stop arrow (line + head), cover arrow (line + head), break-even arrow (line + head)
    expect(notes.strokes).toHaveLength(7);
  });

  it("has nothing to stop on a contract paid to the end", () => {
    const toEnd: PlanCardInput = { ...MAN35, variant: "WLF99H" };
    expect(texts(toEnd)).not.toContain("หยุดส่งเบี้ย");
    expect(notesFor(toEnd).notes.rings.some((r) => r.column === "ปีที่")).toBe(false);
  });

  it("draws no premium notes where no price may be shown", () => {
    const { card } = notesFor(MAN35);
    const unpriced = { ...card, rows: card.rows.map((r) => ({ ...r, due: "—", paid: null })) };
    const labels = penNotes(unpriced, GEO).labels.map((l) => l.text);
    expect(labels).toEqual(["อนุมัติ คุ้มครองเลย"]);
    expect(needsBraceRoom(unpriced)).toBe(false);
  });

  it("does not call a premium that moves คงที่", () => {
    const { card } = notesFor(MAN35);
    const moving = { ...card, rows: card.rows.map((r, i) => (i === 3 ? { ...r, due: "30,000" } : r)) };
    expect(penNotes(moving, GEO).labels.map((l) => l.text)).not.toContain("เบี้ยคงที่");
  });
});
