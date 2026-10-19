import { describe, expect, it } from "vitest";
import { renderPng } from "@/lib/content/poster-png";

/**
 * The poster renderer run for real: fonts read, satori's wasm started, resvg's native build
 * loaded, a PNG out. Its failures are the quiet kind — a missing .wasm or binary, a moved font —
 * and would otherwise first show up as a broken picture on the page.
 */

const size = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

describe("renderPng", () => {
  it("draws a Thai headline to a PNG of the size asked for", async () => {
    const el = {
      type: "div",
      props: {
        style: { width: "100%", height: "100%", display: "flex", background: "#000", color: "#fff", fontFamily: "Plex", fontSize: 80 },
        children: "เรื่องที่ควรรู้ก่อนซื้อ",
      },
    };
    const png = await renderPng(el as never, { width: 1080, height: 1350 });
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(size(png)).toEqual({ width: 1080, height: 1350 });
  }, 30_000);

  it("draws again in the same process, as a clip's hundreds of frames do", async () => {
    const el = { type: "div", props: { style: { display: "flex" }, children: "x" } } as never;
    for (let i = 0; i < 3; i++) expect(size(await renderPng(el, { width: 10, height: 10 }))).toEqual({ width: 10, height: 10 });
  }, 30_000);
});
