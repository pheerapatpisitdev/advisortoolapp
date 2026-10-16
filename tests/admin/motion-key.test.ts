import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ภาพขยับ's keys on /admin/ai, fal.ai and Runware (owner, 2026-10-16): stored through the same
 * encrypted RPC as the AI keys, kept out of the AI key list (whose test asks every company a chat
 * question), and tested without making a video — Runware's test also says the credit left.
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

const answer = (status: number, json: unknown = {}) => vi.fn<typeof fetch>(async () => new Response(JSON.stringify(json), { status }));
const runwareDetails = (amount: number) => ({
  data: [{
    taskType: "accountManagement", operation: "getDetails", balance: { amount, currency: "USD" },
    apiKeys: [{ name: "main", apiKey: "rw-full-secret-key", enabled: true }],
  }],
});

beforeEach(() => {
  staffAllowed = true;
  tableRows = [];
  rpc.mockReset().mockResolvedValue({ data: [], error: null });
});

describe("checkMotionKey for fal", () => {
  it("asks fal a model's price with the key, and a 200 is a good key", async () => {
    const f = answer(200);
    const r = await checkMotionKey("fal", "fal-key-123456", f);
    expect(r).toMatchObject({ state: "ok" });
    expect(r).not.toHaveProperty("credit");
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/api\.fal\.ai\/v1\/models\/pricing\?endpoint_id=/);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Key fal-key-123456");
  });

  it("calls a 401 or 403 a wrong key, and anything else fal's own trouble with its status", async () => {
    expect(await checkMotionKey("fal", "k", answer(401))).toEqual({ state: "bad", error: "กุญแจไม่ถูกต้อง หรือถูกยกเลิกแล้ว" });
    expect(await checkMotionKey("fal", "k", answer(403))).toEqual({ state: "bad", error: "กุญแจไม่ถูกต้อง หรือถูกยกเลิกแล้ว" });
    expect(await checkMotionKey("fal", "k", answer(503))).toEqual({ state: "bad", error: "fal ตอบกลับไม่ได้ (503) ลองใหม่อีกครั้ง" });
  });

  it("says fal could not be reached when the request itself fails, without the key", async () => {
    const r = await checkMotionKey("fal", "fal-secret-999", vi.fn<typeof fetch>(async () => { throw new Error("fal-secret-999 ECONNRESET"); }));
    expect(r).toEqual({ state: "bad", error: "ติดต่อ fal ไม่ได้ ลองใหม่อีกครั้ง" });
  });
});

describe("checkMotionKey for Runware", () => {
  it("posts getDetails with the key as a bearer and says the credit left, nothing else from the answer", async () => {
    const f = answer(200, runwareDetails(4.8213));
    const r = await checkMotionKey("runware", "rw-key-123456", f);
    expect(r).toMatchObject({ state: "ok", credit: "เครดิตเหลือ $4.82" });
    expect(JSON.stringify(r)).not.toContain("rw-full-secret-key");
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe("https://api.runware.ai/v1");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer rw-key-123456");
    const task = JSON.parse(String(init?.body))[0];
    expect(task).toMatchObject({ taskType: "accountManagement", operation: "getDetails" });
    expect(task.taskUUID).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("calls a 401, or a 200 carrying invalidApiKey, a wrong key", async () => {
    expect(await checkMotionKey("runware", "k", answer(401))).toEqual({ state: "bad", error: "กุญแจไม่ถูกต้อง หรือถูกยกเลิกแล้ว" });
    const wrong = answer(200, { errors: [{ code: "invalidApiKey", message: "Invalid API key." }] });
    expect(await checkMotionKey("runware", "k", wrong)).toEqual({ state: "bad", error: "กุญแจไม่ถูกต้อง หรือถูกยกเลิกแล้ว" });
  });

  it("says Runware's own trouble with its status, and when it cannot be reached", async () => {
    expect(await checkMotionKey("runware", "k", answer(500, { errors: [{ code: "internal" }] }))).toEqual({ state: "bad", error: "Runware ตอบกลับไม่ได้ (500) ลองใหม่อีกครั้ง" });
    const down = vi.fn<typeof fetch>(async () => { throw new Error("ECONNRESET"); });
    expect(await checkMotionKey("runware", "k", down)).toEqual({ state: "bad", error: "ติดต่อ Runware ไม่ได้ ลองใหม่อีกครั้ง" });
  });
});

describe("saveMotionKey", () => {
  it("stores each key under its own name through the encrypted RPC, cleaned of spaces", async () => {
    rpc.mockResolvedValue({ error: null });
    expect(await saveMotionKey("fal", "  abcd1234:efgh5678  ")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("ins_set_api_key", { p_provider: "fal", p_key: "abcd1234:efgh5678", p_passphrase: "test-passphrase" });
    expect(await saveMotionKey("runware", "rw-key-123456")).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("ins_set_api_key", { p_provider: "runware", p_key: "rw-key-123456", p_passphrase: "test-passphrase" });
  });

  it("refuses a short paste or another service's name, and stores nothing", async () => {
    expect(await saveMotionKey("fal", "abc")).toEqual({ ok: false, error: "กุญแจสั้นเกินไป — วางกุญแจทั้งเส้นอีกครั้ง" });
    expect(await saveMotionKey("openai", "sk-aaaaaaaaaaaa")).toEqual({ ok: false, error: "บริการไม่ถูกต้อง" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("is refused for a non-admin before anything is stored", async () => {
    staffAllowed = false;
    await expect(saveMotionKey("runware", "rw-key-123456")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("the page", () => {
  it("shows fal and Runware on their own card, never in the AI key list", async () => {
    tableRows = [
      { provider: "openai", tail: "aaaa", enabled: true },
      { provider: "fal", tail: "7c2e", enabled: false },
      { provider: "runware", tail: "a91f", enabled: true },
    ];
    const page = await loadAiPage();
    expect(page.keys.map((k) => k.provider)).toEqual(["openai"]);
    expect(page.motion).toEqual([
      { provider: "fal", tail: "7c2e", enabled: false },
      { provider: "runware", tail: "a91f", enabled: true },
    ]);
    expect(page.providers).not.toContain("fal");
    expect(page.providers).not.toContain("runware");
  });

  it("has no rows held before a key is saved", async () => {
    tableRows = [{ provider: "openai", tail: "aaaa", enabled: true }];
    expect((await loadAiPage()).motion).toEqual([]);
  });
});

describe("testMotionKey", () => {
  it("says there is no key when none is held, and refuses another service's name", async () => {
    rpc.mockResolvedValue({ data: [{ provider: "openai", api_key: "sk-x" }], error: null });
    expect(await testMotionKey("runware")).toEqual({ state: "no-key" });
    expect(await testMotionKey("openai")).toEqual({ state: "bad", error: "บริการไม่ถูกต้อง" });
  });

  it("tests the held key of the service asked, even one switched off", async () => {
    rpc.mockResolvedValue({ data: [{ provider: "fal", api_key: "fal-key-123456" }, { provider: "runware", api_key: "rw-key-123456" }], error: null });
    const f = answer(200, runwareDetails(10));
    vi.stubGlobal("fetch", f);
    try {
      expect(await testMotionKey("runware")).toMatchObject({ state: "ok", credit: "เครดิตเหลือ $10.00" });
      expect((f.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer rw-key-123456");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
