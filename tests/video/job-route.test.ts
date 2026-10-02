import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClipEdit, ClipVideo, EditJob, EditPass, EngineName } from "@/lib/content/clip";
import type { ContentOutput } from "@/lib/content/output";
import type { RenderEngine } from "@/lib/video/engines/types";
import { clipDb } from "../helpers/fake-clip-db";

/**
 * POST /api/content-video/job — the render services' webhook, through the real jobs module
 * onto one row in memory: what the row says after a callback that is ours, one that is not,
 * one for a job we do not have, and Rendi's unsigned one.
 */

vi.mock("@/lib/supabase/admin", async () => {
  const { clipDb: fake } = await import("../helpers/fake-clip-db");
  return { supabaseAdmin: () => fake.client };
});
const eng = vi.hoisted(() => ({ enginesInOrder: vi.fn(), engineNamed: vi.fn() }));
vi.mock("@/lib/video/engines/index", () => eng);
const round = vi.hoisted(() => ({ settleLater: vi.fn(async () => undefined) }));
vi.mock("@/lib/wallet/round", async (orig) => ({ ...(await orig<typeof import("@/lib/wallet/round")>()), ...round }));

const { NO_FLAGS, clipOutput } = await import("@/lib/content/clip");
const { JOB_NO_FILES, JOB_TIMED_OUT, hashToken } = await import("@/lib/video/jobs");
const { POST } = await import("@/app/api/content-video/job/route");

const PIECE = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const TOKEN = "f".repeat(64);
const TAKE = `${PIECE}/44444444-4444-4444-8444-444444444444.mp4`;
const SOURCE = `${PIECE}/11111111-1111-4111-8111-111111111111.mp4`;
const WALLET: EditPass = { paidBy: "wallet", holdId: "h1", heldSatang: 600, multiplier: 2 };
const REEL_URL = "https://storage.rendi.test/out/reel.mp4";

const job = (over: Partial<EditJob> = {}): EditJob => ({
  kind: "render", engine: "lambda", id: "lam-1", startedAt: new Date().toISOString(), tokenHash: hashToken(TOKEN), tried: ["lambda"],
  dest: { out_1: TAKE }, rev: "r1", pass: WALLET, costThb: 0.07, ...over,
});
const edit = (j: EditJob): ClipEdit => ({ cut: [], trimSilence: true, subs: [], hook: { main: "หัว" }, style: "box", rev: "r1", job: j });
const video = (e: ClipEdit): ClipVideo => ({
  path: SOURCE, durationSec: 10, width: 1080, height: 1920, sizeBytes: 1, mime: "video/mp4",
  uploadedAt: new Date().toISOString(), caption: "c", flags: NO_FLAGS, edit: e,
});
function dbRow(j: EditJob) {
  const output: ContentOutput = { ...clipOutput("d"), rev: "o1", video: video(edit(j)) };
  return { id: PIECE, agent_id: "a1", created_at: "2026-10-02T00:00:00Z", plan_href: "clip", format: "clip", output, flags: {}, status: "draft" };
}
const storedEdit = (): ClipEdit => (clipDb.row!.output as ContentOutput).video!.edit!;
const post = (body: unknown) =>
  POST(new Request("https://x.test/api/content-video/job", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));

const rendi = { name: "rendi" as EngineName, submit: vi.fn(), status: vi.fn(), cleanup: vi.fn(async () => undefined) };
const fetchMock = vi.fn(async (url: string) => (url === REEL_URL ? new Response("REEL-BYTES") : new Response("no", { status: 404 })));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", fetchMock);
  eng.engineNamed.mockImplementation(async (n: EngineName) => (n === "rendi" ? (rendi as RenderEngine) : null));
  clipDb.reset(dbRow(job()));
});

describe("the job webhook", () => {
  it("finishes a Lambda job whose token matches", async () => {
    const res = await post({ id: "lam-1", token: TOKEN, state: "done", outputs: { out_1: { path: TAKE } } });

    expect(res.status).toBe(200);
    expect(storedEdit()).toMatchObject({ job: null, renderedPath: TAKE, renderedRev: "r1" });
    expect(round.settleLater).toHaveBeenCalledWith(WALLET, true, 0.07);
  });

  it("refuses a wrong token with 401 and changes nothing", async () => {
    const before = JSON.stringify(clipDb.row);
    expect((await post({ id: "lam-1", token: "e".repeat(64), state: "done", outputs: { out_1: { path: TAKE } } })).status).toBe(401);
    expect((await post({ id: "lam-1", token: "short", state: "failed" })).status).toBe(401);

    expect(JSON.stringify(clipDb.row)).toBe(before);
    expect(clipDb.writes).toBe(0);
    expect(round.settleLater).not.toHaveBeenCalled();
  });

  it("answers 200 and does nothing for an unknown job id", async () => {
    const before = JSON.stringify(clipDb.row);
    const res = await post({ id: "lam-404", token: TOKEN, state: "done", outputs: { out_1: { path: TAKE } } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(JSON.stringify(clipDb.row)).toBe(before);
    expect(round.settleLater).not.toHaveBeenCalled();
  });

  it("re-polls Rendi for its dashboard webhook instead of trusting the body", async () => {
    clipDb.reset(dbRow(job({ engine: "rendi", id: "cmd-1", tried: ["rendi"], costThb: 0.9, dest: undefined })));
    // still running on Rendi: whatever the body claims, nothing changes
    rendi.status.mockResolvedValue({ state: "running" });
    const before = JSON.stringify(clipDb.row);
    const lie = { data: { command_id: "cmd-1", status: "SUCCESS" }, state: "done", outputs: { out_1: { path: TAKE } } };
    expect((await post(lie)).status).toBe(200);
    expect(rendi.status).toHaveBeenCalledWith("cmd-1");
    expect(JSON.stringify(clipDb.row)).toBe(before);

    // done on Rendi: the take is the file Rendi answers with, copied into our storage — not the body's path
    rendi.status.mockResolvedValue({ state: "done", outputs: { out_1: { url: REEL_URL, fileId: "f1" } } });
    expect((await post(lie)).status).toBe(200);
    const e = storedEdit();
    expect(e.job).toBeNull();
    expect(e.renderedPath).not.toBe(TAKE);
    expect(clipDb.files.get(e.renderedPath!)?.text).toBe("REEL-BYTES");
    expect(round.settleLater).toHaveBeenCalledWith(WALLET, true, 0.9);
  });

  it("refuses a callback naming any file but the job's own destination, the clip's source among them", async () => {
    clipDb.files.set(SOURCE, { text: "SOURCE" });
    const before = JSON.stringify(clipDb.row);
    const res = await post({ id: "lam-1", token: TOKEN, state: "done", outputs: { out_1: { path: SOURCE } } });
    const other = await post({ id: "lam-1", token: TOKEN, state: "done", outputs: { out_1: { path: `${PIECE}/55555555-5555-4555-8555-555555555555.mp4` } } });

    expect(res.status).toBe(400);
    expect(other.status).toBe(400);
    expect(JSON.stringify(clipDb.row)).toBe(before);
    expect(clipDb.files.get(SOURCE)?.text).toBe("SOURCE");
    expect(round.settleLater).not.toHaveBeenCalled();
  });

  it("a Lambda callback with no file for an output has failed", async () => {
    const res = await post({ id: "lam-1", token: TOKEN, state: "done", outputs: {} });
    expect(res.status).toBe(200);
    expect(storedEdit()).toMatchObject({ job: null, error: JOB_NO_FILES });
    expect(round.settleLater).toHaveBeenCalledWith(WALLET, false, 0);
  });

  it("a token callback for a Rendi job finishes nothing", async () => {
    // a Rendi job's hash made from the same token: still, only asking Rendi ends a Rendi job
    clipDb.reset(dbRow(job({ engine: "rendi", id: "cmd-1", tried: ["rendi"], dest: undefined })));
    const before = JSON.stringify(clipDb.row);
    const res = await post({ id: "cmd-1", token: TOKEN, state: "done", outputs: { out_1: { path: TAKE } } });

    expect(res.status).toBe(200);
    expect(JSON.stringify(clipDb.row)).toBe(before);
    expect(rendi.status).not.toHaveBeenCalled();
    expect(round.settleLater).not.toHaveBeenCalled();
  });

  it("a Lambda callback after 16 minutes fails the job and lets its file go", async () => {
    clipDb.reset(dbRow(job({ startedAt: new Date(Date.now() - 16 * 60_000).toISOString() })));
    clipDb.files.set(TAKE, { text: "LATE-TAKE" });
    const res = await post({ id: "lam-1", token: TOKEN, state: "done", outputs: { out_1: { path: TAKE } } });

    expect(res.status).toBe(200);
    expect(storedEdit()).toMatchObject({ job: null, error: JOB_TIMED_OUT });
    expect(storedEdit().renderedPath).toBeUndefined();
    expect(clipDb.files.has(TAKE)).toBe(false);
    expect(round.settleLater).toHaveBeenCalledWith(WALLET, false, 0);
  });

  it("a second callback for a job already finished changes nothing", async () => {
    await post({ id: "lam-1", token: TOKEN, state: "done", outputs: { out_1: { path: TAKE } } });
    const after = JSON.stringify(clipDb.row);
    expect((await post({ id: "lam-1", token: TOKEN, state: "failed", error: "late" })).status).toBe(200);

    expect(JSON.stringify(clipDb.row)).toBe(after);
    expect(round.settleLater).toHaveBeenCalledTimes(1);
  });
});
