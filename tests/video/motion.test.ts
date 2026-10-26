import { describe, expect, it, vi } from "vitest";
import { animateInLane, animatePicture, motionEngine, motionPrompt, MOTION_ENGINES } from "@/lib/video/motion";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const video = () => new Response(new Uint8Array(5000), { status: 200 });
const sleep = async () => undefined;
const queue = () => json({ status_url: "https://q/s", response_url: "https://q/r" });
const fal = motionEngine("kling-2.5-fal")!;
const klingRw = motionEngine("kling-2.5-runware")!;
const hailuo = motionEngine("hailuo-2.3-runware")!;

describe("animatePicture at fal.ai (Kling, owner 2026-10-17)", () => {
  it("submits, waits for COMPLETED, and downloads the video", async () => {
    let asked = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("queue.fal.run/fal-ai/kling")) return queue();
      if (url === "https://q/s") return json({ status: ++asked < 2 ? "IN_PROGRESS" : "COMPLETED" });
      if (url === "https://q/r") return json({ video: { url: "https://v/x.mp4" } });
      return video();
    });
    const out = await animatePicture({ engine: fal, key: "k", imageUrl: "https://img", move: "waves", fetchImpl: fetchImpl as unknown as typeof fetch, sleep });
    expect(out?.length).toBe(5000);
    const submit = fetchImpl.mock.calls[0] as unknown as [string, { body: string; headers: Record<string, string> }];
    expect(JSON.parse(submit[1].body)).toMatchObject({ image_url: "https://img", duration: "5" });
    expect(JSON.parse(submit[1].body).prompt).toContain("waves");
    expect(submit[1].headers.Authorization).toBe("Key k");
    expect(asked).toBe(2);
  });

  it("gives null, not an error, when fal refuses (an empty balance is a 403)", async () => {
    const fetchImpl = (async () => json({ detail: "User is locked. Reason: Exhausted balance." }, 403)) as unknown as typeof fetch;
    expect(await animatePicture({ engine: fal, key: "k", imageUrl: "u", move: "m", fetchImpl, sleep })).toBeNull();
  });

  it("gives null when the job ends as anything but COMPLETED", async () => {
    const fetchImpl = (async (url: string) => (url.includes("queue.fal.run") ? queue() : json({ status: "FAILED" }))) as unknown as typeof fetch;
    expect(await animatePicture({ engine: fal, key: "k", imageUrl: "u", move: "m", fetchImpl, sleep })).toBeNull();
  });

  it("gives null when it runs out of time", async () => {
    const fetchImpl = (async (url: string) => (url.includes("queue.fal.run") ? queue() : json({ status: "IN_PROGRESS" }))) as unknown as typeof fetch;
    expect(await animatePicture({ engine: fal, key: "k", imageUrl: "u", move: "m", budgetMs: -1, fetchImpl, sleep })).toBeNull();
  });

  it("gives null for a video too small to be one", async () => {
    const fetchImpl = (async (url: string) => {
      if (url.includes("queue.fal.run")) return queue();
      if (url === "https://q/s") return json({ status: "COMPLETED" });
      if (url === "https://q/r") return json({ video: { url: "https://v/x.mp4" } });
      return new Response(new Uint8Array(10));
    }) as unknown as typeof fetch;
    expect(await animatePicture({ engine: fal, key: "k", imageUrl: "u", move: "m", fetchImpl, sleep })).toBeNull();
  });

  it("keeps the picture's own look in the prompt", () => {
    expect(motionPrompt(" smiles ")).toMatch(/^smiles\. Keep the exact drawing style/);
  });
});

describe("animatePicture at Runware (owner 2026-10-27)", () => {
  /** Runware's one endpoint: the task, then getResponse asked until the video is there */
  function runware(replies: ((uuid: string) => Response)[]) {
    let uuid = "";
    let n = 0;
    return vi.fn(async (url: string, init?: { body?: string }) => {
      if (url === "https://api.runware.ai/v1") {
        const task = JSON.parse(init!.body!)[0];
        if (task.taskType === "videoInference") {
          uuid = task.taskUUID;
          return json({ data: [{ taskType: "videoInference", taskUUID: uuid }] });
        }
        return replies[Math.min(n++, replies.length - 1)](uuid);
      }
      return video();
    });
  }

  it("sends Kling the picture as its first frame in the clip's shape, and downloads the video", async () => {
    const fetchImpl = runware([
      (u) => json({ data: [{ taskUUID: u, status: "processing" }] }),
      (u) => json({ data: [{ taskUUID: u, status: "success", videoURL: "https://v/rw.mp4" }] }),
    ]);
    const out = await animatePicture({ engine: klingRw, key: "rk", imageUrl: "https://img", move: "waves", size: "square", fetchImpl: fetchImpl as unknown as typeof fetch, sleep });
    expect(out?.length).toBe(5000);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, { body: string; headers: Record<string, string> }];
    const task = JSON.parse(init.body)[0];
    expect(task).toMatchObject({
      taskType: "videoInference", model: "klingai:6@1", deliveryMethod: "async", duration: 5, width: 720, height: 720,
      inputs: { frameImages: [{ image: "https://img", frame: "first" }] },
    });
    expect(init.headers.Authorization).toBe("Bearer rk");
    expect(fetchImpl.mock.calls.at(-1)?.[0]).toBe("https://v/rw.mp4");
  });

  it("asks Hailuo for 6 seconds and no size, which it takes from the picture", async () => {
    const fetchImpl = runware([(u) => json({ data: [{ taskUUID: u, videoURL: "https://v/h.mp4" }] })]);
    await animatePicture({ engine: hailuo, key: "rk", imageUrl: "https://img", move: "m", fetchImpl: fetchImpl as unknown as typeof fetch, sleep });
    const task = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, { body: string }])[1].body)[0];
    expect(task).toMatchObject({ model: "minimax:4@1", duration: 6 });
    expect(task.width).toBeUndefined();
  });

  it("gives null when the balance is empty (402) or the task fails", async () => {
    const broke = (async () => json({ errors: [{ code: "insufficientCredits" }] }, 402)) as unknown as typeof fetch;
    expect(await animatePicture({ engine: klingRw, key: "rk", imageUrl: "u", move: "m", fetchImpl: broke, sleep })).toBeNull();
    const failing = runware([(u) => json({ errors: [{ code: "providerError", taskUUID: u }] })]);
    expect(await animatePicture({ engine: klingRw, key: "rk", imageUrl: "u", move: "m", fetchImpl: failing as unknown as typeof fetch, sleep })).toBeNull();
  });
});

describe("animateInLane (the วิดีโอ lane, owner 2026-10-27)", () => {
  const lane = MOTION_ENGINES.map((e) => e.id);

  it("goes down the lane: a provider with no key is passed over, a failing engine hands on", async () => {
    const tried: string[] = [];
    const animate = vi.fn(async ({ engine }: { engine: { id: string } }) => {
      tried.push(engine.id);
      return engine.id === "hailuo-2.3-runware" ? Buffer.alloc(5000) : null;
    });
    const out = await animateInLane({
      lane, imageUrl: "u", move: "m", keyOf: async (p) => (p === "runware" ? "rk" : null), animate: animate as never,
    });
    expect(tried).toEqual(["kling-2.5-runware", "hailuo-2.3-runware"]);
    expect(out?.engine.id).toBe("hailuo-2.3-runware");
  });

  it("stops at the first engine that makes the clip", async () => {
    const animate = vi.fn(async () => Buffer.alloc(5000));
    const out = await animateInLane({ lane, imageUrl: "u", move: "m", keyOf: async () => "k", animate: animate as never });
    expect(animate).toHaveBeenCalledTimes(1);
    expect(out?.engine.id).toBe("kling-2.5-fal");
  });

  it("gives null when no engine can make it, and skips ids it does not know", async () => {
    const animate = vi.fn(async () => null);
    expect(await animateInLane({ lane: ["gone", ...lane], imageUrl: "u", move: "m", keyOf: async () => "k", animate: animate as never })).toBeNull();
    expect(animate).toHaveBeenCalledTimes(3);
  });
});
