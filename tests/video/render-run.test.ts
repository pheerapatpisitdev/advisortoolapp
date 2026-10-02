import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClipEdit, ClipVideo, EditPass, EngineName, Hook } from "@/lib/content/clip";
import type { ContentWord } from "@/lib/content/check";
import type { ContentOutput } from "@/lib/content/output";
import type { FfmpegJob } from "@/lib/video/command";
import type { RenderEngine } from "@/lib/video/engines/types";
import { clipDb } from "../helpers/fake-clip-db";

/**
 * A render, up to the moment a service has it: what is refused before a round, which pictures
 * are laid where on the cut clip, which file is sent, and what the stored job then says. The
 * table is one row in memory with saveOutputIf's rev guard; the bucket is a Map.
 */

vi.mock("@/lib/supabase/admin", async () => {
  const { clipDb: fake } = await import("../helpers/fake-clip-db");
  return { supabaseAdmin: () => fake.client };
});
const eng = vi.hoisted(() => ({ enginesInOrder: vi.fn(), engineNamed: vi.fn() }));
vi.mock("@/lib/video/engines/index", () => eng);
const round = vi.hoisted(() => ({ settleLater: vi.fn(async () => undefined) }));
vi.mock("@/lib/wallet/round", async (orig) => ({ ...(await orig<typeof import("@/lib/wallet/round")>()), ...round }));
// a picture's bytes say what it shows, so the stored file can be told apart
const pics = vi.hoisted(() => ({
  renderSubPng: vi.fn(async (words: string) => Buffer.from(`sub:${words}`)),
  renderHookPng: vi.fn(async (hook: Hook) => Buffer.from(`hook:${hook.main}`)),
}));
vi.mock("@/lib/video/overlays", () => pics);
const words = vi.hoisted(() => ({ list: [] as ContentWord[] }));
vi.mock("@/lib/content/store", async (orig) => ({
  ...(await orig<typeof import("@/lib/content/store")>()),
  listWords: vi.fn(async () => words.list),
}));

const { NO_FLAGS, clipOutput } = await import("@/lib/content/clip");
const { getContentUnscoped } = await import("@/lib/content/store");
const { EngineError } = await import("@/lib/video/engines/types");
const { claimSubmit } = await import("@/lib/video/jobs");
const { HOOK_Y, RENDER_DOWN, SUB_Y, TOO_SHORT, tooLong, pageTheme, renderChecks, renderCostThb, startRender } = await import("@/lib/video/render-run");

const PIECE = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const SOURCE = `${PIECE}/11111111-1111-4111-8111-111111111111.mp4`;
const PROXY = `${PIECE}/33333333-3333-4333-8333-333333333333.mp4`;
const WALLET: EditPass = { paidBy: "wallet", holdId: "h1", heldSatang: 600, multiplier: 2 };

const video = (over: Partial<ClipVideo> = {}): ClipVideo => ({
  path: SOURCE, durationSec: 10, width: 1080, height: 1920, sizeBytes: 20_000_000, mime: "video/mp4",
  uploadedAt: new Date().toISOString(), caption: "แคปชัน", flags: NO_FLAGS,
  transcript: [
    { start: 0.5, end: 3, text: "ประโยคแรก" },
    { start: 3.5, end: 6, text: "ประโยคที่ตัด" },
    { start: 6.5, end: 9.5, text: "ประโยคสุดท้าย" },
  ],
  ...over,
});
// no silences measured and none trimmed: what stays is the clip less the cut sentence, [0,3.5] and [6,10]
const edit = (over: Partial<ClipEdit> = {}): ClipEdit => ({
  proxyPath: PROXY, silences: [], cut: [1], trimSilence: false, style: "box", rev: "r1",
  hook: { top: "รู้หรือยัง", main: "ประกันสุขภาพต้องมี" },
  subs: [
    { start: 0.5, end: 3, text: "บรรทัดแรก", seg: 0 },
    // a line of the cut sentence that reaches past the cut: still left off (it is the sentence's)
    { start: 3.2, end: 6.3, text: "บรรทัดที่ตัด", seg: 1 },
    { start: 6.5, end: 9.5, text: "บรรทัดสุดท้าย", seg: 2 },
  ],
  ...over,
});
function dbRow(v: ClipVideo, over: Record<string, unknown> = {}) {
  const output: ContentOutput = { ...clipOutput("d"), rev: "o1", video: v };
  return {
    id: PIECE, agent_id: "a1", created_at: new Date().toISOString(), plan_href: "clip", format: "clip", angle: null, length: null,
    output, flags: {}, model: null, cost_thb: 0, status: "draft", hook_template_id: null, fb_page_id: null, fb_post_id: null,
    publish_state: null, publish_at: null, publish_error: null, page_id: null, plan_day: null, planned_done_at: null, ...over,
  };
}
const piece = async () => (await getContentUnscoped(PIECE))!;
const storedEdit = (): ClipEdit => (clipDb.row!.output as ContentOutput).video!.edit!;

type FakeEngine = RenderEngine & { submit: ReturnType<typeof vi.fn> };
const engine = (name: EngineName): FakeEngine => ({ name, submit: vi.fn(), status: vi.fn(), cleanup: vi.fn() }) as unknown as FakeEngine;
let rendi: FakeEngine;
let lambda: FakeEngine;

/** the pictures a render job lays, in order: where, when, and what the stored file shows */
function overlaysOf(job: FfmpegJob) {
  return [...job.command.matchAll(/\[(\d+):v\]overlay=x=0:y=(\d+):enable='between\(t,([\d.]+),([\d.]+)\)'/g)].map((m) => {
    const url = job.inputs[Number(m[1])].url;
    const path = /\/object\/sign\/([^?]+)/.exec(url)![1];
    const file = clipDb.files.get(path);
    return { y: Number(m[2]), from: Number(m[3]), to: Number(m[4]), shows: file?.text, type: file?.contentType, path };
  });
}
const submitted = (e: FakeEngine): FfmpegJob => e.submit.mock.calls[0][0] as FfmpegJob;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  words.list = [];
  rendi = engine("rendi");
  lambda = engine("lambda");
  rendi.submit.mockResolvedValue({ id: "cmd-9" });
  lambda.submit.mockResolvedValue({ id: "lam-9" });
  eng.enginesInOrder.mockImplementation(async () => [rendi, lambda]);
  eng.engineNamed.mockImplementation(async (n: EngineName) => (n === "rendi" ? rendi : lambda));
  clipDb.reset(dbRow(video({ edit: edit() })));
});

describe("renderChecks", () => {
  it("refuses an edit that leaves under 3 seconds", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ cut: [0, 1, 2] }) })));
    expect(await renderChecks(await piece())).toBe(TOO_SHORT);
    clipDb.reset(dbRow(video({ edit: edit() })));
    expect(await renderChecks(await piece())).toBeNull();
  });

  it("refuses an edit that leaves more than a minute, saying how much more to cut", async () => {
    // nothing cut from a 90-second clip
    clipDb.reset(dbRow(video({ durationSec: 90, edit: edit({ cut: [] }) })));
    expect(await renderChecks(await piece())).toBe("คลิปที่ตัดแล้วยาว 90 วินาที — Reel ที่ตัดต่อต้องไม่เกิน 1 นาที ตัดออกอีก 30 วินาที");
    // whole seconds, rounded up
    clipDb.reset(dbRow(video({ durationSec: 61.2, edit: edit({ cut: [] }) })));
    expect(await renderChecks(await piece())).toBe("คลิปที่ตัดแล้วยาว 62 วินาที — Reel ที่ตัดต่อต้องไม่เกิน 1 นาที ตัดออกอีก 2 วินาที");
    expect(tooLong(61.2)).toBe(await renderChecks(await piece()));
    // a minute exactly is a Reel
    clipDb.reset(dbRow(video({ durationSec: 60, edit: edit({ cut: [] }) })));
    expect(await renderChecks(await piece())).toBeNull();
  });

  it("refuses a hook the rules block", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ hook: { main: "การันตีอนุมัติทุกเคส" } }) })));
    const refusal = await renderChecks(await piece());
    expect(refusal).toMatch(/^hook ผิดกฎโฆษณาของ Facebook: /);
    expect(refusal).toContain("รับประกันผลการสมัครแบบเด็ดขาด"); // the rule's own words
    expect(refusal).toMatch(/— แก้ก่อนสร้างคลิป$/);
    // the top line is read too, and a banned word of the owner's list is refused as well
    words.list = [{ word: "รวยเร็ว", kind: "banned", fix: null }];
    clipDb.reset(dbRow(video({ edit: edit({ hook: { top: "รวยเร็ว", main: "ประกันสุขภาพ" } }) })));
    expect(await renderChecks(await piece())).toContain("รวยเร็ว");
    // a top line with no main line is never drawn, so it refuses nothing
    clipDb.reset(dbRow(video({ edit: edit({ hook: { top: "การันตีอนุมัติทุกเคส รวยเร็ว", main: " " } }) })));
    expect(await renderChecks(await piece())).toBeNull();
  });

  it("refuses an edit not yet prepared, one with a job, and an expired clip", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ proxyPath: undefined }) })));
    expect(await renderChecks(await piece())).not.toBeNull();
    clipDb.reset(dbRow(video({ expired: true, edit: edit() })));
    expect(await renderChecks(await piece())).not.toBeNull();
    clipDb.reset(dbRow(video({ edit: edit({ submitting: { id: "x", at: new Date().toISOString(), kind: "render" } }) })));
    expect(await renderChecks(await piece())).not.toBeNull();
  });
});

describe("startRender", () => {
  it("renders with no hook when it is empty", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ hook: { top: "รู้หรือยัง", main: "  " } }) })));
    await startRender(await piece(), WALLET);
    const laid = overlaysOf(submitted(rendi));
    expect(pics.renderHookPng).not.toHaveBeenCalled();
    expect(laid.map((o) => o.y)).toEqual([SUB_Y, SUB_Y]);
    expect(laid.some((o) => o.y === HOOK_Y)).toBe(false);
  });

  it("lays the hook at 230 for its first 2.6 s and each subtitle at 1450 on the cut clock", async () => {
    await startRender(await piece(), WALLET);
    const laid = overlaysOf(submitted(rendi));
    expect(laid.map(({ y, from, to, shows, type }) => ({ y, from, to, shows, type }))).toEqual([
      { y: 230, from: 0, to: 2.6, shows: "hook:ประกันสุขภาพต้องมี", type: "image/png" },
      { y: 1450, from: 0.5, to: 3, shows: "sub:บรรทัดแรก", type: "image/png" },
      // 6.5–9.5 in the clip is 4.0–7.0 once the 2.5 s cut out of it is gone; the cut sentence's line is not laid
      { y: 1450, from: 4, to: 7, shows: "sub:บรรทัดสุดท้าย", type: "image/png" },
    ]);
    for (const o of laid) expect(o.path).toMatch(new RegExp(`^${PIECE}/[0-9a-f-]{36}\\.png$`));
    // the cut itself: the source's [0,3.5] and [6,10]
    expect(submitted(rendi).command).toContain("trim=start=0.000:end=3.500");
    expect(submitted(rendi).command).toContain("trim=start=6.000:end=10.000");
  });

  it("submits the full-quality original, not the preview", async () => {
    await startRender(await piece(), WALLET);
    const job = submitted(rendi);
    expect(job.inputs[0]).toEqual({ name: "in_1", url: expect.stringContaining(`/object/sign/${SOURCE}?`) });
    expect(clipDb.reads).toContain(SOURCE);
    expect(clipDb.reads).not.toContain(PROXY);
    // every link is good for two hours
    for (const i of job.inputs) expect(i.url).toContain("s=7200");
  });

  it("records the rev it rendered, the round's pass and the cost estimate on the job", async () => {
    const item = await startRender(await piece(), WALLET);
    const rendiCost = ((20_000_000 + 25e6) / 1e9) * 0.10 * 36;
    expect(storedEdit().job).toMatchObject({ kind: "render", engine: "rendi", id: "cmd-9", rev: "r1", pass: WALLET });
    expect(storedEdit().job?.costThb).toBeCloseTo(rendiCost, 6);
    expect(renderCostThb(20_000_000).rendi).toBeCloseTo(rendiCost, 6);
    expect(item.output.video?.edit?.job?.id).toBe("cmd-9");

    // the cost is the engine's that took it: Rendi turned it away, our Lambda's estimate is kept
    clipDb.reset(dbRow(video({ edit: edit() })));
    rendi.submit.mockRejectedValue(new EngineError("Rendi ไม่รับงาน (429)", true));
    await startRender(await piece(), WALLET);
    expect(storedEdit().job).toMatchObject({ engine: "lambda", id: "lam-9", rev: "r1", pass: WALLET });
    expect(storedEdit().job?.costThb).toBeCloseTo(0.002 * 36, 6);
  });

  it("hands the round back when no engine takes the job", async () => {
    const claimed = await claimSubmit(await piece(), "render", "r1");
    if (typeof claimed === "string") throw new Error(claimed);
    eng.enginesInOrder.mockResolvedValue([]);

    await expect(startRender(claimed.item, WALLET, claimed.claim)).rejects.toThrow(RENDER_DOWN);

    expect(round.settleLater).toHaveBeenCalledWith(WALLET, false, 0);
    expect(storedEdit().job ?? null).toBeNull();
    expect(storedEdit().submitting).toBeUndefined(); // the claim let go: the agent may press again
    // the pictures drawn for it are let go too
    expect([...clipDb.files.keys()].filter((p) => p.endsWith(".png"))).toEqual([]);
    expect(clipDb.removed.filter((p) => p.endsWith(".png"))).toHaveLength(3);
  });

  it("lets the claim and the pictures go even when handing the round back fails", async () => {
    const claimed = await claimSubmit(await piece(), "render", "r1");
    if (typeof claimed === "string") throw new Error(claimed);
    eng.enginesInOrder.mockResolvedValue([]);
    round.settleLater.mockRejectedValueOnce(new Error("wallet down"));

    await expect(startRender(claimed.item, WALLET, claimed.claim)).rejects.toThrow(RENDER_DOWN);

    expect(storedEdit().submitting).toBeUndefined();
    expect([...clipDb.files.keys()].filter((p) => p.endsWith(".png"))).toEqual([]);
  });

  it("sends a render after a failure to the other engine, or to the same one when it is the only one", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ failedOn: "rendi", error: "ตัดต่อไม่สำเร็จ — ลองอีกครั้งได้" }) })));
    await startRender(await piece(), WALLET);
    expect(rendi.submit).not.toHaveBeenCalled();
    expect(storedEdit().job).toMatchObject({ engine: "lambda" });

    clipDb.reset(dbRow(video({ edit: edit({ failedOn: "rendi" }) })));
    eng.enginesInOrder.mockResolvedValue([rendi]);
    await startRender(await piece(), WALLET);
    expect(storedEdit().job).toMatchObject({ engine: "rendi", id: "cmd-9" });
  });
});

describe("pageTheme", () => {
  it("is the theme of the Page's latest poster, navy without one", async () => {
    expect(await pageTheme(null)).toBe("navy");
    expect(await pageTheme("105")).toBe("navy"); // the Page has no piece with a poster
    const row = dbRow(video(), { page_id: "105" });
    clipDb.reset({ ...row, output: { ...row.output, poster: { layout: "bottom", theme: "emerald", blocks: [] } } });
    expect(await pageTheme("105")).toBe("emerald");
  });
});
