import { describe, expect, it } from "vitest";
import { emojiRow, stickerAt, stickerRect, type Rect } from "@/app/studio/claim/stickers";

/** Is the point inside the rounded rectangle? The corners are quarter circles of r.radius. */
function inside(r: Rect, px: number, py: number): boolean {
  if (px < r.x || px > r.x + r.w || py < r.y || py > r.y + r.h) return false;
  const rad = Math.min(r.radius, r.w / 2, r.h / 2);
  const cx = Math.min(Math.max(px, r.x + rad), r.x + r.w - rad);
  const cy = Math.min(Math.max(py, r.y + rad), r.y + r.h - rad);
  return (px - cx) ** 2 + (py - cy) ** 2 <= rad ** 2 + 1e-9;
}

describe("a sticker covers its whole box", () => {
  const boxes = [
    { x: 0.2, y: 0.3, w: 0.3, h: 0.02 },  // a long thin name line
    { x: 0.1, y: 0.1, w: 0.05, h: 0.05 }, // a squarish signature
    { x: 0, y: 0, w: 1, h: 1 },           // the whole paper
    { x: 0.5, y: 0.9, w: 0.01, h: 0.003 },// a sliver
  ];

  it("reaches past all four corners, rounded as it is", () => {
    for (const [W, H] of [[1200, 1600], [1600, 900], [400, 400]]) {
      for (const b of boxes) {
        const r = stickerRect(b, W, H);
        const x0 = Math.floor(b.x * W), y0 = Math.floor(b.y * H);
        const x1 = Math.ceil((b.x + b.w) * W), y1 = Math.ceil((b.y + b.h) * H);
        for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
          expect(inside(r, px, py), `${JSON.stringify(b)} at ${W}×${H}, corner ${px},${py}`).toBe(true);
        }
      }
    }
  });

  it("takes turns in colour and emoji, so neighbours differ", () => {
    for (let i = 0; i < 10; i++) {
      expect(stickerAt(i).fill).not.toBe(stickerAt(i + 1).fill);
      expect(stickerAt(i).pair).not.toEqual(stickerAt(i + 1).pair);
    }
  });
});

describe("what a sticker says", () => {
  const s = stickerAt(0);

  it("is emoji only — no words on the customer's papers", () => {
    for (let i = 0; i < 8; i++) {
      const { text } = emojiRow(stickerAt(i), 400, 40);
      expect(text).not.toMatch(/[\u0E00-\u0E7Fa-z]/i);
    }
  });

  it("runs a row of the pair along a name line, and one on a small square", () => {
    const line = emojiRow(s, 400, 40);
    expect([...line.text].length).toBeGreaterThan(4);
    expect(line.text.startsWith(s.pair[0] + s.pair[1])).toBe(true);
    expect([...emojiRow(s, 40, 40).text]).toEqual([s.pair[0]]);
  });

  it("fits the pill's height, and never shrinks to nothing on a sliver", () => {
    expect(emojiRow(s, 400, 40).size).toBeLessThanOrEqual(40 * 0.62);
    expect(emojiRow(s, 3, 2).size).toBeGreaterThanOrEqual(4);
  });
});
