import { describe, expect, it, vi } from "vitest";
import { checkShotstackKey, renderState, submitRender } from "@/lib/shotstack/api";

const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

describe("checkShotstackKey", () => {
  it("says Production when v1 takes the key", async () => {
    const f = vi.fn(async () => reply(200, { response: { templates: [] } }));
    const r = await checkShotstackKey("k", f as unknown as typeof fetch);
    expect(r).toMatchObject({ state: "ok", env: "v1" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("falls to the Sandbox when Production refuses the key", async () => {
    const f = vi.fn().mockResolvedValueOnce(reply(403)).mockResolvedValueOnce(reply(200));
    const r = await checkShotstackKey("k", f as unknown as typeof fetch);
    expect(r).toMatchObject({ state: "ok", env: "stage" });
    expect(String(f.mock.calls[1][0])).toContain("/edit/stage/templates");
  });

  it("calls a key both refuse wrong", async () => {
    const f = vi.fn(async () => reply(403));
    expect(await checkShotstackKey("k", f as unknown as typeof fetch)).toEqual({ state: "bad", error: "กุญแจไม่ถูกต้อง หรือถูกยกเลิกแล้ว" });
  });

  it("says the service's own trouble with its status", async () => {
    const f = vi.fn(async () => reply(503));
    const r = await checkShotstackKey("k", f as unknown as typeof fetch);
    expect(r.state === "bad" && r.error).toContain("503");
  });
});

describe("submitRender", () => {
  it("posts the edit with the callback and returns the id and environment", async () => {
    const f = vi.fn().mockResolvedValueOnce(reply(403)).mockResolvedValueOnce(reply(201, { response: { id: "r1" } }));
    const r = await submitRender("k", { timeline: {}, output: {} }, "https://x/cb", f as unknown as typeof fetch);
    expect(r).toEqual({ id: "r1", env: "stage" });
    const body = JSON.parse(String(f.mock.calls[1][1].body));
    expect(body.callback).toBe("https://x/cb");
  });

  it("throws a refused key with its status, which renderError reads as set-up trouble", async () => {
    const f = vi.fn(async () => reply(403));
    await expect(submitRender("k", {}, "https://x/cb", f as unknown as typeof fetch)).rejects.toThrow("(403)");
  });

  it("does not try the Sandbox after a bad edit", async () => {
    const f = vi.fn(async () => reply(400, { message: "Validation failed" }));
    await expect(submitRender("k", {}, "https://x/cb", f as unknown as typeof fetch)).rejects.toThrow("(400)");
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("renderState", () => {
  it("reads done with its link, failed with its reason, anything else as working", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(reply(200, { response: { status: "done", url: "https://cdn/x.mp4" } }))
      .mockResolvedValueOnce(reply(200, { response: { status: "failed", error: "bad asset" } }))
      .mockResolvedValueOnce(reply(200, { response: { status: "rendering" } }));
    const g = f as unknown as typeof fetch;
    expect(await renderState("k", "v1", "r1", g)).toEqual({ status: "done", url: "https://cdn/x.mp4" });
    expect(await renderState("k", "v1", "r1", g)).toEqual({ status: "failed", error: "bad asset" });
    expect(await renderState("k", "stage", "r1", g)).toEqual({ status: "working" });
  });
});
