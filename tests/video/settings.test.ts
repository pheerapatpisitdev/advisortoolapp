import { beforeEach, describe, expect, it, vi } from "vitest";

const row = vi.hoisted(() => ({ data: null as Record<string, unknown> | null, upserted: null as unknown, selected: "" }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: (cols: string) => { row.selected = cols; return { maybeSingle: async () => ({ data: row.data, error: null }) }; },
      upsert: async (v: unknown) => { row.upserted = v; return { error: null }; },
    }),
  }),
}));
const { saveVideoSettings, videoSettings } = await import("@/lib/video/settings");

beforeEach(() => { row.data = null; row.upserted = null; row.selected = ""; });

describe("videoSettings", () => {
  it("defaults to off", async () => {
    expect(await videoSettings()).toEqual({ enabled: false });
  });
  it("is on only when the column is exactly true; null, missing or truthy strings are off", async () => {
    for (const v of [null, undefined, "true", 1]) {
      row.data = { video_edit_enabled: v };
      expect((await videoSettings()).enabled).toBe(false);
    }
    row.data = { video_edit_enabled: true };
    expect((await videoSettings()).enabled).toBe(true);
  });
  it("reads only the switch: the old engine columns are left alone (Rendi and Lambda removed 2026-11-11)", async () => {
    row.data = { video_engine: "rendi", video_fallback: true, rendi_max_seconds: 60, video_edit_enabled: true };
    expect(await videoSettings()).toEqual({ enabled: true });
    expect(row.selected).toBe("video_edit_enabled");
  });
  it("saves the switch into the one settings row, and nothing of the old engine columns", async () => {
    await saveVideoSettings({ enabled: true });
    expect(row.upserted).toMatchObject({ id: true, video_edit_enabled: true });
    expect(row.upserted).not.toHaveProperty("video_engine");
    expect(row.upserted).not.toHaveProperty("rendi_max_seconds");
  });
});
