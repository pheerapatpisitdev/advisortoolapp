import { describe, expect, it, vi } from "vitest";
import { STYLE_PREFIX, picturePrompt, drawScenePicture } from "@/lib/prompt-story/pictures";
import { PAINTERS } from "@/lib/content/models";

const scene = { voice: "v", screen: "s", picture: "พ่อแม่ลูกนั่งยิ้มในบ้าน" };
const SUFFIX = "no text, no numbers, no logos, no real person's likeness";
const ok = () => vi.fn().mockResolvedValue({ bytes: Buffer.from("png"), mimeType: "image/png" });
/** สไตล์ภาพ AI (owner, 2026-11-14) */
const AI = ["cartoon3d", "clay", "anime", "watercolor", "isometric", "collage", "pixel"] as const;
const AI_PREFIX = Object.fromEntries(AI.map((s) => [s, STYLE_PREFIX[s]]));

describe("prompt-story pictures", () => {
  it("has a prefix for every style: the seven looks, the seven AI styles, real, and the two that left the form", () => {
    expect(Object.keys(STYLE_PREFIX).sort()).toEqual([
      "anime", "blueprint", "board", "cartoon", "cartoon3d", "clay", "collage", "flat", "isometric", "line", "neon", "paper", "pixel", "plot", "real", "warm", "watercolor",
    ]);
  });
  it("paints the seven AI styles in the spec's words, each of Thai people", () => {
    expect(AI_PREFIX).toEqual({
      cartoon3d: "Cute 3D cartoon render of Thai people: rounded friendly characters with big eyes, soft studio lighting, smooth plastic-like materials, bright cheerful colours, simple clean background.",
      clay: "Claymation still of Thai people: characters and objects sculpted from matte modelling clay with visible fingerprints and soft edges, warm studio light, a miniature set.",
      anime: "Japanese anime illustration of Thai people: clean cel-shaded characters, soft pastel sky colours, gentle light, simple background details.",
      watercolor: "Soft watercolour painting of Thai people on textured paper: loose washes, gentle bleeding edges, pale pastel palette, light pencil underdrawing, lots of white paper.",
      isometric: "Isometric 3D illustration with Thai people: a small diorama seen from a 30-degree isometric angle, clean geometric shapes, soft shadows, calm blue and teal palette.",
      collage: "Magazine paper collage of Thai people: cut-out shapes and halftone photo pieces layered with torn paper edges, bold contrasting colours, visible paper texture.",
      pixel: "16-bit pixel art of Thai people: chunky visible pixels, limited bright palette, simple sprites and tiles like a retro video game scene.",
    });
    for (const s of AI) expect(STYLE_PREFIX[s], s).toContain("Thai people");
  });
  it("paints ไวต์บอร์ด นีออน บลูพริ้นท์ in the spec's words", () => {
    expect(STYLE_PREFIX.board).toBe("Hand-drawn whiteboard marker illustration: dark blue and black marker lines on a clean white board, a few red and blue marker accents, simple shapes, no shading, generous white space.");
    expect(STYLE_PREFIX.neon).toBe("Neon sign illustration on a dark violet background: glowing cyan, pink and yellow neon tube outlines, simple shapes, soft glow, no fill except the glow.");
    expect(STYLE_PREFIX.blueprint).toBe("Technical blueprint drawing: thin white lines on blueprint blue paper with a faint grid, simple isometric outlines and dimension marks, no colour other than white and pale cyan.");
  });
  it("prompt = prefix + note + no-text suffix", () => {
    for (const s of ["cartoon", "real", "flat", "paper", "warm", "plot", "line", "board", "neon", "blueprint", ...AI] as const) {
      const p = picturePrompt(scene, s);
      expect(p.startsWith(STYLE_PREFIX[s])).toBe(true);
      expect(p).toContain(scene.picture);
      expect(p.endsWith(SUFFIX)).toBe(true);
    }
  });
  it("maps size to aspect, painter to model id, and names the task", async () => {
    const cases = [["portrait", "9:16"], ["square", "1:1"], ["landscape", "16:9"]] as const;
    for (const [size, aspect] of cases) {
      const draw = ok();
      const buf = await drawScenePicture(scene, "flat", "sharp", size, draw);
      expect(buf?.toString()).toBe("png");
      const arg = draw.mock.calls[0][0];
      expect(arg.aspect).toBe(aspect);
      expect(arg.prefer).toBe(PAINTERS.find((p) => p.id === "sharp")!.modelId);
      expect(arg.task).toBe("prompt-story-picture");
    }
  });
  it("retries once after a failure", async () => {
    const draw = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce({ bytes: Buffer.from("b"), mimeType: "image/png" });
    expect((await drawScenePicture(scene, "real", "standard", "portrait", draw))?.toString()).toBe("b");
    expect(draw).toHaveBeenCalledTimes(2);
  });
  it("gives null after two failures", async () => {
    const draw = vi.fn().mockRejectedValue(new Error("x"));
    expect(await drawScenePicture(scene, "real", "standard", "portrait", draw)).toBeNull();
    expect(draw).toHaveBeenCalledTimes(2);
  });
});
