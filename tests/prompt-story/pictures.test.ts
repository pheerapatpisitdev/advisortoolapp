import { describe, expect, it, vi } from "vitest";
import { STYLE_PREFIX, picturePrompt, drawScenePicture } from "@/lib/prompt-story/pictures";
import { PAINTERS } from "@/lib/content/models";

const scene = { voice: "v", screen: "s", picture: "พ่อแม่ลูกนั่งยิ้มในบ้าน" };
const SUFFIX = "no text, no numbers, no logos, no real person's likeness";
const ok = () => vi.fn().mockResolvedValue({ bytes: Buffer.from("png"), mimeType: "image/png" });

describe("prompt-story pictures", () => {
  it("has three style prefixes", () => {
    expect(Object.keys(STYLE_PREFIX).sort()).toEqual(["cartoon", "flat", "real"]);
  });
  it("prompt = prefix + note + no-text suffix", () => {
    for (const s of ["cartoon", "real", "flat"] as const) {
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
