import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";
import { PIECES } from "@/lib/collage/library";
import { pickPieces } from "@/lib/collage/pick";
import { cleanFhc, events, scores, toPlanInput } from "@/lib/fhc/health";
import { gapsOf } from "@/lib/fhc/gaps";
import { FIXED_PICK } from "@/lib/plan/order";
import { realPricer } from "@/lib/plan/pricer";
import { recommend } from "@/lib/plan/recommend";
import { fhcVideoFacts, type FhcVideoFacts, type FhcVideoInput } from "@/lib/quote-video/fhc";
import { fhcRoom } from "@/lib/quote-video/fhc-motion";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";

/**
 * คอลลาจกระดาษ in สรุป FHC (owner chose ก ก ก, 2026-10-17, mockup https://claude.ai/artifact/RcQRD93uywHi12PhSWVGbH):
 * the clip repainted in its theme, and in portrait each scene's library piece, picked by AI from
 * its line, laid in the room the scene leaves free.
 */

/** a real one-pixel PNG with its piece's name after it, so each sticker's bytes are its own */
const STICKER = vi.hoisted(() => (k: string) => Buffer.concat([
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"), Buffer.from(`sticker-${k}`),
]));

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
  chat: (...a: unknown[]) => chatAsk.fn(...a),
}));
vi.mock("@/lib/ai/tts", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/tts")>()),
  speakLine: (...a: unknown[]) => ai.speak(...a),
}));
vi.mock("@/lib/ai/ledger", () => ({ recordUsage: async () => undefined }));
vi.mock("@/lib/video/engines/cloudrun", () => ({ cloudRunEngine: () => ({ submit: (...a: unknown[]) => ai.submit(...a) }) }));
vi.mock("@/lib/collage/library", async (orig) => ({ ...(await orig<object>()), pieceSticker: async (k: string) => STICKER(k) }));
vi.mock("@/lib/collage/pick", async (orig) => ({ ...(await orig<object>()), drawnPieces: async () => PIECES.filter((p) => ["piggy", "handshake", "hand-wave", "hand-phone", "umbrella"].includes(p.key)) }));
const chatAsk = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@/lib/quote-video/contact", () => ({ getContact: async () => ({ phone: "0812345678" }), photoDataUri: async () => null }));
const drawnTrees = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/content/poster-png", () => ({ renderPng: async (el: unknown) => { drawnTrees.push(JSON.stringify(el)); return Buffer.from("png"); } }));

const { createVideo, drawScene, produce } = await import("@/lib/quote-video/make");

const agent = { kind: "unitos", agentId: "a1", name: "ตัวแทน", staff: null } as unknown as Viewer;
const rowOf = (id: string) => db.rows.find((r) => r.id === id)!;

/** the FHC tests' สมชาย: six scores, four covers, five events, two plans */
function somchai(): FhcVideoFacts {
  const f = cleanFhc({
    age: 35, sex: "M", income: 45_000, expense: 32_000, cash: 50_000, fixed: 30_000, lifeCover: 500_000, ciCover: 0,
    healthNow: "none", hospital: "private", lifeWant: "save", retireAge: 60, retireMonthly: 25_000, pensionHave: 3_000,
    budget: 7_000, carLoan: 300_000, people: [{ relation: "child", age: 5 }, { relation: "spouse", age: 33 }],
  });
  if (typeof f === "string") throw new Error(f);
  const p = toPlanInput(f);
  const plan = recommend(p, realPricer(p.age, p.sex), FIXED_PICK);
  const sc = scores(f);
  return fhcVideoFacts({ age: f.age, sex: f.sex, createdAt: "2026-10-12T03:00:00Z", gaps: gapsOf(plan), snapshot: { scores: sc, events: events(f, sc, plan), plan } });
}
const fhcInput = (over: Partial<FhcVideoInput> = {}): FhcVideoInput => ({ product: "FHC", customerId: "c1", age: 35, sex: "M", style: "motion", length: "full", fhc: somchai(), theme: "collage", ...over });
const answer = (scenes: { key: string; piece: string }[]) => ({ text: JSON.stringify({ scenes }) });

beforeEach(async () => {
  db.rows.length = 0;
  db.files.clear();
  drawnTrees.length = 0;
  for (const f of Object.values(wallet)) f.mockReset();
  wallet.walletSettings.mockResolvedValue({ enabled: true, multiplier: 1 });
  wallet.walletPrices.mockResolvedValue({ ...DEFAULT_PRICES });
  wallet.holdWallet.mockImplementation(async () => "hold-1");
  wallet.walletFrozen.mockResolvedValue(false);
  ai.speak.mockReset();
  ai.speak.mockImplementation(async () => ({ pcm: Buffer.alloc(48000), costThb: 0.01 }));
  ai.submit.mockReset();
  ai.submit.mockResolvedValue(undefined);
  chatAsk.fn.mockReset();
  vi.stubGlobal("fetch", vi.fn(async (_u: unknown, init?: { body?: string }) => {
    const b = JSON.parse(init?.body ?? "{}");
    const r = await drawScene(b.id, b.scene, b.token, b.agentName);
    return new Response("{}", { status: r === "drawn" ? 200 : 401 });
  }));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("pickPieces", () => {
  const drawn = PIECES.filter((p) => ["piggy", "umbrella", "handshake"].includes(p.key));
  const scenes = [{ key: "a", voice: "เงินสำรองฉุกเฉิน" }, { key: "b", voice: "ครอบครัวควรมีเงินก้อน" }, { key: "c", voice: "เริ่มที่ประกันชีวิต" }];

  it("takes AI's pick of a drawn piece, each piece once, and gives the rest their fallback", async () => {
    const ask = vi.fn(async () => answer([{ key: "a", piece: "piggy" }, { key: "b", piece: "piggy" }, { key: "c", piece: "doctor" }]));
    expect(await pickPieces(scenes, drawn, { b: "umbrella", c: "handshake" }, ask as never)).toEqual({ a: "piggy", b: "umbrella", c: "handshake" });
  });

  it("an AI that fails or says nothing leaves each scene its fallback, if drawn, else none", async () => {
    const ask = vi.fn(async () => { throw new Error("down"); });
    expect(await pickPieces(scenes, drawn, { a: "piggy", b: "house" }, ask as never)).toEqual({ a: "piggy", b: null, c: null });
  });

  it("asks nothing when the library has no drawn piece", async () => {
    const ask = vi.fn();
    expect(await pickPieces(scenes, [], { a: "piggy" }, ask as never)).toEqual({ a: null, b: null, c: null });
    expect(ask).not.toHaveBeenCalled();
  });
});

describe("fhcRoom", () => {
  const f = somchai();
  const c = { customer: "สมชาย", contact: {} };

  it("a full check fills its scores, gaps and events: only the opening, the plan and the contact take a picture", () => {
    const rooms = Object.fromEntries((["fhcOpen", "fhcScores", "fhcGaps", "fhcEvents", "fhcPlan", "fhcContact"] as const).map((k) => [k, fhcRoom(k, f, c)]));
    expect(Object.entries(rooms).filter(([, r]) => r).map(([k]) => k)).toEqual(["fhcOpen", "fhcPlan", "fhcContact"]);
    for (const r of Object.values(rooms)) if (r) expect(r.top + r.h).toBeLessThanOrEqual(1500);
  });

  it("fewer rows leave more room", () => {
    const few = { ...f, scores: f.scores.slice(0, 2), gaps: f.gaps.slice(0, 1), events: f.events.slice(0, 2) };
    expect(fhcRoom("fhcScores", few, c)).not.toBeNull();
    expect(fhcRoom("fhcGaps", few, c)).not.toBeNull();
    expect(fhcRoom("fhcEvents", few, c)).not.toBeNull();
  });
});

describe("a คอลลาจ สรุป FHC", () => {
  it("picks a piece for each scene while the voice is made, keeps them, and lays them where there is room", async () => {
    chatAsk.fn.mockResolvedValue(answer([{ key: "fhcOpen", piece: "hand-wave" }, { key: "fhcPlan", piece: "handshake" }, { key: "fhcContact", piece: "hand-phone" }, { key: "fhcScores", piece: "piggy" }]));
    const made = await createVideo(agent, fhcInput(), "สมชาย");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    const row = rowOf(id);
    expect(row.error).toBeNull();
    expect(row.status).toBe("rendering");
    const picks = (row.input as FhcVideoInput).picks!;
    expect(picks).toMatchObject({ fhcOpen: "hand-wave", fhcScores: "piggy", fhcGaps: "umbrella", fhcPlan: "handshake", fhcContact: "hand-phone" });
    // the plan's picture is in its frames; the scores' has no room in a full check, so it is not
    const uri = (k: string) => STICKER(k).toString("base64");
    expect(drawnTrees.some((t) => t.includes(uri("handshake")))).toBe(true);
    expect(drawnTrees.some((t) => t.includes(uri("piggy")))).toBe(false);
  });

  it("น้ำเงินทอง picks nothing and draws as before", async () => {
    const made = await createVideo(agent, fhcInput({ theme: undefined }), "");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    expect((rowOf(id).input as FhcVideoInput).picks).toBeUndefined();
    expect(chatAsk.fn).not.toHaveBeenCalled();
    expect(rowOf(id).status).toBe("rendering");
  });
});

