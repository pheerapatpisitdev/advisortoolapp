import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The video render keys and engine switch on /admin/ai. Keys go through the same encrypted
 * RPC as the AI keys; a malformed AWS key or an unknown name is refused before anything is
 * stored; a non-admin never reaches the database.
 */

const SECRET = "SuperSecretValue123";
// a throwaway key pair made here, never a real one
const PEM = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const PEM_BODY = PEM.split("\n")[1];
const SA_EMAIL = "clip-render@my-proj.iam.gserviceaccount.com";
/** a service account file as Google hands it out, pasted with CRLF line ends */
const SA_FILE = JSON.stringify({
  type: "service_account", project_id: "my-proj", private_key_id: "abc123", private_key: PEM, client_email: SA_EMAIL,
  client_id: "1234567890", auth_uri: "https://accounts.google.com/o/oauth2/auth", token_uri: "https://oauth2.googleapis.com/token",
}, null, 2).replace(/\n/g, "\r\n");
const rpc = vi.fn();
const upsert = vi.fn();
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
        upsert, order: () => q, maybeSingle: async () => ({ data: null, error: null }),
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: table === "ins_api_keys" ? tableRows : [], error: null }).then(ok),
      };
      return { ...q, select: () => q };
    },
  }),
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
    for (const bad of ["AKIAEXAMPLE:onlytwo", `AKIAEXAMPLE:${SECRET}:ap-southeast-1`, `AKIAEXAMPLE:${SECRET}::fn`, `AKIAEXAMPLE:${SECRET}:evil.example.com:fn`]) {
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

describe("saveRenderKey for Google Cloud Run", () => {
  it("keeps only what the engine needs, as one line of JSON, from the pasted file and the region and job typed beside it", async () => {
    const r = await saveRenderKey("gcp", SA_FILE, { region: " asia-southeast1 ", job: "clip-ffmpeg" });
    expect(r).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0] as [string, { p_provider: string; p_key: string; p_passphrase: string }];
    expect(fn).toBe("ins_set_api_key");
    expect(args.p_provider).toBe("gcp");
    // the file's line breaks survive as escapes (cleanKey would have stripped them), no raw ones
    expect(args.p_key).not.toMatch(/[\r\n]/);
    expect(JSON.parse(args.p_key)).toEqual({ client_email: SA_EMAIL, private_key: PEM, project_id: "my-proj", region: "asia-southeast1", job: "clip-ffmpeg" });
  });

  it("refuses a bad paste, a bad region or job name, or no region at all — in Thai, without the key, storing nothing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const bad: [string, { region: string; job: string } | undefined][] = [
      ["not json at all", { region: "asia-southeast1", job: "clip-ffmpeg" }],
      [JSON.stringify({ client_email: SA_EMAIL, project_id: "my-proj" }), { region: "asia-southeast1", job: "clip-ffmpeg" }],
      [JSON.stringify({ client_email: SA_EMAIL, project_id: "my-proj", private_key: `-----BEGIN PRIVATE KEY-----\n${SECRET}\n-----END PRIVATE KEY-----\n` }), { region: "asia-southeast1", job: "clip-ffmpeg" }],
      [SA_FILE, { region: "Asia Southeast", job: "clip-ffmpeg" }],
      [SA_FILE, { region: "asia-southeast1", job: "Clip_FFmpeg" }],
      [SA_FILE, undefined],
    ];
    for (const [file, where] of bad) {
      const r = await saveRenderKey("gcp", file, where);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Service Account/);
      expect(JSON.stringify(r)).not.toContain(SECRET);
      expect(JSON.stringify(r)).not.toContain(PEM_BODY);
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(PEM_BODY);
    log.mockRestore();
  });

  it("is refused for a non-admin before anything is stored", async () => {
    staffAllowed = false;
    await expect(saveRenderKey("gcp", SA_FILE, { region: "asia-southeast1", job: "clip-ffmpeg" })).rejects.toThrow("forbidden");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("saveVideoEngine", () => {
  it("stores Google Cloud Run as the pick", async () => {
    await expect(saveVideoEngine({ engine: "cloudrun", fallback: true, rendiMaxSeconds: 60, enabled: false })).resolves.toEqual({ ok: true });
    expect(upsert.mock.calls[0][0]).toMatchObject({ video_engine: "cloudrun", video_fallback: true });
  });

  it("refuses an unknown engine and saves nothing", async () => {
    // @ts-expect-error — deliberately outside the union
    const r = await saveVideoEngine({ engine: "ffmpeg", fallback: true, rendiMaxSeconds: 60, enabled: false });
    expect(r).toEqual({ ok: false, error: "ตัวตัดต่อไม่ถูกต้อง" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses a Rendi limit that is neither plan's", async () => {
    const r = await saveVideoEngine({ engine: "rendi", fallback: true, rendiMaxSeconds: 90, enabled: false });
    expect(r.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses a fallback that is not a boolean instead of coercing it", async () => {
    // @ts-expect-error — deliberately wrong type
    const r = await saveVideoEngine({ engine: "rendi", fallback: "false", rendiMaxSeconds: 60, enabled: false });
    expect(r.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses an enabled that is not a boolean instead of coercing it", async () => {
    // @ts-expect-error — deliberately wrong type
    const r = await saveVideoEngine({ engine: "rendi", fallback: true, rendiMaxSeconds: 60, enabled: "true" });
    expect(r.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("stores the engine, the fallback and the limit", async () => {
    await expect(saveVideoEngine({ engine: "lambda", fallback: false, rendiMaxSeconds: 600, enabled: true })).resolves.toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({ id: true, video_engine: "lambda", video_fallback: false, rendi_max_seconds: 600, video_edit_enabled: true });
  });

  it("says in Thai when the database refuses", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    upsert.mockResolvedValue({ error: { message: "boom" } });
    const r = await saveVideoEngine({ engine: "rendi", fallback: true, rendiMaxSeconds: 60, enabled: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ไม่สำเร็จ/);
    log.mockRestore();
  });

  it("is refused for a non-admin", async () => {
    staffAllowed = false;
    await expect(saveVideoEngine({ engine: "rendi", fallback: true, rendiMaxSeconds: 60, enabled: false })).rejects.toThrow("forbidden");
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("loadAiPage render keys", () => {
  it("shows Rendi's last four and AWS's region and function, and never the secret or key id", async () => {
    const aws = `AKIAEXAMPLEID:${SECRET}:ap-southeast-1:clip-ffmpeg`;
    rpc.mockImplementation(async (fn: string) => fn === "ins_get_api_keys"
      ? { data: [{ provider: "aws", api_key: aws }, { provider: "rendi", api_key: "rendi-whole-key-9999" }, { provider: "openai", api_key: "sk-x" }], error: null }
      : { error: null });
    const rows = [
      { provider: "aws", tail: "ffmpeg".slice(-4), enabled: true },
      { provider: "rendi", tail: "9999", enabled: true },
      { provider: "openai", tail: "sk-x", enabled: true },
    ];
    tableRows = rows;
    const { loadAiPage } = await import("@/app/admin/ai/actions");
    const page = await loadAiPage();
    expect(page.video.keys).toEqual([
      { provider: "aws", shown: "ap-southeast-1 · clip-ffmpeg" },
      { provider: "rendi", shown: "••••9999" },
    ]);
    const wire = JSON.stringify(page);
    expect(wire).not.toContain(SECRET);
    expect(wire).not.toContain("AKIAEXAMPLEID");
    expect(page.keys.map((k) => k.provider)).toEqual(["openai"]);
    tableRows = [];
  });

  it("shows Google's project, region and job — never the private key or the service account's email", async () => {
    await saveRenderKey("gcp", SA_FILE, { region: "asia-southeast1", job: "clip-ffmpeg" });
    const stored = (rpc.mock.calls[0][1] as { p_key: string }).p_key;
    rpc.mockReset().mockImplementation(async (fn: string) => fn === "ins_get_api_keys"
      ? { data: [{ provider: "gcp", api_key: stored }, { provider: "aws", api_key: `AKIAEXAMPLEID:${SECRET}:ap-southeast-1:clip-ffmpeg` }], error: null }
      : { error: null });
    tableRows = [
      { provider: "gcp", tail: stored.slice(-4), enabled: true },
      { provider: "aws", tail: "fmpeg".slice(-4), enabled: true },
    ];
    const { loadAiPage } = await import("@/app/admin/ai/actions");
    const page = await loadAiPage();
    expect(page.video.keys).toEqual([
      { provider: "gcp", shown: "my-proj · asia-southeast1 · clip-ffmpeg" },
      { provider: "aws", shown: "ap-southeast-1 · clip-ffmpeg" },
    ]);
    const wire = JSON.stringify(page);
    for (const secret of [PEM_BODY, "PRIVATE KEY", SA_EMAIL, "client_email", "iam.gserviceaccount.com", SECRET]) expect(wire).not.toContain(secret);
    expect(page.keys).toEqual([]);
    tableRows = [];
  });

  it("a Google key that cannot be read shows as held, nothing more", async () => {
    rpc.mockImplementation(async (fn: string) => fn === "ins_get_api_keys" ? { data: [{ provider: "gcp", api_key: `{"private_key":"${SECRET}"}` }], error: null } : { error: null });
    tableRows = [{ provider: "gcp", tail: "xx\"}", enabled: true }];
    const { loadAiPage } = await import("@/app/admin/ai/actions");
    const page = await loadAiPage();
    expect(page.video.keys).toEqual([{ provider: "gcp", shown: "ตั้งไว้แล้ว" }]);
    expect(JSON.stringify(page)).not.toContain(SECRET);
    tableRows = [];
  });
});
