import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";
import { DEFAULT_PRICES, pictureSatang } from "@/lib/wallet/prices";
import { PAINTERS } from "@/lib/content/models";
import { promptStoryPrice, type PromptScene, type PromptStoryInput } from "@/lib/prompt-story/types";

/**
 * คลิปตามโจทย์ through the clip pipeline (make.ts): one hold for the clip and its pictures, the
 * pictures drawn first and filed with the voice, and one scene's picture drawn again for one
 * picture's price, the clip cut again from the kept voice.
 */

type Row = Record<string, unknown> & { id: string };
const db = vi.hoisted(() => ({ tick: 0, rows: [] as Row[], drafts: [] as Row[], files: new Map<string, Buffer>(), downloads: [] as string[], notes: [] as { step: string; done: number; of: number }[] }));

/** a small in-memory stand-in for the rows the pipeline reads and writes: the clips, and the written drafts */
function table(name: string) {
  const list = name === "ins_prompt_drafts" ? db.drafts : db.rows;
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
      // each row a moment after the last, as the database's clock would have them
      const now = new Date(Date.now() + ++db.tick).toISOString();
      const row: Row = {
        id: randomUUID(), created_at: now, updated_at: now, status: "drawing", deleted_at: null, video_path: null, job: null,
        error: null, hold_id: null, paid_by: null, held_satang: null, multiplier: null, cost_thb: 0, charged_satang: null, progress: null,
        ...patch,
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
    lte: (k: string, v: string) => { filters.push((r) => String(val(r, k)) <= v); return b; },
    eq: (k: string, v: unknown) => { filters.push((r) => val(r, k) === v); return b; },
    neq: (k: string, v: unknown) => { filters.push((r) => val(r, k) !== v); return b; },
    in: (k: string, vs: unknown[]) => { filters.push((r) => vs.includes(val(r, k))); return b; },
    is: (k: string, v: unknown) => { filters.push((r) => (val(r, k) ?? null) === v); return b; },
    not: (k: string, _op: string, v: unknown) => { filters.push((r) => (val(r, k) ?? null) !== v); return b; },
    lt: (k: string, v: string) => { filters.push((r) => String(val(r, k)) < v); return b; },
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
  download: async (path: string) => {
    db.downloads.push(path);
    const f = db.files.get(path);
    return f ? { data: new Blob([new Uint8Array(f)]), error: null } : { data: null, error: { message: "missing" } };
  },
  list: async (prefix: string) => ({ data: [...db.files.keys()].filter((k) => k.startsWith(`${prefix}/`)).map((k) => ({ name: k.slice(prefix.length + 1) })) }),
  remove: async (paths: string[]) => { for (const p of paths) db.files.delete(p); return { error: null }; },
  createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ signedUrl: `https://x/${p}` })), error: null }),
  createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: `https://x/up/${path}` }, error: null }),
  createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://x/${path}` }, error: null }),
};
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: (name: string) => table(name), storage: { from: () => bucket } }) }));

const wallet = vi.hoisted(() => ({
  walletSettings: vi.fn(), walletPrices: vi.fn(), holdWallet: vi.fn(), walletFrozen: vi.fn(),
  balanceSatang: vi.fn(), releaseWallet: vi.fn(), settleWallet: vi.fn(),
}));
vi.mock("@/lib/wallet/store", () => wallet);
const pass = vi.hoisted(() => ({ open: true }));
vi.mock("@/lib/members/access", async (orig) => ({
  ...(await orig<typeof import("@/lib/members/access")>()),
  memberAccess: async () => ({ gated: false }),
  passOpen: () => pass.open,
}));

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
vi.mock("@/lib/quote-video/contact", () => ({ getContact: async () => ({ phone: "0812345678" }), photoDataUri: async () => null }));
vi.mock("@/lib/content/poster-png", () => ({ renderPng: async () => Buffer.from("png") }));
// ภาพจากคลัง: the library's store and the part laid on the look's ground, faked
const lib = vi.hoisted(() => ({ okUploads: vi.fn(), uploadFile: vi.fn(), assetPicture: vi.fn() }));
vi.mock("@/lib/scene-library/uploads", () => ({ okUploads: (...a: unknown[]) => lib.okUploads(...a), uploadFile: (...a: unknown[]) => lib.uploadFile(...a) }));
vi.mock("@/lib/prompt-story/asset-picture", () => ({ assetPicture: (...a: unknown[]) => lib.assetPicture(...a) }));

const { createPromptStory, deleteVideo, finishVideo, isStuck, produce, redrawPicture, sweepStuckVideos, voiceFullUntil } = await import("@/lib/quote-video/make");
const { clipStates } = await import("@/lib/quote-video/rows");
const { VOICE_FULL } = await import("@/lib/quote-video/voice-quota");
const { paidLine } = await import("@/lib/quote-video/paid-line");

/** no drawing route since every clip is drawn by Remotion (owner, 2026-10-20): any fetch here is a mistake */
const route = async () => new Response("{}", { status: 404 });

const agent = { kind: "unitos", agentId: "a1", name: "ตัวแทน", staff: null } as unknown as Viewer;
// the free clips' machinery, as a member has it while the pass is switched off: a UnitClub agent
// has no free clips since the ฿15 starter credit took their place (owner, 2026-10-18)
const taster = { kind: "member", agentId: "a1", name: "ตัวแทน", staff: null } as unknown as Viewer;
const owner = { ...agent, staff: { owner: true, publish: true, connect: true, admin: true } } as unknown as Viewer;

const input = (over: Partial<PromptStoryInput> = {}): PromptStoryInput => ({
  product: "FREESTORY", draftId: "draft-1", brief: "ทุน 1 ล้าน ปีละ 12000 บาท", title: "ดูแลครอบครัว", caption: "ทักมาคุยกันได้",
  scenes: [
    { voice: "ถ้าวันหนึ่งเสาหลักของบ้านหายไป", screen: "ถ้าเสาหลักหายไป", picture: "a quiet family kitchen" },
    { voice: "ค่าบ้าน ค่าเรียน ยังอยู่ครบ", screen: "ค่าใช้จ่ายยังอยู่", picture: "bills on a table" },
    { voice: "ทุน 1 ล้าน ดูแลคนข้างหลังได้", screen: "ทุน 1 ล้าน", picture: "a parent hugging a child" },
  ],
  style: "cartoon", painter: "standard", faces: { narrator: "w26" }, ...over,
});

const pcm = () => Buffer.alloc(24000 * 2);
const picture = (n: number) => Buffer.from(`picture-${n}`);
let drawn = 0;

beforeEach(() => {
  db.rows.length = 0;
  db.drafts.length = 0;
  db.drafts.push({ id: "draft-1", agent_id: "a1", made_clip_id: null });
  db.files.clear();
  db.downloads.length = 0;
  db.notes.length = 0;
  drawn = 0;
  pass.open = true;
  for (const f of Object.values(wallet)) f.mockReset();
  wallet.walletSettings.mockResolvedValue({ enabled: true, multiplier: 1 });
  wallet.walletPrices.mockResolvedValue({ ...DEFAULT_PRICES });
  wallet.holdWallet.mockImplementation(async () => `hold-${randomUUID()}`);
  wallet.settleWallet.mockImplementation(async (_h: string, charge: number) => charge);
  wallet.walletFrozen.mockResolvedValue(false);
  wallet.releaseWallet.mockResolvedValue(undefined);
  ai.draw.mockReset();
  ai.draw.mockImplementation(async () => ({ bytes: picture(++drawn) }));
  ai.speak.mockReset();
  ai.speak.mockImplementation(async () => ({ pcm: pcm(), costThb: 0.01 }));
  ai.submit.mockReset();
  ai.submit.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn(route));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/** the agent's two free clips, used */
const freeUsedUp = () => {
  for (let i = 0; i < 2; i++) db.rows.push({ id: randomUUID(), agent_id: "a1", paid_by: "free", status: "done", deleted_at: null, input: {} });
};
const rowOf = (id: string) => db.rows.find((r) => r.id === id)!;

const scene = (n: number, over: Partial<PromptScene> = {}): PromptScene => ({ voice: `ประโยค${"abcde"[n]}`, screen: "คำบนจอ", picture: `picture words ${"abcde"[n]}`, ...over });
/** hook, card, number, compare, check with a photo: only the card (1) and the check (4) carry a picture */
const motion = (over: Partial<PromptStoryInput> = {}): PromptStoryInput => input({
  design: "motion",
  scenes: [
    scene(0, { motion: { kind: "hook", lines: ["ถ้าเสาหลักหายไป"], key: 0, icon: "home" } }),
    scene(1, { motion: { kind: "card", tag: "ค่าใช้จ่ายยังอยู่", chips: ["ค่าบ้าน", "ค่าเรียน"] } }),
    scene(2, { motion: { kind: "number", value: 12000, unit: "บาท", tag: "ปีละ", bill: "ค่างวดต่อปี" } }),
    scene(3, { motion: { kind: "compare", title: "เทียบกัน", bad: { head: "ไม่มี", lines: ["ลำบาก", "เครียด"] }, good: { head: "มี", lines: ["สบายใจ", "ตั้งหลักได้"] } } }),
    scene(4, { motion: { kind: "check", lines: ["เช็กให้ครบ", "ก่อนตัดสินใจ"], ticks: ["ทุน", "ค่างวด", "ความคุ้มครอง"], photo: true } }),
  ],
  ...over,
});
const doneMotion = async (over: Partial<PromptStoryInput> = {}) => {
  const made = await createPromptStory(agent, motion(over), "");
  if (!("id" in made)) throw new Error(made.refusal);
  await produce(made.id, "ตัวแทน");
  return made.id;
};

describe("โมชันกราฟิก clip", () => {
  it("draws only the scenes that paint and files null for the rest", async () => {
    const id = await doneMotion();
    expect(ai.draw).toHaveBeenCalledTimes(2);
    expect((rowOf(id).input as PromptStoryInput).pictures).toEqual([null, `${id}/pic-1.png`, null, null, `${id}/pic-4.png`]);
    expect(db.notes.filter((n) => n.step === "pictures").map((n) => [n.done, n.of])).toEqual([[0, 2], [1, 2], [2, 2]]);
  });

  it("holds exactly what promptStoryPrice says", async () => {
    freeUsedUp();
    const made = await createPromptStory(agent, motion(), "");
    expect("id" in made).toBe(true);
    expect(wallet.holdWallet).toHaveBeenCalledWith("a1", promptStoryPrice(motion(), DEFAULT_PRICES), "quote-video-prompt");
    expect(promptStoryPrice(motion(), DEFAULT_PRICES)).toBe(DEFAULT_PRICES.videoPrompt + 2 * pictureSatang(DEFAULT_PRICES, "standard")!);
  });

  it("a free clip holds the two pictures only", async () => {
    const made = await createPromptStory(taster, motion(), "");
    expect(rowOf((made as { id: string }).id).held_satang).toBe(2 * pictureSatang(DEFAULT_PRICES, "standard")!);
  });

  it("a failed card picture refunds one picture", async () => {
    freeUsedUp();
    ai.draw.mockImplementation(async (a: { prompt: string }) => {
      if (a.prompt.includes("picture words b")) throw new Error("painter down");
      return { bytes: picture(++drawn) };
    });
    const id = await doneMotion();
    expect((rowOf(id).input as PromptStoryInput).pictures).toEqual([null, null, null, null, `${id}/pic-4.png`]);
    expect(rowOf(id).held_satang).toBe(promptStoryPrice(motion(), DEFAULT_PRICES) - pictureSatang(DEFAULT_PRICES, "standard")!);
  });

  it("names a layout fault by แบบฉาก", async () => {
    const v = motion();
    v.scenes[0] = { ...v.scenes[0], motion: { kind: "hook", lines: ["ก".repeat(23)], key: 0, icon: "home" } };
    const made = await createPromptStory(agent, v, "");
    expect("refusal" in made && made.refusal).toMatch(/ฉากที่ 1 .*แบบฉาก: /);
    expect(db.rows).toHaveLength(0);
  });

  it("refuses to draw again a scene that does not paint, and takes nothing", async () => {
    const made = await createPromptStory(agent, motion(), "");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    await finishVideo(structuredClone(rowOf(id)) as never, "done", `${id}/quote.mp4`);
    wallet.holdWallet.mockClear();
    expect(await redrawPicture(agent, id, 0)).toEqual({ ok: false, error: "ฉากนี้เป็นภาพจากระบบ ไม่มีภาพ AI ให้วาดใหม่" });
    expect(wallet.holdWallet).not.toHaveBeenCalled();
    expect(await redrawPicture(agent, id, 1)).toEqual({ ok: true });
  });
});
