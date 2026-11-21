import { describe, expect, it, vi } from "vitest";
import { AD_PAINTER, drawAdPhoto, photoPrompt } from "@/lib/ad-video/photo";
import { BudgetExceeded } from "@/lib/ai/client";

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
  it("tries twice then gives null, logging each failure without the prompt", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const draw = vi.fn().mockRejectedValue(new Error("down"));
    expect(await drawAdPhoto("a secret idea", "hook", draw)).toBeNull();
    expect(draw).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(2);
    for (const [line] of log.mock.calls) {
      expect(line).toContain("ad-video-photo");
      expect(line).toContain("down");
      expect(line).not.toContain("a secret idea");
      expect(line).not.toMatch(/\n\s+at /);
    }
    log.mockRestore();
  });
  it("does not retry the budget refusal or a day with no painter", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const err of [new BudgetExceeded(), new Error("ไม่มีโมเดลวาดรูปที่ใช้ได้ในตอนนี้")]) {
      const draw = vi.fn().mockRejectedValue(err);
      expect(await drawAdPhoto("x", "close", draw)).toBeNull();
      expect(draw).toHaveBeenCalledTimes(1);
    }
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[0][0]).toContain("ถึงงบค่า AI ของเดือนนี้แล้ว");
    log.mockRestore();
  });
  it("retries a provider failure once and keeps the second try's photo", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const bytes = Buffer.from([9]);
    const draw = vi.fn().mockRejectedValueOnce(new Error("วาดรูปไม่สำเร็จ\ngemini: 429")).mockResolvedValueOnce({ bytes });
    expect(await drawAdPhoto("x", "body", draw)).toBe(bytes);
    expect(draw).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
  it("returns the drawn bytes with the ad task and the gemini model", async () => {
    const bytes = Buffer.from([1, 2, 3]);
    const draw = vi.fn().mockResolvedValue({ bytes });
    expect(await drawAdPhoto("x", "close", draw)).toBe(bytes);
    expect(draw.mock.calls[0][0]).toMatchObject({ task: "ad-video-photo", aspect: "9:16", prefer: "gemini-image" });
    expect(AD_PAINTER).toBe("gemini");
  });
});
