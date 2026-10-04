import { describe, expect, it } from "vitest";
import {
  addRow, canTick, comboLine, editRow, fromEdit, sameDimensions, shortOf, styleRequest, toEdit,
} from "@/lib/ads/dimension-edit";
import { cleanDimensions } from "@/lib/ads/dimensions";
import type { Dimensions } from "@/lib/ads/campaign-store";

const one = (t: string) => ({ text: t, note: `${t} note` });
const dims = (over: Partial<Dimensions> = {}): Dimensions => ({
  hooks: [one("h1"), one("h2")], personas: [one("p1")], angles: [one("a1"), one("a2")], styles: [one("s1")], ...over,
});

describe("editing the four dimensions", () => {
  it("reads back what was saved, unchanged", () => {
    expect(fromEdit(toEdit(dims()))).toEqual(dims());
    expect(sameDimensions(fromEdit(toEdit(dims())), dims())).toBe(true);
  });

  it("leaves out a row ticked off, and keeps it on screen to tick back", () => {
    const e = editRow(toEdit(dims()), "hooks", 0, { on: false });
    expect(fromEdit(e).hooks).toEqual([one("h2")]);
    expect(e.hooks).toHaveLength(2);
    expect(fromEdit(editRow(e, "hooks", 0, { on: true })).hooks).toEqual([one("h1"), one("h2")]);
  });

  it("cleans as the server does: trimmed, blank and repeated rows dropped, cut to length", () => {
    let e = toEdit(dims());
    e = editRow(e, "hooks", 1, { text: "  h1  " });
    e = addRow(e, "personas");
    e = editRow(e, "personas", e.personas[1].id, { text: "ก".repeat(90), note: " x " });
    e = addRow(e, "angles");
    const got = fromEdit(e);
    expect(got.hooks).toEqual([one("h1")]);
    expect(got.personas[1]).toEqual({ text: "ก".repeat(80), note: "x" });
    expect(got.angles).toHaveLength(2);
    // the page's reading and the server's agree, so the count shown is the count kept
    expect(cleanDimensions({
      hooks: e.hooks.filter((r) => r.on), personas: e.personas.filter((r) => r.on),
      angles: e.angles.filter((r) => r.on), styles: e.styles.filter((r) => r.on),
    })).toEqual(got);
  });

  it("names a dimension left with nothing ticked", () => {
    expect(shortOf(toEdit(dims()))).toEqual([]);
    const e = editRow(toEdit(dims()), "styles", toEdit(dims()).styles[0].id, { on: false });
    expect(shortOf(e)).toEqual(["styles"]);
    expect(shortOf(editRow(toEdit(dims()), "personas", 2, { text: "   " }))).toEqual(["personas"]);
  });

  it("stops ticking at twelve hooks and five of the others", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => one(`x${i}`));
    const e = toEdit(dims({ hooks: many(12), styles: many(5) }));
    expect(canTick(e, "hooks")).toBe(false);
    expect(canTick(e, "styles")).toBe(false);
    expect(canTick(e, "personas")).toBe(true);
    const added = addRow(e, "styles");
    expect(added.styles.at(-1)).toMatchObject({ text: "", on: false });
    expect(addRow(e, "personas").personas.at(-1)).toMatchObject({ text: "", on: true });
  });

  it("gives every new row its own id", () => {
    const e = addRow(addRow(toEdit(dims()), "hooks"), "styles");
    const ids = [...e.hooks, ...e.personas, ...e.angles, ...e.styles].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("says the number of designs as the product of the four", () => {
    expect(comboLine(dims())).toBe("2 × 1 × 2 × 1 = 4 แบบ");
    const many = (n: number) => Array.from({ length: n }, (_, i) => one(`x${i}`));
    expect(comboLine({ hooks: many(10), personas: many(4), angles: many(4), styles: many(4) })).toBe("10 × 4 × 4 × 4 = 640 แบบ");
  });

  it("tells changed dimensions from the saved ones", () => {
    expect(sameDimensions(dims(), null)).toBe(false);
    expect(sameDimensions(dims({ styles: [{ text: "s1", note: "other" }] }), dims())).toBe(false);
    expect(sameDimensions(dims({ angles: [one("a2"), one("a1")] }), dims())).toBe(false);
  });
});

describe("the picture request for a style", () => {
  it("is the style and its note", () => {
    expect(styleRequest(dims(), "s1")).toBe("s1 — s1 note");
  });
  it("is the style alone when it has no note, was edited away, or there are no dimensions", () => {
    expect(styleRequest(dims({ styles: [{ text: "s1", note: "" }] }), "s1")).toBe("s1");
    expect(styleRequest(dims(), "gone")).toBe("gone");
    expect(styleRequest(null, "s1")).toBe("s1");
  });
});
