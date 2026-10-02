import { afterEach, describe, expect, it, vi } from "vitest";
import { rendiEngine, RENDI_API } from "@/lib/video/engines/rendi";
import { EngineError } from "@/lib/video/engines/types";

const job = { inputs: [{ name: "in_1", url: "https://s/c.mp4" }], command: "-i {{in_1}} {{out_1}}", outputs: [{ name: "out_1", file: "reel.mp4", contentType: "video/mp4" }] };
function api(answers: { status?: number; body: unknown }[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const a = answers.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(a.body), { status: a.status ?? 200 });
  }));
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

describe("rendiEngine", () => {
  it("submits the command with its inputs, outputs and time limit, and returns the command id", async () => {
    const calls = api([{ body: { command_id: "c1" } }]);
    expect(await rendiEngine("k", 60).submit(job, { callbackUrl: "x", token: "t" })).toEqual({ id: "c1" });
    expect(calls[0].url).toBe(`${RENDI_API}/run-ffmpeg-command`);
    expect(calls[0].init?.headers).toMatchObject({ "X-API-KEY": "k", "Content-Type": "application/json" });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      input_files: { in_1: "https://s/c.mp4" }, output_files: { out_1: "reel.mp4" },
      ffmpeg_command: "-i {{in_1}} {{out_1}}", max_command_run_seconds: 60,
    });
  });

  it("a refusal for the key or the plan is one to try elsewhere; a bad command is not", async () => {
    api([{ status: 401, body: { detail: "bad key" } }]);
    await expect(rendiEngine("k", 60).submit(job, { callbackUrl: "x", token: "t" })).rejects.toMatchObject({ retryElsewhere: true });
    api([{ status: 422, body: { detail: "bad" } }]);
    await expect(rendiEngine("k", 60).submit(job, { callbackUrl: "x", token: "t" })).rejects.toMatchObject({ retryElsewhere: false });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(rendiEngine("k", 60).submit(job, { callbackUrl: "x", token: "t" })).rejects.toBeInstanceOf(EngineError);
  });

  it("reads a command's state and its output files", async () => {
    api([{ body: { status: "PROCESSING" } }]);
    expect(await rendiEngine("k", 60).status("c1")).toEqual({ state: "running" });
    api([{ body: { status: "QUEUED" } }]);
    expect((await rendiEngine("k", 60).status("c1"))?.state).toBe("queued");
    api([{ body: { status: "SUCCESS", output_files: { out_1: { storage_url: "https://r/reel.mp4", file_id: "f1" } } } }]);
    expect(await rendiEngine("k", 60).status("c1")).toEqual({ state: "done", outputs: { out_1: { url: "https://r/reel.mp4", fileId: "f1" } } });
    api([{ body: { status: "FAILED", error_message: "boom" } }]);
    expect(await rendiEngine("k", 60).status("c1")).toEqual({ state: "failed", error: "boom" });
  });

  it("on a 503 during status poll, throws with retryElsewhere: true", async () => {
    api([{ status: 503, body: {} }]);
    await expect(rendiEngine("k", 60).status("c1")).rejects.toMatchObject({ retryElsewhere: true });
  });

  it("deletes its stored outputs once we have them", async () => {
    const calls = api([{ status: 204, body: {} }, { status: 404, body: {} }]);
    await rendiEngine("k", 60).cleanup({ state: "done", outputs: { out_1: { url: "u", fileId: "f1" }, out_2: { url: "u2", fileId: "f2" } } });
    expect(calls.map((c) => [c.init?.method, c.url])).toEqual([["DELETE", `${RENDI_API}/files/f1`], ["DELETE", `${RENDI_API}/files/f2`]]);
  });
});
