import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";
import { REMOTION_DRAWING, REMOTION_JOB, remotionFits, remotionPlan, remotionPlanOf, type ClipProps, type StoryClipProps } from "@/lib/quote-video/remotion";
import { checkedStory, storyScript, type StoryVideoInput } from "@/lib/quote-video/story";
import type { PromptStoryInput } from "@/lib/prompt-story/types";
import type { VideoInput } from "@/lib/quote-video/script";
import { clipKind } from "@/lib/quote-video/progress";

/**
 * วิดีโอนำเสนอ's Motion Graphic clips drawn by Remotion (owner, 2026-10-17; remotion.ts): a portrait
 * Life Protect or iHealthy clip is marked when made, as the /admin/ai switch's row for its plan says,
 * and is handed to the Remotion job with its props, voice, cut-outs and (Chinese, Russian, Burmese)
 * script face as links, no frame drawn on Vercel. The rest are made as before.
 */

type Row = Record<string, unknown> & { id: string };
const db = vi.hoisted(() => ({ rows: [] as Row[], drafts: [] as Row[], files: new Map<string, Buffer>(), downloads: [] as string[], notes: [] as { step: string; done: number; of: number }[] }));

/** a small in-memory stand-in for the rows the pipeline reads and writes: the clips, and the written drafts */
function table(name: string) {
  const list = name === "ins_prompt_drafts" ? db.drafts : db.rows;
  let op: "select" | "insert" | "update" = "select";
  let patch: Record<string, unknown> = {};
  let head = false;
  const filters: ((r: Row) => boolean)[] = [];
  const val = (r: Row, k: string) => {
    const m = /^(\w+)->>(\w+)$/.exec(k);
    return m ? (r[m[1]] as Record<string, unknown> | null)?.[m[2]] : r[k];
  };
  const run = () => {
    if (op === "insert") {
      const now = new Date().toISOString();
      const row: Row = {
        id: randomUUID(), created_at: now, updated_at: now, status: "drawing", deleted_at: null, video_path: null, job: null,
        error: null, hold_id: null, paid_by: null, held_satang: null, multiplier: null, cost_thb: 0, charged_satang: null, progress: null,
        ...patch,
      };
      list.push(row);
      return [row];
    }
    const hit = list.filter((r) => filters.every((f) => f(r)));
    if (op === "update") for (const r of hit) Object.assign(r, structuredClone(patch));
    if (op === "update" && hit.length && patch.progress) db.notes.push(patch.progress as never);
    return hit.map((r) => structuredClone(r));
  };
  const b = {
    select: (_c?: string, o?: { head?: boolean }) => { head = Boolean(o?.head); return b; },
    insert: (v: Record<string, unknown>) => { op = "insert"; patch = structuredClone(v); return b; },
    update: (v: Record<string, unknown>) => { op = "update"; patch = v; return b; },
    eq: (k: string, v: unknown) => { filters.push((r) => val(r, k) === v); return b; },
    neq: (k: string, v: unknown) => { filters.push((r) => val(r, k) !== v); return b; },
    in: (k: string, vs: unknown[]) => { filters.push((r) => vs.includes(val(r, k))); return b; },
    is: (k: string, v: unknown) => { filters.push((r) => (val(r, k) ?? null) === v); return b; },
    not: (k: string, _op: string, v: unknown) => { filters.push((r) => (val(r, k) ?? null) !== v); return b; },
    gte: () => b, order: () => b, limit: () => b,
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
// the engine as built: which job it was told to run (the Remotion render names its own), then what it was handed
vi.mock("@/lib/video/engines/cloudrun", () => ({ cloudRunEngine: (_k: string, deps: { job?: string } = {}) => ({ submit: (...a: unknown[]) => ai.submit(deps.job ?? "clip-ffmpeg", ...a) }) }));
const sw = vi.hoisted(() => ({ who: "all" as "off" | "owner" | "all", ih: "owner" as "off" | "owner" | "all", asked: [] as string[] }));
vi.mock("@/lib/quote-video/remotion-switch", () => ({ remotionFor: async (plan: string) => { sw.asked.push(plan); return plan === "IHEALTHY" ? sw.ih : sw.who; } }));
// the script face as Google gives it, cut down: two weights, or nothing when it cannot be had
const font = vi.hoisted(() => ({ asked: [] as string[], fails: false }));
vi.mock("@/lib/google-font", () => ({
  googleFontSubset: async (family: string, text: string) => {
    font.asked.push(`${family}\n${text}`);
    return font.fails ? undefined : [400, 600].map((weight) => ({ name: family, data: new TextEncoder().encode(`${family}-${weight}`).buffer, weight, style: "normal" }));
  },
}));
vi.mock("@/lib/collage/library", async (orig) => ({ ...(await orig<object>()), pieceSticker: async (k: string) => Buffer.from(`sticker-${k}`) }));
vi.mock("@/lib/quote-video/contact", () => ({ getContact: async () => ({ phone: "0812345678" }), photoDataUri: async () => null }));
vi.mock("@/lib/content/poster-png", () => ({ renderPng: async () => Buffer.from("png") }));

const { createVideo, finishVideo, produce } = await import("@/lib/quote-video/make");

const agent = { kind: "unitos", agentId: "a1", name: "ตัวแทน", staff: null } as unknown as Viewer;
const owner = { ...agent, staff: { owner: true, publish: true, connect: true, admin: true } } as unknown as Viewer;
const lp = (over: Partial<VideoInput> = {}): VideoInput => ({ product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000, style: "motion", theme: "collage", ...over } as VideoInput);
const ih = (over: Partial<VideoInput> = {}): VideoInput => ({
  product: "IHEALTHY", age: 40, sex: "F", plan: "BRONZE", compare: ["SILVER", "GOLD"],
  setup: "base=WLF99H&sa=150000&area=&cover=&r=MEB%3A1000&r=DCI%3A%3A200000", style: "motion", theme: "navy", ...over,
} as VideoInput);
const pcm = () => Buffer.alloc(24000 * 2);
const rowOf = (id: string) => db.rows.find((r) => r.id === id)!;
const drawCalls = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([u]) => String(u).includes("/api/quote-video/draw")).length;

beforeEach(() => {
  sw.who = "all";
  sw.ih = "owner";
  sw.asked.length = 0;
  font.asked.length = 0;
  font.fails = false;
  db.rows.length = 0;
  db.files.clear();
  db.downloads.length = 0;
  db.notes.length = 0;
  for (const f of Object.values(wallet)) f.mockReset();
  wallet.walletSettings.mockResolvedValue({ enabled: true, multiplier: 1 });
  wallet.walletPrices.mockResolvedValue({ ...DEFAULT_PRICES });
  wallet.holdWallet.mockImplementation(async () => `hold-${randomUUID()}`);
  wallet.settleWallet.mockImplementation(async (_h: string, charge: number) => charge);
  wallet.walletFrozen.mockResolvedValue(false);
  ai.speak.mockReset();
  ai.speak.mockImplementation(async () => ({ pcm: pcm(), costThb: 0.01 }));
  ai.submit.mockReset();
  ai.submit.mockResolvedValue(undefined);
  // the drawing route answers as drawn, without drawing: only whether it was asked matters here
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("remotionFits", () => {
  it("takes a portrait Motion Graphic Life Protect, iHealthy or iShield clip only, as the trials measured", () => {
    expect(remotionFits(lp())).toBe(true);
    expect(remotionFits(lp({ product: undefined } as Partial<VideoInput>))).toBe(true);
    expect(remotionFits(lp({ style: "classic" }))).toBe(false);
    expect(remotionFits(lp({ size: "square" }))).toBe(false);
    expect(remotionFits(lp({ size: "landscape" }))).toBe(false);
    // iShield: the Remotion move's phase 1 (owner chose ก ก, 2026-10-19)
    expect(remotionFits(lp({ product: "ISHIELD", variant: "WLCI20" } as Partial<VideoInput>))).toBe(true);
    expect(remotionFits(lp({ product: "ISHIELD", variant: "WLCI20", style: "classic" } as Partial<VideoInput>))).toBe(false);
    expect(remotionFits(lp({ product: "ISHIELD", variant: "WLCI20", size: "square" } as Partial<VideoInput>))).toBe(false);
    expect(remotionFits(lp({ product: "PLB" } as Partial<VideoInput>))).toBe(false);
    expect(remotionFits(ih())).toBe(true);
    expect(remotionFits(ih({ lang: "zh" } as Partial<VideoInput>))).toBe(true);
    expect(remotionFits(ih({ style: "classic" }))).toBe(false);
    expect(remotionFits(ih({ size: "square" }))).toBe(false);
    expect(remotionFits(ih({ size: "landscape" }))).toBe(false);
  });
  it("names the plan whose row on the switch a clip follows", () => {
    expect(remotionPlan(lp())).toBe("LIFEPROTECT");
    expect(remotionPlan(lp({ product: undefined } as Partial<VideoInput>))).toBe("LIFEPROTECT");
    expect(remotionPlan(ih())).toBe("IHEALTHY");
    expect(remotionPlan(lp({ product: "ISHIELD", variant: "WLCI20" } as Partial<VideoInput>))).toBe("ISHIELD");
    expect(remotionPlan(ih({ size: "square" }))).toBeNull();
  });
});

describe("คลิปเล่าเรื่อง and คลิปตามโจทย์ on Remotion (owner chose ก ก ก, 2026-10-19)", () => {
  it("every size follows the tool's own row; an FHC summary never", () => {
    for (const size of ["portrait", "square", "landscape"]) {
      expect(remotionPlanOf({ product: "STORY", size } as never)).toBe("STORY");
      expect(remotionPlanOf({ product: "FREESTORY", size } as never)).toBe("FREESTORY");
    }
    expect(remotionPlanOf({ fhc: {}, style: "motion" } as never)).toBeNull();
    expect(remotionPlanOf(lp({ style: "classic" }))).toBeNull();
  });
  it("guesses a Remotion story clip's progress from Remotion story clips", () => {
    expect(clipKind({ product: "STORY", engine: "remotion" })).toBe("story-remotion");
    expect(clipKind({ product: "FREESTORY" })).toBe("story");
  });
});

it("a Remotion clip's progress is guessed from Remotion clips, not the frames'", () => {
  expect(clipKind({ style: "motion", engine: "remotion" })).toBe("remotion-full");
  expect(clipKind({ style: "motion", engine: "remotion", length: "short" })).toBe("remotion-short");
  expect(clipKind({ style: "motion" })).toBe("motion-full");
});

const engineOf = async (viewer: Viewer, input = lp()) => {
  const made = await createVideo(viewer, input, "");
  return (rowOf((made as { id: string }).id).input as VideoInput).engine;
};

describe("createVideo, as the switch says", () => {
  it("Remotion ทุกคน: every agent's portrait Motion Graphic Life Protect clip", async () => {
    expect(await engineOf(agent)).toBe("remotion");
    expect(await engineOf(owner)).toBe("remotion");
  });

  it("Remotion เฉพาะเจ้าของ: the owner's alone", async () => {
    sw.who = "owner";
    expect(await engineOf(owner)).toBe("remotion");
    expect(await engineOf(agent)).toBeUndefined();
  });

  it("เครื่องเดิม ทุกคน: nobody's", async () => {
    sw.who = "off";
    expect(await engineOf(owner)).toBeUndefined();
    expect(await engineOf(agent)).toBeUndefined();
  });

  it("each plan follows its own row: iHealthy the owner's alone while Life Protect is everyone's", async () => {
    expect(await engineOf(owner, ih())).toBe("remotion");
    expect(await engineOf(agent, ih())).toBeUndefined();
    expect(await engineOf(agent)).toBe("remotion");
    expect(sw.asked).toEqual(["IHEALTHY", "IHEALTHY", "LIFEPROTECT"]);
    sw.ih = "all";
    expect(await engineOf(agent, ih({ lang: "my" } as Partial<VideoInput>))).toBe("remotion");
    sw.ih = "off";
    expect(await engineOf(owner, ih())).toBeUndefined();
  });

  it("a clip Remotion has not been tried on stays on the frames, whatever the switch", async () => {
    sw.ih = "all";
    for (const input of [ih({ size: "square" }), ih({ size: "landscape" }), ih({ style: "classic" })]) {
      expect(await engineOf(owner, input)).toBeUndefined();
    }
    for (const input of [lp({ style: "classic" }), lp({ size: "square" }), lp({ product: "ISHIELD", variant: "WLCI20", size: "square" } as Partial<VideoInput>)]) {
      expect(await engineOf(owner, input)).toBeUndefined();
    }
  });

  it("iShield follows its own row (the Remotion move's phase 1)", async () => {
    sw.who = "owner";
    sw.asked.length = 0;
    const is = lp({ product: "ISHIELD", variant: "WLCI20" } as Partial<VideoInput>);
    expect(await engineOf(owner, is)).toBe("remotion");
    expect(await engineOf(agent, is)).toBeUndefined();
    expect(sw.asked).toEqual(["ISHIELD", "ISHIELD"]);
  });
});

const pool = (over: Record<string, unknown> = {}): StoryVideoInput => {
  const st = checkedStory({ topic: "pool48", faces: { narrator: "w26", hero: "w15" }, ...over }, "F");
  if (typeof st === "string") throw new Error(st);
  return st;
};
const free = (over: Partial<PromptStoryInput> = {}): PromptStoryInput => ({
  product: "FREESTORY", brief: "", title: "ดูแลคนที่เรารัก", caption: "", style: "flat", painter: "sharp", narrator: "M", faces: { narrator: "m03" },
  scenes: [{ voice: "ทุกครอบครัวมีคนที่เรารัก", screen: "ดูแลคนที่เรารัก", picture: "ครอบครัว" }, { voice: "วางแผนวันนี้", screen: "วางแผน", picture: "โต๊ะ" }], ...over,
});

describe("createVideo, คลิปเล่าเรื่อง and คลิปตามโจทย์", () => {
  it("as their rows say, owner-only to start", async () => {
    sw.who = "owner";
    expect((rowOf((await createVideo(owner, pool({ size: "landscape" }), "") as { id: string }).id).input as StoryVideoInput).engine).toBe("remotion");
    expect((rowOf((await createVideo(agent, pool(), "") as { id: string }).id).input as StoryVideoInput).engine).toBeUndefined();
    expect((rowOf((await createVideo(owner, free(), "") as { id: string }).id).input as PromptStoryInput).engine).toBe("remotion");
    expect(sw.asked).toEqual(["STORY", "STORY", "FREESTORY"]);
    sw.who = "off";
    expect((rowOf((await createVideo(owner, pool(), "") as { id: string }).id).input as StoryVideoInput).engine).toBeUndefined();
  });
});

describe("produce, a story clip drawn by Remotion", () => {
  it("draws no frame, puts the voice up, and hands StoryClip the input and each scene's place", async () => {
    const made = await createVideo(owner, pool({ size: "square" }), "สมชาย");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    const row = rowOf(id);
    expect(row.error).toBeNull();
    expect(row.status).toBe("rendering");
    expect(drawCalls()).toBe(0);
    expect(db.files.has(`${id}/voice.wav`)).toBe(true);
    expect(ai.submit.mock.calls[0][0]).toBe(REMOTION_JOB);
    const props = JSON.parse(db.files.get(`${id}/job.json`)!.toString()).remotion.props as StoryClipProps;
    expect(props.composition).toBe("StoryClip");
    expect(props.kind).toBe("story");
    expect(props.size).toBe("square");
    expect(props.drawing).toBe(REMOTION_DRAWING);
    expect(props.customer).toBe("สมชาย");
    expect(props.scenes.map((x) => x.key)).toEqual(storyScript(row.input as StoryVideoInput, "สมชาย", "F").map((x) => x.key));
    expect(props.scenes.every((x) => x.picture === undefined)).toBe(true);
    expect(props.audio).toBe(`https://x/${id}/voice.wav`);
    expect(props.total).toBe(row.duration_sec);
    expect((row as { cost_parts?: { engine?: string } }).cost_parts?.engine).toBe("remotion");
  });

  it("a คลิปตามโจทย์ links each scene's picture where it was filed, and none on the card", async () => {
    ai.draw.mockResolvedValue({ bytes: Buffer.from("picture") });
    const made = await createVideo(owner, free(), "");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    const row = rowOf(id);
    expect(row.error).toBeNull();
    expect(row.status).toBe("rendering");
    expect(drawCalls()).toBe(0);
    const props = JSON.parse(db.files.get(`${id}/job.json`)!.toString()).remotion.props as StoryClipProps;
    expect(props.kind).toBe("free");
    expect(props.scenes.map((x) => x.key)).toEqual(["freeScene", "freeScene", "storyContact"]);
    expect(props.scenes.map((x) => x.picture)).toEqual([`https://x/${id}/pic-0.png`, `https://x/${id}/pic-1.png`, undefined]);
  });

  it("with the row on เครื่องเดิม, a story clip is drawn on Vercel as before", async () => {
    sw.who = "off";
    const made = await createVideo(owner, pool(), "");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    expect(rowOf(id).status).toBe("rendering");
    expect(drawCalls()).toBeGreaterThan(0);
    expect(ai.submit.mock.calls[0][0]).toBe("clip-ffmpeg");
  });
});

describe("produce, drawn by Remotion", () => {
  it("draws no frame, puts the voice and the cut-outs up, and hands the props to the Remotion job", async () => {
    const made = await createVideo(agent, lp(), "");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    const row = rowOf(id);
    expect(row.error).toBeNull();
    expect(row.status).toBe("rendering");
    expect(drawCalls()).toBe(0);
    expect(db.files.has(`${id}/voice.wav`)).toBe(true);
    expect([...db.files.keys()].filter((k) => k.includes("/piece-")).sort()).toEqual([
      `${id}/piece-contact-hand-phone.png`, `${id}/piece-cover-umbrella.png`, `${id}/piece-price-hand-coins.png`,
    ]);
    expect(ai.submit).toHaveBeenCalledTimes(1);
    expect(ai.submit.mock.calls[0][0]).toBe(REMOTION_JOB);
    const payload = JSON.parse(db.files.get(`${id}/job.json`)!.toString());
    const props = payload.remotion.props as ClipProps;
    expect(props.scenes.map((s) => s.key)).toEqual(["lead", "price", "cover", "value", "contact"]);
    expect(props.theme).toBe("collage");
    expect(props.drawing).toBe(REMOTION_DRAWING);
    expect(props.facts.lead.amount).toBe("2,000,000");
    expect(props.audio).toBe(`https://x/${id}/voice.wav`);
    expect(props.pieces["price/hand-coins"]).toBe(`https://x/${id}/piece-price-hand-coins.png`);
    expect(props.total).toBe(row.duration_sec);
    expect(payload.uploads.out_1.path).toBe(`${id}/quote.mp4`);
    // the job answers the same callback as clip-ffmpeg's
    await finishVideo(structuredClone(row) as never, "done", `${id}/quote.mp4`);
    expect(rowOf(id).status).toBe("done");
  });

  it("with the switch on เครื่องเดิม, a Motion Graphic clip is drawn on Vercel and cut by clip-ffmpeg", async () => {
    sw.who = "off";
    const made = await createVideo(agent, lp(), "");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    expect(rowOf(id).status).toBe("rendering");
    expect(drawCalls()).toBe(5);
    expect(ai.submit.mock.calls[0][0]).toBe("clip-ffmpeg");
    expect(JSON.parse(db.files.get(`${id}/job.json`)!.toString()).remotion).toBeUndefined();
  });

  it("an iHealthy clip goes the same way, its riders in the facts, with no script face in Thai", async () => {
    const made = await createVideo(owner, ih(), "");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    const row = rowOf(id);
    expect(row.error).toBeNull();
    expect(row.status).toBe("rendering");
    expect(drawCalls()).toBe(0);
    expect(ai.submit.mock.calls[0][0]).toBe(REMOTION_JOB);
    const props = JSON.parse(db.files.get(`${id}/job.json`)!.toString()).remotion.props as ClipProps;
    expect(props.scenes.map((s) => s.key)).toContain("compare");
    expect(props.facts.product).toBe("IHEALTHY");
    expect(props.scriptFont).toBeUndefined();
    expect(font.asked).toEqual([]);
  });

  it.each([["zh", "Noto Sans SC"], ["ru", "Noto Sans"], ["my", "Noto Sans Myanmar"]] as const)("in %s, the old engine's face (%s) goes up beside the voice, cut to the clip's letters", async (lang, family) => {
    const made = await createVideo(owner, ih({ lang } as Partial<VideoInput>), "");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    expect(rowOf(id).error).toBeNull();
    expect(rowOf(id).status).toBe("rendering");
    expect(font.asked).toHaveLength(1);
    const [asked, text] = font.asked[0].split("\n");
    expect(asked).toBe(family);
    const props = JSON.parse(db.files.get(`${id}/job.json`)!.toString()).remotion.props as ClipProps;
    // every word on screen is among the letters the face was cut to
    for (const ch of new Set(props.scenes.map((s) => s.voice).join(""))) expect(text).toContain(ch);
    expect(props.scriptFont).toEqual([
      { url: `https://x/${id}/script-400.ttf`, weight: 400 }, { url: `https://x/${id}/script-600.ttf`, weight: 600 },
    ]);
    expect(db.files.get(`${id}/script-600.ttf`)!.toString()).toBe(`${family}-600`);
  });

  it("a script face that cannot be had fails the clip, and nothing is charged", async () => {
    font.fails = true;
    sw.ih = "all";
    wallet.releaseWallet.mockResolvedValue(undefined);
    const made = await createVideo(agent, ih({ lang: "zh" } as Partial<VideoInput>), "");
    const id = (made as { id: string }).id;
    expect((rowOf(id).input as VideoInput).engine).toBe("remotion");
    // as though paid from the wallet: the hold is what must go back
    Object.assign(rowOf(id), { paid_by: "wallet", hold_id: "hold-x" });
    await produce(id, "ตัวแทน");
    expect(rowOf(id).status).toBe("failed");
    expect(ai.submit).not.toHaveBeenCalled();
    expect(wallet.releaseWallet).toHaveBeenCalledWith("hold-x");
    expect(wallet.settleWallet).not.toHaveBeenCalled();
  });
});
