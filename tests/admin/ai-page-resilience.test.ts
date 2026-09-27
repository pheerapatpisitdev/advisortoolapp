import { describe, expect, it, vi } from "vitest";

/**
 * /admin/ai when things go wrong.
 *
 * The page is where the keys are, which is the first place anybody goes when the AI is
 * misbehaving — so a ledger that cannot be read must not take it down, and a save the server
 * refuses must come back as a Thai sentence, not as a throw Next turns into English.
 */

let upsertError: { message: string } | null = null;

vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/ai/client", () => ({ clearAiConfigCache: () => undefined, testProviders: async () => [] }));
vi.mock("@/lib/ai/ledger", () => ({
  monthStart: () => new Date("2026-09-01T00:00:00Z"),
  monthSpend: async () => { throw new Error("อ่านค่าใช้จ่าย AI ไม่ได้: boom"); },
}));
vi.mock("@/lib/content/store", () => ({ contentBaht: () => 0, DEFAULT_CONTENT_CAP_THB: 30 }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async () => ({ data: null, error: null }),
    from: (table: string) => {
      const q = {
        order: () => q,
        eq: async () => ({ error: null }),
        upsert: async () => ({ error: upsertError }),
        update: () => q,
        maybeSingle: async () => ({ data: { small_model: null, large_model: null, monthly_budget_thb: "500", content_budget_thb: null } }),
        then: (ok: (v: unknown) => unknown) => {
          const data = table === "model_configs"
            ? [
                { id: "gpt-image-medium", provider: "openai", kind: "image", model_name: "gpt-image-2", enabled: true, params: { quality: "medium" } },
                { id: "gpt-image-high", provider: "openai", kind: "image", model_name: "gpt-image-2", enabled: true, params: { quality: "high" } },
                { id: "claude-large", provider: "anthropic", kind: "text", model_name: "claude-sonnet-5", enabled: true, params: null },
              ]
            : [];
          return Promise.resolve({ data, error: null }).then(ok);
        },
      };
      return { select: () => q, upsert: q.upsert, update: q.update };
    },
  }),
}));

const { loadAiPage, saveSettings, saveApiKey, setProviderEnabled } = await import("@/app/admin/ai/actions");

describe("/admin/ai when the ledger is down", () => {
  it("still opens, with the spend marked unknown rather than zero", async () => {
    const page = await loadAiPage();
    expect(page.spentThisMonth).toBeNull();
    expect(page.spend).toEqual([]);
    expect(page.content).toEqual({ spent: null, cap: 30, fallback: 30 });
    expect(page.providers).toContain("anthropic");
  });

  it("tells the two gpt-image-2 rows apart by the quality each is asked for", async () => {
    const page = await loadAiPage();
    const images = page.models.filter((m) => m.model_name === "gpt-image-2");
    expect(images.map((m) => m.quality)).toEqual(["medium", "high"]);
    expect(page.models.find((m) => m.id === "claude-large")?.quality).toBeNull();
  });
});

describe("saves answer instead of throwing", () => {
  it("refuses a ฿0 month in Thai", async () => {
    await expect(saveSettings("", "", "0", "")).resolves.toEqual({ ok: false, error: "งบต้องมากกว่า 0 — ถ้าไม่อยากจำกัดให้เว้นว่าง" });
  });

  it("saves an ordinary budget", async () => {
    upsertError = null;
    await expect(saveSettings("", "", "120", "25")).resolves.toEqual({ ok: true });
  });

  it("says a database refusal rather than throwing it", async () => {
    upsertError = { message: "permission denied" };
    const r = await saveSettings("", "", "120", "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("บันทึกค่าเริ่มต้นไม่สำเร็จ");
    upsertError = null;
  });

  it("refuses a short key and an unknown company without throwing", async () => {
    await expect(saveApiKey("anthropic", "abc")).resolves.toMatchObject({ ok: false });
    await expect(setProviderEnabled("xai", true)).resolves.toEqual({ ok: false, error: "ค่ายไม่ถูกต้อง" });
  });
});
