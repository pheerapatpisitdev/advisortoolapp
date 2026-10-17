import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";
import { REMOTION_DRAWING, REMOTION_JOB, remotionFits, type ClipProps } from "@/lib/quote-video/remotion";
import type { VideoInput } from "@/lib/quote-video/script";
import { clipKind } from "@/lib/quote-video/progress";

/**
 * วิดีโอนำเสนอ's Motion Graphic clips drawn by Remotion (owner, 2026-10-17; remotion.ts): a portrait
 * Life Protect clip is marked when made, as the /admin/ai switch says, and is handed to the Remotion
 * job with its props, voice and cut-outs as links, no frame drawn on Vercel. The rest are made as before.
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
const sw = vi.hoisted(() => ({ who: "all" as "off" | "owner" | "all" }));
vi.mock("@/lib/quote-video/remotion-switch", () => ({ remotionFor: async () => sw.who }));
vi.mock("@/lib/collage/library", async (orig) => ({ ...(await orig<object>()), pieceSticker: async (k: string) => Buffer.from(`sticker-${k}`) }));
vi.mock("@/lib/quote-video/contact", () => ({ getContact: async () => ({ phone: "0812345678" }), photoDataUri: async () => null }));
vi.mock("@/lib/content/poster-png", () => ({ renderPng: async () => Buffer.from("png") }));

const { createVideo, finishVideo, produce } = await import("@/lib/quote-video/make");

const agent = { kind: "unitos", agentId: "a1", name: "ตัวแทน", staff: null } as unknown as Viewer;
const owner = { ...agent, staff: { owner: true, publish: true, connect: true, admin: true } } as unknown as Viewer;
const lp = (over: Partial<VideoInput> = {}): VideoInput => ({ product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000, style: "motion", theme: "collage", ...over } as VideoInput);
const pcm = () => Buffer.alloc(24000 * 2);
const rowOf = (id: string) => db.rows.find((r) => r.id === id)!;
const drawCalls = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([u]) => String(u).includes("/api/quote-video/draw")).length;

beforeEach(() => {
  sw.who = "all";
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
  it("takes a portrait Motion Graphic Life Protect clip only, as the trial measured", () => {
    expect(remotionFits(lp())).toBe(true);
    expect(remotionFits(lp({ product: undefined } as Partial<VideoInput>))).toBe(true);
    expect(remotionFits(lp({ style: "classic" }))).toBe(false);
    expect(remotionFits(lp({ size: "square" }))).toBe(false);
    expect(remotionFits(lp({ size: "landscape" }))).toBe(false);
    expect(remotionFits(lp({ product: "ISHIELD" } as Partial<VideoInput>))).toBe(false);
    expect(remotionFits({ product: "IHEALTHY", age: 35, sex: "F", plan: "SILVER", compare: [], style: "motion" } as VideoInput)).toBe(false);
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

  it("a clip Remotion has not been tried on stays on the frames, whatever the switch", async () => {
    for (const input of [lp({ style: "classic" }), lp({ size: "square" }), lp({ product: "ISHIELD" } as Partial<VideoInput>)]) {
      expect(await engineOf(owner, input)).toBeUndefined();
    }
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
});
