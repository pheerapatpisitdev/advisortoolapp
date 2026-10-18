import { describe, expect, it } from "vitest";
import { EngineError } from "@/lib/video/engines/types";
import { NO_ENGINE } from "@/lib/video/jobs";
import { RENDER_DOWN, RENDER_SETUP, renderError } from "@/lib/video/render-run";

/** a cut that cannot start says whether trying again can help (owner, 2026-10-18) */
describe("renderError", () => {
  it("tells the agent to tell the admin when the engine is not set up or its key is refused", () => {
    expect(renderError(new EngineError(NO_ENGINE, false))).toBe(RENDER_SETUP);
    expect(renderError(new EngineError("ตั้งค่า Google Cloud ไม่ครบ", true))).toBe(RENDER_SETUP);
    expect(renderError(new EngineError("Rendi ไม่รับงาน (401)", true))).toBe(RENDER_SETUP);
    expect(renderError(new Error(RENDER_SETUP))).toBe(RENDER_SETUP);
  });

  it("says try again later for anything that may pass", () => {
    expect(renderError(new EngineError("ส่งงานให้ Google Cloud ไม่ได้", true))).toBe(RENDER_DOWN);
    expect(renderError(new EngineError("Rendi ไม่รับงาน (503)", true))).toBe(RENDER_DOWN);
    expect(renderError("boom")).toBe(RENDER_DOWN);
  });
});

describe("the timed-out words (owner, 2026-10-18)", () => {
  it("never name a longer wait than the job was given before it was failed", async () => {
    const { COLLECT_LATEST_MS, JOB_TIMED_OUT } = await import("@/lib/video/jobs");
    const said = Number(/นานเกิน (\d+) นาที/.exec(JOB_TIMED_OUT)?.[1]);
    expect(said * 60_000).toBeLessThanOrEqual(COLLECT_LATEST_MS);
  });
});
