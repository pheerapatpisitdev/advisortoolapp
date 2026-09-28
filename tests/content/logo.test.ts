import { describe, expect, it, vi } from "vitest";
import { isLogoPath, logoBox, LOGO_SPOTS, toLogo } from "@/lib/content/logo";
import { metrics, logoAt } from "@/lib/content/poster-layout";
import { parsePoster } from "@/lib/content/poster";

/** A Page's logo on its posters: six spots, a margin of its own, and a path that can point nowhere else. */

const PATH = "logos/0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f.png";
const SQUARE = { width: 1080, height: 1080 };

// a 1×1 transparent PNG, for the drawing test
const DOT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
vi.mock("@/lib/content/store", () => ({ backgroundDataUri: vi.fn(async () => DOT) }));

describe("a logo's path and spot", () => {
  it("takes only a logo file in the logos folder, and one of the six spots", () => {
    expect(isLogoPath(PATH)).toBe(true);
    expect(isLogoPath("0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f/x.png")).toBe(false);
    expect(isLogoPath("logos/../secret.png")).toBe(false);
    expect(toLogo({ path: PATH, spot: "tr" })).toEqual({ path: PATH, spot: "tr" });
    expect(toLogo({ path: PATH, spot: "middle" })).toBeNull();
  });

  it("stays on a poster through a save, and a bad one is dropped", () => {
    const base = { layout: "bottom", theme: "navy", blocks: [{ kind: "headline", text: "หัว" }] };
    expect(parsePoster({ ...base, logo: { path: PATH, spot: "bl" } })?.logo).toEqual({ path: PATH, spot: "bl" });
    expect(parsePoster({ ...base, logo: { path: "http://x/y.png", spot: "bl" } })?.logo).toBeUndefined();
  });
});

describe("where a logo sits", () => {
  it("moves the words' margin at its own edge by its box and a gap, and no other", () => {
    const plain = metrics(SQUARE);
    const top = metrics(SQUARE, "tc");
    const bottom = metrics(SQUARE, "br");
    const room = logoBox(1080).h + plain.gap;
    expect(top.padTop).toBe(plain.padTop + room);
    expect(top.padBottom).toBe(plain.padBottom);
    expect(bottom.padBottom).toBe(plain.padBottom + room);
    expect(bottom.usableHeight).toBe(plain.usableHeight - room);
  });

  it("sits inside the canvas at the words' old margins, left, centre or right", () => {
    const m = metrics(SQUARE);
    const { w, h } = logoBox(1080);
    expect(logoAt(SQUARE, "tl")).toMatchObject({ left: m.padX, top: m.padTop });
    expect(logoAt(SQUARE, "tc").left).toBe(Math.round((1080 - w) / 2));
    expect(logoAt(SQUARE, "br")).toMatchObject({ left: 1080 - m.padX - w, top: 1080 - m.padBottom - h });
    for (const spot of LOGO_SPOTS) {
      const at = logoAt(SQUARE, spot);
      expect(at.left).toBeGreaterThanOrEqual(0);
      expect(at.left + at.w).toBeLessThanOrEqual(1080);
      expect(at.top + at.h).toBeLessThanOrEqual(1080);
    }
  });
});

describe("a poster drawn with a logo", () => {
  it("draws in every spot and size", async () => {
    const { drawPoster } = await import("@/lib/content/poster-draw");
    for (const spot of LOGO_SPOTS) {
      const png = await drawPoster({ layout: "top", theme: "navy", blocks: [{ kind: "headline", text: "หัวข้อโปสเตอร์" }], logo: { path: PATH, spot } }, "square");
      expect(png.subarray(1, 4).toString()).toBe("PNG");
    }
    const tall = await drawPoster({ layout: "bottom", theme: "photo", blocks: [{ kind: "headline", text: "หัว" }], logo: { path: PATH, spot: "bc" } }, "story");
    expect(tall.subarray(1, 4).toString()).toBe("PNG");
  }, 60_000);
});

describe("a logo's own shape", () => {
  it("reads a PNG's size, and fits it in its box without stretching", async () => {
    const { imageSize, fitInBox } = await import("@/lib/content/logo");
    const png = Buffer.from(DOT.split(",")[1], "base64");
    expect(imageSize(png)).toEqual({ width: 1, height: 1 });
    expect(fitInBox({ width: 400, height: 100 }, { w: 238, h: 108 })).toEqual({ w: 238, h: 60 });
    expect(fitInBox({ width: 192, height: 192 }, { w: 238, h: 108 })).toEqual({ w: 108, h: 108 });
    expect(fitInBox(null, { w: 238, h: 108 })).toEqual({ w: 108, h: 108 });
  });

  it("reads a JPEG's size from its frame header", async () => {
    const { imageSize } = await import("@/lib/content/logo");
    // SOI, then an SOF0 of 8-bit, height 50, width 120
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x32, 0x00, 0x78, 0x03, 0, 0, 0, 0, 0, 0]);
    expect(imageSize(jpeg)).toEqual({ width: 120, height: 50 });
  });
});
