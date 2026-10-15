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
const db = vi.hoisted(() => ({ rows: [] as Row[], drafts: [] as Row[], files: new Map<string, Buffer>(), downloads: [] as string[] }));

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
vi.mock("@/lib/video/engines/cloudrun", () => ({ cloudRunEngine: () => ({ submit: (...a: unknown[]) => ai.submit(...a) }) }));
vi.mock("@/lib/quote-video/contact", () => ({ getContact: async () => ({ phone: "0812345678" }), photoDataUri: async () => null }));
vi.mock("@/lib/content/poster-png", () => ({ renderPng: async () => Buffer.from("png") }));

const { createPromptStory, drawScene, finishVideo, produce, redrawPicture } = await import("@/lib/quote-video/make");

/** the drawing route as produce calls it: each scene drawn for real, by drawScene */
const route = async (_url: unknown, init?: { body?: string }) => {
  const b = JSON.parse(init?.body ?? "{}");
  const r = await drawScene(b.id, b.scene, b.token, b.agentName);
  return new Response("{}", { status: r === "drawn" ? 200 : 401 });
};

const agent = { kind: "unitos", agentId: "a1", name: "ตัวแทน", staff: null } as unknown as Viewer;
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
    expect(wallet.holdWallet).toHaveBeenCalledWith("a1", promptStoryPrice(input(), DEFAULT_PRICES), "quote-video");
    const row = rowOf((made as { id: string }).id);
    expect(row.paid_by).toBe("wallet");
    expect(row.held_satang).toBe(promptStoryPrice(input(), DEFAULT_PRICES));
  });

  it("a free clip still pays its pictures from the wallet", async () => {
    const made = await createPromptStory(agent, input(), "");
    const row = rowOf((made as { id: string }).id);
    const pictures = 3 * pictureSatang(DEFAULT_PRICES, "standard")!;
    expect(row.paid_by).toBe("free");
    expect(row.held_satang).toBe(pictures);
    expect(wallet.holdWallet).toHaveBeenCalledWith("a1", pictures, "quote-video");
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
    expect(wallet.holdWallet).toHaveBeenCalledWith("a1", price, "quote-video");
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
