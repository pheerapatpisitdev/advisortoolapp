import { describe, expect, it, vi } from "vitest";
import { runJob as runJobJs } from "../../infra/cloudrun-ffmpeg/job.mjs";

const runJob = runJobJs as unknown as (o: Record<string, unknown>) => Promise<number>;

const URL_SECRET = "https://example.supabase.co/storage/v1/object/sign/content-video/p/abc.job.json?token=SECRETTOKEN";
const event = { id: "j1", job: { inputs: [], outputs: [], command: "" }, uploads: {}, callbackUrl: "https://app.test/cb", token: "tok" };

function setup(res: { ok: boolean; status: number; text?: string } | Error) {
  const fetchFn = vi.fn(async () => {
    if (res instanceof Error) throw res;
    return { ok: res.ok, status: res.status, text: async () => res.text ?? "" };
  });
  const runRender = vi.fn(async (..._a: unknown[]) => {});
  const logs: string[] = [];
  return { fetchFn, runRender, logs, log: (m: string) => logs.push(m) };
}

describe("cloud run job", () => {
  it("fetches the payload from JOB_URL and hands it to runRender, exit 0", async () => {
    const s = setup({ ok: true, status: 200, text: JSON.stringify(event) });
    const code = await runJob({ env: { JOB_URL: URL_SECRET }, fetch: s.fetchFn, runRender: s.runRender, log: s.log });
    expect(code).toBe(0);
    expect(s.fetchFn).toHaveBeenCalledWith(URL_SECRET);
    expect(s.runRender).toHaveBeenCalledTimes(1);
    expect(s.runRender.mock.calls[0][0]).toEqual(event);
    expect(s.runRender.mock.calls[0][1]).toMatchObject({ ffmpegPath: "/opt/ffmpeg/ffmpeg" });
  });

  it("a refused payload: logs the status, no render, exit 1, no URL in logs", async () => {
    const s = setup({ ok: false, status: 403 });
    const code = await runJob({ env: { JOB_URL: URL_SECRET }, fetch: s.fetchFn, runRender: s.runRender, log: s.log });
    expect(code).toBe(1);
    expect(s.runRender).not.toHaveBeenCalled();
    expect(s.logs).toEqual(["job: payload 403"]);
  });

  it("a network error or bad JSON never leaks the URL", async () => {
    for (const res of [new Error(`boom ${URL_SECRET}`), { ok: true, status: 200, text: "not json" }]) {
      const s = setup(res);
      const code = await runJob({ env: { JOB_URL: URL_SECRET }, fetch: s.fetchFn, runRender: s.runRender, log: s.log });
      expect(code).toBe(1);
      expect(s.runRender).not.toHaveBeenCalled();
      expect(s.logs.join("\n")).not.toContain("SECRETTOKEN");
      expect(s.logs.join("\n")).not.toContain("supabase");
    }
  });

  it("no JOB_URL: exit 1 without fetching", async () => {
    const s = setup({ ok: true, status: 200 });
    expect(await runJob({ env: {}, fetch: s.fetchFn, runRender: s.runRender, log: s.log })).toBe(1);
    expect(s.fetchFn).not.toHaveBeenCalled();
  });
});
