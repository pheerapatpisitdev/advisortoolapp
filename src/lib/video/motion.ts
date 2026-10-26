import type { VideoSize } from "@/lib/quote-video/timeline";
import type { MotionProvider } from "./motion-key";

/**
 * ภาพขยับ: one still picture made to move for a few seconds (owner, 2026-10-17), by whichever
 * engine comes first in the วิดีโอ lane on ตั้งค่า AI (owner, 2026-10-27, mockup
 * https://claude.ai/artifact/8hH1hoAGzjqt3cqaWTXDX5, ก ก): Kling 2.5 Turbo Pro at fal.ai, the same
 * Kling at Runware, then Hailuo 2.3 at Runware. Never throws for a provider's trouble: null means
 * "try the next engine", and when none is left the scene keeps its still picture.
 */

export interface MotionEngine {
  /** the id the lane saves */
  id: string;
  name: string;
  provider: MotionProvider;
  /** the model at that provider: fal's endpoint, Runware's AIR id */
  model: string;
  /** how long the clip it makes runs, in seconds */
  sec: number;
  /** what one clip costs us, in baht (฿36/$; fal and Runware price lists, 2026-10-16 and 2026-10-27) */
  thb: number;
  /** its name on the AI ledger, where the lane's 30-day count and the per-person cost read it */
  ledger: string;
}

export const MOTION_ENGINES: MotionEngine[] = [
  { id: "kling-2.5-fal", name: "Kling 2.5 Turbo Pro", provider: "fal", model: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video", sec: 5, thb: 12.6, ledger: "kling-2.5-turbo-pro@fal" },
  { id: "kling-2.5-runware", name: "Kling 2.5 Turbo Pro", provider: "runware", model: "klingai:6@1", sec: 5, thb: 12.6, ledger: "kling-2.5-turbo-pro@runware" },
  { id: "hailuo-2.3-runware", name: "Hailuo 2.3 · 768p", provider: "runware", model: "minimax:4@1", sec: 6, thb: 10.1, ledger: "hailuo-2.3@runware" },
];

export const motionEngine = (id: string): MotionEngine | undefined => MOTION_ENGINES.find((e) => e.id === id);

/** the ledger's task for a made clip */
export const MOTION_TASK = "prompt-story-motion";

const FAL_QUEUE = "https://queue.fal.run/";
const RUNWARE_URL = "https://api.runware.ai/v1";
const POLL_MS = 4000;
const SUBMIT_TIMEOUT_MS = 20_000;
const CALL_TIMEOUT_MS = 20_000;

/** the picture's own cartoon look must hold: no cuts, no new objects, no text, no warping */
const KEEP = "Keep the exact drawing style and every character as in the picture. Gentle, natural movement only, one continuous shot.";
const NEGATIVE = "text, letters, numbers, logo, watermark, blur, distortion, deformed, morphing, scene cut, extra people";

export const motionPrompt = (move: string): string => `${move.trim()}. ${KEEP}`;

/** Kling at Runware is asked for the clip's own shape; Hailuo takes it from the picture (it allows only 16:9 sizes) */
const KLING_SIZE: Record<VideoSize, { width: number; height: number }> = {
  portrait: { width: 720, height: 1280 }, square: { width: 720, height: 720 }, landscape: { width: 1280, height: 720 },
};

type Fetch = typeof fetch;

export interface AnimateArgs {
  engine: MotionEngine;
  key: string;
  /** a link the provider can read: the picture's signed bucket link */
  imageUrl: string;
  /** what moves, written in English or Thai; sent as typed */
  move: string;
  size?: VideoSize;
  /** give up after this long, in ms */
  budgetMs?: number;
  fetchImpl?: Fetch;
  sleep?: (ms: number) => Promise<void>;
}

const sleepFor = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** the finished clip's bytes, or null (the reason is in the log, never the key) */
export async function animatePicture(a: AnimateArgs): Promise<Buffer | null> {
  const f = a.fetchImpl ?? fetch;
  const until = Date.now() + (a.budgetMs ?? 4 * 60_000);
  const tag = `motion ${a.engine.id}`;
  try {
    const url = a.engine.provider === "fal"
      ? await falClip(a, f, a.sleep ?? sleepFor, until, tag)
      : await runwareClip(a, f, a.sleep ?? sleepFor, until, tag);
    if (!url) return null;
    const file = await f(url, { signal: AbortSignal.timeout(60_000) });
    if (!file.ok) {
      console.error(`${tag}: video not downloaded (${file.status})`);
      return null;
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    return bytes.length > 1000 ? bytes : null;
  } catch (e) {
    console.error(`${tag}: failed:`, e instanceof Error ? e.message : "unknown error");
    return null;
  }
}

/** fal's queue API: submit, ask the status until it is done, read the result's video link */
async function falClip(a: AnimateArgs, f: Fetch, sleep: (ms: number) => Promise<void>, until: number, tag: string): Promise<string | null> {
  const headers = { Authorization: `Key ${a.key}`, "Content-Type": "application/json" };
  const sub = await f(FAL_QUEUE + a.engine.model, {
    method: "POST", headers,
    body: JSON.stringify({ prompt: motionPrompt(a.move), image_url: a.imageUrl, duration: String(a.engine.sec), negative_prompt: NEGATIVE, cfg_scale: 0.5 }),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  });
  if (!sub.ok) {
    // an empty fal balance is a 403 "Exhausted balance"
    console.error(`${tag}: submit refused (${sub.status})`);
    return null;
  }
  const job = (await sub.json().catch(() => null)) as { status_url?: string; response_url?: string } | null;
  if (!job?.status_url || !job.response_url) {
    console.error(`${tag}: submit gave no links`);
    return null;
  }
  for (;;) {
    if (Date.now() > until) {
      console.error(`${tag}: gave up waiting`);
      return null;
    }
    await sleep(POLL_MS);
    const st = await f(job.status_url, { headers, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });
    if (!st.ok) {
      // a hiccup between two asks is not the end; the budget is
      if (st.status === 401 || st.status === 403 || st.status === 404) {
        console.error(`${tag}: status refused (${st.status})`);
        return null;
      }
      continue;
    }
    const s = (await st.json().catch(() => null)) as { status?: string } | null;
    if (s?.status === "COMPLETED") break;
    if (s?.status && s.status !== "IN_QUEUE" && s.status !== "IN_PROGRESS") {
      console.error(`${tag}: job ended as ${s.status}`);
      return null;
    }
  }
  const res = await f(job.response_url, { headers, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });
  if (!res.ok) {
    console.error(`${tag}: result refused (${res.status})`);
    return null;
  }
  const url = ((await res.json().catch(() => null)) as { video?: { url?: string } } | null)?.video?.url;
  if (!url) console.error(`${tag}: result has no video`);
  return url ?? null;
}

interface RunwareReply {
  data?: { taskUUID?: string; status?: string; videoURL?: string }[];
  errors?: { code?: string; message?: string; taskUUID?: string }[];
}

/** Runware's one endpoint: a videoInference task sent async, then getResponse asked until it has the video */
async function runwareClip(a: AnimateArgs, f: Fetch, sleep: (ms: number) => Promise<void>, until: number, tag: string): Promise<string | null> {
  const headers = { Authorization: `Bearer ${a.key}`, "Content-Type": "application/json" };
  const taskUUID = crypto.randomUUID();
  const kling = a.engine.model.startsWith("klingai:");
  const task = {
    taskType: "videoInference", taskUUID, model: a.engine.model, deliveryMethod: "async", outputFormat: "MP4",
    positivePrompt: motionPrompt(a.move), duration: a.engine.sec,
    inputs: { frameImages: [{ image: a.imageUrl, frame: "first" }] },
    ...(kling ? { negativePrompt: NEGATIVE, ...KLING_SIZE[a.size ?? "portrait"] } : {}),
  };
  const sub = await f(RUNWARE_URL, { method: "POST", headers, body: JSON.stringify([task]), signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS) });
  const ack = (await sub.json().catch(() => null)) as RunwareReply | null;
  // an empty balance is a 402; Runware may also answer a refusal with a 200 and an errors list
  if (!sub.ok || ack?.errors?.length) {
    console.error(`${tag}: submit refused (${sub.status}${ack?.errors?.[0]?.code ? `, ${ack.errors[0].code}` : ""})`);
    return null;
  }
  for (;;) {
    if (Date.now() > until) {
      console.error(`${tag}: gave up waiting`);
      return null;
    }
    await sleep(POLL_MS);
    const st = await f(RUNWARE_URL, {
      method: "POST", headers, body: JSON.stringify([{ taskType: "getResponse", taskUUID }]), signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    if (st.status === 401 || st.status === 402 || st.status === 403) {
      console.error(`${tag}: status refused (${st.status})`);
      return null;
    }
    const r = (await st.json().catch(() => null)) as RunwareReply | null;
    const failed = r?.errors?.find((e) => !e.taskUUID || e.taskUUID === taskUUID);
    if (failed) {
      console.error(`${tag}: job failed (${failed.code ?? "error"})`);
      return null;
    }
    const item = r?.data?.find((d) => d.taskUUID === taskUUID);
    if (item?.videoURL) return item.videoURL;
    if (item?.status === "error") {
      console.error(`${tag}: job ended as error`);
      return null;
    }
  }
}

export interface LaneAnimateArgs extends Omit<AnimateArgs, "engine" | "key"> {
  /** the วิดีโอ lane's ids, in order (laneIds "video-motion") */
  lane: string[];
  /** a provider's key, null when it has none or is switched off */
  keyOf: (provider: MotionProvider) => Promise<string | null>;
  animate?: typeof animatePicture;
}

/**
 * Down the lane until one engine makes the clip: an engine with no key is passed over, one that
 * fails hands on to the next, all within the one budget. Null when none made it.
 */
export async function animateInLane(a: LaneAnimateArgs): Promise<{ bytes: Buffer; engine: MotionEngine } | null> {
  const until = Date.now() + (a.budgetMs ?? 4 * 60_000);
  const animate = a.animate ?? animatePicture;
  for (const id of a.lane) {
    const engine = motionEngine(id);
    if (!engine) continue;
    const key = await a.keyOf(engine.provider).catch(() => null);
    if (!key) continue;
    const left = until - Date.now();
    if (left < 20_000) break;
    const bytes = await animate({ ...a, engine, key, budgetMs: left });
    if (bytes) return { bytes, engine };
  }
  return null;
}
