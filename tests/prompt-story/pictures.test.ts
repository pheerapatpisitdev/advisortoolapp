import { describe, expect, it, vi } from "vitest";
import { STYLE_PREFIX, picturePrompt, drawScenePicture } from "@/lib/prompt-story/pictures";
import { PAINTERS } from "@/lib/content/models";

const scene = { voice: "v", screen: "s", picture: "พ่อแม่ลูกนั่งยิ้มในบ้าน" };
const SUFFIX = "no text, no numbers, no logos, no real person's likeness";
const ok = () => vi.fn().mockResolvedValue({ bytes: Buffer.from("png"), mimeType: "image/png" });

describe("prompt-story pictures", () => {
  it("has a prefix for every style: the seven looks, real, and the two that left the form", () => {
    expect(Object.keys(STYLE_PREFIX).sort()).toEqual(["blueprint", "board", "cartoon", "flat", "line", "neon", "paper", "plot", "real", "warm"]);
  });
  it("paints ไวต์บอร์ด นีออน บลูพริ้นท์ in the spec's words", () => {
    expect(STYLE_PREFIX.board).toBe("Hand-drawn whiteboard marker illustration: dark blue and black marker lines on a clean white board, a few red and blue marker accents, simple shapes, no shading, generous white space.");
    expect(STYLE_PREFIX.neon).toBe("Neon sign illustration on a dark violet background: glowing cyan, pink and yellow neon tube outlines, simple shapes, soft glow, no fill except the glow.");
    expect(STYLE_PREFIX.blueprint).toBe("Technical blueprint drawing: thin white lines on blueprint blue paper with a faint grid, simple isometric outlines and dimension marks, no colour other than white and pale cyan.");
  });
  it("prompt = prefix + note + no-text suffix", () => {
    for (const s of ["cartoon", "real", "flat", "paper", "warm", "plot", "line", "board", "neon", "blueprint"] as const) {
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
