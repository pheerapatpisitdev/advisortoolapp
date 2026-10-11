import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { providerKey } from "@/lib/ai/client";
import { recordUsage } from "@/lib/ai/ledger";
import { asWho } from "@/lib/ai/who";
import { speakThai, TTS_RATE } from "@/lib/ai/tts";
import { renderPng } from "@/lib/content/poster-png";
import { valueTableChart } from "@/lib/quote-card";
import { can } from "@/lib/auth/access";
import type { Viewer } from "@/lib/auth/access";
import { siteUrl } from "@/lib/site-url";
import { formatBaht } from "@/lib/wallet/money";
import { balanceSatang, holdWallet, releaseWallet, settleWallet, walletFrozen, walletSettings } from "@/lib/wallet/store";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cloudRunEngine } from "@/lib/video/engines/cloudrun";
import { getContact, photoDataUri } from "./contact";
import { CHART_W, panEndFor, sceneLayer, tableImage, type Contact } from "./draw";
import { buildJob, concatList, mixNarration, nameFiles, pcmSeconds } from "./job";
import { motionBackground, motionFrame, motionWindows, MOTION_BG_H, MOTION_FPS } from "./motion";
import { planInput, productOf, quoteVideoFacts, quoteVideoScript, sceneMotion, type VideoInput, type VideoStyle } from "./script";
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
/** every agent's free clips, once (owner, 2026-10-11) */
export const FREE_VIDEOS = 2;
/**
 * What a clip costs an agent, fixed (owner, 2026-10-11): ฿5 แบบปกติ, ฿10 Motion Graphic (Premium).
 * The wallet holds the price when the clip is asked for and takes it when the clip is done.
 */
export const VIDEO_PRICE_SATANG: Record<VideoStyle, number> = { classic: 500, motion: 1000 };
const styleOf = (v: VideoInput): VideoStyle => (v.style === "motion" ? "motion" : "classic");
/** the round name on the wallet's hold and charge lines */
export const VIDEO_ROUND = "quote-video";

export type VideoStatus = "drawing" | "rendering" | "done" | "failed";
export type { VideoInput } from "./script";
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
  paid_by: PaidBy | null;
  hold_id: string | null;
  held_satang: number | null;
  multiplier: number | null;
  cost_thb: number;
  charged_satang: number | null;
}
export type PaidBy = "staff" | "free" | "wallet";

const rows = () => supabaseAdmin().from("ins_quote_videos");
const bucket = () => supabaseAdmin().storage.from(VIDEO_BUCKET);
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");


/** How the next clip would be paid for, as the board says it under the button. */
export type CostView =
  | { kind: "staff" }
  | { kind: "free"; left: number; of: number }
  /** the price of each style, and whether the wallet holds it */
  | { kind: "wallet"; balance: string; prices: Record<VideoStyle, { price: string; enough: boolean }> }
  | { kind: "closed" };

/** the agent's free clips used: those not failed (a failed one is handed back) */
async function freeUsed(agentId: string): Promise<number> {
  const { count, error } = await rows().select("id", { count: "exact", head: true })
    .eq("agent_id", agentId).eq("paid_by", "free").neq("status", "failed");
  if (error) throw new Error(`free clips not counted: ${error.message}`);
  return count ?? 0;
}

export async function costView(viewer: Viewer): Promise<CostView> {
  if (can(viewer, "owner")) return { kind: "staff" };
  const used = await freeUsed(viewer.agentId);
  if (used < FREE_VIDEOS) return { kind: "free", left: FREE_VIDEOS - used, of: FREE_VIDEOS };
  const s = await walletSettings().catch(() => null);
  if (!s?.enabled) return { kind: "closed" };
  const balance = await balanceSatang(viewer.agentId);
  const priced = (style: VideoStyle) => ({ price: formatBaht(VIDEO_PRICE_SATANG[style]), enough: balance >= VIDEO_PRICE_SATANG[style] });
  return { kind: "wallet", balance: formatBaht(balance), prices: { classic: priced("classic"), motion: priced("motion") } };
}

/**
 * Starts a clip's row and says who pays: the owner nothing, then the agent's two free clips,
 * then the wallet — the hold set aside before anything is spent. A refusal is the words to show.
 */
export async function createVideo(viewer: Viewer, input: VideoInput, customer: string): Promise<{ id: string } | { refusal: string }> {
  let pay: Partial<VideoRow> = { paid_by: "staff" };
  if (!can(viewer, "owner")) {
    if ((await freeUsed(viewer.agentId)) < FREE_VIDEOS) pay = { paid_by: "free" };
    else {
      const s = await walletSettings().catch(() => null);
      if (!s?.enabled) return { refusal: `ใช้วิดีโอฟรีครบ ${FREE_VIDEOS} ครั้งแล้ว` };
      const held = VIDEO_PRICE_SATANG[styleOf(input)];
      const hold = await holdWallet(viewer.agentId, held, VIDEO_ROUND).catch((e) => {
        console.error("quote video hold failed:", e);
        return null;
      });
      if (!hold) {
        return { refusal: (await walletFrozen(viewer.agentId).catch(() => false))
          ? "กระเป๋าเงินถูกพักไว้ชั่วคราว — ติดต่อสำนักงานนะครับ"
          : `ใช้วิดีโอฟรีครบแล้ว — ต้องมีเงินในกระเป๋าอย่างน้อย ${formatBaht(held)} เติมเงินได้ที่เมนู "กระเป๋าเงิน"` };
      }
      pay = { paid_by: "wallet", hold_id: hold, held_satang: held, multiplier: 1 };
    }
  }
  const { data, error } = await rows().insert({ agent_id: viewer.agentId, input, customer_name: customer, ...pay }).select("id").single();
  if (error || !data) {
    if (pay.hold_id) await releaseWallet(pay.hold_id).catch(() => undefined);
    throw new Error(`video not created: ${error?.message}`);
  }
  return { id: data.id as string };
}

/** the wallet's hold, if any, given back in full */
async function release(row: Pick<VideoRow, "hold_id" | "paid_by">): Promise<void> {
  if (row.paid_by !== "wallet" || !row.hold_id) return;
  await releaseWallet(row.hold_id).catch((e) => console.error("quote video hold not released:", e));
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
  // only the writer that moves the row to failed gives the hold back
  const { data } = await rows().update({ status: "failed", error: FAILED, updated_at: new Date().toISOString() })
    .eq("id", id).in("status", ["drawing", "rendering"]).select("hold_id, paid_by").maybeSingle();
  if (data) await release(data as Pick<VideoRow, "hold_id" | "paid_by">);
  await clearInputs(id).catch(() => undefined);
}

/** The whole making, up to Cloud Run taking the job. Never throws: a failure is written to the row. */
export async function produce(id: string, agentName: string): Promise<void> {
  try {
    const { data: row, error } = await rows().select("*").eq("id", id).single<VideoRow>();
    if (error || !row) throw new Error("row not read");
    const gcpKey = await providerKey("gcp");
    if (!gcpKey) throw new Error("no gcp key");
    const facts = quoteVideoFacts(row.input);
    if (!facts) throw new Error("quote not priced");
    const contactRow = await getContact(row.agent_id);
    const contact: Contact = {
      name: agentName, phone: contactRow.phone,
      ...(contactRow.line ? { line: contactRow.line } : {}),
      ...(await photoDataUri(contactRow.photoPath).then((p) => (p ? { photo: p } : {}))),
    };
    const narrator: "F" | "M" = row.input.narrator === "M" ? "M" : "F";
    // the 15-second clip goes up on a public Page: no customer's name, whatever was typed
    const short = row.input.length === "short";
    const customer = short ? "" : row.customer_name;
    const script = quoteVideoScript(facts, customer, narrator, short ? "short" : "full");

    const spoken = await Promise.all(script.map((s) => speakThai(s.voice, VIDEO_TASK_VOICE, { narrator })));
    const pcms = spoken.map((s) => s.pcm);
    await setRow(id, { cost_thb: spoken.reduce((n, s) => n + s.costThb, 0) });
    const motion = row.input.style === "motion";
    const secs = pcms.map((pcm) => pcmSeconds(pcm, TTS_RATE));
    const plans = planScenes(script.map((s, i) => ({
      key: s.key, voice: s.voice, voiceSec: secs[i],
      ...(motion ? { windows: motionWindows(s.key, facts, secs[i]), fps: MOTION_FPS } : sceneMotion(facts, s.key)),
    })));
    const layers = plans.map((p) => (motion ? undefined : p.key === "lead" ? "photo" as const : p.key === "value" ? "table" as const : undefined));
    const named = nameFiles(plans, layers);
    const chart = "variant" in row.input && productOf(row.input) !== "IHEALTHY" ? valueTableChart(planInput(row.input), CHART_W) : undefined;
    const panEnd = panEndFor(facts);
    const table = tableImage(facts);
    const total = clipLength(plans);

    // every file the job reads, as bytes, by its input name
    const files = new Map<string, { body: Buffer | string; type: string }>();
    files.set(named.audio, { body: mixNarration(pcms.map((pcm, i) => ({ pcm, at: plans[i].voiceAt })), total, TTS_RATE), type: "audio/wav" });
    const family = await readFile(join(process.cwd(), "public/card/family.jpg"));
    const draws: { name: string; draw: () => Promise<Buffer> }[] = [];
    // the Motion Graphic style: one drifting background under every scene, every frame drawn whole
    const background = motion ? await renderPng(motionBackground(), { width: W, height: MOTION_BG_H }) : undefined;
    if (motion) plans.forEach((p, s) => {
      const sc = named.scenes[s];
      const mctx = { facts, narrator, customer, contact, words: script[s].voice.split(" ").filter(Boolean), voiceSec: secs[s] };
      files.set(sc.base, { body: background!, type: "image/png" });
      p.frames.forEach((fr, k) => draws.push({ name: sc.frames[k], draw: () => renderPng(motionFrame(p.key, mctx, fr.t ?? 0), { width: W, height: H }) }));
      files.set(sc.list, { body: concatList(p, sc.frames), type: "text/plain" });
    });
    else plans.forEach((p, s) => {
      const sc = named.scenes[s];
      const ctx = { facts, narrator, customer, contact, ...(chart ? { chart } : {}), words: script[s].voice.split(" ").filter(Boolean), panEnd };
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
    const built = buildJob(plans, named, motion ? { driftHeight: MOTION_BG_H } : { tableHeight: table.height, panEnd });
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

/** one of an agent's own clips, not deleted; null when there is none */
export async function videoOf(agentId: string, id: string): Promise<VideoRow | null> {
  const { data, error } = await rows().select("*").eq("id", id).eq("agent_id", agentId).is("deleted_at", null).maybeSingle<VideoRow>();
  if (error) throw new Error(`video not read: ${error.message}`);
  return data ?? null;
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
    // the row moves once: a callback sent twice settles once
    const { data, error } = await rows().update({ status: "done", video_path: outPath, error: null, updated_at: new Date().toISOString() })
      .eq("id", row.id).eq("status", "rendering").select("id").maybeSingle();
    if (error) throw new Error(`video ${row.id} not finished: ${error.message}`);
    if (!data) return;
    await asWho(row.agent_id, () => recordUsage("cloudrun", VIDEO_TASK_RENDER, 0, 0, RENDER_COST_THB));
    const cost = Number(row.cost_thb ?? 0) + RENDER_COST_THB;
    let charged: number | null = null;
    if (row.paid_by === "wallet" && row.hold_id && row.held_satang) {
      // the price is fixed: the whole hold is the charge
      charged = await settleWallet(row.hold_id, Number(row.held_satang), cost)
        .catch((e) => { console.error("quote video settle failed:", e); return null; });
    }
    await setRow(row.id, { cost_thb: cost, ...(charged !== null ? { charged_satang: charged } : {}) }).catch(() => undefined);
    await clearInputs(row.id);
  } else {
    await fail(row.id, new Error("render failed"));
  }
}

/** An agent's clips, newest first; any stuck past the time limit is marked failed on the way. */
export async function listVideos(agentId: string, limit = 30): Promise<VideoRow[]> {
  const { data, error } = await rows().select("*").eq("agent_id", agentId).is("deleted_at", null).order("created_at", { ascending: false }).limit(limit);
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

/**
 * An agent's own clip deleted (owner, 2026-10-11): its files go, the row is marked and stays, so
 * the free clips and the wallet's lines are not undone. Not while it is being made.
 */
export async function deleteVideo(agentId: string, id: string): Promise<"deleted" | "busy" | "missing"> {
  const { data, error } = await rows().update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id).eq("agent_id", agentId).is("deleted_at", null).in("status", ["done", "failed"]).select("id").maybeSingle();
  if (error) throw new Error(`video ${id} not deleted: ${error.message}`);
  if (!data) {
    const { data: still } = await rows().select("status").eq("id", id).eq("agent_id", agentId).is("deleted_at", null).maybeSingle();
    return still ? "busy" : "missing";
  }
  const { data: files } = await bucket().list(id, { limit: 1000 });
  const paths = (files ?? []).map((o) => `${id}/${o.name}`);
  for (let i = 0; i < paths.length; i += 100) await bucket().remove(paths.slice(i, i + 100)).catch(() => undefined);
  return "deleted";
}

/** a link to watch, or to save under a file name (download), good for `seconds` */
export async function videoLink(path: string, seconds: number, download?: string): Promise<string | null> {
  const { data } = await bucket().createSignedUrl(path, seconds, download ? { download } : undefined);
  return data?.signedUrl ?? null;
}
