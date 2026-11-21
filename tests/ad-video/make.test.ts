import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";
import { quoteVideoFacts, type VideoInput } from "@/lib/quote-video/script";
import { fixedPlan } from "@/lib/ad-video/plan";
import type { AdPlan } from "@/lib/ad-video/keys";
import type { Viewer } from "@/lib/auth/access";

/**
 * วิดีโอโฆษณา through the clip pipeline (make.ts): an ad clip is a Motion quote clip whose input carries
 * the plan. It speaks the plan, draws its photos first (a failed one not charged), and hands Remotion
 * the photos as links with the closing words.
 */

type Row = Record<string, unknown> & { id: string };
const db = vi.hoisted(() => ({ tick: 0, rows: [] as Row[], files: new Map<string, Buffer>(), notes: [] as { step: string; done: number; of: number }[] }));

/** a small in-memory stand-in for the clip rows the pipeline reads and writes (as tests/prompt-story/make.test.ts) */
function table() {
  const list = db.rows;
  let op: "select" | "insert" | "update" | "delete" = "select";
  let patch: Record<string, unknown> = {};
  let head = false;
  const filters: ((r: Row) => boolean)[] = [];
  const val = (r: Row, k: string) => {
    const m = /^(\w+)->>(\w+)$/.exec(k);
    return m ? (r[m[1]] as Record<string, unknown> | null)?.[m[2]] : r[k];
  };
  const run = () => {
    if (op === "insert") {
      const now = new Date(Date.now() + ++db.tick).toISOString();
      const row: Row = {
        id: randomUUID(), created_at: now, updated_at: now, status: "drawing", deleted_at: null, video_path: null, job: null,
        error: null, hold_id: null, paid_by: null, held_satang: null, multiplier: null, cost_thb: 0, progress: null, ...patch,
      };
      list.push(row);
      return [row];
    }
    const hit = list.filter((r) => filters.every((f) => f(r)));
    if (op === "delete") { for (const r of hit) list.splice(list.indexOf(r), 1); return []; }
    if (op === "update") for (const r of hit) Object.assign(r, structuredClone(patch));
    if (op === "update" && hit.length && patch.progress) db.notes.push(patch.progress as never);
    return hit.map((r) => structuredClone(r));
  };
  const b = {
    select: (_c?: string, o?: { head?: boolean }) => { head = Boolean(o?.head); return b; },
    insert: (v: Record<string, unknown>) => { op = "insert"; patch = structuredClone(v); return b; },
    update: (v: Record<string, unknown>) => { op = "update"; patch = v; return b; },
    delete: () => { op = "delete"; return b; },
    eq: (k: string, v: unknown) => { filters.push((r) => val(r, k) === v); return b; },
    neq: (k: string, v: unknown) => { filters.push((r) => val(r, k) !== v); return b; },
    in: (k: string, vs: unknown[]) => { filters.push((r) => vs.includes(val(r, k))); return b; },
    is: (k: string, v: unknown) => { filters.push((r) => (val(r, k) ?? null) === v); return b; },
    not: (k: string, _op: string, v: unknown) => { filters.push((r) => (val(r, k) ?? null) !== v); return b; },
    lt: (k: string, v: string) => { filters.push((r) => String(val(r, k)) < v); return b; },
    lte: (k: string, v: string) => { filters.push((r) => String(val(r, k)) <= v); return b; },
    gte: (k: string, v: unknown) => { if (typeof v === "string") filters.push((r) => String(val(r, k)) >= v); return b; },
    like: (k: string, pat: string) => { filters.push((r) => String(val(r, k) ?? "").startsWith(pat.replace(/%$/, ""))); return b; },
    order: () => b, limit: () => b,
    single: async () => { const d = run(); return { data: d[0] ?? null, error: d[0] ? null : { message: "no row" } }; },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    then: (ok: (v: unknown) => unknown, no?: (e: unknown) => unknown) => {
      const d = run();
      return Promise.resolve({ data: d, error: null, count: head ? d.length : null }).then(ok, no);
    },
  };
  return b;
}

const bucket = {
  upload: async (path: string, body: Buffer | string) => { db.files.set(path, Buffer.from(body)); return { error: null }; },
  createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ signedUrl: `https://x/${p}` })), error: null }),
  createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: `https://x/up/${path}` }, error: null }),
  createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://x/${path}` }, error: null }),
};
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: () => table(), storage: { from: () => bucket } }) }));

const wallet = vi.hoisted(() => ({
  walletSettings: vi.fn(), walletPrices: vi.fn(), holdWallet: vi.fn(), walletFrozen: vi.fn(),
  balanceSatang: vi.fn(), releaseWallet: vi.fn(), settleWallet: vi.fn(),
}));
vi.mock("@/lib/wallet/store", () => wallet);
vi.mock("@/lib/members/access", async (orig) => ({
  ...(await orig<typeof import("@/lib/members/access")>()),
  memberAccess: async () => ({ gated: false }),
  passOpen: () => true,
}));
// the clip's reader as speak.ts has it, unless a test says the chosen ElevenLabs voice could not speak (then Google read it)
const voice = vi.hoisted(() => ({ google: false }));
vi.mock("@/lib/quote-video/speak", async (orig) => {
  const real = await orig<typeof import("@/lib/quote-video/speak")>();
  return {
    ...real,
    speakClip: async (lines: string[], o: Parameters<typeof real.speakClip>[1]) => (voice.google
      ? { spoken: lines.map(() => ({ pcm: Buffer.alloc(24000 * 2), costThb: 0.01 })), fellBackTo: null, google: o.narrator === "M" ? "Orus" : "Kore" }
      : real.speakClip(lines, o)),
  };
});

const ai = vi.hoisted(() => ({ draw: vi.fn(), speak: vi.fn(), submit: vi.fn() }));
vi.mock("@/lib/ai/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/client")>()),
  providerKey: async () => "key",
  drawImage: (...a: unknown[]) => ai.draw(...a),
}));
vi.mock("@/lib/ai/tts", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/tts")>()),
  speakLine: (...a: unknown[]) => ai.speak(...a),
}));
vi.mock("@/lib/ai/ledger", () => ({ recordUsage: async () => undefined }));
vi.mock("@/lib/video/engines/cloudrun", () => ({ cloudRunEngine: () => ({ submit: (...a: unknown[]) => ai.submit(...a) }) }));
vi.mock("@/lib/google-font", () => ({ googleFontSubset: async () => undefined }));
vi.mock("@/lib/quote-video/contact", () => ({ getContact: async () => ({ phone: "0812345678" }), photoDataUri: async () => null }));

const { createVideo, produce, videoPrice, clipRound } = await import("@/lib/quote-video/make");
const { adCta, adParts, adPrice, adScript } = await import("@/lib/ad-video/make");
const { boardOf } = await import("@/lib/quote-video/board");
const { clipProps } = await import("@/lib/quote-video/remotion");

const TODAY = new Date("2026-11-22T00:00:00+07:00");
const LP: VideoInput = { variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 };
const lp = quoteVideoFacts(LP, TODAY)!;
const plan = (art: AdPlan["art"] = "mixed"): AdPlan => fixedPlan(lp, { art, mode: "pick", body: ["price", "value"] });
type AdInput = VideoInput & { ad: AdPlan };
const adInput = (over: Partial<AdInput> = {}, art: AdPlan["art"] = "mixed"): AdInput =>
  ({ ...LP, style: "motion", length: "short", narrator: "M", ad: plan(art), ...over }) as AdInput;
const contact = { name: "ตัวแทน", phone: "0812345678" };

const pcm = () => Buffer.alloc(24000 * 2);
let drawn = 0;

beforeEach(() => {
  voice.google = false;
  db.rows.length = 0;
  db.files.clear();
  db.notes.length = 0;
  drawn = 0;
  for (const f of Object.values(wallet)) f.mockReset();
  wallet.walletSettings.mockResolvedValue({ enabled: true, multiplier: 1 });
  wallet.walletPrices.mockResolvedValue({ ...DEFAULT_PRICES });
  wallet.releaseWallet.mockResolvedValue(undefined);
  wallet.holdWallet.mockImplementation(async () => `hold-${randomUUID()}`);
  wallet.walletFrozen.mockResolvedValue(false);
  ai.draw.mockReset();
  ai.draw.mockImplementation(async () => ({ bytes: Buffer.from(`photo-${++drawn}`) }));
  ai.speak.mockReset();
  ai.speak.mockImplementation(async () => ({ pcm: pcm(), costThb: 0.01 }));
  ai.submit.mockReset();
  ai.submit.mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/** an ad clip's row, paid from the wallet: its whole price held */
function adRow(input: VideoInput): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.rows.push({
    id, agent_id: "a1", customer_name: "", input, status: "drawing", deleted_at: null, video_path: null, job: null, error: null,
    paid_by: "wallet", hold_id: "hold-1", held_satang: videoPrice(input, DEFAULT_PRICES), multiplier: 1, cost_thb: 0, cost_parts: null,
    progress: null, created_at: now, updated_at: now,
  });
  return id;
}
const rowOf = (id: string) => db.rows.find((r) => r.id === id)!;
const propsOf = (id: string) => JSON.parse(db.files.get(`${id}/job.json`)!.toString()).remotion.props as Record<string, unknown> & {
  scenes: { key: string }[]; ad?: { photos: (string | null)[]; cta: string }; shown: { headline?: string[] };
};

describe("ad board and price", () => {
  it("lists an ad clip on its own board", () => {
    expect(boardOf({ ad: plan() })).toBe("ad");
    expect(boardOf({})).toBe("quote");
    expect(boardOf({ product: "STORY" })).toBe("story");
  });

  it("prices the Motion clip, its voice, and each photo it draws", () => {
    expect(adPrice(adInput(), DEFAULT_PRICES)).toBe(1000 + 2 * 500);
    expect(adPrice(adInput({}, "motion"), DEFAULT_PRICES)).toBe(1000);
    expect(adPrice(adInput({}, "photo"), DEFAULT_PRICES)).toBe(1000 + 4 * 500);
    expect(adPrice(adInput({ voice: "el-voice" }), DEFAULT_PRICES)).toBe(1000 + 2 * 500 + 200);
    // the clip's price is the ad's, and its round the quote clips'
    expect(videoPrice(adInput(), DEFAULT_PRICES)).toBe(2000);
    expect(clipRound(adInput())).toBe("quote-video");
  });
});

describe("ad script and parts", () => {
  it("speaks the hook, each body and the closing, in a man's voice", () => {
    const lines = adScript(lp, plan(), "M");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "value", "contact"]);
    for (const l of lines) expect(l.voice).not.toMatch(/ค่ะ|คะ(?=\s|$)/);
    expect(lines[3].voice).toMatch(/ครับ$/);
    expect(lines[0].voice).toBe(plan().hook.voice.replace(/นะคะ/g, "นะครับ").replace(/ค่ะ/g, "ครับ").replace(/คะ(?=\s|$)/g, "ครับ"));
  });

  it("a man's voice turns endings that punctuation follows, as the AI writes them (R12)", () => {
    const p: AdPlan = { ...plan(), hook: { ...plan().hook, voice: "อายุ 35 ออมวันละเท่าไหร่ดีคะ? รู้ไหมคะ?" }, cta: { key: "chat", voice: "ทักมาขอใบเสนอได้เลยนะคะ!" } };
    const lines = adScript(lp, p, "M");
    for (const l of lines) expect(l.voice).not.toMatch(/ค่ะ|คะ(?!แนน)/);
    expect(lines[0].voice).toBe("อายุ 35 ออมวันละเท่าไหร่ดีครับ? รู้ไหมครับ?");
    expect(lines[3].voice).toBe("ทักมาขอใบเสนอได้เลยนะครับ!");
  });

  it("shows the closing words without the particle", () => {
    expect(adCta("บอกแค่อายุ ทักมาขอใบเสนอของคุณได้เลยนะคะ")).toBe("บอกแค่อายุ ทักมาขอใบเสนอของคุณได้เลย");
    expect(adCta("ทักมานัดคุย 15 นาที ช่วยดูแผนให้ฟรีค่ะ")).toBe("ทักมานัดคุย 15 นาที ช่วยดูแผนให้ฟรี");
    expect(adCta("ทักมาเลยครับ")).toBe("ทักมาเลย");
  });

  it("plans a portrait Motion clip with the hook's headline and a photo place per scene", () => {
    const input = adInput({ pictures: ["x/pic-0.png", null, null, "x/pic-3.png"] });
    const parts = adParts(lp, input, input.ad, contact, "M", [3, 4, 4, 3]);
    expect(parts.plans).toHaveLength(4);
    expect(parts.size).toBe("portrait");
    expect(parts.motion).toBe(true);
    expect(parts.motion$?.shown.headline).toEqual(plan().hook.headline);
    expect(parts.motion$?.shown.loop).toBe(false);
    expect(parts.motion$?.shown.priceJar).toBeUndefined();
    expect(parts.motion$?.shown.coverRoad).toBeUndefined();
    expect(parts.motion$?.recipe).toBeUndefined();
    expect(parts.motion$?.customer).toBe("");
    expect(parts.motion$?.theme).toBe("board");
    expect(parts.motion$?.ad?.photos).toEqual(["x/pic-0.png", null, null, "x/pic-3.png"]);
    expect(parts.motion$?.ad?.cta).toBe(adCta(plan().cta.voice));
    // no photos yet: still one place a scene
    expect(adParts(lp, adInput(), plan(), contact, "M", [3, 4, 4, 3]).motion$?.ad?.photos).toEqual([null, null, null, null]);
    // ไวท์บอร์ด or แบบเดิม only: a festival or any other look is drawn as ไวท์บอร์ด
    expect(adParts(lp, adInput({ theme: "navy" }), plan(), contact, "M", [3, 4, 4, 3]).motion$?.theme).toBe("navy");
    for (const theme of ["festival", "glass", "chat"] as const) {
      expect(adParts(lp, adInput({ theme }), plan(), contact, "M", [3, 4, 4, 3]).motion$?.theme).toBe("board");
    }
    expect(() => adParts(lp, input, input.ad, contact, "M", [3, 4])).toThrow();
  });

  it("leaves a clip without an ad's props as they were", () => {
    const motion = { theme: "board" as const, sex: "M" as const, facts: lp, customer: "", narrator: "M" as const, contact, shown: { loop: false, extra: adParts(lp, adInput(), plan(), contact, "M", [3, 4, 4, 3]).motion$!.shown.extra } };
    expect("ad" in clipProps(motion, [], [], [], 10, "a.wav")).toBe(false);
  });
});

describe("produce, ad clip", () => {
  it("draws the photos its scenes need, speaks the plan, and hands Remotion the photos as links", async () => {
    const id = adRow(adInput());
    await produce(id, "ตัวแทน");
    const row = rowOf(id);
    expect(row.error).toBeNull();
    expect(row.status).toBe("rendering");
    // mixed: the opening and the closing scene only
    expect(ai.draw).toHaveBeenCalledTimes(2);
    expect((row.input as VideoInput).pictures).toEqual([`${id}/pic-0.png`, null, null, `${id}/pic-3.png`]);
    expect(db.files.has(`${id}/pic-0.png`)).toBe(true);
    expect(db.files.has(`${id}/pic-3.png`)).toBe(true);
    expect(row.held_satang).toBe(2000);
    expect(ai.speak).toHaveBeenCalledTimes(4);
    expect(db.notes.filter((n) => n.step === "pictures").at(-1)).toEqual({ step: "pictures", done: 2, of: 2 });
    expect(ai.submit).toHaveBeenCalledTimes(1);
    const props = propsOf(id);
    expect(props.scenes.map((s) => s.key)).toEqual(["lead", "price", "value", "contact"]);
    expect(props.shown.headline).toEqual(plan().hook.headline);
    expect(props.ad?.photos[0]).toBe(`https://x/${id}/pic-0.png`);
    expect(props.ad?.photos.slice(1, 3)).toEqual([null, null]);
    expect(props.ad?.photos[3]).toBe(`https://x/${id}/pic-3.png`);
    expect(props.ad?.cta).toBe(adCta(plan().cta.voice));
  });

  it("a photo that cannot be drawn is not charged, and the clip still goes", async () => {
    ai.draw.mockRejectedValue(new Error("painter down"));
    const id = adRow(adInput());
    await produce(id, "ตัวแทน");
    const row = rowOf(id);
    expect(row.status).toBe("rendering");
    expect((row.input as VideoInput).pictures).toEqual([null, null, null, null]);
    expect(row.held_satang).toBe(2000 - 2 * 500);
    expect(ai.submit).toHaveBeenCalledTimes(1);
    expect(propsOf(id).ad?.photos).toEqual([null, null, null, null]);
  });

  it("a motion-only ad draws nothing", async () => {
    const id = adRow(adInput({}, "motion"));
    await produce(id, "ตัวแทน");
    expect(ai.draw).not.toHaveBeenCalled();
    expect(db.notes.some((n) => n.step === "pictures")).toBe(false);
    expect(rowOf(id).status).toBe("rendering");
  });

  it("an idea the plan lacks is drawn from the product's fixed photo", async () => {
    const p = plan("photo");
    const id = adRow(adInput({ ad: { ...p, photos: { hook: "a calm beach at dawn" } } }));
    await produce(id, "ตัวแทน");
    const prompts = ai.draw.mock.calls.map((c) => (c[0] as { prompt: string }).prompt);
    expect(prompts).toHaveLength(4);
    expect(prompts.some((x) => x.includes("a calm beach at dawn"))).toBe(true);
    for (const x of prompts) expect(x).not.toMatch(/[ก-๙]/);
  });
});

describe("paying for an ad clip", () => {
  // a member's pass with free clips left: the free clip covers the Motion clip only (R11)
  const taster = { kind: "member", agentId: "a1", name: "ตัวแทน", staff: null } as unknown as Viewer;

  it("a free ad clip still holds its photos from the wallet", async () => {
    const made = await createVideo(taster, adInput(), "");
    expect("id" in made).toBe(true);
    const row = rowOf((made as { id: string }).id);
    expect(row.paid_by).toBe("free");
    expect(row.held_satang).toBe(2 * 500);
    expect(wallet.holdWallet).toHaveBeenCalledWith("a1", 1000, "quote-video");
  });

  it("a free motion-only ad holds nothing", async () => {
    const made = await createVideo(taster, adInput({}, "motion"), "");
    const row = rowOf((made as { id: string }).id);
    expect(row.paid_by).toBe("free");
    expect(row.hold_id).toBeNull();
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("a free ad clip's photos are refused in words about the photos when the wallet is shut", async () => {
    wallet.walletSettings.mockResolvedValue({ enabled: false, multiplier: 1 });
    const made = await createVideo(taster, adInput(), "");
    expect("refusal" in made && made.refusal).toMatch(/ค่าภาพประกอบ/);
  });

  it("photos not drawn and the voice switched both come off the hold", async () => {
    ai.draw.mockRejectedValue(new Error("painter down"));
    voice.google = true;
    const input = adInput({ voice: "el-voice" });
    const id = adRow(input);
    const start = videoPrice(input, DEFAULT_PRICES);
    expect(start).toBe(1000 + 2 * 500 + 200);
    await produce(id, "ตัวแทน");
    const row = rowOf(id);
    expect(row.status).toBe("rendering");
    expect(row.held_satang).toBe(start - 2 * 500 - 200);
  });
});
