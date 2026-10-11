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
// the red pen's words; the blue note is tested on its own below
const texts = (input: PlanCardInput) => notesFor(input).notes.labels.filter((l) => !l.ink).map((l) => l.text);

describe("the red-pen notes on the value table (owner's markup, 2026-10-09)", () => {
  it("writes all five on a contract paid for 19 years", () => {
    const { notes } = notesFor(MAN35);
    // the last three are one note, written a line at a time beside the years after break-even (2026-10-10)
    expect(texts(MAN35)).toEqual(["เบี้ยคงที่", "หยุดส่งเบี้ย", "อนุมัติ คุ้มครองเลย", "เบี้ยไม่ทิ้งเปล่า", "สามารถเก็บเป็นเงินสด", "หลังเกษียณได้"]);
    // the last paying year and the first year's cover are ringed
    expect(notes.rings).toEqual([{ row: 18, column: "ปีที่" }, { row: 0, column: "คุ้มครอง" }]);
    // brace, stop arrow (line + head), cover arrow (line + head), break-even arrow (line + head),
    // and the brace down the years after break-even
    expect(notes.strokes).toHaveLength(8);
  });

  it("has nothing to stop on a contract paid to the end", () => {
    const toEnd: PlanCardInput = { ...MAN35, variant: "WLF99H" };
    expect(texts(toEnd)).not.toContain("หยุดส่งเบี้ย");
    expect(notesFor(toEnd).notes.rings.some((r) => r.column === "ปีที่")).toBe(false);
  });

  it("draws no premium notes where no price may be shown", () => {
    const { card } = notesFor(MAN35);
    const unpriced = { ...card, rows: card.rows.map((r) => ({ ...r, due: "—", paid: null })) };
    const labels = penNotes(unpriced, GEO).labels.filter((l) => !l.ink).map((l) => l.text);
    // the note after break-even is about the surrender values, which are still shown
    expect(labels).toEqual(["อนุมัติ คุ้มครองเลย", "เบี้ยไม่ทิ้งเปล่า", "สามารถเก็บเป็นเงินสด", "หลังเกษียณได้"]);
    expect(needsBraceRoom(unpriced)).toBe(false);
  });

  it("does not call a premium that moves คงที่", () => {
    const { card } = notesFor(MAN35);
    const moving = { ...card, rows: card.rows.map((r, i) => (i === 3 ? { ...r, due: "30,000" } : r)) };
    expect(penNotes(moving, GEO).labels.map((l) => l.text)).not.toContain("เบี้ยคงที่");
  });
});

/** The blue pen down the surrender values before break-even (owner's sketch, 2026-10-11). */
describe("the blue note: เงินโตทุกปี เวนคืน เมื่อฉุกเฉิน", () => {
  it("braces the years before break-even in blue, the words beside it in blue", () => {
    const { card, notes } = notesFor(MAN35);
    const be = card.rows.findIndex((r) => r.breakEven);
    expect(be).toBeGreaterThan(4);
    expect(notes.blueStrokes).toHaveLength(1);
    const blue = notes.labels.filter((l) => l.ink === "blue").map((l) => l.text);
    expect(blue).toEqual(["เงินโตทุกปี", "เวนคืน", "เมื่อฉุกเฉิน"]);
    // the brace ends above the break-even row
    const ys = [...notes.blueStrokes[0].matchAll(/[\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBeLessThan(GEO.caption + GEO.head + be * GEO.row);
  });

  it("keeps the words inside the surrender column, clear of the running total", () => {
    const { notes } = notesFor(MAN35);
    const total = GEO.widths.reduce((s, w) => s + w, 0);
    const cashLeft = GEO.widths.slice(0, 4).reduce((s, w) => s + w, 0);
    for (const l of notes.labels.filter((x) => x.ink === "blue")) {
      const right = total - l.right!;
      expect(right).toBeGreaterThan(cashLeft);
      expect(right).toBeLessThan(total - GEO.widths[5]);
    }
  });

  it("on a narrow column, writes the words where the running total has stopped", () => {
    const { card } = notesFor(MAN35);
    const narrow: PenGeometry = { ...GEO, widths: [124, 124, 281, 314, 190, 339] };
    const notes = penNotes(card, narrow);
    const stopped = card.rows.findIndex((r) => r.paid === null);
    for (const l of notes.labels.filter((x) => x.ink === "blue")) {
      expect(l.top).toBeGreaterThanOrEqual(narrow.caption + narrow.head + stopped * narrow.row);
    }
    expect(notes.labels.filter((x) => x.ink === "blue")).toHaveLength(3);
  });

  it("is not drawn when break-even comes within four years", () => {
    const { card } = notesFor(MAN35);
    const early = { ...card, rows: card.rows.map((r, i) => ({ ...r, breakEven: i === 2 })) };
    const notes = penNotes(early, GEO);
    expect(notes.blueStrokes).toHaveLength(0);
    expect(notes.labels.some((l) => l.ink === "blue")).toBe(false);
  });
});
