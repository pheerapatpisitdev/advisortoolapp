import { afterEach, describe, expect, it, vi } from "vitest";
import { postReel, reelLink, reelState, PublishError } from "@/lib/facebook/publish";

/** Graph and rupload as a script of answers, in call order; every request is kept to look at. */
function graph(answers: { status?: number; body: unknown }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const a = answers.shift() ?? { status: 500, body: {} };
    return new Response(typeof a.body === "string" ? a.body : JSON.stringify(a.body), { status: a.status ?? 200 });
  }));
  return calls;
}
const form = (init: RequestInit) => Object.fromEntries((init.body as FormData).entries());
afterEach(() => vi.unstubAllGlobals());

const opts = { pageId: "105", token: "t", fileUrl: "https://x.supabase.co/storage/v1/object/sign/content-video/a/b.mp4?token=s", caption: "แคปชัน" };

describe("postReel", () => {
  it("starts, hands Facebook the file's link, and finishes as published", async () => {
    const calls = graph([{ body: { video_id: "v1", upload_url: "u" } }, { body: { success: true } }, { body: { success: true } }]);
    expect(await postReel(opts)).toEqual({ id: "v1" });
    expect(calls[0].url).toBe("https://graph.facebook.com/v23.0/105/video_reels");
    expect(form(calls[0].init)).toMatchObject({ upload_phase: "start" });
    expect(calls[1].url).toBe("https://rupload.facebook.com/video-upload/v23.0/v1");
    expect(calls[1].init.headers).toMatchObject({ Authorization: "OAuth t", file_url: opts.fileUrl });
    expect(form(calls[2].init)).toMatchObject({ upload_phase: "finish", video_id: "v1", video_state: "PUBLISHED", description: "แคปชัน" });
  });

  it("holds it for a time as SCHEDULED, in Unix seconds", async () => {
    const calls = graph([{ body: { video_id: "v1" } }, { body: { success: true } }, { body: { success: true } }]);
    const at = new Date("2026-10-03T12:30:00Z");
    await postReel({ ...opts, at });
    expect(form(calls[2].init)).toMatchObject({ video_state: "SCHEDULED", scheduled_publish_time: String(at.getTime() / 1000) });
  });

  it("before finish nothing is on the Page: a refusal there is sure, whatever came back", async () => {
    graph([{ status: 400, body: { error: { code: 100, message: "bad" } } }]);
    await expect(postReel(opts)).rejects.toMatchObject({ unsure: false });
    graph([{ body: { video_id: "v1" } }, { status: 502, body: "<html>bad gateway</html>" }]);
    await expect(postReel(opts)).rejects.toMatchObject({ unsure: false });
    graph([{ body: {} }]);
    await expect(postReel(opts)).rejects.toMatchObject({ unsure: false });
  });

  it("a finish Graph explained is sure; one it did not answer is not", async () => {
    graph([{ body: { video_id: "v1" } }, { body: { success: true } }, { status: 400, body: { error: { code: 368, message: "blocked" } } }]);
    await expect(postReel(opts)).rejects.toMatchObject({ unsure: false, code: 368 });
    graph([{ body: { video_id: "v1" } }, { body: { success: true } }, { status: 502, body: "<html/>" }]);
    await expect(postReel(opts)).rejects.toMatchObject({ unsure: true });
    graph([{ body: { video_id: "v1" } }, { body: { success: true } }, { body: {} }]);
    await expect(postReel(opts)).rejects.toBeInstanceOf(PublishError);
  });
});

describe("reelState", () => {
  it("reads published, a failure, and anything still on its way", async () => {
    graph([{ body: { status: { video_status: "ready", publishing_phase: { status: "complete", publish_status: "published" } } } }]);
    expect(await reelState("v1", "t")).toBe("published");
    graph([{ body: { status: { video_status: "error" } } }]);
    expect(await reelState("v1", "t")).toBe("failed");
    graph([{ body: { status: { video_status: "ready", processing_phase: { status: "error" } } } }]);
    expect(await reelState("v1", "t")).toBe("failed");
    graph([{ body: { status: { video_status: "processing", publishing_phase: { publish_status: "scheduled" } } } }]);
    expect(await reelState("v1", "t")).toBe("unknown");
  });
  it("throws on a Graph error — not evidence of anything", async () => {
    graph([{ status: 400, body: { error: { code: 190, message: "expired" } } }]);
    await expect(reelState("v1", "t")).rejects.toBeInstanceOf(PublishError);
  });
});

it("links a Reel by its video id", () => {
  expect(reelLink("v1")).toBe("https://www.facebook.com/reel/v1");
});
