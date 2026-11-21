import { describe, expect, it, vi } from "vitest";
import { AD_PAINTER, drawAdPhoto, photoPrompt } from "@/lib/ad-video/photo";

describe("ad video photos", () => {
  it("asks for a vertical text-free photo in English only", () => {
    for (const scene of ["hook", "body", "close"] as const) {
      const p = photoPrompt("a Thai mother and daughter laughing in a kitchen", scene);
      expect(p).toContain("9:16");
      expect(p).toContain("No text");
      expect(p).toContain("Avoid:");
      expect(p).not.toMatch(/[ก-๙]/);
    }
  });
  it("keeps the lower third calm on body and close, the upper third on hook", () => {
    expect(photoPrompt("x", "close")).toMatch(/lower third/);
    expect(photoPrompt("x", "body")).toMatch(/lower third/);
    expect(photoPrompt("x", "hook")).toMatch(/upper third/);
  });
  it("tries twice then gives null", async () => {
    const draw = vi.fn().mockRejectedValue(new Error("down"));
    expect(await drawAdPhoto("x", "hook", draw)).toBeNull();
    expect(draw).toHaveBeenCalledTimes(2);
  });
  it("returns the drawn bytes with the ad task and the gemini model", async () => {
    const bytes = Buffer.from([1, 2, 3]);
    const draw = vi.fn().mockResolvedValue({ bytes });
    expect(await drawAdPhoto("x", "close", draw)).toBe(bytes);
    expect(draw.mock.calls[0][0]).toMatchObject({ task: "ad-video-photo", aspect: "9:16", prefer: "gemini-image" });
    expect(AD_PAINTER).toBe("gemini");
  });
});
