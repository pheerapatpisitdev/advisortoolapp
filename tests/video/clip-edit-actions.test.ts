import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClipEdit, ClipVideo, EditJob, EngineName, Hook } from "@/lib/content/clip";
import type { ContentOutput } from "@/lib/content/output";
import type { FfmpegJob } from "@/lib/video/command";
import type { RenderEngine } from "@/lib/video/engines/types";
import { clipDb } from "../helpers/fake-clip-db";

/**
 * The clip editor's actions as the row sees them: what is stored after open, save, render and
 * back-to-the-original, what each refuses, and what the browser is handed. The table is one row
 * in memory with saveOutputIf's rev guard (so two presses at once race for real); the bucket a Map.
 */

vi.mock("@/lib/supabase/admin", async () => {
  const { clipDb: fake } = await import("../helpers/fake-clip-db");
  return { supabaseAdmin: () => fake.client };
});
const eng = vi.hoisted(() => ({ enginesInOrder: vi.fn(), engineNamed: vi.fn() }));
vi.mock("@/lib/video/engines/index", () => eng);
const round = vi.hoisted(() => ({ settleLater: vi.fn(async () => undefined) }));
vi.mock("@/lib/wallet/round", async (orig) => ({ ...(await orig<typeof import("@/lib/wallet/round")>()), ...round }));
vi.mock("@/lib/video/overlays", () => ({
  renderSubPng: vi.fn(async (w: string) => Buffer.from(`sub:${w}`)),
  renderHookPng: vi.fn(async (h: Hook) => Buffer.from(`hook:${h.main}`)),
}));
// the asker may see the piece (scope is tested with the store); the words list is empty
vi.mock("@/lib/content/store", async (orig) => {
  const real = await orig<typeof import("@/lib/content/store")>();
  return { ...real, getContent: (id: string) => real.getContentUnscoped(id), listWords: vi.fn(async () => []) };
});
const quota = vi.hoisted(() => ({ takeRound: vi.fn() }));
vi.mock("@/lib/auth/quota", () => quota);
const auth = vi.hoisted(() => ({ requireMember: vi.fn(async () => ({ kind: "unitos", agentId: "a1", staff: null })) }));
vi.mock("@/lib/auth/viewer", () => auth);

const { NO_FLAGS, clipOutput } = await import("@/lib/content/clip");
const { EngineError } = await import("@/lib/video/engines/types");
const { JOB_BUSY } = await import("@/lib/video/jobs");
const { RENDER_DOWN, TOO_SHORT } = await import("@/lib/video/render-run");
const { openEdit, pollEdit, renderEdit, saveEdit, useOriginal } = await import("@/app/studio/clip-edit");

const PIECE = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const SOURCE = `${PIECE}/11111111-1111-4111-8111-111111111111.mp4`;
const PROXY = `${PIECE}/33333333-3333-4333-8333-333333333333.mp4`;
const TAKE = `${PIECE}/44444444-4444-4444-8444-444444444444.mp4`;
const WALLET = { ok: true, paidBy: "wallet", holdId: "hold-1", heldSatang: 600, multiplier: 2 } as const;

const video = (over: Partial<ClipVideo> = {}): ClipVideo => ({
  path: SOURCE, durationSec: 10, width: 1080, height: 1920, sizeBytes: 20_000_000, mime: "video/mp4",
  uploadedAt: new Date().toISOString(), caption: "แคปชัน", flags: NO_FLAGS,
  transcript: [
    { start: 0.5, end: 3, text: "ประโยคแรก" },
    { start: 3.5, end: 6, text: "ประโยคที่สอง" },
    { start: 6.5, end: 9.5, text: "ประโยคสุดท้าย" },
  ],
  ...over,
});
const prepared = (over: Partial<ClipEdit> = {}): ClipEdit => ({
  proxyPath: PROXY, silences: [], cut: [1], trimSilence: false, style: "box", rev: "r1",
  hook: { main: "ประกันสุขภาพต้องมี" },
  subs: [{ start: 0.5, end: 3, text: "บรรทัดแรก", seg: 0 }, { start: 6.5, end: 9.5, text: "บรรทัดสุดท้าย", seg: 2 }],
  ...over,
});
const runningJob = (over: Partial<EditJob> = {}): EditJob => ({
  kind: "render", engine: "rendi", id: "cmd-1", startedAt: new Date().toISOString(), tokenHash: "a".repeat(64),
  tried: ["rendi"], rev: "r1", pass: { paidBy: "wallet", holdId: "hold-0", heldSatang: 600, multiplier: 2 }, costThb: 0.9, ...over,
});
function dbRow(v: ClipVideo, over: Record<string, unknown> = {}) {
  const output: ContentOutput = { ...clipOutput("d"), rev: "o1", video: v };
  return {
    id: PIECE, agent_id: "a1", created_at: new Date().toISOString(), plan_href: "clip", format: "clip", angle: null, length: null,
    output, flags: {}, model: null, cost_thb: 0, status: "draft", hook_template_id: null, fb_page_id: null, fb_post_id: null,
    publish_state: null, publish_at: null, publish_error: null, page_id: null, plan_day: null, planned_done_at: null, ...over,
  };
}
const stored = (): ClipVideo => (clipDb.row!.output as ContentOutput).video!;
const storedEdit = (): ClipEdit => stored().edit!;
const HELD = { publish_state: "scheduled", fb_page_id: "105", fb_post_id: "v1", publish_at: "2099-01-01T00:00:00Z" };

type FakeEngine = RenderEngine & { submit: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> };
const engine = (name: EngineName): FakeEngine => ({ name, submit: vi.fn(), status: vi.fn(), cleanup: vi.fn() }) as unknown as FakeEngine;
let rendi: FakeEngine;
let lambda: FakeEngine;

/** nothing of a job's round, secret or storage paths in what the browser is handed */
function expectNoJobInternals(item: unknown) {
  const text = JSON.stringify(item);
  for (const key of ["pass", "holdId", "tokenHash", "dest", "hold-1", "a".repeat(64)]) expect(text).not.toContain(`"${key}"`);
  expect(text).not.toContain("hold-1");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  rendi = engine("rendi");
  lambda = engine("lambda");
  rendi.submit.mockResolvedValue({ id: "cmd-9" });
  lambda.submit.mockResolvedValue({ id: "lam-9" });
  rendi.status.mockResolvedValue({ state: "running" });
  eng.enginesInOrder.mockImplementation(async () => [rendi, lambda]);
  eng.engineNamed.mockImplementation(async (n: EngineName) => (n === "rendi" ? rendi : lambda));
  quota.takeRound.mockResolvedValue(WALLET);
  clipDb.reset(dbRow(video()));
});

describe("openEdit", () => {
  it("openEdit starts a free prepare job for a clip that was listened to", async () => {
    const r = await openEdit(PIECE);

    expect(r.ok).toBe(true);
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(storedEdit().job).toMatchObject({ kind: "prepare", engine: "rendi", id: "cmd-9" });
    expect(storedEdit().job?.pass).toBeUndefined();
    expect(storedEdit().submitting).toBeUndefined(); // the claim gave way to the job
    // the preview is made from the clip itself
    const job = rendi.submit.mock.calls[0][0] as FfmpegJob;
    expect(job.inputs[0].url).toContain(`/object/sign/${SOURCE}?`);
    expect(job.outputs.map((o) => o.name)).toEqual(["out_1", "out_2"]);
    if (r.ok) {
      expect(r.item.output.video?.edit?.job).toMatchObject({ kind: "prepare", id: "cmd-9" });
      expectNoJobInternals(r.item);
    }

    // opened again while it runs: asked after, not sent again
    await openEdit(PIECE);
    expect(rendi.submit).toHaveBeenCalledTimes(1);
    expect(rendi.status).toHaveBeenCalledWith("cmd-9");
  });

  it("openEdit refuses before a transcript, an expired clip, and a held Reel", async () => {
    const refused = async (row: ReturnType<typeof dbRow>, error: string) => {
      clipDb.reset(row);
      expect(await openEdit(PIECE)).toEqual({ ok: false, error });
      expect(clipDb.writes).toBe(0);
      expect(clipDb.reads).toEqual([]); // no link to the file is made
    };
    await refused(dbRow(video({ transcript: undefined })), "ถอดเสียงก่อนแล้วค่อยตัดต่อ");
    await refused(dbRow(video({ expired: true })), "ไฟล์คลิปหมดอายุแล้ว — แนบคลิปใหม่ก่อน");
    await refused(dbRow(video(), HELD), "Reel นี้ตั้งเวลาหรือลงเพจแล้ว — ยกเลิกคิวก่อนตัดต่อ");
    // the ffmpeg commands need the clip's sound: a clip nobody speaks in makes no job
    await refused(dbRow(video({ transcript: [] })), "คลิปนี้ไม่มีเสียงพูด — ตัดต่อซับไม่ได้");
    expect(rendi.submit).not.toHaveBeenCalled();
  });

  it("an expired clip's edited take mints no link either, whichever action is pressed", async () => {
    clipDb.reset(dbRow(video({ expired: true, edit: prepared({ renderedPath: TAKE }) })));
    for (const act of [renderEdit, pollEdit, useOriginal]) expect((await act(PIECE)).ok).toBe(false);
    expect((await saveEdit(PIECE, { cut: [] })).ok).toBe(false);
    expect(clipDb.reads).toEqual([]);
    expect(clipDb.writes).toBe(0);
    expect(quota.takeRound).not.toHaveBeenCalled();
  });

  it("two opens at once send one prepare", async () => {
    const [a, b] = await Promise.all([openEdit(PIECE), openEdit(PIECE)]);
    expect(a.ok && b.ok).toBe(true);
    expect(rendi.submit).toHaveBeenCalledTimes(1);
    expect(storedEdit().job).toMatchObject({ kind: "prepare", id: "cmd-9" });
  });

  it("a prepare no engine takes lets its claim go, so the next open tries again", async () => {
    eng.enginesInOrder.mockResolvedValueOnce([]);
    expect(await openEdit(PIECE)).toEqual({ ok: false, error: RENDER_DOWN });
    expect(storedEdit().submitting).toBeUndefined();
    expect(storedEdit().job ?? null).toBeNull();
    expect((await openEdit(PIECE)).ok).toBe(true);
    expect(storedEdit().job).toMatchObject({ kind: "prepare" });
  });
});

describe("saveEdit", () => {
  beforeEach(() => clipDb.reset(dbRow(video({ edit: prepared() }))));

  it("saveEdit keeps valid changes, bumps the rev, and refuses out-of-range cuts", async () => {
    const r = await saveEdit(PIECE, {
      cut: [2, 0, 2], trimSilence: true, style: "yellow",
      hook: { top: "  รู้หรือยัง ", main: " หัวใหม่ " },
      subs: [{ start: 6.5, end: 9.5, text: " ท้าย ", seg: 2 }, { start: 0.5, end: 3, text: "ต้น" }, { start: 3, end: 4, text: "   " }],
    });

    expect(r.ok).toBe(true);
    const e = storedEdit();
    expect(e).toMatchObject({
      cut: [0, 2], trimSilence: true, style: "yellow", hook: { top: "รู้หรือยัง", main: "หัวใหม่" },
      // sorted by time, the sentence each line came from kept, an emptied line taken out
      subs: [{ start: 0.5, end: 3, text: "ต้น" }, { start: 6.5, end: 9.5, text: "ท้าย", seg: 2 }],
      proxyPath: PROXY,
    });
    expect(e.subs[0].seg).toBeUndefined();
    expect(e.rev).not.toBe("r1");
    const rev = e.rev;

    for (const bad of [
      { cut: [3] }, { cut: [-1] }, { cut: [1.5] },
      { subs: [{ start: 0, end: 1, text: "x", seg: 3 }] },
      { subs: [{ start: 0, end: 1, text: "ก".repeat(121) }] },
      { subs: Array.from({ length: 201 }, (_, i) => ({ start: i * 0.04, end: i * 0.04 + 0.03, text: "x" })) },
      { hook: { main: "ก".repeat(29) } }, { hook: { top: "ก".repeat(25), main: "x" } },
      { style: "neon" as never },
    ]) {
      expect((await saveEdit(PIECE, bad)).ok).toBe(false);
    }
    expect(await saveEdit(PIECE, { cut: [3] })).toEqual({ ok: false, error: "ประโยคที่เลือกตัดไม่มีในคลิปนี้ — โหลดหน้าใหม่แล้วลองอีกครั้ง" });
    expect(storedEdit().rev).toBe(rev);
    expect(storedEdit().cut).toEqual([0, 2]);
  });

  it("saveEdit refuses while a render job runs", async () => {
    clipDb.reset(dbRow(video({ edit: prepared({ job: runningJob() }) })));
    expect(await saveEdit(PIECE, { cut: [] })).toEqual({ ok: false, error: JOB_BUSY });
    clipDb.reset(dbRow(video({ edit: prepared({ submitting: { id: "c1", at: new Date().toISOString(), kind: "render" } }) })));
    expect(await saveEdit(PIECE, { cut: [] })).toEqual({ ok: false, error: JOB_BUSY });
    clipDb.reset(dbRow(video({ edit: prepared() }), HELD));
    expect((await saveEdit(PIECE, { cut: [] })).ok).toBe(false);
    expect(clipDb.writes).toBe(0);
    // a claim left by a request that died is not a render running
    clipDb.reset(dbRow(video({ edit: prepared({ submitting: { id: "c1", at: new Date(Date.now() - 6 * 60_000).toISOString(), kind: "render" } }) })));
    expect((await saveEdit(PIECE, { cut: [] })).ok).toBe(true);
  });
});

describe("renderEdit", () => {
  it("renderEdit takes an ai-edit round only after the checks pass", async () => {
    clipDb.reset(dbRow(video({ edit: prepared({ cut: [0, 1, 2] }) })));
    expect(await renderEdit(PIECE)).toEqual({ ok: false, error: TOO_SHORT });
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(clipDb.writes).toBe(0);

    clipDb.reset(dbRow(video({ edit: prepared() })));
    const r = await renderEdit(PIECE);
    expect(r.ok).toBe(true);
    expect(quota.takeRound).toHaveBeenCalledTimes(1);
    expect(quota.takeRound).toHaveBeenCalledWith(expect.objectContaining({ agentId: "a1" }), "ai-edit");
    expect(storedEdit().job).toMatchObject({
      kind: "render", engine: "rendi", id: "cmd-9", rev: "r1",
      pass: { paidBy: "wallet", holdId: "hold-1", heldSatang: 600, multiplier: 2 },
    });
    expect(storedEdit().job?.pass).not.toHaveProperty("ok");
    if (r.ok) {
      expect(r.item.output.video?.edit?.job).toMatchObject({ kind: "render", id: "cmd-9", rev: "r1" });
      expectNoJobInternals(r.item);
    }
  });

  it("a refused round lets the claim go and sends nothing", async () => {
    clipDb.reset(dbRow(video({ edit: prepared() })));
    quota.takeRound.mockResolvedValue({ ok: false, refusal: "รอบฟรีหมดแล้ว" });
    expect(await renderEdit(PIECE)).toEqual({ ok: false, error: "รอบฟรีหมดแล้ว" });
    expect(rendi.submit).not.toHaveBeenCalled();
    expect(storedEdit().submitting).toBeUndefined();
    expect(storedEdit().job ?? null).toBeNull();
  });

  it("two presses at once send one render and take one round", async () => {
    clipDb.reset(dbRow(video({ edit: prepared() })));
    const results = await Promise.all([renderEdit(PIECE), renderEdit(PIECE)]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: JOB_BUSY });
    expect(quota.takeRound).toHaveBeenCalledTimes(1);
    expect(rendi.submit).toHaveBeenCalledTimes(1);
    expect(round.settleLater).not.toHaveBeenCalled();
    expect(storedEdit().job).toMatchObject({ kind: "render", id: "cmd-9", pass: { holdId: "hold-1" } });
    expect(storedEdit().submitting).toBeUndefined();
  });

  it("a render no engine takes hands the round back and lets the claim go", async () => {
    clipDb.reset(dbRow(video({ edit: prepared() })));
    rendi.submit.mockRejectedValue(new EngineError("Rendi ไม่รับงาน (500)", true));
    lambda.submit.mockRejectedValue(new EngineError("Lambda ไม่รับงาน", true));

    expect(await renderEdit(PIECE)).toEqual({ ok: false, error: RENDER_DOWN });
    expect(round.settleLater).toHaveBeenCalledWith({ paidBy: "wallet", holdId: "hold-1", heldSatang: 600, multiplier: 2 }, false, 0);
    expect(storedEdit().submitting).toBeUndefined();
    expect(storedEdit().job ?? null).toBeNull();

    // the agent may press again
    rendi.submit.mockResolvedValue({ id: "cmd-10" });
    expect((await renderEdit(PIECE)).ok).toBe(true);
    expect(storedEdit().job).toMatchObject({ id: "cmd-10" });
  });
});

describe("pollEdit", () => {
  it("collects for a Reel the Page holds, and hands the browser nothing of the job's round", async () => {
    clipDb.reset(dbRow(video({ edit: prepared({ job: runningJob() }) }), HELD));
    rendi.status.mockResolvedValue({ state: "failed", error: "boom" });
    const r = await pollEdit(PIECE);
    expect(r.ok).toBe(true);
    expect(storedEdit()).toMatchObject({ job: null, failedOn: "rendi" });
    expect(round.settleLater).toHaveBeenCalledWith(runningJob().pass, false, 0);

    clipDb.reset(dbRow(video({ edit: prepared({ job: runningJob() }) })));
    rendi.status.mockResolvedValue({ state: "running" });
    const running = await pollEdit(PIECE);
    if (!running.ok) throw new Error(running.error);
    expect(running.item.output.video?.edit?.job?.id).toBe("cmd-1");
    expectNoJobInternals(running.item);
  });
});

describe("useOriginal", () => {
  it("useOriginal lets the edited take go", async () => {
    clipDb.reset(dbRow(video({ edit: prepared({ renderedPath: TAKE, renderedAt: new Date().toISOString(), renderedRev: "r1" }) })));
    clipDb.files.set(TAKE, { text: "REEL" });

    const r = await useOriginal(PIECE);

    expect(r.ok).toBe(true);
    const e = storedEdit();
    expect(e.renderedPath).toBeUndefined();
    expect(e.renderedRev).toBeUndefined();
    expect(e.renderedAt).toBeUndefined();
    expect(e).toMatchObject({ proxyPath: PROXY, cut: [1], rev: "r1" }); // the edit itself stays
    expect(clipDb.files.has(TAKE)).toBe(false);
    expect(clipDb.removed).toEqual([TAKE]);
    expect(stored().path).toBe(SOURCE);
  });
});
