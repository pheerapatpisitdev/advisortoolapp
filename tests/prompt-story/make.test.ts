import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";
import { DEFAULT_PRICES, pictureSatang } from "@/lib/wallet/prices";
import { promptStoryPrice, type PromptStoryInput } from "@/lib/prompt-story/types";

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

const { createPromptStory, deleteVideo, drawScene, finishVideo, isStuck, produce, redrawPicture, sweepStuckVideos, voiceFullUntil } = await import("@/lib/quote-video/make");
const { clipStates } = await import("@/lib/quote-video/rows");
const { VOICE_FULL } = await import("@/lib/quote-video/voice-quota");
const { paidLine } = await import("@/lib/quote-video/paid-line");

/** the drawing route as produce calls it: each scene drawn for real, by drawScene */
const route = async (_url: unknown, init?: { body?: string }) => {
  const b = JSON.parse(init?.body ?? "{}");
  const r = await drawScene(b.id, b.scene, b.token, b.agentName);
  return new Response("{}", { status: r === "drawn" ? 200 : 401 });
};

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

/** a finished clip: made, rendered, and Cloud Run's done answer taken */
async function doneClip(viewer = agent): Promise<string> {
  const made = await createPromptStory(viewer, input(), "");
  if (!("id" in made)) throw new Error(made.refusal);
  await produce(made.id, "ตัวแทน");
  const row = rowOf(made.id);
  expect(row.status).toBe("rendering");
  await finishVideo(structuredClone(row) as never, "done", `${made.id}/quote.mp4`);
  expect(rowOf(made.id).status).toBe("done");
  return made.id;
}

describe("createPromptStory", () => {
  it("holds the clip and every picture in one hold once the free clips are used", async () => {
    freeUsedUp();
    const made = await createPromptStory(agent, input(), "");
    expect("id" in made).toBe(true);
    expect(wallet.holdWallet).toHaveBeenCalledTimes(1);
    expect(wallet.holdWallet).toHaveBeenCalledWith("a1", promptStoryPrice(input(), DEFAULT_PRICES), "quote-video-prompt");
    const row = rowOf((made as { id: string }).id);
    expect(row.paid_by).toBe("wallet");
    expect(row.held_satang).toBe(promptStoryPrice(input(), DEFAULT_PRICES));
  });

  it("an agent's clip is paid from the wallet whole, the starter credit first (owner, 2026-10-18)", async () => {
    const made = await createPromptStory(agent, input(), "");
    expect(rowOf((made as { id: string }).id).paid_by).toBe("wallet");
  });

  it("a free clip still pays its pictures from the wallet", async () => {
    const made = await createPromptStory(taster, input(), "");
    const row = rowOf((made as { id: string }).id);
    const pictures = 3 * pictureSatang(DEFAULT_PRICES, "standard")!;
    expect(row.paid_by).toBe("free");
    expect(row.held_satang).toBe(pictures);
    expect(wallet.holdWallet).toHaveBeenCalledWith("a1", pictures, "quote-video-prompt");
  });

  it("charges the owner nothing", async () => {
    const made = await createPromptStory(owner, input(), "");
    expect(rowOf((made as { id: string }).id).paid_by).toBe("staff");
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("refuses an edited script with a number not in the brief, naming the scene", async () => {
    const v = input();
    v.scenes[1] = { ...v.scenes[1], voice: "เก็บเดือนละ 5000 บาท" };
    const made = await createPromptStory(agent, v, "");
    expect("refusal" in made && made.refusal).toMatch(/ฉากที่ 2/);
    expect("refusal" in made && made.refusal).toMatch(/5000/);
    expect(db.rows).toHaveLength(0);
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("refuses a second press for the same draft while the first stands", async () => {
    freeUsedUp();
    expect("id" in await createPromptStory(agent, input(), "")).toBe(true);
    const again = await createPromptStory(agent, input(), "");
    expect("refusal" in again).toBe(true);
    expect(wallet.holdWallet).toHaveBeenCalledTimes(1);
  });

  it("lets the same draft be made again once its clip failed", async () => {
    const first = await createPromptStory(agent, input(), "");
    ai.speak.mockRejectedValue(new Error("voice down"));
    await produce((first as { id: string }).id, "ตัวแทน");
    expect(rowOf((first as { id: string }).id).status).toBe("failed");
    expect("id" in await createPromptStory(agent, input(), "")).toBe(true);
  });

  it("two presses at once make one clip", async () => {
    freeUsedUp();
    const both = await Promise.all([createPromptStory(agent, input(), ""), createPromptStory(agent, input(), "")]);
    expect(both.filter((m) => "id" in m)).toHaveLength(1);
    expect(wallet.holdWallet).toHaveBeenCalledTimes(1);
    expect(db.drafts[0].made_clip_id).toBe((both.find((m) => "id" in m) as { id: string }).id);
  });

  it("refuses a draft that is not the agent's, or none", async () => {
    db.drafts[0].agent_id = "a2";
    expect("refusal" in await createPromptStory(agent, input(), "")).toBe(true);
    expect("refusal" in await createPromptStory(agent, input({ draftId: undefined }), "")).toBe(true);
    expect(db.rows.filter((r) => r.agent_id === "a1")).toHaveLength(0);
  });

  it("gives the draft back when the clip cannot be paid for", async () => {
    freeUsedUp();
    wallet.holdWallet.mockResolvedValue(null);
    expect("refusal" in await createPromptStory(agent, input(), "")).toBe(true);
    expect(db.drafts[0].made_clip_id).toBeNull();
  });
});

describe("produce, คลิปตามโจทย์", () => {
  it("draws the pictures and keeps them and the voice with the clip, then renders", async () => {
    const made = await createPromptStory(agent, input(), "");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    const row = rowOf(id);
    expect(row.status).toBe("rendering");
    expect((row.input as PromptStoryInput).pictures).toEqual([0, 1, 2].map((s) => `${id}/pic-${s}.png`));
    for (const s of [0, 1, 2]) expect(db.files.has(`${id}/pic-${s}.png`)).toBe(true);
    // every line spoken, the close too
    for (const s of [0, 1, 2, 3]) expect(db.files.has(`${id}/voice-${s}.pcm`)).toBe(true);
    expect(ai.speak).toHaveBeenCalledTimes(4);
    expect(ai.submit).toHaveBeenCalledTimes(1);
    // the drawing route read each scene's own picture and drew every frame of every scene
    for (const s of [0, 1, 2]) expect(db.downloads).toContain(`${id}/pic-${s}.png`);
    const job = ai.submit.mock.calls[0][0] as { inputs: { name: string }[]; command: string };
    for (const f of job.inputs) expect(db.files.has(`${id}/${f.name}`)).toBe(true);
  });

  it("files each picture once, as its scene's layer pushed in by ffmpeg, under few word frames", async () => {
    ai.draw.mockImplementation(async (a: { prompt: string }) => {
      if (a.prompt.includes("bills on a table")) throw new Error("painter down");
      return { bytes: picture(++drawn) };
    });
    const made = await createPromptStory(agent, input(), "");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    const job = ai.submit.mock.calls[0][0] as { inputs: { name: string }[]; command: string };
    const files = job.inputs.map((f) => db.files.get(`${id}/${f.name}`)!);
    // scenes 0 and 2 carry their picture as a layer, once each; scene 1 has none and stays on paper
    expect(files.filter((b) => b.equals(db.files.get(`${id}/pic-0.png`)!))).toHaveLength(1);
    expect(files.filter((b) => b.equals(db.files.get(`${id}/pic-2.png`)!))).toHaveLength(1);
    expect(job.command.match(/zoompan/g)).toHaveLength(2);
    // a frame per word, not twelve a second: under 20 frames for a short line
    const frames = job.inputs.length - 1 - 4 * 2 - 2;
    expect(frames).toBeLessThan(4 * 20);
  });

  it("a picture that fails twice leaves its scene on paper and the clip still goes", async () => {
    freeUsedUp();
    ai.draw.mockImplementation(async (a: { prompt: string }) => {
      if (a.prompt.includes("bills on a table")) throw new Error("painter down");
      return { bytes: picture(++drawn) };
    });
    const made = await createPromptStory(agent, input(), "");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    const row = rowOf(id);
    expect(row.status).toBe("rendering");
    expect((row.input as PromptStoryInput).pictures).toEqual([`${id}/pic-0.png`, null, `${id}/pic-2.png`]);
    // the picture not drawn is not charged
    expect(row.held_satang).toBe(promptStoryPrice(input(), DEFAULT_PRICES) - pictureSatang(DEFAULT_PRICES, "standard")!);
  });

  it("shows the pictures as their own step, before the voice", async () => {
    const made = await createPromptStory(agent, input(), "");
    await produce((made as { id: string }).id, "ตัวแทน");
    const steps = db.notes.map((n) => n.step);
    expect(db.notes.filter((n) => n.step === "pictures").map((n) => n.done)).toEqual([0, 1, 2, 3]);
    expect(steps.indexOf("pictures")).toBeLessThan(steps.indexOf("voice"));
    expect(steps.indexOf("draw")).toBeGreaterThan(steps.lastIndexOf("voice"));
  });

  it("a free clip whose every picture failed gives its whole hold back at the end", async () => {
    ai.draw.mockRejectedValue(new Error("painter down"));
    const made = await createPromptStory(taster, input(), "");
    const id = (made as { id: string }).id;
    const hold = rowOf(id).hold_id;
    await produce(id, "ตัวแทน");
    expect(rowOf(id).held_satang).toBe(0);
    await finishVideo(structuredClone(rowOf(id)) as never, "done", `${id}/quote.mp4`);
    expect(wallet.releaseWallet).toHaveBeenCalledWith(hold);
    expect(wallet.settleWallet).not.toHaveBeenCalled();
  });

  it("a failed clip gives the hold back", async () => {
    freeUsedUp();
    const made = await createPromptStory(agent, input(), "");
    const id = (made as { id: string }).id;
    const hold = rowOf(id).hold_id;
    ai.speak.mockRejectedValue(new Error("voice down"));
    await produce(id, "ตัวแทน");
    expect(rowOf(id).status).toBe("failed");
    expect(wallet.releaseWallet).toHaveBeenCalledWith(hold);
    expect([...db.files.keys()].filter((k) => k.startsWith(`${id}/`))).toEqual([]);
  });

  it("a finished clip keeps its pictures and voice, nothing else but the video", async () => {
    const id = await doneClip();
    const left = [...db.files.keys()].filter((k) => k.startsWith(`${id}/`)).map((k) => k.slice(id.length + 1)).sort();
    expect(left).toEqual(["pic-0.png", "pic-1.png", "pic-2.png", "voice-0.pcm", "voice-1.pcm", "voice-2.pcm", "voice-3.pcm"]);
  });
});

describe("redrawPicture", () => {
  it("draws only that scene's picture again and cuts the clip from the kept voice", async () => {
    const id = await doneClip();
    const before = new Map([...db.files].filter(([k]) => /pic-\d\.png$/.test(k)));
    ai.speak.mockClear();
    ai.submit.mockClear();
    db.downloads.length = 0;
    expect(await redrawPicture(agent, id, 1)).toEqual({ ok: true });
    expect(db.files.get(`${id}/pic-1.png`)).not.toEqual(before.get(`${id}/pic-1.png`));
    expect(db.files.get(`${id}/pic-0.png`)).toEqual(before.get(`${id}/pic-0.png`));
    expect(db.files.get(`${id}/pic-2.png`)).toEqual(before.get(`${id}/pic-2.png`));
    expect(ai.draw).toHaveBeenCalledTimes(4);
    for (const s of [0, 1, 2, 3]) expect(db.downloads).toContain(`${id}/voice-${s}.pcm`);
    expect(ai.speak).not.toHaveBeenCalled();
    expect(ai.submit).toHaveBeenCalledTimes(1);
    expect(rowOf(id).status).toBe("rendering");
  });

  it("charges one picture price, once, when the new cut is done", async () => {
    const id = await doneClip();
    wallet.holdWallet.mockClear();
    wallet.settleWallet.mockClear();
    await redrawPicture(agent, id, 0);
    const price = pictureSatang(DEFAULT_PRICES, "standard")!;
    expect(wallet.holdWallet).toHaveBeenCalledTimes(1);
    expect(wallet.holdWallet).toHaveBeenCalledWith("a1", price, "quote-video-prompt");
    const hold = await wallet.holdWallet.mock.results[0].value;
    // held while the clip is cut again, taken when Cloud Run says it is done
    expect(wallet.settleWallet).not.toHaveBeenCalled();
    await finishVideo(structuredClone(rowOf(id)) as never, "done", `${id}/quote.mp4`);
    expect(wallet.settleWallet).toHaveBeenCalledTimes(1);
    expect(wallet.settleWallet.mock.calls[0].slice(0, 2)).toEqual([hold, price]);
    // a second answer for the same cut takes nothing more
    await finishVideo(structuredClone(rowOf(id)) as never, "done", `${id}/quote.mp4`);
    expect(wallet.settleWallet).toHaveBeenCalledTimes(1);
  });

  it("charges the owner nothing", async () => {
    const id = await doneClip(owner);
    wallet.holdWallet.mockClear();
    expect(await redrawPicture(owner, id, 0)).toEqual({ ok: true });
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("refuses a clip still being made, and takes nothing", async () => {
    const made = await createPromptStory(agent, input(), "");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    wallet.holdWallet.mockClear();
    const r = await redrawPicture(agent, id, 0);
    expect(r.ok).toBe(false);
    expect(wallet.holdWallet).not.toHaveBeenCalled();
    expect(rowOf(id).status).toBe("rendering");
  });

  it("refuses a member whose pass has run out, and takes nothing", async () => {
    const id = await doneClip();
    pass.open = false;
    wallet.holdWallet.mockClear();
    expect((await redrawPicture(agent, id, 0)).ok).toBe(false);
    expect(wallet.holdWallet).not.toHaveBeenCalled();
    expect(rowOf(id).status).toBe("done");
  });

  it("refuses another agent's clip", async () => {
    const id = await doneClip();
    const other = { ...agent, agentId: "a2" } as Viewer;
    expect((await redrawPicture(other, id, 0)).ok).toBe(false);
  });

  it("a picture that cannot be drawn gives the hold back and leaves the clip as it was", async () => {
    const id = await doneClip();
    ai.draw.mockRejectedValue(new Error("painter down"));
    ai.submit.mockClear();
    await redrawPicture(agent, id, 0);
    const row = rowOf(id);
    expect(row.status).toBe("done");
    expect(row.video_path).toBe(`${id}/quote.mp4`);
    expect(wallet.releaseWallet).toHaveBeenCalledTimes(1);
    expect(wallet.settleWallet).toHaveBeenCalledTimes(1); // the clip's own, at finish
    expect(ai.submit).not.toHaveBeenCalled();
  });

  it("a cut that fails after a redraw gives the picture's hold back and leaves the last finished clip standing", async () => {
    const id = await doneClip();
    wallet.holdWallet.mockClear();
    wallet.settleWallet.mockClear();
    await redrawPicture(agent, id, 0);
    const hold = await wallet.holdWallet.mock.results[0].value;
    await finishVideo(structuredClone(rowOf(id)) as never, "failed");
    expect(wallet.releaseWallet).toHaveBeenCalledWith(hold);
    expect(wallet.settleWallet).not.toHaveBeenCalled();
    const row = rowOf(id);
    expect(row.status).toBe("done");
    expect(row.video_path).toBe(`${id}/quote.mp4`);
    expect(db.files.has(`${id}/pic-0.png`)).toBe(true);
    expect(db.files.has(`${id}/voice-0.pcm`)).toBe(true);
  });
});

describe("a clip's money when it runs long (owner chose 1ก 2ก, 2026-10-18)", () => {
  const MIN = 60_000;
  const ago = (min: number, now: number) => new Date(now - min * MIN).toISOString();
  const stuckRow = (over: Row) => ({
    agent_id: "someone-else", deleted_at: null, video_path: null, job: null, error: null, paid_by: "wallet", held_satang: 500,
    multiplier: 1, cost_thb: 0, charged_satang: null, progress: null, input: {}, ...over,
  });

  it("a clip done after its hold was swept says it was not charged, not held for good", async () => {
    freeUsedUp();
    const made = await createPromptStory(agent, input(), "");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    wallet.settleWallet.mockResolvedValue(null);
    await finishVideo(structuredClone(rowOf(id)) as never, "done", `${id}/quote.mp4`);
    expect(rowOf(id).status).toBe("done");
    expect(rowOf(id).charged_satang).toBe(0);
    expect(paidLine(rowOf(id) as never)).toBe("ทำเสร็จ · ไม่ได้หักเงิน");
  });

  it("a settle that throws leaves the charge unknown, not zero", async () => {
    freeUsedUp();
    const made = await createPromptStory(agent, input(), "");
    const id = (made as { id: string }).id;
    await produce(id, "ตัวแทน");
    wallet.settleWallet.mockRejectedValue(new Error("db down"));
    await finishVideo(structuredClone(rowOf(id)) as never, "done", `${id}/quote.mp4`);
    expect(rowOf(id).charged_satang).toBeNull();
  });

  it("drawing is stuck after 20 minutes, rendering after 25", () => {
    const now = Date.now();
    const row = (status: string, min: number) => ({ status, video_path: null, created_at: ago(min, now), updated_at: ago(min, now) }) as never;
    expect(isStuck(row("drawing", 19), now)).toBe(false);
    expect(isStuck(row("drawing", 21), now)).toBe(true);
    expect(isStuck(row("rendering", 22), now)).toBe(false);
    expect(isStuck(row("rendering", 26), now)).toBe(true);
    expect(isStuck(row("done", 60), now)).toBe(false);
  });

  it("the sweep fails anyone's stuck clips and gives their holds back, and leaves the rest", async () => {
    const now = Date.now();
    db.rows.push(
      stuckRow({ id: "old-draw", status: "drawing", hold_id: "h1", created_at: ago(40, now), updated_at: ago(40, now) }),
      stuckRow({ id: "old-render", status: "rendering", hold_id: "h2", created_at: ago(26, now), updated_at: ago(12, now) }),
      stuckRow({ id: "late-render", status: "rendering", hold_id: "h3", created_at: ago(22, now), updated_at: ago(8, now) }),
      stuckRow({ id: "fresh", status: "drawing", hold_id: "h4", created_at: ago(3, now), updated_at: ago(3, now) }),
    );
    expect(await sweepStuckVideos(now, true)).toBe(2);
    expect(rowOf("old-draw").status).toBe("failed");
    expect(rowOf("old-render").status).toBe("failed");
    expect(rowOf("late-render").status).toBe("rendering");
    expect(rowOf("fresh").status).toBe("drawing");
    expect(wallet.releaseWallet.mock.calls.map((c) => c[0]).sort()).toEqual(["h1", "h2"]);
  });

  it("a board waiting on clips reads its own alone, and a stuck one fails on the way (owner chose ก, 2026-10-19)", async () => {
    const now = Date.now();
    db.rows.push(
      stuckRow({ id: "mine-stuck", agent_id: "me", status: "drawing", hold_id: "h6", created_at: ago(40, now), updated_at: ago(40, now) }),
      stuckRow({ id: "mine-fresh", agent_id: "me", status: "rendering", hold_id: "h7", created_at: ago(3, now), updated_at: ago(1, now) }),
      stuckRow({ id: "mine-gone", agent_id: "me", status: "drawing", deleted_at: ago(1, now), created_at: ago(2, now), updated_at: ago(2, now) }),
      stuckRow({ id: "theirs", status: "drawing", created_at: ago(2, now), updated_at: ago(2, now) }),
    );
    const states = await clipStates("me", ["mine-stuck", "mine-fresh", "mine-gone", "theirs"]);
    expect(Object.fromEntries(states.map((v) => [v.id, v.status]))).toEqual({ "mine-stuck": "failed", "mine-fresh": "rendering" });
    expect(rowOf("mine-stuck").status).toBe("failed");
    expect(wallet.releaseWallet.mock.calls.map((c) => c[0])).toEqual(["h6"]);
  });

  it("a render that arrives after the clip was failed has its file removed", async () => {
    const now = Date.now();
    db.rows.push(stuckRow({ id: "gone", status: "failed", hold_id: "h5", created_at: ago(30, now), updated_at: ago(2, now) }));
    db.files.set("gone/quote.mp4", Buffer.from("mp4"));
    await finishVideo(structuredClone(rowOf("gone")) as never, "done", "gone/quote.mp4");
    expect(db.files.has("gone/quote.mp4")).toBe(false);
    expect(rowOf("gone").status).toBe("failed");
    expect(wallet.settleWallet).not.toHaveBeenCalled();
  });
});

describe("deleting an old clip the voice quota failed (owner, 2026-10-18)", () => {
  it("does not make today's voice read as full", async () => {
    const old = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
    db.rows.push({ id: "q1", agent_id: "a1", status: "failed", deleted_at: null, video_path: null, error: `${VOICE_FULL} พรุ่งนี้`, created_at: old, updated_at: old, input: {} });
    expect(await voiceFullUntil()).toBeNull();
    expect(await deleteVideo("a1", "q1")).toBe("deleted");
    expect(rowOf("q1").deleted_at).not.toBeNull();
    expect(await voiceFullUntil()).toBeNull();
  });
});

describe("the last free clip, pressed twice at once (owner, 2026-10-18)", () => {
  it("is free once; the other press is taken back and asked again, its hold given back", async () => {
    db.rows.push({ id: randomUUID(), agent_id: "a1", paid_by: "free", status: "done", deleted_at: null, input: {}, created_at: new Date(Date.now() - 60_000).toISOString() });
    db.drafts.push({ id: "draft-2", agent_id: "a1", made_clip_id: null });
    const [a, b] = await Promise.all([createPromptStory(taster, input(), ""), createPromptStory(taster, input({ draftId: "draft-2" }), "")]);
    const made = [a, b].filter((r) => "id" in r);
    expect(made).toHaveLength(1);
    expect([a, b].find((r) => "refusal" in r)).toEqual({ refusal: "ใช้วิดีโอฟรีครบแล้ว กดสร้างอีกครั้งเพื่อจ่ายจากกระเป๋านะครับ" });
    expect(wallet.releaseWallet).toHaveBeenCalled();
    expect(db.rows.filter((r) => r.paid_by === "free")).toHaveLength(2);
  });
});
