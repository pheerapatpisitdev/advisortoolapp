import { describe, expect, it } from "vitest";
import { failReason, renderThbFor, secondsBetween } from "@/lib/quote-video/run-record";

describe("failReason", () => {
  it("names the stage and keeps the error's words", () => {
    expect(failReason(new Error("render failed: upload out_1 403"), "rendering")).toBe("ขณะ Cloud Run ทำ · render failed: upload out_1 403");
    expect(failReason(new Error("no gcp key"), "drawing")).toBe("ขณะเตรียม · no gcp key");
  });

  it("never keeps a link", () => {
    const r = failReason(new Error("fetch https://x.supabase.co/storage/v1/object/sign/a?token=abc failed"));
    expect(r).toBe("fetch <link> failed");
    expect(r).not.toContain("token");
  });

  it("goes without a stage it does not know, and cuts long words", () => {
    expect(failReason("timed out")).toBe("timed out");
    expect(failReason(undefined)).toBe("unknown error");
    expect(failReason(new Error("x".repeat(1000)), "drawing")).toHaveLength(400);
  });
});

describe("renderThbFor", () => {
  it("prices a run at its machine's list rate", () => {
    // 8 vCPU / 8 GiB: (8 × 0.000024 + 8 × 0.0000025) × 36 = 0.007632 baht a second
    expect(renderThbFor("remotion", 60)).toBeCloseTo(0.4579, 4);
    // 4 vCPU / 8 GiB: (4 × 0.000024 + 8 × 0.0000025) × 36 = 0.004176 baht a second
    expect(renderThbFor("ffmpeg", 100)).toBeCloseTo(0.4176, 4);
    expect(renderThbFor("ffmpeg", -5)).toBe(0);
  });
});

describe("secondsBetween", () => {
  it("counts from a time or a timestamp to a tenth", () => {
    expect(secondsBetween("2026-10-19T10:00:00.000Z", Date.parse("2026-10-19T10:01:17.260Z"))).toBe(77.3);
    expect(secondsBetween(1000, 3500)).toBe(2.5);
    expect(secondsBetween(undefined, 1)).toBeNull();
    expect(secondsBetween("not a time", 1)).toBeNull();
  });
});
