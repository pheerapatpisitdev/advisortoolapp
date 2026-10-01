/**
 * A clip too big for Gemini to fetch by link (over 100MB) handed to it through the Files API
 * (owner, 2026-10-02): a resumable upload in one go, then a wait until Gemini has read it.
 * Files are kept by Google for 48 hours and then dropped on their own.
 */
const BASE = "https://generativelanguage.googleapis.com";
// Kept well inside the caller's 600-second function, which still has a 240-second listen to do afterwards,
// so our own clear errors fire before the platform kills the function.
const UPLOAD_TIMEOUT_MS = 150_000;
const MAX_LOOKS = 30; // ≈60 s at the default 2 s between looks

export async function uploadToGemini(opts: {
  apiKey: string; body: ReadableStream<Uint8Array>; sizeBytes: number; mimeType: string; displayName: string;
  /** between looks at a file still processing; tests pass 0 */
  pollMs?: number;
}): Promise<string> {
  const start = await fetch(`${BASE}/upload/v1beta/files?key=${opts.apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(opts.sizeBytes),
      "X-Goog-Upload-Header-Content-Type": opts.mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: opts.displayName } }),
    signal: AbortSignal.timeout(30_000),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) throw new Error(`gemini upload not started: ${start.status}`);

  const sent = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Length": String(opts.sizeBytes), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
    body: opts.body,
    // a stream as a request body needs half duplex in Node's fetch
    duplex: "half",
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  } as RequestInit & { duplex: "half" });
  const got = await sent.json().catch(() => ({})) as { file?: { name?: string; uri?: string; state?: string } };
  let file = got.file;
  if (!sent.ok || !file?.name || !file.uri) throw new Error(`gemini upload failed: ${sent.status}`);

  const pollMs = opts.pollMs ?? 2000;
  for (let looks = 0; file.state !== "ACTIVE"; looks++) {
    if (file.state === "FAILED") throw new Error("gemini could not read the clip");
    if (looks >= MAX_LOOKS) throw new Error("gemini took too long to read the clip");
    if (pollMs) await new Promise((r) => setTimeout(r, pollMs));
    const res = await fetch(`${BASE}/v1beta/${file.name}?key=${opts.apiKey}`, { signal: AbortSignal.timeout(10_000) });
    file = await res.json().catch(() => ({})) as typeof file;
    if (!file?.name || !file.uri) throw new Error(`gemini file unreadable: ${res.status}`);
  }
  return file.uri;
}
