import { afterEach, describe, expect, it, vi } from "vitest";
import { CALLERS, googleParts } from "@/lib/ai/providers";
import { uploadToGemini } from "@/lib/ai/gemini-files";

afterEach(() => vi.unstubAllGlobals());

describe("a video in a Gemini message", () => {
  it("goes ahead of the words, as fileData", () => {
    expect(googleParts({ role: "user", content: "ถอดเสียง", video: { uri: "https://s/v.mp4", mimeType: "video/mp4" } }))
      .toEqual([{ fileData: { mimeType: "video/mp4", fileUri: "https://s/v.mp4" } }, { text: "ถอดเสียง" }]);
  });

  it("asks for low media resolution when told", async () => {
    let sent: Record<string, unknown> = {};
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } }));
    }));
    await CALLERS.google({ apiKey: "k", model: "gemini-3.7-flash", messages: [{ role: "user", content: "x" }], maxTokens: 10, mediaResolution: "low" });
    expect((sent.generationConfig as Record<string, unknown>).mediaResolution).toBe("MEDIA_RESOLUTION_LOW");
  });
});

describe("uploadToGemini", () => {
  it("starts a resumable upload, sends the bytes, and waits for ACTIVE", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const answers = [
      new Response("{}", { headers: { "x-goog-upload-url": "https://up/1" } }),
      new Response(JSON.stringify({ file: { name: "files/abc", uri: "https://g/files/abc", state: "PROCESSING" } })),
      new Response(JSON.stringify({ name: "files/abc", uri: "https://g/files/abc", state: "ACTIVE" })),
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => { calls.push({ url, init }); return answers.shift()!; }));
    const body = new Blob([new Uint8Array(4)]).stream();
    expect(await uploadToGemini({ apiKey: "k", body, sizeBytes: 4, mimeType: "video/mp4", displayName: "clip", pollMs: 0 })).toBe("https://g/files/abc");
    expect(calls[0].init?.headers).toMatchObject({ "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": "4" });
    expect(calls[1].url).toBe("https://up/1");
    expect(calls[1].init?.headers).toMatchObject({ "X-Goog-Upload-Command": "upload, finalize", "X-Goog-Upload-Offset": "0" });
    expect(calls[2].url).toContain("/v1beta/files/abc");
  });

  it("throws when the file fails to process", async () => {
    const answers = [
      new Response("{}", { headers: { "x-goog-upload-url": "https://up/1" } }),
      new Response(JSON.stringify({ file: { name: "files/abc", uri: "u", state: "FAILED" } })),
    ];
    vi.stubGlobal("fetch", vi.fn(async () => answers.shift()!));
    await expect(uploadToGemini({ apiKey: "k", body: new Blob([]).stream(), sizeBytes: 0, mimeType: "video/mp4", displayName: "c", pollMs: 0 })).rejects.toThrow();
  });

  it("gives up when the file never leaves PROCESSING", async () => {
    let first = true;
    vi.stubGlobal("fetch", vi.fn(async () => {
      if (first) { first = false; return new Response("{}", { headers: { "x-goog-upload-url": "https://up/1" } }); }
      return new Response(JSON.stringify({ file: { name: "files/abc", uri: "u", state: "PROCESSING" }, name: "files/abc", uri: "u", state: "PROCESSING" }));
    }));
    await expect(uploadToGemini({ apiKey: "k", body: new Blob([]).stream(), sizeBytes: 0, mimeType: "video/mp4", displayName: "c", pollMs: 0 })).rejects.toThrow("took too long");
  });
});
