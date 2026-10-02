import { describe, expect, it } from "vitest";
import { mergeBack, POLL_GIVE_UP, retryDelay } from "@/lib/video/edit-saves";

/** The clip editor puts a save the connection dropped back, and tries again (2026-10-02). */

describe("mergeBack", () => {
  it("puts the failed save's fields back under what changed since", () => {
    const failed = { cut: [1], hook: { main: "เก่า" }, style: "box" as const };
    const newer = { hook: { main: "ใหม่" } };
    expect(mergeBack<Record<string, unknown>>(failed, newer)).toEqual({ cut: [1], hook: { main: "ใหม่" }, style: "box" });
  });
  it("keeps the failed save whole when nothing changed since", () => {
    expect(mergeBack({ trimSilence: false }, {})).toEqual({ trimSilence: false });
  });
});

describe("retryDelay", () => {
  it("doubles from a second and stops at fifteen", () => {
    expect([1, 2, 3, 4, 5, 9].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 15_000, 15_000]);
  });
  it("gives up the poll after a few failures in a row", () => {
    expect(POLL_GIVE_UP).toBeGreaterThan(1);
  });
});
