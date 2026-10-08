import { describe, expect, it } from "vitest";
import { MAX_SWATCHES, dominantColors, parseSwatches } from "@/lib/content/palette";

/**
 * The colours a picture is made of, counted from its pixels in the browser and sent with it, so
 * the hex codes in a prompt are measured rather than guessed by the model.
 */

/** RGBA pixels from [r, g, b, a, count] runs */
function pixels(...runs: [number, number, number, number, number][]): Uint8ClampedArray {
  const out: number[] = [];
  for (const [r, g, b, a, n] of runs) for (let i = 0; i < n; i++) out.push(r, g, b, a);
  return Uint8ClampedArray.from(out);
}

describe("dominantColors", () => {
  it("finds one flat colour as the whole picture", () => {
    expect(dominantColors(pixels([255, 0, 0, 255, 100]))).toEqual([{ hex: "#FF0000", share: 100 }]);
  });

  it("orders colours by the share of the picture they cover", () => {
    expect(dominantColors(pixels([0, 0, 255, 255, 30], [255, 0, 0, 255, 70]))).toEqual([
      { hex: "#FF0000", share: 70 },
      { hex: "#0000FF", share: 30 },
    ]);
  });

  it("merges shades too close to tell apart, into their average", () => {
    const found = dominantColors(pixels([255, 0, 0, 255, 60], [250, 6, 4, 255, 40]));
    expect(found).toHaveLength(1);
    expect(found[0].share).toBe(100);
    expect(found[0].hex).toBe("#FD0202");
  });

  it("keeps at most six, and their shares still add up to the whole", () => {
    const wheel: [number, number, number, number, number][] = [
      [255, 0, 0, 255, 10], [0, 255, 0, 255, 10], [0, 0, 255, 255, 10], [255, 255, 0, 255, 10],
      [0, 255, 255, 255, 10], [255, 0, 255, 255, 10], [0, 0, 0, 255, 10], [255, 255, 255, 255, 10], [128, 128, 128, 255, 10], [255, 128, 0, 255, 10],
    ];
    const found = dominantColors(pixels(...wheel));
    expect(MAX_SWATCHES).toBe(6);
    expect(found.length).toBeLessThanOrEqual(6);
    const total = found.reduce((s, c) => s + c.share, 0);
    expect(total).toBeGreaterThanOrEqual(98);
    expect(total).toBeLessThanOrEqual(102);
  });

  it("takes fewer when asked for fewer", () => {
    const found = dominantColors(pixels([255, 0, 0, 255, 50], [0, 255, 0, 255, 30], [0, 0, 255, 255, 20]), 2);
    expect(found).toHaveLength(2);
  });

  it("leaves out transparent pixels", () => {
    expect(dominantColors(pixels([0, 0, 0, 0, 90], [0, 128, 0, 255, 10]))).toEqual([{ hex: "#008000", share: 100 }]);
  });

  it("finds nothing in an empty or fully transparent picture", () => {
    expect(dominantColors(new Uint8ClampedArray())).toEqual([]);
    expect(dominantColors(pixels([9, 9, 9, 0, 50]))).toEqual([]);
  });

  it("drops a colour that rounds to under 1 percent", () => {
    const found = dominantColors(pixels([255, 0, 0, 255, 1000], [0, 0, 255, 255, 1]));
    expect(found.map((c) => c.hex)).toEqual(["#FF0000"]);
  });
});

describe("parseSwatches", () => {
  it("takes well-formed swatches and writes the hex in capitals", () => {
    expect(parseSwatches([{ hex: "#c41e3a", share: 38 }, { hex: "#FFFFFF", share: 22.4 }])).toEqual([
      { hex: "#C41E3A", share: 38 }, { hex: "#FFFFFF", share: 22 },
    ]);
  });

  it("drops what is not a swatch", () => {
    expect(parseSwatches([
      { hex: "red", share: 10 }, { hex: "#12345", share: 10 }, { hex: "#GGGGGG", share: 10 }, { hex: "#112233", share: "9" },
      { hex: "#112233", share: -1 }, { hex: "#112233", share: 101 }, null, 5, { hex: "#445566", share: 50 },
    ])).toEqual([{ hex: "#445566", share: 50 }]);
  });

  it("keeps no more than six, and nothing from a value that is not a list", () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ hex: `#00000${i}`, share: 10 }));
    expect(parseSwatches(seven)).toHaveLength(6);
    expect(parseSwatches("nope")).toEqual([]);
    expect(parseSwatches(undefined)).toEqual([]);
  });
});
