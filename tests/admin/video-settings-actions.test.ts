import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The video render keys and engine switch on /admin/ai. Keys go through the same encrypted
 * RPC as the AI keys; a malformed AWS key or an unknown name is refused before anything is
 * stored; a non-admin never reaches the database.
 */

const SECRET = "SuperSecretValue123";
const rpc = vi.fn();
const upsert = vi.fn();
let staffAllowed = true;

vi.mock("@/lib/auth/viewer", async () => {
  const base = (await import("../helpers/signed-in")).asOwner;
  return { ...base, requireStaff: async () => { if (!staffAllowed) throw new Error("forbidden"); return base.getViewer(); } };
});
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/ai/client", () => ({ clearAiConfigCache: () => undefined, testProviders: async () => [] }));
vi.mock("@/lib/ai/ledger", () => ({ monthStart: () => new Date(), monthSpend: async () => null }));
vi.mock("@/lib/content/store", () => ({ contentBaht: () => 0, DEFAULT_CONTENT_CAP_THB: 30 }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ rpc, from: () => ({ upsert }) }),
}));

process.env.ADMIN_SESSION_SECRET = "test-passphrase";
const { saveRenderKey, saveVideoEngine } = await import("@/app/admin/ai/actions");

beforeEach(() => {
  staffAllowed = true;
  rpc.mockReset().mockResolvedValue({ error: null });
  upsert.mockReset().mockResolvedValue({ error: null });
});

describe("saveRenderKey", () => {
  it("refuses a malformed AWS key and stores nothing", async () => {
    for (const bad of ["AKIAEXAMPLE:onlytwo", `AKIAEXAMPLE:${SECRET}:ap-southeast-1`, `AKIAEXAMPLE:${SECRET}::fn`]) {
      const r = await saveRenderKey("aws", bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).not.toContain(SECRET);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses an unknown provider", async () => {
    // @ts-expect-error — deliberately outside the union
    const r = await saveRenderKey("openai", "sk-aaaaaaaaaaaa");
    expect(r).toEqual({ ok: false, error: "บริการไม่ถูกต้อง" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("stores a good AWS key through the RPC, sanitized, colons kept", async () => {
    const r = await saveRenderKey("aws", ` AKIAEXAMPLE:${SECRET}:ap-southeast-1:clip-render  `);
    expect(r).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("ins_set_api_key", {
      p_provider: "aws", p_key: `AKIAEXAMPLE:${SECRET}:ap-southeast-1:clip-render`, p_passphrase: "test-passphrase",
    });
  });

  it("stores a Rendi key through the RPC", async () => {
    await expect(saveRenderKey("rendi", "rendi-key-12345678")).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("ins_set_api_key", { p_provider: "rendi", p_key: "rendi-key-12345678", p_passphrase: "test-passphrase" });
  });

  it("never puts the key in the message or the log when the database refuses", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    rpc.mockResolvedValue({ error: { message: "permission denied" } });
    const r = await saveRenderKey("rendi", `rendi-${SECRET}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ไม่สำเร็จ/);
    expect(JSON.stringify([r, log.mock.calls])).not.toContain(SECRET);
    log.mockRestore();
  });

  it("is refused for a non-admin before anything is stored", async () => {
    staffAllowed = false;
    await expect(saveRenderKey("rendi", "rendi-key-12345678")).rejects.toThrow("forbidden");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("saveVideoEngine", () => {
  it("refuses an unknown engine and saves nothing", async () => {
    // @ts-expect-error — deliberately outside the union
    const r = await saveVideoEngine({ engine: "ffmpeg", fallback: true, rendiMaxSeconds: 60 });
    expect(r).toEqual({ ok: false, error: "ตัวตัดต่อไม่ถูกต้อง" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses a Rendi limit that is neither plan's", async () => {
    const r = await saveVideoEngine({ engine: "rendi", fallback: true, rendiMaxSeconds: 90 });
    expect(r.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("stores the engine, the fallback and the limit", async () => {
    await expect(saveVideoEngine({ engine: "lambda", fallback: false, rendiMaxSeconds: 600 })).resolves.toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({ id: true, video_engine: "lambda", video_fallback: false, rendi_max_seconds: 600 });
  });

  it("says in Thai when the database refuses", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    upsert.mockResolvedValue({ error: { message: "boom" } });
    const r = await saveVideoEngine({ engine: "rendi", fallback: true, rendiMaxSeconds: 60 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ไม่สำเร็จ/);
    log.mockRestore();
  });

  it("is refused for a non-admin", async () => {
    staffAllowed = false;
    await expect(saveVideoEngine({ engine: "rendi", fallback: true, rendiMaxSeconds: 60 })).rejects.toThrow("forbidden");
    expect(upsert).not.toHaveBeenCalled();
  });
});
