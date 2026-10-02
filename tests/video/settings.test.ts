import { beforeEach, describe, expect, it, vi } from "vitest";

const row = vi.hoisted(() => ({ data: null as Record<string, unknown> | null, upserted: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: row.data, error: null }) }),
      upsert: async (v: unknown) => { row.upserted = v; return { error: null }; },
    }),
  }),
}));
const { saveVideoSettings, videoSettings } = await import("@/lib/video/settings");

beforeEach(() => { row.data = null; row.upserted = null; });

describe("videoSettings", () => {
  it("defaults to Rendi with fallback, 60 s a command", async () => {
    expect(await videoSettings()).toEqual({ engine: "rendi", fallback: true, rendiMaxSeconds: 60, enabled: false });
  });
  it("reads what the owner chose, and clamps a bad number", async () => {
    row.data = { video_engine: "lambda", video_fallback: false, rendi_max_seconds: 5000 };
    expect(await videoSettings()).toEqual({ engine: "lambda", fallback: false, rendiMaxSeconds: 600, enabled: false });
  });
  it("reads Google Cloud Run as the pick; anything it does not know is Rendi", async () => {
    row.data = { video_engine: "cloudrun", video_fallback: true };
    expect((await videoSettings()).engine).toBe("cloudrun");
    for (const v of ["gcp", "CLOUDRUN", null, 3]) {
      row.data = { video_engine: v };
      expect((await videoSettings()).engine).toBe("rendi");
    }
  });
  it("is on only when the column is exactly true; null, missing or truthy strings are off", async () => {
    for (const v of [null, undefined, "true", 1]) {
      row.data = { video_edit_enabled: v };
      expect((await videoSettings()).enabled).toBe(false);
    }
    row.data = { video_edit_enabled: true };
    expect((await videoSettings()).enabled).toBe(true);
  });
  it("saves Google Cloud Run as the pick", async () => {
    await saveVideoSettings({ engine: "cloudrun", fallback: false, rendiMaxSeconds: 60, enabled: false });
    expect(row.upserted).toMatchObject({ id: true, video_engine: "cloudrun", video_fallback: false });
  });
  it("saves into the one settings row", async () => {
    await saveVideoSettings({ engine: "rendi", fallback: true, rendiMaxSeconds: 600, enabled: true });
    expect(row.upserted).toMatchObject({ id: true, video_engine: "rendi", video_fallback: true, rendi_max_seconds: 600, video_edit_enabled: true });
  });
});

describe("the migration that lets the column hold cloudrun", () => {
  it("replaces the video_engine check with one that allows all three engines", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(new URL("../../supabase/migrations/20261003_clip_cloudrun.sql", import.meta.url), "utf8");
    expect(sql).toMatch(/drop constraint if exists ins_ai_settings_video_engine_check/);
    expect(sql).toMatch(/add constraint ins_ai_settings_video_engine_check\s+check \(video_engine in \('rendi', 'lambda', 'cloudrun'\)\)/);
  });
});
