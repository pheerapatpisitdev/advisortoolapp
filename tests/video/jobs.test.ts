import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClipEdit, ClipVideo, EditJob, EditPass, EngineName } from "@/lib/content/clip";
import type { ContentOutput } from "@/lib/content/output";
import type { JobStatus, RenderEngine } from "@/lib/video/engines/types";
import { clipDb } from "../helpers/fake-clip-db";

/**
 * A clip's render jobs as the row sees them: what is stored after a submit, a poll, a job that
 * finished, failed or never answered — and after two polls that see it finished at once. The
 * table is one row in memory that honours saveOutputIf's rev guard; the bucket is a Map.
 */

vi.mock("@/lib/supabase/admin", async () => {
  const { clipDb: fake } = await import("../helpers/fake-clip-db");
  return { supabaseAdmin: () => fake.client };
});
const eng = vi.hoisted(() => ({ enginesInOrder: vi.fn(), engineNamed: vi.fn() }));
vi.mock("@/lib/video/engines/index", () => eng);
const round = vi.hoisted(() => ({ settleLater: vi.fn(async () => undefined) }));
vi.mock("@/lib/wallet/round", async (orig) => ({ ...(await orig<typeof import("@/lib/wallet/round")>()), ...round }));

const { NO_FLAGS, clipOutput, EDIT_JOB_TIMEOUT_MS } = await import("@/lib/content/clip");
const { EngineError } = await import("@/lib/video/engines/types");
const { prepareJob, renderJob } = await import("@/lib/video/command");
const { buildSubs, parseSilences } = await import("@/lib/video/timeline");
const { checkJob, initialEdit, submitJob, JOB_FAILED, JOB_NO_FILES, JOB_TIMED_OUT, NO_ENGINE } = await import("@/lib/video/jobs");

const PIECE = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const OWN_FILE = new RegExp(`^${PIECE}/[0-9a-f-]{36}\\.mp4$`);
const OLD_TAKE = `${PIECE}/22222222-2222-4222-8222-222222222222.mp4`;
const WALLET: EditPass = { paidBy: "wallet", holdId: "h1", heldSatang: 600, multiplier: 2 };
const SILENCE_TEXT = [
  "frame:0 pts:0", "lavfi.silence_start=0", "lavfi.silence_end=0.4",
  "lavfi.silence_start=3.1", "lavfi.silence_end=3.4",
  "lavfi.silence_start=6.1", "lavfi.silence_end=6.4",
  "lavfi.silence_start=9.7",
].join("\n");
const URLS = {
  proxy: "https://storage.rendi.test/out/proxy.mp4",
  silences: "https://storage.rendi.test/out/silences.txt",
  reel: "https://storage.rendi.test/out/reel.mp4",
};
const BODIES: Record<string, string> = { [URLS.proxy]: "PROXY-BYTES", [URLS.silences]: SILENCE_TEXT, [URLS.reel]: "REEL-BYTES" };

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const video = (over: Partial<ClipVideo> = {}): ClipVideo => ({
  path: `${PIECE}/11111111-1111-4111-8111-111111111111.mp4`,
  durationSec: 10, width: 1080, height: 1920, sizeBytes: 20_000_000, mime: "video/mp4", uploadedAt: minutesAgo(30),
  caption: "ประกันสุขภาพ เลือกยังไงให้คุ้มค่าที่สุดสำหรับครอบครัว\nบรรทัดสอง", flags: NO_FLAGS,
  transcript: [
    { start: 0.5, end: 3, text: "สวัสดีครับ วันนี้มาคุยเรื่องประกัน" },
    { start: 3.5, end: 6, text: "เอ่อ ขอพูดใหม่", cut: true, why: "พูดซ้ำ" },
    { start: 6.5, end: 9.5, text: "ประกันสุขภาพสำคัญมาก" },
  ],
  hookSuggestion: { main: "ประกันสุขภาพต้องมี" },
  ...over,
});
const edit = (over: Partial<ClipEdit> = {}): ClipEdit => ({
  cut: [1], trimSilence: true, subs: [{ start: 0.4, end: 3.1, text: "สวัสดีครับ" }], hook: { main: "หัวของฉัน" }, style: "box", rev: "r1",
  proxyPath: `${PIECE}/33333333-3333-4333-8333-333333333333.mp4`, silences: [[0, 0.4]], ...over,
});
const job = (over: Partial<EditJob> = {}): EditJob => ({
  kind: "render", engine: "rendi", id: "cmd-1", startedAt: minutesAgo(1), token: "a".repeat(64), tried: ["rendi"],
  rev: "r1", pass: WALLET, costThb: 0.9, ...over,
});
function dbRow(v: ClipVideo) {
  const output: ContentOutput = { ...clipOutput("d"), rev: "o1", video: v };
  return {
    id: PIECE, agent_id: "a1", created_at: minutesAgo(60), plan_href: "clip", format: "clip", angle: null, length: null,
    output, flags: {}, model: null, cost_thb: 0, status: "draft", hook_template_id: null, fb_page_id: null, fb_post_id: null,
    publish_state: null, publish_at: null, publish_error: null, page_id: null, plan_day: null, planned_done_at: null,
  };
}
const stored = (): ClipVideo => (clipDb.row!.output as ContentOutput).video!;
const storedEdit = (): ClipEdit => stored().edit!;

type FakeEngine = RenderEngine & { submit: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn>; cleanup: ReturnType<typeof vi.fn> };
const engine = (name: EngineName): FakeEngine => ({ name, submit: vi.fn(), status: vi.fn(), cleanup: vi.fn(async () => undefined) }) as FakeEngine;
let rendi: FakeEngine;
let lambda: FakeEngine;
const fetchMock = vi.fn(async (url: string) => (url in BODIES ? new Response(BODIES[url]) : new Response("gone", { status: 404 })));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", fetchMock);
  rendi = engine("rendi");
  lambda = engine("lambda");
  eng.enginesInOrder.mockImplementation(async () => [rendi, lambda]);
  eng.engineNamed.mockImplementation(async (n: EngineName) => (n === "rendi" ? rendi : lambda));
  clipDb.reset(dbRow(video()));
});

describe("submitJob", () => {
  it("submits to the first engine and records the job on the clip", async () => {
    rendi.submit.mockResolvedValue({ id: "cmd-1" });
    const job = prepareJob("https://signed.test/source.mp4");
    const rec = await submitJob(PIECE, "prepare", job);

    expect(storedEdit().job).toEqual(rec);
    expect(storedEdit().job).toMatchObject({ kind: "prepare", engine: "rendi", id: "cmd-1", tried: ["rendi"] });
    expect(rec.token).toMatch(/^[0-9a-f]{64}$/);
    // a first prepare makes the clip's edit, empty, around the job
    expect(storedEdit()).toMatchObject({ cut: [], trimSilence: true, subs: [], hook: { main: "" }, style: "box" });
    expect(typeof storedEdit().rev).toBe("string");
    expect(rendi.submit).toHaveBeenCalledWith(job, expect.objectContaining({ token: rec.token, callbackUrl: expect.stringMatching(/\/api\/content-video\/job$/) }));
    expect(lambda.submit).not.toHaveBeenCalled();
  });

  it("records a render's round, its cost and the edit it was made from", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ rev: "r7", error: "ครั้งก่อนล้ม" }) })));
    rendi.submit.mockResolvedValue({ id: "cmd-2" });
    await submitJob(PIECE, "render", renderJob("https://signed.test/source.mp4", [[0, 5]], []), [], { pass: WALLET, costThb: 0.5 });

    expect(storedEdit().job).toMatchObject({ kind: "render", id: "cmd-2", rev: "r7", pass: WALLET, costThb: 0.5 });
    expect(storedEdit().error).toBeUndefined();
    expect(storedEdit().cut).toEqual([1]); // the edit itself is untouched
  });

  it("falls back to the other engine when the first refuses to take it", async () => {
    rendi.submit.mockRejectedValue(new EngineError("Rendi ไม่รับงาน (429)", true));
    lambda.submit.mockResolvedValue({ id: "lam-1" });
    const rec = await submitJob(PIECE, "prepare", prepareJob("https://signed.test/source.mp4"));

    expect(storedEdit().job).toMatchObject({ engine: "lambda", id: "lam-1", tried: ["rendi", "lambda"], token: rec.token });
    // the Lambda writes our storage itself: one signed destination per output, in this clip's folder
    const uploads = lambda.submit.mock.calls[0][1].uploads as Record<string, { uploadUrl: string; path: string }>;
    expect(Object.keys(uploads).sort()).toEqual(["out_1", "out_2"]);
    expect(uploads.out_1.path).toMatch(OWN_FILE);
    expect(uploads.out_2.path).toMatch(new RegExp(`^${PIECE}/[0-9a-f-]{36}\\.txt$`));
    expect(clipDb.signed).toEqual([uploads.out_1.path, uploads.out_2.path]);
  });

  it("does not fall back for a bad command", async () => {
    rendi.submit.mockRejectedValue(new EngineError("Rendi ไม่รับงาน (400)", false));
    await expect(submitJob(PIECE, "prepare", prepareJob("https://signed.test/source.mp4"))).rejects.toThrow("Rendi ไม่รับงาน (400)");

    expect(lambda.submit).not.toHaveBeenCalled();
    expect(clipDb.writes).toBe(0);
    expect(stored().edit).toBeUndefined();
  });

  it("throws when no engine is configured", async () => {
    eng.enginesInOrder.mockResolvedValue([]);
    await expect(submitJob(PIECE, "prepare", prepareJob("https://signed.test/source.mp4"))).rejects.toThrow(NO_ENGINE);
    expect(NO_ENGINE).toBe("ยังไม่ได้ตั้งค่าตัวตัดต่อ");
    expect(clipDb.writes).toBe(0);
    expect(stored().edit).toBeUndefined();
  });

  it("refuses a second job while one is running", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ job: job() }) })));
    rendi.status.mockResolvedValue({ state: "running" });
    await expect(submitJob(PIECE, "render", renderJob("https://signed.test/s.mp4", [[0, 5]], []))).rejects.toThrow(/งานตัดต่อค้างอยู่/);
    expect(rendi.submit).not.toHaveBeenCalled();
    expect(storedEdit().job?.id).toBe("cmd-1");
  });
});

describe("checkJob", () => {
  it("collects a finished prepare: preview kept, silences read, a first edit built", async () => {
    clipDb.reset(dbRow(video({ edit: { cut: [], trimSilence: true, subs: [], hook: { main: "" }, style: "box", rev: "e0", job: job({ kind: "prepare", rev: undefined, pass: undefined, costThb: undefined }) } })));
    const status: JobStatus = { state: "done", outputs: { out_1: { url: URLS.proxy, fileId: "f1" }, out_2: { url: URLS.silences, fileId: "f2" } } };
    rendi.status.mockResolvedValue(status);

    const r = await checkJob(PIECE);

    const e = storedEdit();
    expect(r.changed).toBe(true);
    expect(e.job).toBeNull();
    expect(e.proxyPath).toMatch(OWN_FILE);
    expect(clipDb.files.get(e.proxyPath!)).toEqual({ text: "PROXY-BYTES", contentType: "video/mp4" });
    const silences = parseSilences(SILENCE_TEXT, 10);
    expect(e.silences).toEqual(silences);
    expect(e.silences).toEqual([[0, 0.4], [3.1, 3.4], [6.1, 6.4], [9.7, 10]]);
    // the first edit: the listener's cut, subtitles from the words and the silences, its hook
    expect(e.cut).toEqual([1]);
    expect(e.subs).toEqual(buildSubs(video().transcript!, silences, 10));
    expect(e.subs.length).toBeGreaterThan(0);
    expect(e.hook).toEqual({ main: "ประกันสุขภาพต้องมี" });
    expect(e.rev).not.toBe("e0");
    // the silences were only for reading: the text file is gone, Rendi's copies let go
    const txt = clipDb.uploads.find((p) => p.endsWith(".txt"))!;
    expect(clipDb.files.has(txt)).toBe(false);
    expect(clipDb.removed).toContain(txt);
    expect(rendi.cleanup).toHaveBeenCalledWith(status);
    expect(round.settleLater).not.toHaveBeenCalled();
  });

  it("a prepare collected again keeps the agent's own edit", async () => {
    const mine = edit({ job: job({ kind: "prepare", pass: undefined, costThb: undefined }) });
    clipDb.reset(dbRow(video({ edit: mine })));
    clipDb.files.set(mine.proxyPath!, { text: "OLD-PROXY" });
    rendi.status.mockResolvedValue({ state: "done", outputs: { out_1: { url: URLS.proxy }, out_2: { url: URLS.silences } } });

    await checkJob(PIECE);

    const e = storedEdit();
    expect(e).toMatchObject({ cut: [1], subs: mine.subs, hook: mine.hook, rev: "r1", job: null });
    expect(e.proxyPath).not.toBe(mine.proxyPath);
    expect(clipDb.files.has(mine.proxyPath!)).toBe(false); // the old preview let go
  });

  it("collects a finished render: the take kept, the old take removed, the round charged", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ renderedPath: OLD_TAKE, renderedRev: "r0", job: job() }) })));
    clipDb.files.set(OLD_TAKE, { text: "OLD-TAKE" });
    const status: JobStatus = { state: "done", outputs: { out_1: { url: URLS.reel, fileId: "f9" } } };
    rendi.status.mockResolvedValue(status);

    await checkJob(PIECE);

    const e = storedEdit();
    expect(e.job).toBeNull();
    expect(e.renderedPath).toMatch(OWN_FILE);
    expect(e.renderedPath).not.toBe(OLD_TAKE);
    expect(clipDb.files.get(e.renderedPath!)).toEqual({ text: "REEL-BYTES", contentType: "video/mp4" });
    expect(e.renderedRev).toBe("r1");
    expect(Date.now() - new Date(e.renderedAt!).getTime()).toBeLessThan(5_000);
    expect(clipDb.files.has(OLD_TAKE)).toBe(false);
    expect(round.settleLater).toHaveBeenCalledWith(WALLET, true, 0.9);
    expect(rendi.cleanup).toHaveBeenCalledWith(status);
  });

  it("a render that lands after an edit is marked with the rev it was made from", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ rev: "r2", cut: [0, 1], job: job({ rev: "r1" }) }) })));
    rendi.status.mockResolvedValue({ state: "done", outputs: { out_1: { url: URLS.reel } } });

    await checkJob(PIECE);

    const e = storedEdit();
    expect(e.renderedRev).toBe("r1");
    expect(e.rev).toBe("r2");
    expect(e.cut).toEqual([0, 1]);
    expect(e.renderedPath).toMatch(OWN_FILE);
  });

  it("collects a finished job once when asked twice at the same time", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ job: job() }) })));
    rendi.status.mockResolvedValue({ state: "done", outputs: { out_1: { url: URLS.reel } } });

    await Promise.all([checkJob(PIECE), checkJob(PIECE)]);

    expect(clipDb.uploads).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(round.settleLater).toHaveBeenCalledTimes(1);
    expect(rendi.cleanup).toHaveBeenCalledTimes(1);
    expect(storedEdit().renderedPath).toBe(clipDb.uploads[0]);
    expect(storedEdit().job).toBeNull();
  });

  it("a job past 15 minutes has failed: error set, round handed back", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ renderedPath: OLD_TAKE, job: job({ startedAt: minutesAgo(16) }) }) })));
    rendi.status.mockResolvedValue({ state: "running" });

    const r = await checkJob(PIECE);

    expect(r.changed).toBe(true);
    expect(storedEdit()).toMatchObject({ job: null, error: JOB_TIMED_OUT, renderedPath: OLD_TAKE, cut: [1] });
    expect(round.settleLater).toHaveBeenCalledWith(WALLET, false, 0);
  });

  it("a job that cannot be asked about is asked again, until 15 minutes are up", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ job: job({ startedAt: minutesAgo(5) }) }) })));
    rendi.status.mockRejectedValue(new EngineError("อ่านสถานะงานจาก Rendi ไม่ได้ (503)", true));
    expect((await checkJob(PIECE)).changed).toBe(false);
    expect(storedEdit().job?.id).toBe("cmd-1");
    expect(clipDb.writes).toBe(0);

    clipDb.reset(dbRow(video({ edit: edit({ job: job({ startedAt: new Date(Date.now() - EDIT_JOB_TIMEOUT_MS - 1000).toISOString() }) }) })));
    await checkJob(PIECE);
    expect(storedEdit()).toMatchObject({ job: null, error: JOB_TIMED_OUT });
    expect(round.settleLater).toHaveBeenCalledWith(WALLET, false, 0);
  });

  it("a Lambda job, which only calls back, is left waiting until it times out", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ job: job({ engine: "lambda", id: "lam-1" }) }) })));
    lambda.status.mockResolvedValue(null);
    expect((await checkJob(PIECE)).changed).toBe(false);
    expect(storedEdit().job?.id).toBe("lam-1");
    expect(clipDb.writes).toBe(0);
  });

  it("a failed job hands the round back and keeps the edit", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ renderedPath: OLD_TAKE, renderedRev: "r0", job: job() }) })));
    rendi.status.mockResolvedValue({ state: "failed", error: "Error opening input https://x.supabase.co/storage/v1/object/sign/content-video/a.mp4?token=SECRET" });

    await checkJob(PIECE);

    const e = storedEdit();
    expect(e).toMatchObject({ job: null, error: JOB_FAILED, renderedPath: OLD_TAKE, renderedRev: "r0", cut: [1], hook: { main: "หัวของฉัน" }, rev: "r1" });
    expect(JSON.stringify(clipDb.row)).not.toContain("SECRET");
    expect(round.settleLater).toHaveBeenCalledWith(WALLET, false, 0);
    expect(clipDb.uploads).toHaveLength(0);
  });

  it("a job Rendi calls done without one of its files has failed", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ job: job() }) })));
    rendi.status.mockResolvedValue({ state: "done", outputs: {} });

    await checkJob(PIECE);

    expect(storedEdit()).toMatchObject({ job: null, error: JOB_NO_FILES });
    expect(storedEdit().renderedPath).toBeUndefined();
    expect(round.settleLater).toHaveBeenCalledWith(WALLET, false, 0);
    expect(clipDb.uploads).toHaveLength(0);
  });

  it("a download that breaks leaves the job to be collected next time", async () => {
    clipDb.reset(dbRow(video({ edit: edit({ job: job() }) })));
    rendi.status.mockResolvedValue({ state: "done", outputs: { out_1: { url: "https://storage.rendi.test/out/missing.mp4" } } });

    expect((await checkJob(PIECE)).changed).toBe(false);
    expect(storedEdit().job?.id).toBe("cmd-1");
    expect(storedEdit().job?.collecting).toBeUndefined(); // the claim let go
    expect(round.settleLater).not.toHaveBeenCalled();

    rendi.status.mockResolvedValue({ state: "done", outputs: { out_1: { url: URLS.reel } } });
    await checkJob(PIECE);
    expect(storedEdit().renderedPath).toMatch(OWN_FILE);
    expect(round.settleLater).toHaveBeenCalledWith(WALLET, true, 0.9);
  });
});

describe("initialEdit", () => {
  it("takes the caption's first line, cut to 28, when nothing was suggested", () => {
    const e = initialEdit(video({ hookSuggestion: undefined }), [[0, 0.4]]);
    expect(e.hook.main).toBe([..."ประกันสุขภาพ เลือกยังไงให้คุ้มค่าที่สุดสำหรับครอบครัว"].slice(0, 28).join(""));
    expect([...e.hook.main]).toHaveLength(28);
    expect(e).toMatchObject({ cut: [1], trimSilence: true, style: "box", silences: [[0, 0.4]] });
  });
});
