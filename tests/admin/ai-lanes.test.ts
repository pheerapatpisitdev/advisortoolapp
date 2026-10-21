import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ลำดับหลักและสำรอง on ตั้งค่า AI (owner, 2026-10-21, mockup v3 https://claude.ai/artifact/JmmL9bs2ZBqhBi829bjUey)

let saved: unknown = {};
let lanesError: { message: string } | null = null;
let upserted: Record<string, unknown> | null = null;
const MODELS = [
  { id: "gemini-small", provider: "google", kind: "text", model_name: "gemini-3.1-flash-lite", enabled: true, price: { inputPerMTokUsd: 0.25, outputPerMTokUsd: 1.5 } },
  { id: "gemini-large", provider: "google", kind: "text", model_name: "gemini-3.7-flash", enabled: true, price: { inputPerMTokUsd: 0.75, outputPerMTokUsd: 3.75 } },
  { id: "claude-large", provider: "anthropic", kind: "text", model_name: "claude-sonnet-5", enabled: true, price: { inputPerMTokUsd: 2, outputPerMTokUsd: 10 } },
  { id: "gpt-small", provider: "openai", kind: "text", model_name: "gpt-5-mini", enabled: true, price: { inputPerMTokUsd: 0.25, outputPerMTokUsd: 2 } },
  { id: "zai-small", provider: "zai", kind: "text", model_name: "glm-5.3-flash", enabled: true, price: { inputPerMTokUsd: 0.15, outputPerMTokUsd: 0.5 } },
  { id: "deepseek-small", provider: "deepseek", kind: "text", model_name: "deepseek-flash", enabled: true, price: { inputPerMTokUsd: 0.3, outputPerMTokUsd: 1.2 } },
  { id: "deepseek-large", provider: "deepseek", kind: "text", model_name: "deepseek-v4-pro", enabled: true, price: { inputPerMTokUsd: 1.32, outputPerMTokUsd: 3.96 } },
  { id: "openrouter-gemma-free", provider: "openrouter", kind: "text", model_name: "google/gemma-4-31b-it:free", enabled: true, price: { inputPerMTokUsd: 0, outputPerMTokUsd: 0 } },
  { id: "gpt-image-medium", provider: "openai", kind: "image", model_name: "gpt-image-2", enabled: true, price: { perImageUsd: 0.012 } },
  { id: "gemini-image", provider: "google", kind: "image", model_name: "gemini-3.1-flash-image", enabled: true, price: { perImageUsd: 0.067 } },
];
/** keys held: OpenAI's switched off, as it is in prod on 2026-10-21; DeepSeek's not yet pasted */
const KEYS = [{ provider: "google", enabled: true }, { provider: "anthropic", enabled: true }, { provider: "openai", enabled: false }, { provider: "zai", enabled: true }, { provider: "gcp", enabled: true }];

vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/ai/client", () => ({ clearAiConfigCache: () => undefined, providerKey: async () => null, voiceLane: async () => [] }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async () => ({
      data: [
        { task: "route", model: "gemini-3.1-flash-lite", calls: 796 },
        { task: "plan_info", model: "gemini-3.1-flash-lite", calls: 182 },
        { task: "content-plan", model: "gemini-3.1-flash-lite", calls: 174 },
        { task: "content", model: "claude-sonnet-5", calls: 379 },
        { task: "content-image", model: "gpt-image-2", calls: 194 },
        { task: "content-image", model: "gemini-3.1-flash-image", calls: 82 },
        { task: "quote-video-voice", model: "eleven_v3", calls: 341 },
      ],
      error: null,
    }),
    from: (table: string) => ({
      select: () => {
        if (table === "model_configs") return Promise.resolve({ data: MODELS });
        if (table === "ins_model_prefs") return Promise.resolve({ data: [] });
        if (table === "ins_api_keys") return Promise.resolve({ data: KEYS });
        return { maybeSingle: async () => ({ data: lanesError ? null : { lanes: saved }, error: lanesError }) };
      },
      upsert: async (v: Record<string, unknown>) => { upserted = v; return { error: null }; },
    }),
  }),
}));

const { loadLanes, saveLanes } = await import("@/app/admin/ai/lanes-actions");
const { LanesCard } = await import("@/app/admin/ai/LanesCard");

beforeEach(() => {
  saved = {};
  lanesError = null;
  upserted = null;
});

describe("loadLanes", () => {
  it("shows each lane's defaults with what can be used now and the last 30 days' work", async () => {
    const { lanes, savable } = await loadLanes();
    expect(savable).toBe(true);
    const small = lanes.find((l) => l.key === "bot-small")!;
    expect(small.entries[0]).toEqual({ id: "gemini-3.1-flash-lite", on: true });
    const status = (id: string) => small.options.find((o) => o.id === id)?.status;
    expect(status("gemini-3.1-flash-lite")).toBe("ready");
    expect(status("gpt-5-mini")).toBe("off-provider");
    expect(status("deepseek-flash")).toBe("no-key");
    // the bot's own work only: Studio's planning is not counted here
    expect(small.used["gemini-3.1-flash-lite"]).toBe(796 + 182);
    expect(lanes.find((l) => l.key === "write-help")!.used["gemini-3.1-flash-lite"]).toBe(174);
    expect(lanes.find((l) => l.key === "write-post")!.used["claude-sonnet-5"]).toBe(379);
    expect(lanes.find((l) => l.key === "image-plain")!.used["gpt-image-medium"]).toBe(194);
    expect(lanes.find((l) => l.key === "image-face")!.used["gemini-image"]).toBe(82);
    expect(lanes.find((l) => l.key === "voice")!.used.elevenlabs).toBe(341);
  });

  it("never offers the free model, and offers only picture readers for reading pictures", async () => {
    const { lanes } = await loadLanes();
    for (const l of lanes) expect(l.options.map((o) => o.id)).not.toContain("google/gemma-4-31b-it:free");
    const read = lanes.find((l) => l.key === "write-read")!.options.map((o) => o.id);
    expect(read).toContain("deepseek-flash");
    expect(read).not.toContain("deepseek-v4-pro");
    expect(read).not.toContain("glm-5.3-flash");
  });

  it("prices a lane in its own unit", async () => {
    const { lanes } = await loadLanes();
    const price = (key: string, id: string) => lanes.find((l) => l.key === key)!.options.find((o) => o.id === id)!.price;
    expect(price("bot-small", "gemini-3.1-flash-lite")).toBe("฿30");
    expect(price("write-post", "claude-sonnet-5")).toBe("฿0.61 / ชิ้น");
    expect(price("image-plain", "gpt-image-medium")).toBe("฿0.43 / รูป");
  });

  it("before its migration: the defaults show, and saving is held back", async () => {
    lanesError = { message: "column ins_ai_settings.lanes does not exist" };
    const { lanes, savable } = await loadLanes();
    expect(savable).toBe(false);
    expect(lanes.find((l) => l.key === "voice")!.entries.map((e) => e.id)).toEqual(["gemini-api", "gemini-cloud", "elevenlabs"]);
    expect(await saveLanes([{ key: "voice", entries: [{ id: "gemini-cloud", on: true }] }])).toMatchObject({ ok: false });
  });
});

describe("saveLanes", () => {
  it("saves a group's lanes, keeping the other groups as they were", async () => {
    saved = { voice: [{ id: "gemini-cloud", on: true }] };
    const r = await saveLanes([{ key: "bot-small", entries: [{ id: "deepseek-flash", on: true }, { id: "gemini-3.1-flash-lite", on: true }] }]);
    expect(r).toEqual({ ok: true });
    expect(upserted?.lanes).toEqual({
      voice: [{ id: "gemini-cloud", on: true }],
      "bot-small": [{ id: "deepseek-flash", on: true }, { id: "gemini-3.1-flash-lite", on: true }],
    });
  });

  it("refuses a lane with nothing on that can be used now", async () => {
    const r = await saveLanes([{ key: "bot-small", entries: [{ id: "gpt-5-mini", on: true }, { id: "gemini-3.1-flash-lite", on: false }] }]);
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("ไม่มีตัวที่พร้อมใช้") });
    expect(upserted).toBeNull();
  });

  it("refuses what the lane may not hold, twice the same, or a lane that is not one", async () => {
    expect(await saveLanes([{ key: "write-read", entries: [{ id: "glm-5.3-flash", on: true }] }])).toMatchObject({ ok: false });
    expect(await saveLanes([{ key: "bot-small", entries: [{ id: "google/gemma-4-31b-it:free", on: true }] }])).toMatchObject({ ok: false });
    expect(await saveLanes([{ key: "bot-small", entries: [{ id: "gemini-3.1-flash-lite", on: true }, { id: "gemini-3.1-flash-lite", on: false }] }])).toMatchObject({ ok: false });
    expect(await saveLanes([{ key: "nonsense", entries: [] }])).toMatchObject({ ok: false });
    expect(upserted).toBeNull();
  });
});

describe("the card", () => {
  it("opens on Autobot with the main choice marked and the four groups to pick from", async () => {
    const html = renderToStaticMarkup(createElement(LanesCard, await loadLanes()));
    for (const g of ["Autobot", "เขียน", "รูปภาพ", "เสียง"]) expect(html).toContain(g);
    expect(html).toContain("ลำดับหลักและสำรอง");
    expect(html).toContain(">หลัก<");
    expect(html).toContain(">สำรอง 1<");
    expect(html).toContain("ข้าม · ปิดค่ายอยู่");
    expect(html).toContain("ข้าม · ยังไม่มีกุญแจ");
    expect(html).toContain("อ่านคำถาม · ตอบสั้น · ตอบเรื่องแบบประกัน");
  });
});
