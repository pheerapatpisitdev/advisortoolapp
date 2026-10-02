import { describe, expect, it } from "vitest";
import { renderHookPng, renderSubPng, STYLE_LABEL } from "@/lib/video/overlays";
import { styleLook } from "@/lib/video/styles";
import { CLIP_STYLES } from "@/lib/content/clip";

const isPng = (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const width = (b: Buffer) => b.readUInt32BE(16);
const height = (b: Buffer) => b.readUInt32BE(20);

describe("styleLook", () => {
  it("has a look and a Thai name for each of the four styles", () => {
    for (const s of CLIP_STYLES) {
      expect(styleLook(s).fontSize).toBeGreaterThan(40);
      expect(STYLE_LABEL[s]).toBeTruthy();
    }
  });
  it("takes the Page's colours for the page style, navy when it has none", () => {
    expect(styleLook("page", "emerald").hookMainBg).not.toBe(styleLook("page").hookMainBg);
    expect(styleLook("page").hookMainBg).toBe(styleLook("page", "navy").hookMainBg);
  });
  it("outline has no box and a stroke", () => {
    expect(styleLook("outline").box).toBeNull();
    expect(styleLook("outline").stroke).toBeTruthy();
  });
});

describe("overlay pictures", () => {
  it("draws a subtitle as a transparent 1080×200 PNG", async () => {
    const png = await renderSubPng("ส่วนที่เหลือก็คือติด", styleLook("box"));
    expect(isPng(png)).toBe(true);
    expect([width(png), height(png)]).toEqual([1080, 200]);
  });
  it("draws a hook with and without its small top line as 1080×360", async () => {
    const a = await renderHookPng({ top: "ขอบคุณลูกเพจทุกท่าน", main: "ปิดยอดไปแล้ว 881,533 บาท" }, styleLook("yellow"));
    const b = await renderHookPng({ main: "ปิดยอดไปแล้ว" }, styleLook("box"));
    expect([width(a), height(a), width(b), height(b)]).toEqual([1080, 360, 1080, 360]);
  });
});
