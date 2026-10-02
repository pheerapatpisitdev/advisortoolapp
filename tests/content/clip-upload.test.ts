import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clipProblem } from "@/lib/content/clip";

// the browser's half, in node: a stand-in <video>, object URLs, and tus's Upload caught at construction
const tus = vi.hoisted(() => ({ made: [] as { file: unknown; options: { metadata: Record<string, string> } }[] }));
vi.mock("tus-js-client", () => ({
  DetailedError: class extends Error {},
  Upload: class {
    constructor(file: unknown, options: { metadata: Record<string, string> }) { tus.made.push({ file, options }); }
    findPreviousUploads() { return new Promise(() => undefined); }
  },
}));

const { readClipFile, uploadClip } = await import("@/app/studio/clip/upload");

let video: { onloadedmetadata?: () => void; onerror?: () => void; duration: number; videoWidth: number; videoHeight: number; src?: string };
let revoke: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  tus.made.length = 0;
  video = { duration: 0, videoWidth: 0, videoHeight: 0 };
  vi.stubGlobal("document", { createElement: () => video });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
  revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const mov = () => new File([new Uint8Array(4)], "IMG_0001.MOV", { type: "" });

describe("readClipFile", () => {
  it("a player that never answers: after 15 s the length reads as not read, the link let go once", async () => {
    const read = readClipFile(mov());
    await vi.advanceTimersByTimeAsync(15_000);
    const f = await read;
    expect(Number.isNaN(f.durationSec)).toBe(true);
    expect(clipProblem(f)).toMatch(/^อ่านความยาวคลิปไม่ได้/);
    video.onloadedmetadata?.();
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("a player that answers in time wins, and the timeout does nothing after", async () => {
    const read = readClipFile(mov());
    Object.assign(video, { duration: 20, videoWidth: 1080, videoHeight: 1920 });
    video.onloadedmetadata?.();
    const f = await read;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(f).toMatchObject({ durationSec: 20, width: 1080, height: 1920, mime: "video/quicktime" });
    expect(revoke).toHaveBeenCalledTimes(1);
  });
});

describe("uploadClip", () => {
  it("sends the type readClipFile worked out, not mp4, for a .mov with no type", () => {
    void uploadClip({ file: mov(), path: "p/x.mov", token: "t", mime: "video/quicktime", onProgress: () => undefined });
    expect(tus.made[0].options.metadata.contentType).toBe("video/quicktime");
  });
});
