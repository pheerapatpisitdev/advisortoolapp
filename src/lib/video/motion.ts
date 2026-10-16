/**
 * ภาพขยับ: one still picture made to move for 5 seconds, by fal.ai's Kling 2.5 Turbo Pro
 * image-to-video (owner, 2026-10-17). The queue API: submit, ask the status until it is done,
 * read the result's video link and download it. About $0.35 a clip; the owner's price is the
 * wallet's `motionScene`. Never throws for a provider's trouble: null means "keep the still".
 */
export const FAL_MOTION_MODEL = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
const QUEUE = `https://queue.fal.run/${FAL_MOTION_MODEL}`;
const POLL_MS = 4000;
const SUBMIT_TIMEOUT_MS = 20_000;
const CALL_TIMEOUT_MS = 20_000;

/** the picture's own cartoon look must hold: no cuts, no new objects, no text, no warping */
const KEEP = "Keep the exact drawing style and every character as in the picture. Gentle, natural movement only, one continuous shot.";
const NEGATIVE = "text, letters, numbers, logo, watermark, blur, distortion, deformed, morphing, scene cut, extra people";

export const motionPrompt = (move: string): string => `${move.trim()}. ${KEEP}`;

type Fetch = typeof fetch;

export interface AnimateArgs {
  key: string;
  /** a link fal can read: the picture's signed bucket link */
  imageUrl: string;
  /** what moves, written in English or Thai; sent as typed */
  move: string;
  /** give up after this long, in ms */
  budgetMs?: number;
  fetchImpl?: Fetch;
  sleep?: (ms: number) => Promise<void>;
}

const sleepFor = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const headers = (key: string) => ({ Authorization: `Key ${key}`, "Content-Type": "application/json" });

/** the finished clip's bytes, or null (the reason is in the log, never the key) */
export async function animatePicture(a: AnimateArgs): Promise<Buffer | null> {
  const f = a.fetchImpl ?? fetch;
  const sleep = a.sleep ?? sleepFor;
  const until = Date.now() + (a.budgetMs ?? 4 * 60_000);
  try {
    const sub = await f(QUEUE, {
      method: "POST",
      headers: headers(a.key),
      body: JSON.stringify({ prompt: motionPrompt(a.move), image_url: a.imageUrl, duration: "5", negative_prompt: NEGATIVE, cfg_scale: 0.5 }),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });
    if (!sub.ok) {
      console.error(`motion: submit refused (${sub.status})`);
      return null;
    }
    const job = (await sub.json().catch(() => null)) as { status_url?: string; response_url?: string } | null;
    if (!job?.status_url || !job.response_url) {
      console.error("motion: submit gave no links");
      return null;
    }
    for (;;) {
      if (Date.now() > until) {
        console.error("motion: gave up waiting");
        return null;
      }
      await sleep(POLL_MS);
      const st = await f(job.status_url, { headers: headers(a.key), signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });
      if (!st.ok) {
        // a hiccup between two asks is not the end; the budget is
        if (st.status === 401 || st.status === 403 || st.status === 404) {
          console.error(`motion: status refused (${st.status})`);
          return null;
        }
        continue;
      }
      const s = (await st.json().catch(() => null)) as { status?: string } | null;
      if (s?.status === "COMPLETED") break;
      if (s?.status && s.status !== "IN_QUEUE" && s.status !== "IN_PROGRESS") {
        console.error(`motion: job ended as ${s.status}`);
        return null;
      }
    }
    const res = await f(job.response_url, { headers: headers(a.key), signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });
    if (!res.ok) {
      console.error(`motion: result refused (${res.status})`);
      return null;
    }
    const url = ((await res.json().catch(() => null)) as { video?: { url?: string } } | null)?.video?.url;
    if (!url) {
      console.error("motion: result has no video");
      return null;
    }
    const file = await f(url, { signal: AbortSignal.timeout(60_000) });
    if (!file.ok) {
      console.error(`motion: video not downloaded (${file.status})`);
      return null;
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    return bytes.length > 1000 ? bytes : null;
  } catch (e) {
    console.error("motion: failed:", e instanceof Error ? e.message : "unknown error");
    return null;
  }
}
