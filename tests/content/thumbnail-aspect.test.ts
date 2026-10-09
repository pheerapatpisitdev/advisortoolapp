import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { withAspect } from "@/lib/ai/images";
import { cropToAspect } from "@/lib/content/crop";

const blank = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#336699" } }).png().toBuffer();
const size = async (b: Buffer) => { const m = await sharp(b).metadata(); return [m.width!, m.height!]; };

describe("withAspect", () => {
  it("leaves params alone without an aspect", () => {
    expect(withAspect("google", { aspect_ratio: "1:1" })).toEqual({ aspect_ratio: "1:1" });
    expect(withAspect("openai", { size: "1024x1024" })).toEqual({ size: "1024x1024" });
  });
  it("gives Gemini the exact ratio", () => {
    expect(withAspect("google", { image_size: "1K" }, "16:9")).toEqual({ image_size: "1K", aspect_ratio: "16:9" });
    expect(withAspect("google", {}, "9:16").aspect_ratio).toBe("9:16");
  });
  it("gives OpenAI the nearest size it can draw", () => {
    expect(withAspect("openai", { quality: "medium" }, "9:16")).toEqual({ quality: "medium", size: "1024x1536" });
    expect(withAspect("openai", {}, "16:9").size).toBe("1536x1024");
  });
});

describe("cropToAspect", () => {
  it("crops 2:3 to 9:16", async () => {
    const out = await cropToAspect(await blank(1024, 1536), "9:16");
    const [w, h] = await size(out.bytes);
    expect(Math.abs(w / h - 9 / 16)).toBeLessThan(0.005);
    expect(out.mimeType).toBe("image/jpeg");
  });
  it("crops 3:2 to 16:9", async () => {
    const [w, h] = await size((await cropToAspect(await blank(1536, 1024), "16:9")).bytes);
    expect(Math.abs(w / h - 16 / 9)).toBeLessThan(0.01);
  });
  it("leaves an image that already has the ratio", async () => {
    const png = await blank(720, 1280);
    const out = await cropToAspect(png, "9:16");
    expect(out.bytes).toBe(png);
  });
});
