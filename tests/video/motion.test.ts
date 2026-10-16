import { describe, expect, it, vi } from "vitest";
import { animatePicture, motionPrompt } from "@/lib/video/motion";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const video = () => new Response(new Uint8Array(5000), { status: 200 });
const sleep = async () => undefined;
const queue = () => json({ status_url: "https://q/s", response_url: "https://q/r" });

describe("animatePicture (fal.ai Kling, owner 2026-10-17)", () => {
  it("submits, waits for COMPLETED, and downloads the video", async () => {
    let asked = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("queue.fal.run/fal-ai/kling")) return queue();
      if (url === "https://q/s") return json({ status: ++asked < 2 ? "IN_PROGRESS" : "COMPLETED" });
      if (url === "https://q/r") return json({ video: { url: "https://v/x.mp4" } });
      return video();
    });
    const out = await animatePicture({ key: "k", imageUrl: "https://img", move: "waves", fetchImpl: fetchImpl as unknown as typeof fetch, sleep });
    expect(out?.length).toBe(5000);
    const submit = fetchImpl.mock.calls[0] as unknown as [string, { body: string; headers: Record<string, string> }];
    expect(JSON.parse(submit[1].body)).toMatchObject({ image_url: "https://img", duration: "5" });
    expect(JSON.parse(submit[1].body).prompt).toContain("waves");
    expect(submit[1].headers.Authorization).toBe("Key k");
    expect(asked).toBe(2);
  });

  it("gives null, not an error, when fal refuses (an empty balance is a 403)", async () => {
    const fetchImpl = (async () => json({ detail: "User is locked. Reason: Exhausted balance." }, 403)) as unknown as typeof fetch;
    expect(await animatePicture({ key: "k", imageUrl: "u", move: "m", fetchImpl, sleep })).toBeNull();
  });

  it("gives null when the job ends as anything but COMPLETED", async () => {
    const fetchImpl = (async (url: string) => (url.includes("queue.fal.run") ? queue() : json({ status: "FAILED" }))) as unknown as typeof fetch;
    expect(await animatePicture({ key: "k", imageUrl: "u", move: "m", fetchImpl, sleep })).toBeNull();
  });

  it("gives null when it runs out of time", async () => {
    const fetchImpl = (async (url: string) => (url.includes("queue.fal.run") ? queue() : json({ status: "IN_PROGRESS" }))) as unknown as typeof fetch;
    expect(await animatePicture({ key: "k", imageUrl: "u", move: "m", budgetMs: -1, fetchImpl, sleep })).toBeNull();
  });

  it("gives null for a video too small to be one", async () => {
    const fetchImpl = (async (url: string) => {
      if (url.includes("queue.fal.run")) return queue();
      if (url === "https://q/s") return json({ status: "COMPLETED" });
      if (url === "https://q/r") return json({ video: { url: "https://v/x.mp4" } });
      return new Response(new Uint8Array(10));
    }) as unknown as typeof fetch;
    expect(await animatePicture({ key: "k", imageUrl: "u", move: "m", fetchImpl, sleep })).toBeNull();
  });

  it("keeps the picture's own look in the prompt", () => {
    expect(motionPrompt(" smiles ")).toMatch(/^smiles\. Keep the exact drawing style/);
  });
});
