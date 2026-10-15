import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { providerKey } from "@/lib/ai/client";
import { recordUsage } from "@/lib/ai/ledger";
import { asWho } from "@/lib/ai/who";
import { speakLine, TTS_RATE, TtsQuotaError } from "@/lib/ai/tts";
import { sayNumbers } from "./say-numbers";
import { renderPng } from "@/lib/content/poster-png";
import { valueTableChart } from "@/lib/quote-card";
import { can } from "@/lib/auth/access";
import type { Viewer } from "@/lib/auth/access";
import { memberAccess, PASS_EXPIRED, PASS_UNREADABLE, passOpen, type MemberAccess } from "@/lib/members/access";
import { videosFrom } from "@/lib/members/pass";
import { siteUrl } from "@/lib/site-url";
import { formatBaht } from "@/lib/wallet/money";
import { videoPriceKey, type PriceKey, type Prices } from "@/lib/wallet/prices";

/** the prices the board shows under its button: each look and length, and the FHC summary */
const VIDEO_KEYS: PriceKey[] = ["videoClassic", "videoMotion", "videoLongClassic", "videoLongMotion", "videoMaxClassic", "videoMaxMotion", "videoFhc", "videoStory", "videoStoryShort"];
import { balanceSatang, holdWallet, releaseWallet, settleWallet, walletFrozen, walletPrices, walletSettings } from "@/lib/wallet/store";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cloudRunEngine } from "@/lib/video/engines/cloudrun";
import { getContact, photoDataUri } from "./contact";
import { CHART_W, sceneLayer, tableImage, type Contact } from "./draw";
import { noteDrawing, tablePlan } from "./table-pen";
import { pensionTableImage, pensionTablePlan } from "./pension-table";
import { buildJob, concatList, mixNarration, nameFiles, pcmSeconds } from "./job";
import { fhcScript, isFhcInput, type FhcVideoInput } from "./fhc";
import { fhcFrame, fhcWindows } from "./fhc-motion";
import { topicOf } from "@/lib/story/topics";
import { isStoryInput, storyScript, type StoryVideoInput } from "./story";
import { storyBackground } from "./story-motion";
import { clipCrowd, clipFaces, clipFrame, clipHandText, clipWindows } from "./story-frames";
import { faceUris } from "./story-faces";
import { motionBackground, motionBgHeight, motionFrame, motionWindows, MOTION_FPS } from "./motion";
import { wideFhcFrame, wideQuoteFrame } from "./wide";
import { WIDE_CHART_W, wideSceneLayer } from "./classic-wide";
import { CLASSIC_BOXES } from "./table-geo";
import { extraOf, linesOf, loops, readLength, type Told } from "./told";
import { writes } from "./brief";
import { writeLines } from "./writer";
import { planInput, productOf, quoteVideoFacts, quoteVideoScript, sceneMotion, type VideoInput } from "./script";
import { clipLength, LOOP_TAIL, planScenes, SIZES, sizeOf, type ScenePlan, type VideoSize } from "./timeline";
import { VOICE_FULL, voiceDay, voiceFullText } from "./voice-quota";
import { readVideoLang, SCRIPT_FAMILY, wordsLetters, type VideoLang } from "./video-words";
import { clipKind, DEFAULT_ESTIMATES, estimatesFrom, type ClipKind, type Estimate, type ProgressNote } from "./progress";

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
/**
 * a clip still drawing or rendering after this long has failed: the drawing's 5 minutes and Cloud
 * Run's 15 (its task timeout), with room — a 2-minute clip renders for longer (owner, 2026-10-13)
 */
export const VIDEO_TIMEOUT_MS = 20 * 60_000;
const LINK_SECONDS = 2 * 3600;
/** a Cloud Run run of one clip: a couple of CPU-minutes, in baht */
const RENDER_COST_THB = 0.01 * 36;
export const FAILED = "ทำวิดีโอไม่สำเร็จ ลองใหม่อีกครั้ง";
/** every agent's free clips, once (owner, 2026-10-11); a member's pass carries its own (freeClips) */
export const FREE_VIDEOS = 2;
/**
 * What a clip costs an agent, fixed, from the owner's price list (src/lib/wallet/prices.ts,
 * /admin/wallet — owner 2026-10-12): ฿5 แบบปกติ, ฿10 Motion Graphic, ฿3 an FHC summary whatever
 * its look, and an ElevenLabs voice on top (+฿2). The wallet holds the price when the clip is
 * asked for and takes it when the clip is done.
 */
export const videoPrice = (v: ClipInput, prices: Prices): number =>
  (isFhcInput(v) ? prices.videoFhc : isStoryInput(v) ? (topicOf(v.topic)?.short ? prices.videoStoryShort : prices.videoStory)
    : prices[videoPriceKey(v.style === "motion" ? "motion" : "classic", readLength(v.length))]) + (v.voice ? prices.elevenExtra : 0);
/** the round name on the wallet's hold and charge lines */
export const VIDEO_ROUND = "quote-video";

export type VideoStatus = "drawing" | "rendering" | "done" | "failed";
export type { VideoInput } from "./script";
/** what a clip's row holds: a quote, an FHC summary (fhc.ts), or a คลิปเล่าเรื่อง (story.ts) */
export type ClipInput = VideoInput | FhcVideoInput | StoryVideoInput;
/** a quote clip: neither an FHC summary nor a story */
export const isQuoteInput = (v: ClipInput): v is VideoInput => !isFhcInput(v) && !isStoryInput(v);
export interface VideoRow {
  id: string;
  agent_id: string;
  created_at: string;
  updated_at: string;
  input: ClipInput;
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
  /** how far the making is (progress.ts): written by produce, read by the board */
  progress: unknown;
  /** the words the agent's AI wrote to go with it (post-text.ts); absent before the column is */
  post_text?: unknown;
}
export type PaidBy = "staff" | "free" | "wallet";

const rows = () => supabaseAdmin().from("ins_quote_videos");
const bucket = () => supabaseAdmin().storage.from(VIDEO_BUCKET);
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");


/** How the next clip would be paid for, as the board says it under the button. */
export type CostView =
  | { kind: "staff" }
  | { kind: "free"; left: number; of: number }
  /** the price of each look (an FHC summary its own), and whether the wallet holds it */
  | { kind: "wallet"; balance: string; prices: Partial<Record<PriceKey, { price: string; enough: boolean }>> }
  | { kind: "closed" };

/** Which free clips count: since `from` when it is set, else every one ever made. */
export interface FreeClips {
  limit: number;
  from: Date | null;
}

/**
 * A member with a live pass has the pass's clips, counted afresh from the period's start (owner,
 * 2026-10-14, option ก); everyone else the two, once. Throws when the pass cannot be read.
 */
export async function freeClips(viewer: Viewer, access?: MemberAccess): Promise<FreeClips> {
  const a = access ?? await memberAccess(viewer);
  return (a.gated && videosFrom(a.state, a.settings)) || { limit: FREE_VIDEOS, from: null };
}

/** the agent's free clips used in the window: those not failed (a failed one is handed back) */
async function freeUsed(agentId: string, from: Date | null): Promise<number> {
  let q = rows().select("id", { count: "exact", head: true })
    .eq("agent_id", agentId).eq("paid_by", "free").neq("status", "failed");
  if (from) q = q.gte("created_at", from.toISOString());
  const { count, error } = await q;
  if (error) throw new Error(`free clips not counted: ${error.message}`);
  return count ?? 0;
}

/** the free clips an agent has left of how many, for the wallet and membership pages (owner, 2026-10-12) */
export async function freeVideosLeft(viewer: Viewer): Promise<{ left: number; of: number }> {
  const { limit, from } = await freeClips(viewer);
  return { left: Math.max(0, limit - await freeUsed(viewer.agentId, from)), of: limit };
}

export async function costView(viewer: Viewer): Promise<CostView> {
  if (can(viewer, "owner")) return { kind: "staff" };
  const { limit, from } = await freeClips(viewer);
  const used = await freeUsed(viewer.agentId, from);
  if (used < limit) return { kind: "free", left: limit - used, of: limit };
  const s = await walletSettings().catch(() => null);
  if (!s?.enabled) return { kind: "closed" };
  const [balance, prices] = await Promise.all([balanceSatang(viewer.agentId), walletPrices()]);
  const priced = (satang: number) => ({ price: formatBaht(satang), enough: balance >= satang });
  return {
    kind: "wallet", balance: formatBaht(balance),
    prices: Object.fromEntries(VIDEO_KEYS.map((k) => [k, priced(prices[k])])),
  };
}

/**
 * Starts a clip's row and says who pays: the owner nothing, then the agent's free clips (freeClips),
 * then the wallet — the hold set aside before anything is spent. A refusal is the words to show.
 */
export async function createVideo(viewer: Viewer, input: ClipInput, customer: string): Promise<{ id: string } | { refusal: string }> {
  let pay: Partial<VideoRow> = { paid_by: "staff" };
  if (!can(viewer, "owner")) {
    // an outside member makes clips while their pass is live (owner, 2026-10-13); unreadable refuses
    const access = await memberAccess(viewer).catch((e) => {
      console.error("quote video refused, pass unreadable:", e);
      return null;
    });
    if (!access) return { refusal: PASS_UNREADABLE };
    if (!passOpen(access)) return { refusal: PASS_EXPIRED };
    const { limit, from } = await freeClips(viewer, access);
    if ((await freeUsed(viewer.agentId, from)) < limit) pay = { paid_by: "free" };
    else {
      const s = await walletSettings().catch(() => null);
      if (!s?.enabled) return { refusal: `ใช้วิดีโอฟรีครบ ${limit} ครั้งแล้ว` };
      const held = videoPrice(input, await walletPrices());
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

/**
 * How far the making is, on the row for the board's bar (progress.ts). updated_at is left alone,
 * and only a clip still drawing is written: a late write never lands on a rendered or failed one.
 */
async function noteProgress(id: string, note: ProgressNote): Promise<void> {
  const { error } = await rows().update({ progress: note }).eq("id", id).eq("status", "drawing");
  if (error) console.error(`quote video ${id}: progress not written:`, error.message);
}

/** each kind's estimate, read again after this long */
const ESTIMATE_TTL_MS = 10 * 60_000;
let estimates: { at: number; value: Record<ClipKind, Estimate> } | null = null;

/**
 * How long each kind of clip takes to make, from the finished ones (progress.ts estimatesFrom):
 * before its render starts, and the render. Kept for a while; the defaults when unreadable.
 */
export async function clipEstimates(now = Date.now()): Promise<Record<ClipKind, Estimate>> {
  if (estimates && now - estimates.at < ESTIMATE_TTL_MS) return estimates.value;
  const { data, error } = await rows().select("input, created_at, updated_at, job")
    .eq("status", "done").is("deleted_at", null).not("job", "is", null).order("created_at", { ascending: false }).limit(300);
  if (error) {
    console.error("quote video estimates not read:", error.message);
    return DEFAULT_ESTIMATES;
  }
  const samples = (data ?? []).flatMap((r: Pick<VideoRow, "input" | "created_at" | "updated_at" | "job">) => {
    const started = Date.parse(r.job?.startedAt ?? "");
    const asked = Date.parse(r.created_at);
    const done = Date.parse(r.updated_at);
    if (![started, asked, done].every(Number.isFinite)) return [];
    return [{ kind: clipKind(r.input as { fhc?: unknown; style?: unknown; length?: unknown }), pre: (started - asked) / 1000, render: (done - started) / 1000 }];
  });
  estimates = { at: now, value: estimatesFrom(samples) };
  return estimates.value;
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
  // Gemini's voice used up for the day: the card says when to try again, and marks the day (voiceFullUntil)
  const error = why instanceof TtsQuotaError ? voiceFullText(voiceDay().until) : FAILED;
  const { data } = await rows().update({ status: "failed", error, updated_at: new Date().toISOString() })
    .eq("id", id).in("status", ["drawing", "rendering"]).select("hold_id, paid_by").maybeSingle();
  if (data) await release(data as Pick<VideoRow, "hold_id" | "paid_by">);
  await clearInputs(id).catch(() => undefined);
}

/**
 * When Gemini's voice comes back, if a clip has hit its daily cap since the day turned over
 * (owner, 2026-10-12): the board then warns before anyone asks for a Gemini-voiced clip.
 */
export async function voiceFullUntil(now = new Date()): Promise<Date | null> {
  const { from, until } = voiceDay(now);
  const { data, error } = await rows().select("id").like("error", `${VOICE_FULL}%`).gte("updated_at", from.toISOString()).limit(1);
  if (error) throw new Error(`voice quota not read: ${error.message}`);
  return data?.length ? until : null;
}

/**
 * The page's own time limit is 300 s (page.tsx maxDuration, the Hobby plan's most): past this the
 * making gives up on its own, so the row says failed and the hold goes back, rather than the
 * platform killing it mid-way with the row left drawing (owner, 2026-10-12: a Premium clip did).
 */
const PRODUCE_BUDGET_MS = 270_000;
/** the drawing route, one scene per call (owner, 2026-10-12: a Premium clip drew too long in one) */
export const VIDEO_DRAW_PATH = "/api/quote-video/draw";
/** what produce keeps for the scene drawers: the voice lengths, and the secret they must bring */
const planPath = (id: string) => `${id}/plan.json`;
interface DrawPlan { tokenHash: string; secs: number[] }

/**
 * Everything about a clip that follows from its row and how long each line was spoken: the
 * script, the scenes and their file names, what each picture shows. produce and every scene
 * drawer work it out the same way, so only the voice lengths travel between them.
 */
type BuildOpts = Parameters<typeof buildJob>[2];
/**
 * The clip's shape (owner, 2026-10-11): a Motion Graphic quote or an FHC summary in the size asked
 * for; the classic style and the 15-second clip always portrait.
 */
export function clipSize(input: ClipInput): VideoSize {
  // every clip in every shape since 2026-10-13 (owner: "ทุกวิดีโอ สามารถเลือกขนาดได้")
  return sizeOf(input);
}

/** how a quote clip is told: its brief and the lines written to it (told.ts) */
const toldOf = (input: VideoInput): Told => ({ ...(input.brief ? { brief: input.brief } : {}), ...(input.lines ? { lines: input.lines } : {}) });

export interface ClipParts {
  size: VideoSize;
  script: { key: string; voice: string }[];
  motion: boolean;
  plans: ScenePlan[];
  named: ReturnType<typeof nameFiles>;
  /** what ffmpeg needs besides the scenes: the classic table's pan, or the Motion background's drift */
  build: BuildOpts;
  layers: { photo: boolean };
  sceneDraws: (s: number) => { name: string; draw: () => Promise<Buffer> }[];
  /** a still background under every scene, when the clip has one of its own (the story clip's paper) */
  background?: () => Promise<Buffer>;
}

async function contactOf(agentId: string, agentName: string): Promise<Contact> {
  const contactRow = await getContact(agentId);
  return {
    name: agentName, phone: contactRow.phone,
    ...(contactRow.line ? { line: contactRow.line } : {}),
    ...(contactRow.more ? { more: contactRow.more } : {}),
    ...(await photoDataUri(contactRow.photoPath).then((p) => (p ? { photo: p } : {}))),
  };
}

const narratorOf = (input: ClipInput): "F" | "M" => (input.narrator === "M" ? "M" : "F");

/** the language a clip is told in: an iHealthy clip's own choice (owner, 2026-10-15), Thai for every other */
export const langOfInput = (input: ClipInput): VideoLang =>
  (isQuoteInput(input) && input.product === "IHEALTHY" ? readVideoLang(input.lang) : "th");

/** the lines a clip speaks, in scene order */
function spokenLines(row: VideoRow): { key: string; voice: string }[] {
  if (isFhcInput(row.input)) return fhcScript(row.input.fhc, row.customer_name, narratorOf(row.input));
  if (isStoryInput(row.input)) return storyScript(row.input, row.customer_name, narratorOf(row.input));
  const facts = quoteVideoFacts(row.input);
  if (!facts) throw new Error("quote not priced");
  const length = readLength(row.input.length);
  return quoteVideoScript(facts, length === "short" ? "" : row.customer_name, narratorOf(row.input), length, toldOf(row.input));
}

/** An FHC summary's parts: always the Motion Graphic world, six scenes (fhc-motion.tsx). */
async function fhcParts(row: VideoRow & { input: FhcVideoInput }, agentName: string, secs: number[]): Promise<ClipParts> {
  const facts = row.input.fhc;
  const size = clipSize(row.input);
  const dims = SIZES[size];
  const narrator = narratorOf(row.input);
  const customer = row.customer_name;
  const contact = await contactOf(row.agent_id, agentName);
  const script = fhcScript(facts, customer, narrator);
  if (secs.length !== script.length) throw new Error("voice lengths do not match the script");
  const plans = planScenes(script.map((s, i) => ({ key: s.key, voice: s.voice, voiceSec: secs[i], windows: fhcWindows(s.key, facts), fps: MOTION_FPS })));
  const named = nameFiles(plans, plans.map(() => undefined));
  const sceneDraws = (s: number) => {
    const p = plans[s];
    const ctx = { facts, narrator, customer, contact, words: script[s].voice.split(" ").filter(Boolean), voiceSec: secs[s] };
    const frame = (t: number) => (size === "portrait" ? fhcFrame(p.key, ctx, t) : wideFhcFrame(p.key, ctx, t, size));
    return p.frames.map((fr, k) => ({ name: named.scenes[s].frames[k], draw: () => renderPng(frame(fr.t ?? 0), { width: dims.w, height: dims.h }) }));
  };
  return { size, script, motion: true, plans, named, build: { driftHeight: motionBgHeight(dims), size: dims }, layers: { photo: false }, sceneDraws };
}

/**
 * A story clip's parts (story.ts): six scenes drawn on paper, a frame every 1/MOTION_FPS while
 * anything moves, over a still paper background rather than the Motion world's drifting one.
 */
async function storyParts(row: VideoRow & { input: StoryVideoInput }, agentName: string, secs: number[]): Promise<ClipParts> {
  const input = row.input;
  const size = clipSize(input);
  const dims = SIZES[size];
  const narrator = narratorOf(input);
  const customer = row.customer_name;
  const contact = await contactOf(row.agent_id, agentName);
  const script = storyScript(input, customer, narrator);
  if (secs.length !== script.length) throw new Error("voice lengths do not match the script");
  const crowd = clipCrowd(input);
  const faces = await faceUris(clipFaces(input));
  const plans = planScenes(script.map((s, i) => ({ key: s.key, voice: s.voice, voiceSec: secs[i], windows: clipWindows(s.key, input, size), fps: MOTION_FPS })));
  const named = nameFiles(plans, plans.map(() => undefined));
  const hand = clipHandText(input, customer) + contact.name;
  const sceneDraws = (s: number) => {
    const p = plans[s];
    const ctx = { input, size, customer, narrator, contact, crowd, faces, words: script[s].voice.split(" ").filter(Boolean), voiceSec: secs[s] };
    return p.frames.map((fr, k) => ({ name: named.scenes[s].frames[k], draw: () => renderPng(clipFrame(p.key, ctx, fr.t ?? 0), { width: dims.w, height: dims.h }, { hand }) }));
  };
  return {
    size, script, motion: true, plans, named, build: { size: dims }, layers: { photo: false }, sceneDraws,
    background: () => renderPng(storyBackground(size), { width: dims.w, height: dims.h }),
  };
}

async function clipParts(row: VideoRow, agentName: string, secs: number[]): Promise<ClipParts> {
  if (isFhcInput(row.input)) return fhcParts(row as VideoRow & { input: FhcVideoInput }, agentName, secs);
  if (isStoryInput(row.input)) return storyParts(row as VideoRow & { input: StoryVideoInput }, agentName, secs);
  return quoteParts(row as VideoRow & { input: VideoInput }, agentName, secs);
}

async function quoteParts(row: VideoRow & { input: VideoInput }, agentName: string, secs: number[]): Promise<ClipParts> {
  return quotePartsFor(row, await contactOf(row.agent_id, agentName), secs);
}

/** A quote clip's parts, the agent's contact in hand: no database, so a local render draws the same clip. */
export function quotePartsFor(row: Pick<VideoRow, "customer_name"> & { input: VideoInput }, agentContact: Contact, secs: number[]): ClipParts {
  const facts = quoteVideoFacts(row.input);
  if (!facts) throw new Error("quote not priced");
  // the agent's รายละเอียดเพิ่มเติม is written in Thai: a clip in another language leaves it out
  const lang = facts.lang ?? "th";
  const contact: Contact = lang === "th" ? agentContact : { ...agentContact, more: undefined };
  const narrator = narratorOf(row.input);
  const size = clipSize(row.input);
  const dims = SIZES[size];
  // the 15-second clip goes up on a public Page: no customer's name, whatever was typed
  const length = readLength(row.input.length);
  const customer = length === "short" ? "" : row.customer_name;
  const told = toldOf(row.input);
  const script = quoteVideoScript(facts, customer, narrator, length, told);
  const loop = loops(told);
  // what the brief puts on screen: the hook's headline, and the longer clips' scenes
  const shown = { ...(linesOf(facts, told) ? { headline: linesOf(facts, told)!.headline } : {}), loop, extra: extraOf(facts, told) };
  const boxes = CLASSIC_BOXES[size];
  if (secs.length !== script.length) throw new Error("voice lengths do not match the script");
  const motion = row.input.style === "motion";
  // the classic value scene: where the table stops and which pen note is written at each stop
  const valueAt = script.findIndex((s) => s.key === "value");
  // บำนาญ 95's table carries its notes in the picture, and only walks down (pension-table.tsx)
  const pen = !motion && valueAt >= 0
    ? (facts.pension ? pensionTablePlan : tablePlan)(facts, script[valueAt].voice, secs[valueAt], boxes.table)
    : undefined;
  const plans = planScenes(script.map((s, i) => ({
    key: s.key, voice: s.voice, voiceSec: secs[i],
    ...(motion ? { windows: motionWindows(s.key, facts, secs[i], s.voice), fps: MOTION_FPS } : sceneMotion(facts, s.key)),
    ...(pen && i === valueAt ? { table: pen.plan } : {}),
    ...(loop && i === script.length - 1 ? { tail: LOOP_TAIL } : {}),
  })));
  // a looping clip's last scene is its opening again, photo and all (owner, 2026-10-13, choice ก)
  const layers = plans.map((p) => (motion ? undefined
    : p.key === "lead" || (loop && p.key === "contact") ? "photo" as const : p.key === "value" ? "table" as const : undefined));
  const named = nameFiles(plans, layers, plans.map((_, i) => (pen && i === valueAt ? pen.notes.length : 0)));
  // a landscape clip's chart stands beside the table, narrower; a square one has no room for it
  // Protection Life has a variant but no value table, so no chart
  const chart = "variant" in row.input && productOf(row.input) !== "IHEALTHY" && productOf(row.input) !== "PLB" && size !== "square"
    ? valueTableChart(planInput(row.input), size === "landscape" ? WIDE_CHART_W : CHART_W) : undefined;
  const table = facts.pension ? pensionTableImage(facts) : tableImage(facts);
  // Chinese, Russian and Burmese letters come from a face of their own, cut to what this clip shows
  const family = SCRIPT_FAMILY[lang];
  const script$ = family
    ? { script: { family, text: [JSON.stringify(facts), ...script.map((x) => x.voice), wordsLetters(lang), customer, contact.name, contact.line ?? ""].join("") } }
    : {};
  /** one scene's pictures: its base (classic), every overlay frame, and the value table */
  const sceneDraws = (s: number): { name: string; draw: () => Promise<Buffer> }[] => {
    const p = plans[s];
    const sc = named.scenes[s];
    const words = script[s].voice.split(" ").filter(Boolean);
    if (motion) {
      const mctx = { facts, narrator, customer, contact, words, voiceSec: secs[s], ...shown };
      const frame = (t: number) => (size === "portrait" ? motionFrame(p.key, mctx, t) : wideQuoteFrame(p.key, mctx, t, size));
      // the value scene writes its pen notes in the handwriting face
      const withPen = { pen: p.key === "value" };
      return p.frames.map((fr, k) => ({ name: sc.frames[k], draw: () => renderPng(frame(fr.t ?? 0), { width: dims.w, height: dims.h }, { ...withPen, ...script$ }) }));
    }
    const ctx = { facts, narrator, customer, contact, ...(chart ? { chart } : {}), words, ...(pen ? { notes: pen.notes } : {}), ...shown };
    const withPen = { pen: p.key === "value" };
    const layer = (which: "base" | "over", state?: (typeof p.frames)[number]["state"]) => (size === "portrait"
      ? sceneLayer(p.key, ctx, which, state) : wideSceneLayer(p.key, ctx, which, size, state));
    return [
      { name: sc.base, draw: () => renderPng(layer("base"), { width: dims.w, height: dims.h }, script$) },
      ...p.frames.map((fr, k) => ({ name: sc.frames[k], draw: () => renderPng(layer("over", fr.state), { width: dims.w, height: dims.h }, { ...withPen, ...script$ }) })),
      ...(sc.layer?.kind === "table" ? [{ name: sc.layer.name, draw: () => renderPng(table.el, { width: table.width, height: table.height }, { pen: Boolean(facts.pension) }) }] : []),
      ...(sc.layer?.pens ?? []).map((name, k) => ({
        name, draw: () => renderPng(noteDrawing(pen!.notes[k], table.height), { width: table.width, height: table.height }, withPen),
      })),
    ];
  };
  return {
    script, motion, plans, named, sceneDraws,
    size,
    build: motion ? { driftHeight: motionBgHeight(dims), size: dims } : { tableHeight: table.height, size: dims, photo: boxes.photo, table: boxes.table },
    layers: { photo: layers.includes("photo") },
  };
}

/** one file into the clip's folder; a dropped connection is tried twice more (hundreds go up per clip) */
async function upload(id: string, name: string, body: Buffer | string, type: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      const { error: e } = await bucket().upload(`${id}/${name}`, body, { contentType: type, upsert: true });
      if (!e) return;
      if (attempt >= 3) throw new Error(e.message);
    } catch (e) {
      if (attempt >= 3) throw new Error(`upload ${name}: ${e instanceof Error ? e.message : "failed"}`);
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}
/** uploads in flight beside the drawing, at most */
const UPLOADS_IN_FLIGHT = 8;

/**
 * The whole making, up to Cloud Run taking the job. Never throws: a failure is written to the row.
 * The voice and the files every scene shares are made here; each scene's pictures are drawn by a
 * call of its own to the drawing route (drawScene), all at once, so no one call draws a whole clip.
 */
export async function produce(id: string, agentName: string): Promise<void> {
  const t0 = Date.now();
  // how long each step took, in the log, to see where a clip runs out of time
  const lap = (what: string) => console.log(`quote video ${id}: ${what} at ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  try {
    const { data: row, error } = await rows().select("*").eq("id", id).single<VideoRow>();
    if (error || !row) throw new Error("row not read");
    const gcpKey = await providerKey("gcp");
    if (!gcpKey) throw new Error("no gcp key");
    const narrator = narratorOf(row.input);
    // a brief the agent did not preview is written now, and kept with the clip so every scene drawer tells the same lines
    if (isQuoteInput(row.input) && writes(row.input.brief) && !row.input.lines) {
      const facts = quoteVideoFacts(row.input);
      if (facts) {
        const { lines } = await writeLines(facts, row.input.brief, readLength(row.input.length));
        row.input = { ...row.input, lines };
        await setRow(id, { input: row.input });
        lap("lines written to the brief");
      }
    }
    const spokenScript = spokenLines(row);

    // the board's bar (progress.ts): each write waits for the one before, so the count never goes back
    let noted: Promise<void> = Promise.resolve();
    const note = (n: ProgressNote) => { noted = noted.then(() => noteProgress(id, n)).catch(() => undefined); };
    let lines = 0;
    note({ step: "voice", done: 0, of: spokenScript.length });
    // figures become Thai words for a Thai voice only; another language's voice reads its own lines, and
    // the ElevenLabs voices are Thai ones, so it is Gemini's narrator (owner, 2026-10-15)
    const lang = langOfInput(row.input);
    const voiceId = lang === "th" ? row.input.voice : undefined;
    const speak = (s: { voice: string }) => speakLine(lang === "th" ? sayNumbers(s.voice) : s.voice, VIDEO_TASK_VOICE, { narrator, voice: voiceId, lang })
      .then((r) => { note({ step: "voice", done: ++lines, of: spokenScript.length }); return r; });
    // ElevenLabs' Starter plan takes three lines at a time: two at once stays under it
    const spoken = voiceId ? await pool(spokenScript, 2, speak) : await Promise.all(spokenScript.map(speak));
    const pcms = spoken.map((s) => s.pcm);
    await setRow(id, { cost_thb: spoken.reduce((n, s) => n + s.costThb, 0) });
    lap(`voice done (${spokenScript.length} lines${voiceId ? ", ElevenLabs" : ""}${lang === "th" ? "" : `, ${lang}`})`);
    const secs = pcms.map((pcm) => pcmSeconds(pcm, TTS_RATE));
    const { size, motion, plans, named, build, layers, background: ownBackground } = await clipParts(row, agentName, secs);
    const total = clipLength(plans);

    // the files every scene shares, or that need no drawing
    const files = new Map<string, { body: Buffer | string; type: string }>();
    files.set(named.audio, { body: mixNarration(pcms.map((pcm, i) => ({ pcm, at: plans[i].voiceAt })), total, TTS_RATE), type: "audio/wav" });
    const family = layers.photo ? await readFile(join(process.cwd(), "public/card/family.jpg")) : undefined;
    // the Motion Graphic style: one drifting background under every scene
    const dims = SIZES[size];
    // a story clip: its own still paper instead
    const background = ownBackground ? await ownBackground()
      : motion ? await renderPng(motionBackground(dims), { width: dims.w, height: motionBgHeight(dims) }) : undefined;
    plans.forEach((p, s) => {
      const sc = named.scenes[s];
      if (background) files.set(sc.base, { body: background, type: "image/png" });
      files.set(sc.list, { body: concatList(p, sc.frames), type: "text/plain" });
      if (sc.layer?.kind === "photo" && family) files.set(sc.layer.name, { body: family, type: "image/jpeg" });
    });
    const drawToken = randomBytes(32).toString("hex");
    const plan: DrawPlan = { tokenHash: hashToken(drawToken), secs };
    files.set("plan.json", { body: JSON.stringify(plan), type: "text/plain" });
    note({ step: "files", done: 0, of: 0 });
    await pool([...files.entries()], 8, ([name, f]) => upload(id, name, f.body, f.type));
    let scenes = 0;
    note({ step: "draw", done: 0, of: plans.length });
    lap(`shared files up; drawing ${plans.length} scenes (${motion ? "motion" : "classic"}, ${plans.reduce((n, p) => n + p.frames.length, 0)} frames)`);

    // every scene at once, each in its own call and its own time
    const left = Math.max(10_000, PRODUCE_BUDGET_MS - (Date.now() - t0));
    const drawn = await Promise.all(plans.map((_, s) => fetch(siteUrl(VIDEO_DRAW_PATH), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, scene: s, token: drawToken, agentName }),
      signal: AbortSignal.timeout(left),
    }).then(async (r) => {
      if (!r.ok) return `scene ${s}: ${r.status} ${(await r.text()).slice(0, 120)}`;
      note({ step: "draw", done: ++scenes, of: plans.length });
      return null;
    }, (e) => `scene ${s}: ${e instanceof Error ? e.name : "no answer"}`)));
    const missed = drawn.filter(Boolean);
    if (missed.length) throw new Error(`scenes not drawn — ${missed.join("; ")}`);
    lap("all scenes drawn");
    note({ step: "submit", done: 0, of: 0 });

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
    const built = buildJob(plans, named, build);
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

    // the last progress write lands before the row leaves "drawing" (it writes only a drawing row)
    await noted;
    // recorded before the run is asked, so a callback that comes back at once finds it
    await setRow(id, { status: "rendering", duration_sec: total, job: { id: jobId, tokenHash: hashToken(token), startedAt: new Date().toISOString() } });
    await cloudRunEngine(gcpKey).submit(job, { callbackUrl, token, uploads: uploadsTo, id: jobId, payloadUrl: payLink.data.signedUrl });
    lap("handed to Cloud Run");
  } catch (e) {
    await fail(id, e);
  }
}

/**
 * One scene's pictures drawn and filed (the drawing route, called by produce). Only for a clip
 * still drawing, and only with the secret produce left beside it. Throws on any failure; produce
 * then fails the clip.
 */
export async function drawScene(id: string, scene: number, token: string, agentName: string): Promise<"drawn" | "refused"> {
  const t0 = Date.now();
  const { data: row, error } = await rows().select("*").eq("id", id).maybeSingle<VideoRow>();
  if (error) throw new Error(`row not read: ${error.message}`);
  if (!row || row.status !== "drawing") return "refused";
  const { data: blob } = await bucket().download(planPath(id));
  if (!blob) return "refused";
  const plan = JSON.parse(await blob.text()) as DrawPlan;
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(String(plan.tokenHash));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "refused";
  const parts = await clipParts(row, agentName, plan.secs);
  if (!Number.isInteger(scene) || scene < 0 || scene >= parts.plans.length) return "refused";
  const draws = parts.sceneDraws(scene);
  // one at a time keeps the drawing's memory flat; uploads run beside it
  const inFlight = new Set<Promise<void>>();
  for (const d of draws) {
    const u = upload(id, d.name, await d.draw(), "image/png");
    inFlight.add(u);
    void u.then(() => inFlight.delete(u), () => undefined);
    if (inFlight.size >= UPLOADS_IN_FLIGHT) await Promise.race(inFlight);
  }
  await Promise.all(inFlight);
  console.log(`quote video ${id}: scene ${scene} (${parts.plans[scene].key}) ${draws.length} pictures in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return "drawn";
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

/** keeps the words written to go with a clip (post-text.ts); updated_at is left alone, as the estimates read it */
export async function savePost(agentId: string, id: string, post: unknown): Promise<void> {
  const { error } = await rows().update({ post_text: post }).eq("id", id).eq("agent_id", agentId).is("deleted_at", null);
  if (error) throw new Error(`clip post not saved: ${error.message}`);
}
