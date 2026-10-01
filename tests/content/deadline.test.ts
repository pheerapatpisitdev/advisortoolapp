import { describe, expect, it, vi } from "vitest";
import { MIN_CALL_MS, OutOfTime, deadline, within } from "@/lib/content/deadline";

/** A round's one clock inside the function's 300 s (review, 2026-10-01). */

describe("a round's deadline", () => {
  it("gives a call its usual time, or what is left after what must come, whichever is less", () => {
    let now = 1_000;
    const clock = deadline(270_000, () => now);
    expect(clock.budget(60_000)).toBe(60_000);
    expect(clock.budget(60_000, 195_000)).toBe(60_000);
    now += 100_000;
    // 170 s left, 150 s kept back for the picture: 20 s for the translation
    expect(clock.budget(60_000, 150_000)).toBe(20_000);
    expect(clock.left()).toBe(170_000);
  });

  it("gives 0 — not a call with no limit — when too little is left to be worth starting", () => {
    let now = 0;
    const clock = deadline(10_000, () => now);
    expect(clock.budget(60_000, 10_000 - MIN_CALL_MS + 1)).toBe(0);
    now = 20_000;
    expect(clock.budget(60_000)).toBe(0);
    expect(clock.left()).toBe(0);
  });
});

describe("within", () => {
  it("passes on what comes in time", async () => {
    await expect(within(Promise.resolve("ok"), 1_000)).resolves.toBe("ok");
  });

  it("gives up at the time, with OutOfTime", async () => {
    vi.useFakeTimers();
    try {
      const late = within(new Promise(() => {}), 5_000, "piece");
      vi.advanceTimersByTime(5_000);
      await expect(late).rejects.toBeInstanceOf(OutOfTime);
    } finally {
      vi.useRealTimers();
    }
  });
});
