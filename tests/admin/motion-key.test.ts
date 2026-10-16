import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ภาพขยับ's fal.ai key on /admin/ai (owner, 2026-10-16): stored through the same encrypted RPC
 * as the AI keys, kept out of the AI key list (whose test asks every company a chat question),
 * and tested with a price lookup that makes no video.
 */

const rpc = vi.fn();
let tableRows: unknown[] = [];
let staffAllowed = true;

vi.mock("@/lib/auth/viewer", async () => {
  const base = (await import("../helpers/signed-in")).asOwner;
  return { ...base, requireStaff: async () => { if (!staffAllowed) throw new Error("forbidden"); return base.getViewer(); } };
});
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/ai/client", () => ({ clearAiConfigCache: () => undefined, testProviders: async () => [] }));
vi.mock("@/lib/ai/ledger", () => ({ monthStart: () => new Date(), spendSince: async () => new Date(), monthSpend: async () => null }));
vi.mock("@/lib/wallet/store", () => ({ walletChargedThb: async () => 0 }));
vi.mock("@/lib/content/store", () => ({ contentBaht: () => 0, DEFAULT_CONTENT_CAP_THB: 30 }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc,
    from: (table: string) => {
      const q = {
        order: () => q, eq: async () => ({ error: null }), update: () => q, maybeSingle: async () => ({ data: null, error: null }),
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: table === "ins_api_keys" ? tableRows : [], error: null }).then(ok),
      };
      return { ...q, select: () => q };
    },
  }),
}));

process.env.ADMIN_SESSION_SECRET = "test-passphrase";
const { saveMotionKey, testMotionKey, loadAiPage } = await import("@/app/admin/ai/actions");
const { checkMotionKey } = await import("@/lib/video/motion-key");

const answer = (status: number) => vi.fn<typeof fetch>(async () => new Response("{}", { status }));

beforeEach(() => {
  staffAllowed = true;
  tableRows = [];
  rpc.mockReset().mockResolvedValue({ data: [], error: null });
});

describe("checkMotionKey", () => {
  it("asks fal a model's price with the key, and a 200 is a good key", async () => {
    const f = answer(200);
    const r = await checkMotionKey("fal-key-123456", f as unknown as typeof fetch);
    expect(r.state).toBe("ok");
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/api\.fal\.ai\/v1\/models\/pricing\?endpoint_id=/);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Key fal-key-123456");
  });

  it("calls a 401 or 403 a wrong key, and anything else fal's own trouble with its status", async () => {
    expect(await checkMotionKey("k", answer(401) as unknown as typeof fetch)).toEqual({ state: "bad", error: "กุญแจไม่ถูกต้อง หรือถูกยกเลิกแล้ว" });
    expect(await checkMotionKey("k", answer(403) as unknown as typeof fetch)).toEqual({ state: "bad", error: "กุญแจไม่ถูกต้อง หรือถูกยกเลิกแล้ว" });
    expect(await checkMotionKey("k", answer(503) as unknown as typeof fetch)).toEqual({ state: "bad", error: "fal ตอบกลับไม่ได้ (503) ลองใหม่อีกครั้ง" });
  });

  it("says fal could not be reached when the request itself fails, without the key", async () => {
    const r = await checkMotionKey("fal-secret-999", (async () => { throw new Error("fal-secret-999 ECONNRESET"); }) as unknown as typeof fetch);
    expect(r).toEqual({ state: "bad", error: "ติดต่อ fal ไม่ได้ ลองใหม่อีกครั้ง" });
  });
});

describe("saveMotionKey", () => {
  it("stores the key under fal through the encrypted RPC, cleaned of spaces", async () => {
    rpc.mockResolvedValue({ error: null });
    expect(await saveMotionKey("  abcd1234:efgh5678  ")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("ins_set_api_key", { p_provider: "fal", p_key: "abcd1234:efgh5678", p_passphrase: "test-passphrase" });
  });

  it("refuses a short paste and stores nothing", async () => {
    expect(await saveMotionKey("abc")).toEqual({ ok: false, error: "กุญแจสั้นเกินไป — วางกุญแจทั้งเส้นอีกครั้ง" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("is refused for a non-admin before anything is stored", async () => {
    staffAllowed = false;
    await expect(saveMotionKey("abcd1234:efgh5678")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("the page", () => {
  it("shows fal on its own card, never in the AI key list", async () => {
    tableRows = [
      { provider: "openai", tail: "aaaa", enabled: true },
      { provider: "fal", tail: "7c2e", enabled: false },
    ];
    const page = await loadAiPage();
    expect(page.keys.map((k) => k.provider)).toEqual(["openai"]);
    expect(page.motion).toEqual({ provider: "fal", tail: "7c2e", enabled: false });
    expect(page.providers).not.toContain("fal");
  });

  it("has no fal card row before a key is saved", async () => {
    tableRows = [{ provider: "openai", tail: "aaaa", enabled: true }];
    expect((await loadAiPage()).motion).toBeNull();
  });
});

describe("testMotionKey", () => {
  it("says there is no key when none is held", async () => {
    rpc.mockResolvedValue({ data: [{ provider: "openai", api_key: "sk-x" }], error: null });
    expect(await testMotionKey()).toEqual({ state: "no-key" });
  });

  it("tests the held key, even one switched off", async () => {
    rpc.mockResolvedValue({ data: [{ provider: "fal", api_key: "fal-key-123456" }], error: null });
    const f = answer(200);
    vi.stubGlobal("fetch", f);
    try {
      expect((await testMotionKey()).state).toBe("ok");
      expect((f.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Key fal-key-123456");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
