import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { providerKey } from "@/lib/ai/client";
import { recordUsage } from "@/lib/ai/ledger";
import { asWho } from "@/lib/ai/who";
import { speakThai, TTS_RATE } from "@/lib/ai/tts";
import type { PlanCardInput } from "@/lib/card-link";
import { renderPng } from "@/lib/content/poster-png";
import { valueTableChart } from "@/lib/quote-card";
import { siteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cloudRunEngine } from "@/lib/video/engines/cloudrun";
import { getContact, photoDataUri } from "./contact";
import { CHART_W, panEndFor, sceneLayer, tableImage, type Contact } from "./draw";
import { buildJob, concatList, mixNarration, nameFiles, pcmSeconds } from "./job";
import { quoteVideoFacts, quoteVideoScript } from "./script";
import { clipLength, H, planScenes, W } from "./timeline";

/**
 * Making one วิดีโอนำเสนอ clip (owner, 2026-10-11; spec docs/superpowers/specs/2026-10-11-quote-video-design.md).
 *
 * `produce` runs after the agent's request has been answered: the five lines spoken, every
 * picture drawn, all of it filed under "<video id>/" in the quote-video bucket, and the job
 * handed to the Cloud Run engine the Studio clips use. The engine calls back on
 * /api/quote-video/job (finishVideo). Tokens and signed links never reach a log or the row.
 */

export const VIDEO_BUCKET = "quote-video";
export const VIDEO_TASK_VOICE = "quote-video-voice";
export const VIDEO_TASK_RENDER = "quote-video-render";
export const VIDEO_CALLBACK_PATH = "/api/quote-video/job";
/** a clip still drawing or rendering after this long has failed */
export const VIDEO_TIMEOUT_MS = 15 * 60_000;
const LINK_SECONDS = 2 * 3600;
/** a Cloud Run run of one clip: a couple of CPU-minutes, in baht */
const RENDER_COST_THB = 0.01 * 36;
export const FAILED = "ทำวิดีโอไม่สำเร็จ ลองใหม่อีกครั้ง";

export type VideoStatus = "drawing" | "rendering" | "done" | "failed";
export interface VideoInput { variant: string; age: number; sex: "M" | "F"; sumAssured: number }
export interface VideoRow {
  id: string;
  agent_id: string;
  created_at: string;
  updated_at: string;
  input: VideoInput;
  customer_name: string;
  status: VideoStatus;
  job: { id: string; tokenHash: string; startedAt: string } | null;
  video_path: string | null;
  duration_sec: number | null;
  error: string | null;
}

const rows = () => supabaseAdmin().from("ins_quote_videos");
const bucket = () => supabaseAdmin().storage.from(VIDEO_BUCKET);
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const planInput = (v: VideoInput): PlanCardInput => ({
  kind: "plan", planCode: "LIFEPROTECT", variant: v.variant, age: v.age, sex: v.sex, sumAssured: v.sumAssured,
});

export async function createVideo(agentId: string, input: VideoInput, customer: string): Promise<string> {
  const { data, error } = await rows().insert({ agent_id: agentId, input, customer_name: customer }).select("id").single();
  if (error || !data) throw new Error(`video not created: ${error?.message}`);
  return data.id as string;
}

async function setRow(id: string, patch: Partial<VideoRow>): Promise<void> {
  const { error } = await rows().update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`video ${id} not updated: ${error.message}`);
}

/** runs `fn` over `items`, `n` at a time */
async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

/** every file under the clip's folder but the finished video */
async function clearInputs(id: string): Promise<void> {
  const { data } = await bucket().list(id, { limit: 1000 });
  const paths = (data ?? []).map((o) => `${id}/${o.name}`).filter((p) => !p.endsWith("/quote.mp4"));
  for (let i = 0; i < paths.length; i += 100) await bucket().remove(paths.slice(i, i + 100)).catch(() => undefined);
}

async function fail(id: string, why: unknown): Promise<void> {
  console.error(`quote video ${id} failed:`, why instanceof Error ? why.message : "unknown error");
  await setRow(id, { status: "failed", error: FAILED }).catch(() => undefined);
  await clearInputs(id).catch(() => undefined);
}

/** The whole making, up to Cloud Run taking the job. Never throws: a failure is written to the row. */
export async function produce(id: string, agentName: string): Promise<void> {
  try {
    const { data: row, error } = await rows().select("*").eq("id", id).single<VideoRow>();
    if (error || !row) throw new Error("row not read");
    const gcpKey = await providerKey("gcp");
    if (!gcpKey) throw new Error("no gcp key");
    const input = planInput(row.input);
    const facts = quoteVideoFacts(input);
    if (!facts) throw new Error("quote not priced");
    const contactRow = await getContact(row.agent_id);
    const contact: Contact = {
      name: agentName, phone: contactRow.phone,
      ...(contactRow.line ? { line: contactRow.line } : {}),
      ...(await photoDataUri(contactRow.photoPath).then((p) => (p ? { photo: p } : {}))),
    };
    const script = quoteVideoScript(facts, row.customer_name);

    const pcms = await Promise.all(script.map((s) => speakThai(s.voice, VIDEO_TASK_VOICE)));
    const plans = planScenes(script.map((s, i) => ({ key: s.key, voice: s.voice, voiceSec: pcmSeconds(pcms[i], TTS_RATE) })));
    const layers = plans.map((p) => (p.key === "legacy" ? "photo" as const : p.key === "value" ? "table" as const : undefined));
    const named = nameFiles(plans, layers);
    const chart = valueTableChart(input, CHART_W);
    const panEnd = panEndFor(facts);
    const table = tableImage(facts);
    const total = clipLength(plans);

    // every file the job reads, as bytes, by its input name
    const files = new Map<string, { body: Buffer | string; type: string }>();
    files.set(named.audio, { body: mixNarration(pcms.map((pcm, i) => ({ pcm, at: plans[i].voiceAt })), total, TTS_RATE), type: "audio/wav" });
    const family = await readFile(join(process.cwd(), "public/card/family.jpg"));
    const draws: { name: string; draw: () => Promise<Buffer> }[] = [];
    plans.forEach((p, s) => {
      const sc = named.scenes[s];
      const ctx = { facts, customer: row.customer_name, contact, ...(chart ? { chart } : {}), words: script[s].voice.split(" ").filter(Boolean), panEnd };
      draws.push({ name: sc.base, draw: () => renderPng(sceneLayer(p.key, ctx, "base"), { width: W, height: H }) });
      p.frames.forEach((fr, k) => draws.push({ name: sc.frames[k], draw: () => renderPng(sceneLayer(p.key, ctx, "over", fr.state), { width: W, height: H }) }));
      files.set(sc.list, { body: concatList(p, sc.frames), type: "text/plain" });
      if (sc.layer?.kind === "photo") files.set(sc.layer.name, { body: family, type: "image/jpeg" });
      if (sc.layer?.kind === "table") draws.push({ name: sc.layer.name, draw: () => renderPng(table.el, { width: table.width, height: table.height }) });
    });
    // one at a time keeps the drawing's memory flat; uploads run beside it
    const uploads: Promise<void>[] = [];
    const upload = (name: string, body: Buffer | string, type: string) => bucket()
      .upload(`${id}/${name}`, body, { contentType: type, upsert: true })
      .then(({ error: e }) => { if (e) throw new Error(`upload ${name}: ${e.message}`); });
    for (const d of draws) uploads.push(upload(d.name, await d.draw(), "image/png"));
    await Promise.all(uploads);
    await pool([...files.entries()], 8, ([name, f]) => upload(name, f.body, f.type));

    const paths = named.files.map((f) => `${id}/${f.name}`);
    const signed: string[] = [];
    for (let i = 0; i < paths.length; i += 200) {
      const { data, error: e } = await bucket().createSignedUrls(paths.slice(i, i + 200), LINK_SECONDS);
      if (e || !data) throw new Error(`links: ${e?.message}`);
      for (const d of data) {
        if (!d.signedUrl) throw new Error("a link is missing");
        signed.push(d.signedUrl);
      }
    }
    const built = buildJob(plans, named, { tableHeight: table.height, panEnd });
    const job = { inputs: named.files.map((f, i) => ({ name: f.name, url: signed[i] })), command: built.command, outputs: built.outputs };

    const out = await bucket().createSignedUploadUrl(`${id}/quote.mp4`);
    if (out.error || !out.data?.signedUrl) throw new Error("no upload link");
    const jobId = randomUUID();
    const token = randomBytes(32).toString("hex");
    const callbackUrl = siteUrl(VIDEO_CALLBACK_PATH);
    const uploadsTo = { out_1: { uploadUrl: out.data.signedUrl, path: `${id}/quote.mp4` } };
    const payloadPath = `${id}/job.json`;
    const pay = await bucket().upload(payloadPath, JSON.stringify({ id: jobId, job, uploads: uploadsTo, callbackUrl, token }), { contentType: "text/plain", upsert: true });
    if (pay.error) throw new Error(`payload: ${pay.error.message}`);
    const payLink = await bucket().createSignedUrl(payloadPath, LINK_SECONDS);
    if (payLink.error || !payLink.data?.signedUrl) throw new Error("no payload link");

    // recorded before the run is asked, so a callback that comes back at once finds it
    await setRow(id, { status: "rendering", duration_sec: total, job: { id: jobId, tokenHash: hashToken(token), startedAt: new Date().toISOString() } });
    await cloudRunEngine(gcpKey).submit(job, { callbackUrl, token, uploads: uploadsTo, id: jobId, payloadUrl: payLink.data.signedUrl });
  } catch (e) {
    await fail(id, e);
  }
}

export async function videoOfJob(jobId: string): Promise<VideoRow | null> {
  const { data, error } = await rows().select("*").eq("job->>id", jobId).maybeSingle<VideoRow>();
  if (error) throw new Error(`video of job not read: ${error.message}`);
  return data ?? null;
}

/** Cloud Run's word on a job: the clip is done (the file is ours already) or failed. */
export async function finishVideo(row: VideoRow, state: "done" | "failed", outPath?: string): Promise<void> {
  if (row.status !== "rendering") return;
  if (state === "done" && outPath === `${row.id}/quote.mp4`) {
    await setRow(row.id, { status: "done", video_path: outPath, error: null });
    await asWho(row.agent_id, () => recordUsage("cloudrun", VIDEO_TASK_RENDER, 0, 0, RENDER_COST_THB));
  } else {
    await setRow(row.id, { status: "failed", error: FAILED });
  }
  await clearInputs(row.id);
}

/** An agent's clips, newest first; any stuck past the time limit is marked failed on the way. */
export async function listVideos(agentId: string, limit = 30): Promise<VideoRow[]> {
  const { data, error } = await rows().select("*").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`videos not read: ${error.message}`);
  const list = (data ?? []) as VideoRow[];
  const now = Date.now();
  for (const v of list) {
    if ((v.status === "drawing" || v.status === "rendering") && now - Date.parse(v.created_at) > VIDEO_TIMEOUT_MS) {
      await fail(v.id, new Error("timed out"));
      v.status = "failed";
      v.error = FAILED;
    }
  }
  return list;
}

/** a link to watch, or to save under a file name (download), good for `seconds` */
export async function videoLink(path: string, seconds: number, download?: string): Promise<string | null> {
  const { data } = await bucket().createSignedUrl(path, seconds, download ? { download } : undefined);
  return data?.signedUrl ?? null;
}
