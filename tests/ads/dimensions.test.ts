import { describe, expect, it } from "vitest";
import { ANGLE_BANK } from "@/lib/content/ads";
import type { Dimension, Dimensions } from "@/lib/ads/campaign-store";
import {
  FALLBACK_DIMENSIONS,
  cleanDimensions,
  nextVariants,
  orderedVariants,
  totalCombos,
  type Variant,
} from "@/lib/ads/dimensions";

/** Four ad dimensions and the queue that walks them without ever repeating a combination. */

const dims = (n: number, label: string): Dimension[] =>
  Array.from({ length: n }, (_, i) => ({ text: `${label}${i + 1}`, note: `${label} note ${i + 1}` }));

const make = (h: number, p: number, a: number, s: number): Dimensions => ({
  hooks: dims(h, "h"),
  personas: dims(p, "p"),
  angles: dims(a, "a"),
  styles: dims(s, "s"),
});

const KEYS = ["hook", "persona", "angle", "style"] as const;
const differing = (x: Variant, y: Variant) => KEYS.filter((k) => x[k] !== y[k]).length;

describe("totalCombos", () => {
  it("multiplies the four dimensions", () => {
    expect(totalCombos(make(10, 4, 4, 4))).toBe(640);
    expect(totalCombos(make(1, 1, 1, 1))).toBe(1);
  });
});

describe("orderedVariants", () => {
  it("lists every combination exactly once", () => {
    const d = make(10, 4, 4, 4);
    const v = orderedVariants(d);
    expect(v).toHaveLength(640);
    expect(new Set(v.map((x) => x.combo)).size).toBe(640);
  });

  it("keys a variant by its four texts", () => {
    const v = orderedVariants(make(2, 1, 1, 1))[0];
    expect(v.combo).toBe(`${v.hook}|${v.persona}|${v.angle}|${v.style}`);
  });

  it("carries the text of each dimension", () => {
    const d = make(2, 2, 2, 2);
    for (const v of orderedVariants(d)) {
      expect(d.hooks.map((x) => x.text)).toContain(v.hook);
      expect(d.styles.map((x) => x.text)).toContain(v.style);
    }
  });

  it("puts pieces that differ in at least two dimensions next to each other, early on", () => {
    const v = orderedVariants(make(3, 3, 3, 3));
    for (let i = 1; i < 9; i++) expect(differing(v[i - 1], v[i])).toBeGreaterThanOrEqual(2);
  });

  it("uses every hook before any hook comes twice", () => {
    const v = orderedVariants(make(5, 3, 3, 3));
    expect(new Set(v.slice(0, 5).map((x) => x.hook)).size).toBe(5);
  });

  it("is the same order every time for the same input", () => {
    const d = make(8, 3, 4, 3);
    expect(orderedVariants(d).map((x) => x.combo)).toEqual(orderedVariants(make(8, 3, 4, 3)).map((x) => x.combo));
  });

  it("copes with a single option in every dimension, and with one dimension of one", () => {
    expect(orderedVariants(make(1, 1, 1, 1))).toHaveLength(1);
    expect(orderedVariants(make(4, 1, 1, 1))).toHaveLength(4);
  });
});

describe("nextVariants", () => {
  it("takes the first n of the order when nothing is made", () => {
    const d = make(3, 3, 3, 3);
    const all = orderedVariants(d).map((x) => x.combo);
    for (const n of [1, 2, 4] as const) expect(nextVariants(d, new Set(), n).map((x) => x.combo)).toEqual(all.slice(0, n));
  });

  it("skips what is already made", () => {
    const d = make(3, 3, 3, 3);
    const all = orderedVariants(d);
    const made = new Set([all[0].combo, all[1].combo]);
    expect(nextVariants(d, made, 2).map((x) => x.combo)).toEqual([all[2].combo, all[3].combo]);
  });

  it("gives fewer than n when nearly out, and nothing once all are made", () => {
    const d = make(2, 1, 1, 1);
    const all = orderedVariants(d);
    expect(nextVariants(d, new Set([all[0].combo]), 4)).toHaveLength(1);
    expect(nextVariants(d, new Set(all.map((x) => x.combo)), 1)).toEqual([]);
  });

  it("never gives a made combination after the dimensions change, and offers the new hook", () => {
    const before = make(3, 2, 2, 2);
    const made = new Set(orderedVariants(before).slice(0, 7).map((x) => x.combo));
    const after: Dimensions = { ...before, hooks: [...before.hooks, { text: "new hook", note: "" }] };
    const got = nextVariants(after, made, 4);
    expect(got).toHaveLength(4);
    for (const v of got) expect(made.has(v.combo)).toBe(false);
    // Walk the whole queue: the new hook's combinations are all still reachable.
    const rest = [...made];
    let guard = 0;
    for (let g = nextVariants(after, new Set(rest), 4); g.length && guard < 100; g = nextVariants(after, new Set(rest), 4), guard++) {
      for (const v of g) {
        expect(rest).not.toContain(v.combo);
        rest.push(v.combo);
      }
    }
    expect(rest).toHaveLength(totalCombos(after));
    expect(rest.some((c) => c.startsWith("new hook|"))).toBe(true);
  });

  it("is not thrown by a dimension reordered since", () => {
    const d = make(3, 2, 2, 2);
    const made = new Set(orderedVariants(d).slice(0, 5).map((x) => x.combo));
    const reordered: Dimensions = { ...d, hooks: [...d.hooks].reverse() };
    for (const v of nextVariants(reordered, made, 4)) expect(made.has(v.combo)).toBe(false);
  });
});

describe("cleanDimensions", () => {
  const ok = { hooks: [{ text: "a", note: "n" }], personas: [{ text: "b", note: "" }], angles: [{ text: "c", note: "" }], styles: [{ text: "d", note: "" }] };

  it("trims text and note", () => {
    const c = cleanDimensions({ ...ok, hooks: [{ text: "  ฮุก  ", note: "  โน้ต " }] });
    expect(c?.hooks).toEqual([{ text: "ฮุก", note: "โน้ต" }]);
  });

  it("drops repeats within a dimension, keeping the first", () => {
    const c = cleanDimensions({ ...ok, hooks: [{ text: "x", note: "1" }, { text: " x ", note: "2" }, { text: "y", note: "" }] });
    expect(c?.hooks).toEqual([{ text: "x", note: "1" }, { text: "y", note: "" }]);
  });

  it("cuts text to 80 and note to 120", () => {
    const c = cleanDimensions({ ...ok, hooks: [{ text: "ก".repeat(100), note: "ข".repeat(200) }] });
    expect(c?.hooks[0].text).toHaveLength(80);
    expect(c?.hooks[0].note).toHaveLength(120);
  });

  it("keeps at most 12 hooks and 5 of the rest", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ text: `t${i}`, note: "" }));
    const c = cleanDimensions({ hooks: many(20), personas: many(9), angles: many(9), styles: many(9) });
    expect(c?.hooks).toHaveLength(12);
    expect(c?.personas).toHaveLength(5);
    expect(c?.angles).toHaveLength(5);
    expect(c?.styles).toHaveLength(5);
  });

  it("drops entries that are not text, and gives null when any dimension ends up empty", () => {
    expect(cleanDimensions({ ...ok, personas: [] })).toBeNull();
    expect(cleanDimensions({ ...ok, angles: [{ text: "   ", note: "" }] })).toBeNull();
    expect(cleanDimensions({ ...ok, styles: [null, 3, {}] })).toBeNull();
    expect(cleanDimensions({ hooks: ok.hooks })).toBeNull();
    expect(cleanDimensions(null)).toBeNull();
    expect(cleanDimensions("x")).toBeNull();
  });

  it("turns a | in a text into ' / ', so two combinations can never share a key", () => {
    const c = cleanDimensions({ ...ok, hooks: [{ text: "a|b", note: "" }, { text: "a | c|", note: "" }], personas: [{ text: "x", note: "" }] });
    expect(c?.hooks.map((h) => h.text)).toEqual(["a / b", "a / c /"]);
    // "a|b" + "c" against "a" + "b|c" used to give the same key "a|b|c|…"
    const clash = cleanDimensions({ hooks: [{ text: "a|b" }, { text: "a" }], personas: [{ text: "c" }, { text: "b|c" }], angles: [{ text: "d" }], styles: [{ text: "e" }] })!;
    const combos = orderedVariants(clash).map((v) => v.combo);
    expect(new Set(combos).size).toBe(combos.length);
  });

  it("treats a missing note as empty", () => {
    expect(cleanDimensions({ ...ok, hooks: [{ text: "h" }] })?.hooks).toEqual([{ text: "h", note: "" }]);
  });
});

describe("FALLBACK_DIMENSIONS", () => {
  const f = FALLBACK_DIMENSIONS("iHealthy Ultra");

  it("has 8 hooks, 3 personas, the first 4 angles of the bank, and 3 styles", () => {
    expect(f.hooks).toHaveLength(8);
    expect(f.personas.map((p) => p.text)).toEqual(["พ่อแม่มือใหม่", "คนทำงานอายุ 30", "คนใกล้เกษียณ"]);
    expect(f.angles.map((a) => a.text)).toEqual(ANGLE_BANK.slice(0, 4).map((a) => a.label));
    expect(f.styles.map((s) => s.text)).toEqual(["ภาพถ่ายครอบครัว", "ตัวเลขเด่นบนพื้นสี", "Before & After"]);
  });

  it("survives its own cleaning unchanged", () => {
    expect(cleanDimensions(f)).toEqual(f);
  });

  it("names the product in at least one hook", () => {
    expect(f.hooks.some((h) => h.text.includes("iHealthy Ultra") || h.note.includes("iHealthy Ultra"))).toBe(true);
  });
});
