import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem } from "@/lib/content/store";
import { clipOutput, NO_FLAGS } from "@/lib/content/clip";

const ai = vi.hoisted(() => ({ chat: vi.fn(), providerKey: vi.fn(), BudgetExceeded: class extends Error {} }));
const store = vi.hoisted(() => ({ getContent: vi.fn(), saveOutputIf: vi.fn(), listWords: vi.fn(async () => []) }));
const clips = vi.hoisted(() => ({ clipReadUrl: vi.fn(async () => "https://signed") }));
const files = vi.hoisted(() => ({ uploadToGemini: vi.fn(async () => "https://g/files/1") }));
vi.mock("@/lib/ai/client", () => ai);
vi.mock("@/lib/content/store", () => store);
vi.mock("@/lib/content/clip-store", () => clips);
vi.mock("@/lib/ai/gemini-files", () => files);

const { runTranscribe } = await import("@/lib/content/clip-run");
const video = (over = {}) => ({
  path: "p/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.mp4", durationSec: 20, width: 1080, height: 1920, sizeBytes: 9_000_000,
  mime: "video/mp4", uploadedAt: "", caption: "", flags: NO_FLAGS, ...over,
});
const item = (v = video()): ContentItem => ({
  id: "p", createdAt: "", planHref: "clip", format: "clip", angle: "", length: null, output: { ...clipOutput(""), video: v },
  flags: NO_FLAGS, model: null, costThb: 0, status: "draft", hookTemplateId: null, publish: null, agentId: "a", pageId: "105", plan: null,
});
const reply = (o: unknown) => ({ text: JSON.stringify(o), model: "gemini-3.7-flash", provider: "google", inputTokens: 1, outputTokens: 1, costThb: 0.3 });

beforeEach(() => {
  vi.clearAllMocks();
  store.getContent.mockImplementation(async () => item());
  store.saveOutputIf.mockImplementation(async (_id: string, output: ContentItem["output"]) => ({ ...item(), output }));
});

describe("runTranscribe", () => {
  it("hands Gemini a link for a clip up to 100MB, keeps the transcript, caption and checks", async () => {
    ai.chat.mockResolvedValue(reply({ segments: [{ start: 1, end: 3, text: "สวัสดีครับ" }], caption: "แคปชันใหม่" }));
    const r = await runTranscribe(item());
    expect(r.ok).toBe(true);
    const sent = ai.chat.mock.calls[0][0];
    expect(sent).toMatchObject({ only: "gemini-3.7-flash", json: true, mediaResolution: "low" });
    expect(sent.messages.at(-1).video).toEqual({ uri: "https://signed", mimeType: "video/mp4" });
    expect(files.uploadToGemini).not.toHaveBeenCalled();
    const v = (store.saveOutputIf.mock.calls[0][1] as ContentItem["output"]).video!;
    expect(v).toMatchObject({ transcript: [{ start: 1, end: 3, text: "สวัสดีครับ" }], caption: "แคปชันใหม่", spokenFlags: [] });
    expect(v.transcribeFailed).toBeUndefined();
  });

  it("uploads a clip over 100MB through the Files API", async () => {
    ai.providerKey.mockResolvedValue("k");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob([new Uint8Array(1)]).stream())));
    ai.chat.mockResolvedValue(reply({ segments: [], caption: "c" }));
    await runTranscribe(item(video({ sizeBytes: 200_000_000 })));
    expect(files.uploadToGemini).toHaveBeenCalled();
    expect(ai.chat.mock.calls[0][0].messages.at(-1).video.uri).toBe("https://g/files/1");
    vi.unstubAllGlobals();
  });

  it("keeps a caption the agent already wrote", async () => {
    store.getContent.mockImplementation(async () => item(video({ caption: "ของตัวแทน" })));
    ai.chat.mockResolvedValue(reply({ segments: [{ start: 0, end: 1, text: "ก" }], caption: "ของ AI" }));
    await runTranscribe(item(video({ caption: "ของตัวแทน" })));
    expect((store.saveOutputIf.mock.calls[0][1] as ContentItem["output"]).video!.caption).toBe("ของตัวแทน");
  });

  it("an unreadable reply: marked failed, said so, nothing delivered", async () => {
    ai.chat.mockResolvedValue(reply("nonsense"));
    const r = await runTranscribe(item());
    expect(r.ok).toBe(false);
    expect((store.saveOutputIf.mock.calls[0][1] as ContentItem["output"]).video!.transcribeFailed).toBe(true);
  });

  it("a Reel sent to the Page while it listened: the row is not written, not ok", async () => {
    const sent = { ...item(), publish: { state: "scheduled" as const, at: new Date(Date.now() + 3_600_000).toISOString(), postId: null, pageId: "105", error: null } };
    // the listen started on a draft; the fresh read keep() makes finds it held on the Page
    store.getContent.mockImplementation(async () => sent);
    ai.chat.mockResolvedValue(reply({ segments: [{ start: 0, end: 1, text: "ก" }], caption: "ของ AI" }));
    const r = await runTranscribe(item());
    expect(store.saveOutputIf).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, error: "Reel นี้ส่งไปเพจแล้วระหว่างถอดเสียง — ไม่ได้เปลี่ยนแคปชัน" });
  });

  it("an expired clip is not sent", async () => {
    const r = await runTranscribe(item(video({ expired: true })));
    expect(r.ok).toBe(false);
    expect(ai.chat).not.toHaveBeenCalled();
  });

  it("stores the suggested hook, and drops a stale one when the reply has none", async () => {
    const hook = { top: "ขอบคุณ", main: "ปิดยอดแล้ว" };
    ai.chat.mockResolvedValue(reply({ segments: [{ start: 0, end: 1, text: "ก" }], caption: "c", hook }));
    await runTranscribe(item());
    expect((store.saveOutputIf.mock.calls[0][1] as ContentItem["output"]).video!.hookSuggestion).toEqual(hook);
    store.getContent.mockImplementation(async () => item(video({ hookSuggestion: { main: "เก่า" } })));
    ai.chat.mockResolvedValue(reply({ segments: [{ start: 0, end: 1, text: "ก" }], caption: "c" }));
    await runTranscribe(item());
    expect((store.saveOutputIf.mock.calls[1][1] as ContentItem["output"]).video!.hookSuggestion).toBeUndefined();
  });
});
