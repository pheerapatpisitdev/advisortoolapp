import type { ReactNode } from "react";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { providerKey } from "@/lib/ai/client";
import { recordUsage } from "@/lib/ai/ledger";
import { asWho } from "@/lib/ai/who";
import { TTS_RATE, TtsQuotaError } from "@/lib/ai/tts";
import { speakClip } from "./speak";
import { sayNumbers } from "./say-numbers";
import { renderPng } from "@/lib/content/poster-png";
import { valueTableChart } from "@/lib/quote-card";
import { can } from "@/lib/auth/access";
import type { Viewer } from "@/lib/auth/access";
import { memberAccess, PASS_EXPIRED, PASS_UNREADABLE, passOpen, type MemberAccess } from "@/lib/members/access";
import { videosFrom } from "@/lib/members/pass";
import { siteUrl } from "@/lib/site-url";
import { formatBaht } from "@/lib/wallet/money";
import { pictureSatang, videoPriceKey, type PriceKey, type Prices } from "@/lib/wallet/prices";

/** the prices the board shows under its button: each look and length, and the FHC summary */
const VIDEO_KEYS: PriceKey[] = ["videoClassic", "videoMotion", "videoLongClassic", "videoLongMotion", "videoMaxClassic", "videoMaxMotion", "videoFhc", "videoStory", "videoStoryShort", "videoPrompt"];
import { balanceSatang, holdWallet, releaseWallet, settleWallet, walletFrozen, walletPrices, walletSettings } from "@/lib/wallet/store";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cloudRunEngine } from "@/lib/video/engines/cloudrun";
import type { FfmpegJob } from "@/lib/video/command";
import { getContact, photoDataUri } from "./contact";
import { CHART_W, sceneLayer, tableImage, type Contact } from "./draw";
import { noteDrawing, tablePlan } from "./table-pen";
import { pensionTableImage, pensionTablePlan } from "./pension-table";
import { addSounds, buildJob, concatList, mixNarration, nameFiles, pcmSeconds } from "./job";
import { fhcScript, isFhcInput, type FhcSceneKey, type FhcVideoInput } from "./fhc";
import { fhcFrame, fhcRoom, fhcSpec, fhcWindows } from "./fhc-motion";
import { topicOf } from "@/lib/story/topics";
import { isPromptStory, promptPicturePrice, promptPicturesPrice, promptStoryPrice, type PromptStoryInput } from "@/lib/prompt-story/types";
import { allowedFor, checkScene, checkScript } from "@/lib/prompt-story/check";
import { drawScenePicture } from "@/lib/prompt-story/pictures";
import { claimDraft, releaseDraft } from "@/lib/prompt-story/drafts";
import { freeFrame, freeHandText, freeWindows } from "@/lib/prompt-story/frames";
import { PAINTERS } from "@/lib/content/models";
import { isStoryInput, storyScript, type StoryVideoInput } from "./story";
import { contactSpec, storyBackground, storyFrame, type StoryContext } from "./story-motion";
import { clipCrowd, clipFaces, clipFrame, clipHandText, clipWindows } from "./story-frames";
import { faceUris } from "./story-faces";
import { a, motionBackground, motionBgHeight, motionFrame, motionSpec, motionWindows, MOTION_FPS } from "./motion";
import { readTheme } from "./theme-keys";
import { clipProps, REMOTION_DRAWING, REMOTION_JOB, remotionFits, remotionPlanOf, storyClipProps, type ClassicClipProps, type ClipProps, type FhcClipProps, type RemotionMotion, type StoryClipProps } from "./remotion";
import { tellOwnerClipFailed } from "./fail-alert";
import { failReason, renderThbFor, secondsBetween, type ClipEngine, type CostParts } from "./run-record";
import { remotionFor } from "./remotion-switch";
import { aiSpots, collageDecor, collageSoundFiles, collageSounds, decorAnims, SOUND_GAIN, THEME_LETTERS, themeBackground, themed, themeFont, themeHero, type Decor, type Hero, type SoundKind } from "./themes";
import { pieceSticker } from "@/lib/collage/library";
import { drawnPieces, pickPieces } from "@/lib/collage/pick";
import { DECOR_AT, stickerAt, stickerOf, type Sticker } from "@/lib/collage/decor";
import { drawIdea, fallbackPiece, writeIdeas } from "@/lib/collage/ai-pieces";
import { wideFhcFrame, wideQuoteFrame } from "./wide";
import { WIDE_CHART_W, wideSceneLayer } from "./classic-wide";
import { CLASSIC_BOXES } from "./table-geo";
import { extraOf, linesOf, loops, readLength, type Told } from "./told";
import { writes } from "./brief";
import { writeLines } from "./writer";
import { planInput, productOf, quoteVideoFacts, quoteVideoScript, sceneMotion, spokenBy, type SceneKey, type VideoInput } from "./script";
import { clipLength, LOOP_TAIL, planScenes, SIZES, sizeOf, type ScenePlan, type VideoSize } from "./timeline";
import { VOICE_FULL, voiceDay, voiceFullText } from "./voice-quota";
import { geminiVoice } from "@/lib/voice/gemini";
import { googleFontSubset } from "@/lib/google-font";
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
/**
 * a clip handed to Cloud Run has five minutes more, so one about to finish is not failed under it;
 * the wallet keeps a clip's hold 30 minutes (20261123_clip_hold_life.sql), past both (owner chose 1ก, 2026-10-18)
 */
export const RENDER_TIMEOUT_MS = 25 * 60_000;
const LINK_SECONDS = 2 * 3600;
/** a Cloud Run run of one clip: a couple of CPU-minutes, in baht */
const RENDER_COST_THB = 0.01 * 36;
/** a Remotion render (remotion.ts): about 80 s of 8 vCPU / 8 GiB at Cloud Run's list price, $0.0001920/s at 36 baht (trial 2026-10-17) */
const REMOTION_COST_THB = 80 * 0.000192 * 36;
export const FAILED = "ทำวิดีโอไม่สำเร็จ ลองใหม่อีกครั้ง";
/** a finished คลิปตามโจทย์ whose new cut failed: the clip as it was stands */
export const RECUT_FAILED = "ตัดคลิปใหม่ไม่สำเร็จ คลิปเดิมยังอยู่ ลองวาดใหม่อีกครั้ง";
/** every agent's free clips, once (owner, 2026-10-11); a member's pass carries its own (freeClips) */
export const FREE_VIDEOS = 2;
/**
 * What a clip costs an agent, fixed, from the owner's price list (src/lib/wallet/prices.ts,
 * /admin/wallet — owner 2026-10-12): ฿5 แบบปกติ, ฿10 Motion Graphic, ฿3 an FHC summary whatever
 * its look, and an ElevenLabs voice on top (+฿2). The wallet holds the price when the clip is
 * asked for and takes it when the clip is done.
 */
export const videoPrice = (v: ClipInput, prices: Prices): number =>
  isPromptStory(v) ? promptStoryPrice(v, prices) :
  (isFhcInput(v) ? prices.videoFhc : isStoryInput(v) ? (topicOf(v.topic)?.short ? prices.videoStoryShort : prices.videoStory)
    : prices[videoPriceKey(v.style === "motion" ? "motion" : "classic", readLength(v.length))] + aiPiecesPrice(v, prices)) + (v.voice ? prices.elevenExtra : 0);
/** the round name on the wallet's hold and charge lines */
export const VIDEO_ROUND = "quote-video";
/**
 * Each clip tool's own round, so the wallet's history names it (owner, 2026-10-18): every one
 * starts "quote-video", which the hold sweep keeps 30 minutes (20261124_clip_rounds.sql).
 */
export const clipRound = (v: ClipInput): string =>
  isPromptStory(v) ? `${VIDEO_ROUND}-prompt` : isStoryInput(v) ? `${VIDEO_ROUND}-story` : VIDEO_ROUND;

export type VideoStatus = "drawing" | "rendering" | "done" | "failed";
export type { VideoInput } from "./script";
/** what a clip's row holds: a quote, an FHC summary (fhc.ts), or a คลิปเล่าเรื่อง (story.ts) */
export type ClipInput = VideoInput | FhcVideoInput | StoryVideoInput | PromptStoryInput;
/** a quote clip: neither an FHC summary nor a story */
export const isQuoteInput = (v: ClipInput): v is VideoInput => !isFhcInput(v) && !isStoryInput(v) && !isPromptStory(v);
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
  /** the real reason it failed (run-record.ts), the server's alone */
  fail_reason?: string | null;
  /** what its making cost, part by part (run-record.ts), the server's alone */
  cost_parts?: CostParts | null;
}
export type PaidBy = "staff" | "free" | "wallet";

const rows = () => supabaseAdmin().from("ins_quote_videos");
const bucket = () => supabaseAdmin().storage.from(VIDEO_BUCKET);
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");


/** How the next clip would be paid for, as the board says it under the button. */
export type CostView =
  | { kind: "staff" }
  /** walletOff: the wallet is shut, so a คลิปตามโจทย์'s pictures (paid even on a free clip) cannot be */
  | { kind: "free"; left: number; of: number; walletOff?: true }
  /** the price of each look (an FHC summary its own), and whether the wallet holds it */
  /** credit: a member's pass, which has credit rather than free clips (owner, 2026-10-17); balance is credit and own money together */
  /** satang: the balance as a number, for a clip whose voice or cut-outs add to its look's price (costLine) */
  | { kind: "wallet"; balance: string; satang: number; prices: Partial<Record<PriceKey, { price: string; enough: boolean; satang: number }>>; credit?: true }
  /** noFree: the agent never had free clips (a member's pass, a UnitClub agent): not "used up" */
  | { kind: "closed"; noFree?: true };

/** Which free clips count: since `from` when it is set, else every one ever made. */
export interface FreeClips {
  limit: number;
  from: Date | null;
}

/**
 * A member with a live pass has no free clips: the pass's credit pays first (owner, 2026-10-17);
 * a UnitClub agent none either, their starter credit pays (2026-10-18); a member with the pass
 * switch off the two, once. Throws when the pass cannot be read.
 */
export async function freeClips(viewer: Viewer, access?: MemberAccess): Promise<FreeClips> {
  // a UnitClub agent's two free clips gave way to the ฿15 starter credit (owner, 2026-10-18)
  if (viewer.kind === "unitos") return { limit: 0, from: null };
  const a = access ?? await memberAccess(viewer);
  return (a.gated && videosFrom(a.state, a.settings)) || { limit: FREE_VIDEOS, from: null };
}

/** the agent's free clips used in the window: those not failed (a failed one is handed back) */
async function freeUsed(agentId: string, from: Date | null, upTo?: string): Promise<number> {
  let q = rows().select("id", { count: "exact", head: true })
    .eq("agent_id", agentId).eq("paid_by", "free").neq("status", "failed");
  if (from) q = q.gte("created_at", from.toISOString());
  // the free clips made up to and including one row: those before it, not after
  if (upTo) q = q.lte("created_at", upTo);
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
  const s = await walletSettings().catch(() => null);
  if (used < limit) return { kind: "free", left: limit - used, of: limit, ...(s?.enabled ? {} : { walletOff: true as const }) };
  if (!s?.enabled) return limit === 0 ? { kind: "closed", noFree: true } : { kind: "closed" };
  const [balance, prices] = await Promise.all([balanceSatang(viewer.agentId), walletPrices()]);
  const priced = (satang: number) => ({ price: formatBaht(satang), enough: balance >= satang, satang });
  return {
    kind: "wallet", balance: formatBaht(balance), satang: balance,
    prices: Object.fromEntries(VIDEO_KEYS.map((k) => [k, priced(prices[k])])),
    ...(limit === 0 ? { credit: true as const } : {}),
  };
}

/**
 * Starts a clip's row and says who pays: the owner nothing, then the agent's free clips (freeClips),
 * then the wallet — the hold set aside before anything is spent. A refusal is the words to show.
 */
export async function createVideo(viewer: Viewer, input: ClipInput, customer: string, id?: string): Promise<{ id: string } | { refusal: string }> {
  let pay: Partial<VideoRow> = { paid_by: "staff" };
  let freeWindow: { limit: number; from: Date | null } | null = null;
  if (!can(viewer, "owner")) {
    // an outside member makes clips while their pass is live (owner, 2026-10-13); unreadable refuses
    const access = await memberAccess(viewer).catch((e) => {
      console.error("quote video refused, pass unreadable:", e);
      return null;
    });
    if (!access) return { refusal: PASS_UNREADABLE };
    if (!passOpen(access)) return { refusal: PASS_EXPIRED };
    const { limit, from } = await freeClips(viewer, access);
    freeWindow = { limit, from };
    if ((await freeUsed(viewer.agentId, from)) < limit) {
      // a คลิปตามโจทย์'s free clip covers the clip only: its pictures are still paid from the wallet (spec, Money)
      // so do the cut-outs AI draws for a คอลลาจ clip (owner, 2026-10-17)
      const pictures = isPromptStory(input) ? promptPicturesPrice(input, await walletPrices()) : isQuoteInput(input) ? aiPiecesPrice(input, await walletPrices()) : 0;
      if (pictures > 0) {
        const s = await walletSettings().catch(() => null);
        if (!s?.enabled) return { refusal: isPromptStory(input) ? "ค่าภาพประกอบจ่ายจากกระเป๋าเงิน แต่กระเป๋าเงินยังไม่เปิดใช้" : "ภาพตัดแปะที่ AI วาดจ่ายจากกระเป๋าเงิน แต่กระเป๋าเงินยังไม่เปิดใช้ — เลือก \"ภาพจากคลัง\" แทนได้" };
        const hold = await holdFor(viewer.agentId, pictures, clipRound(input), `ค่าภาพประกอบต้องมีเงินในกระเป๋าอย่างน้อย ${formatBaht(pictures)} เติมเงินได้ที่เมนู "กระเป๋าเงิน"`);
        if ("refusal" in hold) return hold;
        pay = { paid_by: "free", hold_id: hold.id, held_satang: pictures, multiplier: 1 };
      } else pay = { paid_by: "free" };
    } else {
      const s = await walletSettings().catch(() => null);
      if (!s?.enabled) return { refusal: limit === 0 ? "ตอนนี้ยังใช้เครดิตและกระเป๋าเงินไม่ได้ครับ" : `ใช้วิดีโอฟรีครบ ${limit} ครั้งแล้ว` };
      const held = videoPrice(input, await walletPrices());
      const hold = await holdFor(viewer.agentId, held, clipRound(input), limit === 0
        ? `เครดิตและเงินในกระเป๋าไม่พอ — คลิปนี้ ${formatBaht(held)} เติมเงินได้ที่เมนู "กระเป๋าเงิน"`
        : `ใช้วิดีโอฟรีครบแล้ว — ต้องมีเงินในกระเป๋าอย่างน้อย ${formatBaht(held)} เติมเงินได้ที่เมนู "กระเป๋าเงิน"`);
      if ("refusal" in hold) return hold;
      pay = { paid_by: "wallet", hold_id: hold.id, held_satang: held, multiplier: 1 };
    }
  }
  // drawn by Remotion, as the switch's row for its plan or tool on /admin/ai says (owner, 2026-10-17; remotion.ts):
  // a Motion Graphic quote clip, a คลิปเล่าเรื่อง, a คลิปตามโจทย์ (owner chose ก ก ก, 2026-10-19)
  const plan = remotionPlanOf(input);
  if (plan) {
    // the switch unread is the old engine, never a clip refused (every clip asks it since 2026-10-20)
    const who = await remotionFor(plan).catch(() => "off" as const);
    if (who === "all" || (who === "owner" && can(viewer, "owner"))) input = { ...input, engine: "remotion" } as ClipInput;
  }
  const { data, error } = await rows().insert({ ...(id ? { id } : {}), agent_id: viewer.agentId, input, customer_name: customer, ...pay }).select("id, created_at").single();
  if (error || !data) {
    if (pay.hold_id) await releaseWallet(pay.hold_id).catch(() => undefined);
    throw new Error(`video not created: ${error?.message}`);
  }
  // free clips counted again once the row is in, up to it: of presses at once on the last free
  // clip only the first is free; the rest are taken back and asked to press again (owner, 2026-10-18)
  if (pay.paid_by === "free" && freeWindow) {
    const n = await freeUsed(viewer.agentId, freeWindow.from, String(data.created_at)).catch(() => 0);
    if (n > freeWindow.limit) {
      await rows().delete().eq("id", data.id);
      if (pay.hold_id) await releaseWallet(pay.hold_id).catch(() => undefined);
      return { refusal: "ใช้วิดีโอฟรีครบแล้ว กดสร้างอีกครั้งเพื่อจ่ายจากกระเป๋านะครับ" };
    }
  }
  return { id: data.id as string };
}

/** `satang` set aside in the agent's wallet, or the words to show when it cannot be */
async function holdFor(agentId: string, satang: number, round: string, short: string): Promise<{ id: string } | { refusal: string }> {
  const hold = await holdWallet(agentId, satang, round).catch((e) => {
    console.error("quote video hold failed:", e);
    return null;
  });
  if (hold) return { id: hold };
  return { refusal: (await walletFrozen(agentId).catch(() => false)) ? "กระเป๋าเงินถูกพักไว้ชั่วคราว — ติดต่อสำนักงานนะครับ" : short };
}

/** the wallet's hold, if any, given back in full (a free คลิปตามโจทย์ holds its pictures) */
async function release(row: Pick<VideoRow, "hold_id" | "paid_by">): Promise<void> {
  if (!row.hold_id) return;
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
    return [{ kind: clipKind(r.input as { fhc?: unknown; style?: unknown; length?: unknown; engine?: unknown }), pre: (started - asked) / 1000, render: (done - started) / 1000 }];
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

/** a คลิปตามโจทย์'s pictures and voice, kept with a finished clip so one scene can be drawn again */
const KEPT = /\/(pic-\d+\.png|voice-\d+\.pcm)$/;
const picName = (s: number) => `pic-${s}.png`;
const voiceName = (s: number) => `voice-${s}.pcm`;

/** every file under the clip's folder but the finished video; `keep`: and the pictures and voice it can be cut again from */
async function clearInputs(id: string, keep = false): Promise<void> {
  const { data } = await bucket().list(id, { limit: 1000 });
  const paths = (data ?? []).map((o) => `${id}/${o.name}`).filter((p) => !p.endsWith("/quote.mp4") && !(keep && KEPT.test(p)));
  for (let i = 0; i < paths.length; i += 100) await bucket().remove(paths.slice(i, i + 100)).catch(() => undefined);
}

async function fail(id: string, why: unknown): Promise<void> {
  console.error(`quote video ${id} failed:`, why instanceof Error ? why.message : "unknown error");
  // only the writer that moves the row to failed gives the hold back
  // Gemini's voice used up for the day: the card says when to try again, and marks the day (voiceFullUntil)
  const error = why instanceof TtsQuotaError ? voiceFullText(voiceDay().until) : FAILED;
  // the stage it failed in, for the reason kept (run-record.ts); unread, the reason goes without it
  const { data: was } = await rows().select("status").eq("id", id).maybeSingle();
  const fail_reason = failReason(why, (was as Pick<VideoRow, "status"> | null)?.status);
  const { data } = await rows().update({ status: "failed", error, fail_reason, updated_at: new Date().toISOString() })
    .eq("id", id).in("status", ["drawing", "rendering"]).is("video_path", null).select("hold_id, paid_by, input, agent_id, held_satang").maybeSingle();
  if (data) {
    await release(data as Pick<VideoRow, "hold_id" | "paid_by">);
    // a คลิปตามโจทย์ that failed gives its draft back, to be made again
    const input = (data as Pick<VideoRow, "input">).input;
    if (input && isPromptStory(input) && input.draftId) await releaseDraft(input.draftId, id);
    // the owner's LINE told, every failed clip (owner chose ก ก, 2026-10-19)
    const d = data as Pick<VideoRow, "agent_id" | "paid_by" | "held_satang">;
    await tellOwnerClipFailed({ id, agent_id: d.agent_id, input, paid_by: d.paid_by, held_satang: d.held_satang, fail_reason, error });
    await clearInputs(id).catch(() => undefined);
    return;
  }
  // a finished clip being cut again (redrawPicture): the cut it had stands, paid already, and stays redrawable
  const { data: kept } = await rows().update({ status: "done", error: RECUT_FAILED, fail_reason, updated_at: new Date().toISOString() })
    .eq("id", id).in("status", ["drawing", "rendering"]).not("video_path", "is", null).select("id, input, agent_id, paid_by").maybeSingle();
  // the redrawn picture is not in the clip: its hold goes back
  const input = (kept as Pick<VideoRow, "input"> | null)?.input;
  if (input && isPromptStory(input) && input.redraw) {
    const { redraw, ...rest } = input;
    await releaseWallet(redraw.hold).catch((e) => console.error("redraw hold not released:", e));
    await setRow(id, { input: rest }).catch(() => undefined);
  }
  if (kept) {
    const k = kept as Pick<VideoRow, "agent_id" | "paid_by">;
    const recut = input && isPromptStory(input) && input.redraw ? input.redraw.satang : 0;
    await tellOwnerClipFailed({ id, agent_id: k.agent_id, input, paid_by: k.paid_by, held_satang: null, fail_reason, error: RECUT_FAILED, recut: { satang: recut } });
  }
  await clearInputs(id, Boolean(kept)).catch(() => undefined);
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
  /** คอลลาจกระดาษ's paper and pops, at their times in the clip */
  sounds?: { at: number; kind: SoundKind }[];
  /** a portrait Motion Graphic quote clip: what its frames are drawn from, for Remotion (remotion.ts) */
  motion$?: RemotionMotion;
  /** a แบบปกติ quote clip: what its layers are drawn from, for Remotion (remotion.ts ClassicClipProps) */
  classic$?: Omit<ClassicClipProps, "composition" | "drawing" | "total" | "scenes" | "audio" | "scriptFont"> & { layers: ("photo" | "table" | undefined)[] };
  /** Chinese, Russian and Burmese: the face their letters are drawn in, and every letter the clip shows */
  scriptFace?: { family: string; text: string };
}

async function contactOf(agentId: string, agentName: string): Promise<Contact> {
  const contactRow = await getContact(agentId);
  return {
    // the ชื่อที่แสดง typed for the card in บัญชีของฉัน, else the account's (owner, 2026-10-18)
    name: contactRow.name || agentName, phone: contactRow.phone,
    ...(contactRow.line ? { line: contactRow.line } : {}),
    ...(contactRow.more ? { more: contactRow.more } : {}),
    ...(await photoDataUri(contactRow.photoPath).then((p) => (p ? { photo: p } : {}))),
  };
}

const narratorOf = (input: ClipInput): "F" | "M" => (input.narrator === "M" ? "M" : "F");

/** the scenes of a quote clip whose cut-out AI draws new: คอลลาจ, portrait, asked for (themes.tsx aiSpots) */
export function aiPieceScenes(v: VideoInput): { key: SceneKey; voice: string }[] {
  if (v.pieces !== "ai" || v.style !== "motion" || readTheme(v.theme) !== "collage" || clipSize(v) !== "portrait") return [];
  const facts = quoteVideoFacts(v);
  if (!facts) return [];
  const script = quoteVideoScript(facts, "", narratorOf(v), readLength(v.length), toldOf(v));
  const keys = new Set(aiSpots(script.map((x) => x.key), facts.coverStyle).map((x) => x.key));
  return script.filter((x) => keys.has(x.key)).map((x) => ({ key: x.key, voice: x.voice }));
}
/** what those cut-outs cost the agent: one standard picture each (owner, 2026-10-17, ข 3 ก) */
function aiPiecesPrice(v: VideoInput, prices: Prices): number {
  const n = aiPieceScenes(v).length;
  return n ? n * (pictureSatang(prices, "standard") ?? 0) : 0;
}
const pieceName = (key: SceneKey) => `piece-${key}.png`;

/**
 * A คอลลาจ clip's AI cut-outs: an idea for each scene from its line, drawn, cut out and filed beside
 * the clip; one that fails is the library's in the clip, and is taken off the hold. Never throws.
 */
async function drawAiPieces(row: VideoRow & { input: VideoInput }): Promise<{ input: VideoInput; costThb: number }> {
  const scenes = aiPieceScenes(row.input);
  if (!scenes.length || row.input.aiPieces) return { input: row.input, costThb: 0 };
  const facts = quoteVideoFacts(row.input)!;
  const ideas = await writeIdeas(scenes, { sex: row.input.sex, age: row.input.age, plan: facts.planLine }).catch(() => []);
  let costThb = 0;
  const drawn = await pool(ideas, 3, async (idea) => {
    const got = await drawIdea(idea).catch(() => null);
    if (!got) return [idea.key, null] as const;
    costThb += got.costThb;
    await upload(row.id, pieceName(idea.key), got.png, "image/png");
    return [idea.key, `${row.id}/${pieceName(idea.key)}`] as const;
  }).catch(() => [] as (readonly [SceneKey, string | null])[]);
  const aiPieces = Object.fromEntries(scenes.map((sc) => [sc.key, drawn.find(([k]) => k === sc.key)?.[1] ?? null])) as VideoInput["aiPieces"];
  const missing = Object.values(aiPieces ?? {}).filter((p) => !p).length;
  const input: VideoInput = { ...row.input, aiPieces };
  const patch: Partial<VideoRow> = { input };
  if (missing && row.hold_id && row.held_satang) {
    patch.held_satang = Math.max(0, Number(row.held_satang) - missing * (pictureSatang(await walletPrices(), "standard") ?? 0));
  }
  await setRow(row.id, patch).catch((e) => console.error(`quote video ${row.id}: pieces not written:`, e));
  return { input, costThb };
}

/** a scene's cut-out for the clip: its AI one when drawn, the library's otherwise */
const pieceFor = (input: VideoInput) => async (piece: string, key: SceneKey): Promise<Buffer | null> => {
  const path = input.aiPieces?.[key];
  if (path) {
    const { data } = await bucket().download(path);
    if (data) return Buffer.from(await data.arrayBuffer());
  }
  return pieceSticker(input.aiPieces && key in input.aiPieces ? fallbackPiece(key) : piece);
};

/** the language a clip is told in: an iHealthy clip's own choice (owner, 2026-10-15), Thai for every other */
export const langOfInput = (input: ClipInput): VideoLang =>
  (isQuoteInput(input) && input.product === "IHEALTHY" ? readVideoLang(input.lang) : "th");

/** the lines a clip speaks, in scene order */
function spokenLines(row: VideoRow): { key: string; voice: string }[] {
  if (isFhcInput(row.input)) return fhcScript(row.input.fhc, row.customer_name, narratorOf(row.input));
  if (isStoryInput(row.input)) return storyScript(row.input, row.customer_name, narratorOf(row.input));
  if (isPromptStory(row.input)) return freeScript(row.input, row.customer_name, narratorOf(row.input));
  const facts = quoteVideoFacts(row.input);
  if (!facts) throw new Error("quote not priced");
  const length = readLength(row.input.length);
  return quoteVideoScript(facts, length === "short" ? "" : row.customer_name, narratorOf(row.input), length, toldOf(row.input));
}

/** the agent's close on a คลิปตามโจทย์'s card, as the story clips end */
const FREE_CLOSE = "สนใจรายละเอียดเพิ่มเติม ทักมาได้เลยนะคะ";

/**
 * A คลิปตามโจทย์'s lines: each scene's own, then the agent's close on the card. Every picture
 * scene is "freeScene" (the planner and nameFiles go by position, so the key need not differ),
 * the card "storyContact" as the story clips'.
 */
function freeScript(input: PromptStoryInput, customer: string, narrator: "F" | "M"): { key: "freeScene" | "storyContact"; voice: string }[] {
  const said = (v: string) => spokenBy(v.replace(/\s+/g, " ").trim(), narrator);
  return [
    ...input.scenes.map((sc) => ({ key: "freeScene" as const, voice: said(sc.voice) })),
    { key: "storyContact" as const, voice: said(`${customer ? `คุณ${customer} ` : ""}${FREE_CLOSE}`) },
  ];
}

/** a filed picture, as it was drawn */
async function pictureFile(path: string): Promise<Buffer> {
  const { data } = await bucket().download(path);
  if (!data) throw new Error(`picture ${path.split("/").pop()} not read`);
  return Buffer.from(await data.arrayBuffer());
}

/**
 * A คลิปตามโจทย์'s parts (prompt-story/frames.tsx): each scene on the story clips' paper, its
 * picture filed once as the scene's photo layer, full frame, which ffmpeg scales to cover and
 * pushes in slowly (buildJob's photo zoom, 1.00 → 1.12), with transparent frames of the words over
 * it, one per word; then the agent's card. A scene whose picture fell back has the paper only.
 */
async function freeParts(row: VideoRow & { input: PromptStoryInput }, agentName: string, secs: number[]): Promise<ClipParts> {
  const input = row.input;
  const size = clipSize(input);
  const dims = SIZES[size];
  const narrator = narratorOf(input);
  const customer = row.customer_name;
  const contact = await contactOf(row.agent_id, agentName);
  const script = freeScript(input, customer, narrator);
  if (secs.length !== script.length) throw new Error("voice lengths do not match the script");
  const card = Object.values(contactSpec()).map((x): [number, number] => [x.at, x.at + x.dur]);
  const plans = planScenes(script.map((s, i) => ({ key: s.key, voice: s.voice, voiceSec: secs[i], windows: s.key === "storyContact" ? card : freeWindows(), fps: MOTION_FPS })));
  const pictureAt = (s: number) => (plans[s].key === "freeScene" ? input.pictures?.[s] ?? null : null);
  const named = nameFiles(plans, plans.map((_, s) => (pictureAt(s) ? "photo" as const : undefined)));
  const hand = freeHandText(input) + contact.name;
  const sceneDraws = (s: number) => {
    const p = plans[s];
    const ctx = { input, size, customer, narrator, contact, crowd: [], faces: {}, words: script[s].voice.split(" ").filter(Boolean), voiceSec: secs[s] };
    const dimsOf = { width: dims.w, height: dims.h };
    if (p.key === "storyContact") {
      // the card reads only the clip's size, the agent and the words: a story clip's context in shape
      const c = ctx as unknown as StoryContext;
      return p.frames.map((fr, k) => ({ name: named.scenes[s].frames[k], draw: () => renderPng(storyFrame("storyContact", c, fr.t ?? 0), dimsOf, { hand }) }));
    }
    const path = pictureAt(s);
    const layer = named.scenes[s].layer;
    return [
      ...(path && layer ? [{ name: layer.name, draw: () => pictureFile(path) }] : []),
      ...p.frames.map((fr, k) => ({
        name: named.scenes[s].frames[k],
        draw: () => renderPng(freeFrame(input.scenes[s], Boolean(path), ctx, fr.t ?? 0), dimsOf, { hand }),
      })),
    ];
  };
  return {
    // the photo box is the whole frame; layers.photo stays false, as that is the family photo of a quote clip
    size, script, motion: true, plans, named, build: { size: dims, photo: { x: 0, y: 0, w: dims.w, h: dims.h } }, layers: { photo: false }, sceneDraws,
    background: () => renderPng(storyBackground(size), { width: dims.w, height: dims.h }),
  };
}

/** An FHC summary's parts: always the Motion Graphic world, six scenes (fhc-motion.tsx). */
async function fhcParts(row: VideoRow & { input: FhcVideoInput }, agentName: string, secs: number[]): Promise<ClipParts> {
  return fhcPartsFor(row, await contactOf(row.agent_id, agentName), secs);
}

/** An FHC clip's parts, the agent's contact in hand: no database but the picked pieces, so a local render draws the same clip. */
export function fhcPartsFor(row: Pick<VideoRow, "customer_name"> & { input: FhcVideoInput }, contact: Contact, secs: number[]): ClipParts {
  const facts = row.input.fhc;
  const size = clipSize(row.input);
  const dims = SIZES[size];
  const narrator = narratorOf(row.input);
  const customer = row.customer_name;
  const script = fhcScript(facts, customer, narrator);
  if (secs.length !== script.length) throw new Error("voice lengths do not match the script");
  const plans = planScenes(script.map((s, i) => ({ key: s.key, voice: s.voice, voiceSec: secs[i], windows: fhcWindows(s.key, facts), fps: MOTION_FPS })));
  const named = nameFiles(plans, plans.map(() => undefined));
  // the Motion Graphic look (owner, 2026-10-17): repainted as วิดีโอนำเสนอ's is; คอลลาจ's picked pieces in a portrait clip's free room
  const theme = readTheme(row.input.theme);
  const picks = theme === "collage" && size === "portrait" ? row.input.picks ?? {} : {};
  let decorOnce: Promise<((key: FhcSceneKey, t: number) => ReactNode) | undefined> | undefined;
  const decor = () => (decorOnce ??= fhcDecor(picks, facts, { customer, contact }));
  const font = themeFont(theme) ? { hand: THEME_LETTERS } : {};
  const sceneDraws = (s: number) => {
    const p = plans[s];
    const ctx = { facts, narrator, customer, contact, words: script[s].voice.split(" ").filter(Boolean), voiceSec: secs[s] };
    const frame = (t: number, scenery?: (key: FhcSceneKey, t: number) => ReactNode) =>
      themed(size === "portrait" ? fhcFrame(p.key, { ...ctx, ...(scenery ? { decor: scenery } : {}) }, t) : wideFhcFrame(p.key, ctx, t, size), theme, t);
    return p.frames.map((fr, k) => ({ name: named.scenes[s].frames[k], draw: async () => renderPng(frame(fr.t ?? 0, await decor()), { width: dims.w, height: dims.h }, font) }));
  };
  return {
    size, script, motion: true, plans, named, build: { driftHeight: motionBgHeight(dims), size: dims }, layers: { photo: false }, sceneDraws,
    ...(theme === "collage" ? { sounds: collageSounds(plans.map((p) => ({ start: p.start, anims: [...Object.values(fhcSpec(p.key, facts)), ...(picks[p.key] ? [a(DECOR_AT, "pop")] : [])] }))) } : {}),
  };
}

/** FHC's scenes, what each one's picture is beside, and the piece it falls back to when AI picks none (collage/pick.ts) */
const FHC_PIECE: Record<FhcSceneKey, { role: string; fallback: string }> = {
  fhcOpen: { role: "the opening, under the customer's name", fallback: "hand-wave" },
  fhcScores: { role: "under the six-area money health results", fallback: "piggy" },
  fhcGaps: { role: "under how much cover the family is missing", fallback: "umbrella" },
  fhcEvents: { role: "under the life events nobody controls", fallback: "alarm-clock" },
  fhcPlan: { role: "under the recommended plan", fallback: "handshake" },
  fhcContact: { role: "beside the agent's contact card", fallback: "hand-phone" },
};

/** a คอลลาจ FHC clip's pieces, picked once while the lines are spoken and kept on the row; never throws */
async function pickFhcPieces(row: VideoRow & { input: FhcVideoInput }): Promise<FhcVideoInput> {
  const input = row.input;
  if (readTheme(input.theme) !== "collage" || clipSize(input) !== "portrait" || input.picks) return input;
  try {
    const script = fhcScript(input.fhc, row.customer_name, narratorOf(input));
    const scenes = script.map((s) => ({ key: s.key, voice: s.voice, role: FHC_PIECE[s.key].role }));
    const picks = await pickPieces(scenes, await drawnPieces(), Object.fromEntries(script.map((s) => [s.key, FHC_PIECE[s.key].fallback])) as Partial<Record<FhcSceneKey, string>>);
    const next: FhcVideoInput = { ...input, picks };
    await setRow(row.id, { input: next });
    return next;
  } catch (e) {
    console.error(`fhc video ${row.id}: pieces not picked:`, e instanceof Error ? e.message : "unknown");
    return input;
  }
}

/** each picked piece in its scene's free room (fhcRoom); a piece that cannot be read is left out */
async function fhcDecor(picks: Partial<Record<FhcSceneKey, string | null>>, facts: FhcVideoInput["fhc"], c: { customer: string; contact: Contact }): Promise<((key: FhcSceneKey, t: number) => ReactNode) | undefined> {
  const keys = Object.entries(picks).filter((e): e is [FhcSceneKey, string] => typeof e[1] === "string");
  if (!keys.length) return undefined;
  const got = new Map<FhcSceneKey, Sticker>();
  await Promise.all(keys.map(async ([key, piece]) => {
    const png = await pieceSticker(piece).catch(() => null);
    if (png) got.set(key, await stickerOf(png));
  }));
  return (key, t) => {
    const st = got.get(key);
    const room = st ? fhcRoom(key, facts, c) : null;
    return st && room ? stickerAt(st, room, t) : null;
  };
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
  if (isPromptStory(row.input)) return freeParts(row as VideoRow & { input: PromptStoryInput }, agentName, secs);
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
  // the Motion Graphic look (owner, 2026-10-17): its opening picture is read once, when a frame first needs it
  const theme = motion ? readTheme(row.input.theme) : undefined;
  let heroOnce: Promise<Hero | undefined> | undefined;
  const hero = () => (heroOnce ??= themeHero(theme, row.input.sex));
  // คอลลาจ's library pictures in the portrait scenes, read once, when a frame first needs them
  let decorOnce: Promise<Decor | undefined> | undefined;
  const decor = () => (decorOnce ??= theme === "collage" && size === "portrait" ? collageDecor(pieceFor(row.input), facts.coverStyle) : Promise.resolve(undefined));
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
      const frame = (t: number, hero: Hero | undefined, scenery: Decor | undefined) => {
        const c = { ...mctx, ...(hero ? { hero } : {}), ...(scenery ? { decor: scenery } : {}) };
        return themed(size === "portrait" ? motionFrame(p.key, c, t) : wideQuoteFrame(p.key, c, t, size), theme, t);
      };
      // the value scene writes its pen notes in the handwriting face; a theme with a face of its own writes everything in it
      const withPen = { pen: p.key === "value", ...(themeFont(theme) ? { hand: THEME_LETTERS } : {}) };
      return p.frames.map((fr, k) => ({ name: sc.frames[k], draw: async () => renderPng(frame(fr.t ?? 0, await hero(), await decor()), { width: dims.w, height: dims.h }, { ...withPen, ...script$ }) }));
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
    ...(motion ? { motion$: { theme: theme!, ...(size !== "portrait" ? { size } : {}), sex: row.input.sex, facts, customer, narrator, contact, shown: { loop, extra: shown.extra, ...(shown.headline ? { headline: shown.headline } : {}) } } } : {}),
    ...(!motion ? { classic$: { size, facts, narrator, customer, contact, ...(chart ? { chart } : {}), ...(pen?.notes.length ? { notes: pen.notes } : {}), shown: { loop, extra: shown.extra, ...(shown.headline ? { headline: shown.headline } : {}) }, layers } } : {}),
    ...(script$.script ? { scriptFace: script$.script } : {}),
    ...(theme === "collage" ? { sounds: collageSounds(plans.map((p, i) => ({ start: p.start, anims: [...Object.values(motionSpec(script[i].key, facts, secs[i], script[i].voice)), ...(size === "portrait" ? decorAnims(script[i].key, facts.coverStyle) : [])] }))) } : {}),
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

/** the board's bar for one making (progress.ts): each write waits for the one before, so the count never goes back */
function progressBar(id: string) {
  let noted: Promise<void> = Promise.resolve();
  return {
    note: (n: ProgressNote) => { noted = noted.then(() => noteProgress(id, n)).catch(() => undefined); },
    flush: () => noted,
  };
}
type Bar = ReturnType<typeof progressBar>;
/** how long each step took, in the log, to see where a clip runs out of time */
const lapper = (id: string, t0: number) => (what: string) => console.log(`quote video ${id}: ${what} at ${((Date.now() - t0) / 1000).toFixed(1)}s`);
type Lap = ReturnType<typeof lapper>;

/** what one picture of a painter costs us, in baht */
const pictureThb = (painter: string) => PAINTERS.find((p) => p.id === painter)?.thb ?? 0;

/**
 * A คลิปตามโจทย์'s pictures, three at a time, each filed as "<id>/pic-<n>.png" and named on the
 * row's input. A picture that fails twice leaves its scene on paper, and is not charged: the
 * clip's hold settles that much less (redrawing it later is one picture's price).
 */
async function drawPictures(row: VideoRow & { input: PromptStoryInput }, bar: Bar): Promise<{ input: PromptStoryInput; costThb: number }> {
  const { id, input } = row;
  const size = clipSize(input);
  const of = input.scenes.length;
  let done = 0;
  bar.note({ step: "pictures", done: 0, of });
  const pictures = await pool(input.scenes, 3, async (scene, s): Promise<string | null> => {
    const png = await drawScenePicture(scene, input.style, input.painter, size);
    bar.note({ step: "pictures", done: ++done, of });
    if (!png) return null;
    await upload(id, picName(s), png, "image/png");
    return `${id}/${picName(s)}`;
  });
  const next: PromptStoryInput = { ...input, pictures };
  const missing = pictures.filter((p) => p === null).length;
  const patch: Partial<VideoRow> = { input: next };
  if (missing && row.hold_id && row.held_satang) {
    patch.held_satang = Math.max(0, Number(row.held_satang) - missing * promptPicturePrice(input, await walletPrices()));
  }
  await setRow(id, patch);
  return { input: next, costThb: (of - missing) * pictureThb(input.painter) };
}

/** every line a คลิปตามโจทย์ spoke, as it was filed; null when any is missing */
async function keptVoice(id: string, lines: number): Promise<Buffer[] | null> {
  const out = await Promise.all(Array.from({ length: lines }, async (_, i): Promise<Buffer | null> => {
    const { data } = await bucket().download(`${id}/${voiceName(i)}`);
    return data ? Buffer.from(await data.arrayBuffer()) : null;
  }));
  return out.includes(null) ? null : (out as Buffer[]);
}

/**
 * The whole making, up to Cloud Run taking the job. Never throws: a failure is written to the row.
 * The voice and the files every scene shares are made here; each scene's pictures are drawn by a
 * call of its own to the drawing route (drawScene), all at once, so no one call draws a whole clip.
 * A คลิปตามโจทย์ draws its pictures first and keeps them, and its voice, with the clip.
 */
export async function produce(id: string, agentName: string): Promise<void> {
  const t0 = Date.now();
  const lap = lapper(id, t0);
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
    const bar = progressBar(id);
    let picturesThb = 0;
    if (isPromptStory(row.input)) {
      const drawn = await drawPictures(row as VideoRow & { input: PromptStoryInput }, bar);
      row.input = drawn.input;
      picturesThb = drawn.costThb;
      lap(`pictures drawn (${drawn.input.pictures?.filter(Boolean).length}/${drawn.input.scenes.length})`);
    }
    const spokenScript = spokenLines(row);

    let lines = 0;
    bar.note({ step: "voice", done: 0, of: spokenScript.length });
    // figures become Thai words for a Thai voice only; another language's voice reads its own lines, and
    // the ElevenLabs voices are Thai ones, so it is Gemini's narrator (owner, 2026-10-15)
    const lang = langOfInput(row.input);
    const voiceId = lang === "th" ? row.input.voice : undefined;
    // Gemini's voice cannot be used (off, no key, day cap full): a Thai clip is read whole by อ้อม / สมชาย instead (owner, 2026-10-17)
    // a คอลลาจ clip's AI cut-outs are drawn while the lines are spoken (owner, 2026-10-17)
    const piecesP = isQuoteInput(row.input) ? drawAiPieces(row as VideoRow & { input: VideoInput }) : Promise.resolve(null);
    // a คอลลาจ FHC clip's library pieces, picked by AI from the lines (owner, 2026-10-17)
    const picksP = isFhcInput(row.input) ? pickFhcPieces(row as VideoRow & { input: FhcVideoInput }) : Promise.resolve(null);
    const { spoken, fellBackTo } = await speakClip(
      spokenScript.map((s) => (lang === "th" ? sayNumbers(s.voice) : s.voice)),
      { task: VIDEO_TASK_VOICE, narrator, voice: voiceId, gemini: geminiVoice(row.input.gemini)?.name, lang, pool,
        onLine: () => bar.note({ step: "voice", done: ++lines, of: spokenScript.length }),
        onSwitch: () => { lines = 0; bar.note({ step: "voice", done: 0, of: spokenScript.length }); } },
    );
    const pcms = spoken.map((s) => s.pcm);
    const picked = await picksP;
    if (picked) row.input = picked;
    const pieces = await piecesP;
    if (pieces) {
      row.input = pieces.input;
      picturesThb += pieces.costThb;
      if (pieces.costThb) lap(`AI cut-outs drawn (${Object.values((pieces.input as VideoInput).aiPieces ?? {}).filter(Boolean).length})`);
    }
    const voiceThb = spoken.reduce((n, s) => n + s.costThb, 0);
    row.cost_parts = { voice: voiceThb, pictures: picturesThb };
    await setRow(id, { cost_thb: voiceThb + picturesThb, cost_parts: row.cost_parts });
    lap(`voice done (${spokenScript.length} lines${voiceId || fellBackTo ? ", ElevenLabs" : ""}${fellBackTo ? " (in place of Gemini)" : ""}${lang === "th" ? "" : `, ${lang}`})`);
    // kept with the clip, so a picture redrawn later is cut without speaking again
    if (isPromptStory(row.input)) await pool(pcms, 8, (pcm, i) => upload(id, voiceName(i), pcm, "application/octet-stream"));
    await cutClip(row, agentName, pcms, gcpKey, bar, t0, lap);
  } catch (e) {
    await fail(id, e);
  }
}

/**
 * From the spoken lines to Cloud Run taking the job: the scenes planned, the shared files up, every
 * scene drawn by the drawing route, the links signed and the job handed over. produce and
 * redrawPicture both end here. Throws; the caller fails the clip.
 */
async function cutClip(row: VideoRow, agentName: string, pcms: Buffer[], gcpKey: string, bar: Bar, t0: number, lap: Lap): Promise<void> {
  const id = row.id;
  const note = bar.note;
  // the cut starts here: what comes before it is the voice (run-record.ts prepSec)
  const since = Date.now();
  const secs = pcms.map((pcm) => pcmSeconds(pcm, TTS_RATE));
  const { size, motion, plans, named, build, layers, background: ownBackground, sounds, motion$, classic$, script, scriptFace } = await clipParts(row, agentName, secs);
  const total = clipLength(plans);
  // a แบบปกติ quote clip drawn by Remotion, any plan and size (owner, 2026-10-20: "ย้ายที่เหลือเลย")
  if (classic$ && isQuoteInput(row.input) && row.input.engine === "remotion") {
    return cutClassicWithRemotion(row as VideoRow & { input: VideoInput }, classic$, { plans, script, secs, total, pcms, since, scriptFace }, gcpKey, bar, lap);
  }
  // an FHC summary drawn by Remotion, any size (owner, 2026-10-20: "ย้ายที่เหลือเลย")
  if (isFhcInput(row.input) && row.input.engine === "remotion") {
    return cutFhcWithRemotion(row as VideoRow & { input: FhcVideoInput }, agentName, { plans, script, secs, total, pcms, since, sounds }, gcpKey, bar, lap);
  }
  // a คลิปเล่าเรื่อง or คลิปตามโจทย์ drawn by Remotion, any size (owner chose ก ก ก, 2026-10-19)
  if ((isStoryInput(row.input) || isPromptStory(row.input)) && row.input.engine === "remotion") {
    return cutStoryWithRemotion(row as VideoRow & { input: StoryVideoInput | PromptStoryInput }, agentName, { plans, script, secs, total, pcms, since }, gcpKey, bar, lap);
  }
  if (motion$ && isQuoteInput(row.input) && row.input.engine === "remotion" && remotionFits(row.input)) {
    return cutWithRemotion(row as VideoRow & { input: VideoInput }, motion$, { plans, script, secs, total, sounds, pcms, scriptFace, since }, gcpKey, bar, lap);
  }

  // the files every scene shares, or that need no drawing
  const files = new Map<string, { body: Buffer | string; type: string }>();
  const narration = mixNarration(pcms.map((pcm, i) => ({ pcm, at: plans[i].voiceAt })), total, TTS_RATE);
  const sfx = sounds?.length ? await collageSoundFiles() : undefined;
  files.set(named.audio, { body: sfx ? addSounds(narration, sounds!.map((c) => ({ pcm: sfx[c.kind], at: c.at, gain: SOUND_GAIN[c.kind] })), TTS_RATE) : narration, type: "audio/wav" });
  const family = layers.photo ? await readFile(join(process.cwd(), "public/card/family.jpg")) : undefined;
  // the Motion Graphic style: one drifting background under every scene
  const dims = SIZES[size];
  // a story clip: its own still paper instead
  const background = ownBackground ? await ownBackground()
    : motion ? await renderPng(await themeBackground(readTheme((row.input as { theme?: unknown }).theme), dims, motionBgHeight(dims)) ?? motionBackground(dims), { width: dims.w, height: motionBgHeight(dims) }) : undefined;
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
  await handOver(row, gcpKey, bar, total, lap, { job }, since);
}

/**
 * The run handed over, as every clip ends: the finished video's upload link, the payload file the
 * job reads (JOB_URL), the row marked rendering, the job started. `job`: clip-ffmpeg's command;
 * `remotion`: the Remotion render's props instead (remotion.ts), run on its own job.
 */
async function handOver(row: VideoRow, gcpKey: string, bar: Bar, total: number, lap: Lap, run: { job: FfmpegJob } | { remotion: { props: ClipProps | StoryClipProps | FhcClipProps | ClassicClipProps } }, since: number): Promise<void> {
  const id = row.id;
  // a clip cut again (redrawPicture) writes over its finished video
  const out = row.video_path
    ? await bucket().createSignedUploadUrl(`${id}/quote.mp4`, { upsert: true })
    : await bucket().createSignedUploadUrl(`${id}/quote.mp4`);
  if (out.error || !out.data?.signedUrl) throw new Error("no upload link");
  const jobId = randomUUID();
  const token = randomBytes(32).toString("hex");
  const callbackUrl = siteUrl(VIDEO_CALLBACK_PATH);
  const uploadsTo = { out_1: { uploadUrl: out.data.signedUrl, path: `${id}/quote.mp4` } };
  const job: FfmpegJob = "job" in run ? run.job : { inputs: [], command: "", outputs: [{ name: "out_1", file: "quote.mp4", contentType: "video/mp4" }] };
  const payloadPath = `${id}/job.json`;
  const pay = await bucket().upload(payloadPath, JSON.stringify({ id: jobId, ...run, job, uploads: uploadsTo, callbackUrl, token }), { contentType: "text/plain", upsert: true });
  if (pay.error) throw new Error(`payload: ${pay.error.message}`);
  const payLink = await bucket().createSignedUrl(payloadPath, LINK_SECONDS);
  if (payLink.error || !payLink.data?.signedUrl) throw new Error("no payload link");

  // the last progress write lands before the row leaves "drawing" (it writes only a drawing row)
  await bar.flush();
  const remotion = "remotion" in run;
  const parts: CostParts = { ...(row.cost_parts ?? {}), engine: remotion ? "remotion" : "ffmpeg", prepSec: secondsBetween(since, Date.now()) ?? undefined };
  // recorded before the run is asked, so a callback that comes back at once finds it
  await setRow(id, { status: "rendering", duration_sec: total, cost_parts: parts, job: { id: jobId, tokenHash: hashToken(token), startedAt: new Date().toISOString() } });
  await cloudRunEngine(gcpKey, remotion ? { job: REMOTION_JOB } : {}).submit(job, { callbackUrl, token, uploads: uploadsTo, id: jobId, payloadUrl: payLink.data.signedUrl });
  lap(remotion ? "handed to Cloud Run (Remotion)" : "handed to Cloud Run");
}

/**
 * A Motion Graphic clip drawn by Remotion (remotion.ts): no frame is drawn here. The narration (and
 * คอลลาจ's sounds) goes up as one WAV, คอลลาจ's cut-outs as the pieceFor gives them, a Chinese,
 * Russian or Burmese clip's face cut to its letters, and the job gets the clip's motion context
 * with links to them all.
 */
async function cutWithRemotion(
  row: VideoRow & { input: VideoInput }, motion: RemotionMotion,
  c: { plans: ScenePlan[]; script: { voice: string }[]; secs: number[]; total: number; sounds?: { at: number; kind: SoundKind }[]; pcms: Buffer[]; scriptFace?: { family: string; text: string }; since: number },
  gcpKey: string, bar: Bar, lap: Lap,
): Promise<void> {
  const id = row.id;
  bar.note({ step: "files", done: 0, of: 0 });
  // the same face the old engine draws these letters in; without it they would be boxes, so no clip (poster-png's rule)
  const faces = c.scriptFace ? await googleFontSubset(c.scriptFace.family, c.scriptFace.text) : undefined;
  if (c.scriptFace && !faces) throw new Error(`font ${c.scriptFace.family} not loaded`);
  const fonts = (faces ?? []).map((f) => ({ name: `script-${f.weight}.ttf`, weight: f.weight, data: Buffer.from(f.data) }));
  await Promise.all(fonts.map((f) => upload(id, f.name, f.data, "application/octet-stream")));
  const narration = mixNarration(c.pcms.map((pcm, i) => ({ pcm, at: c.plans[i].voiceAt })), c.total, TTS_RATE);
  const sfx = c.sounds?.length ? await collageSoundFiles() : undefined;
  await upload(id, "voice.wav", sfx ? addSounds(narration, c.sounds!.map((x) => ({ pcm: sfx[x.kind], at: x.at, gain: SOUND_GAIN[x.kind] })), TTS_RATE) : narration, "audio/wav");
  // the family is the app's own photo, in the render's image; the other cut-outs are this clip's or the library's
  // คอลลาจ's cut-outs stand in a portrait clip's free room only (quotePartsFor's decor)
  const spots = motion.theme === "collage" && (motion.size ?? "portrait") === "portrait" ? aiSpots(c.plans.map((p) => p.key as SceneKey), motion.facts.coverStyle) : [];
  const load = pieceFor(row.input);
  const got = (await Promise.all(spots.map(async ({ key, piece }) => {
    const png = await load(piece, key).catch(() => null);
    if (!png) return null;
    const name = `piece-${key}-${piece}.png`;
    await upload(id, name, png, "image/png");
    return { at: `${key}/${piece}`, name };
  }))).filter((x): x is { at: string; name: string } => x !== null);
  const names = ["voice.wav", ...got.map((g) => g.name), ...fonts.map((f) => f.name)];
  const { data, error: e } = await bucket().createSignedUrls(names.map((n) => `${id}/${n}`), LINK_SECONDS);
  const urls = (data ?? []).map((d) => d.signedUrl);
  if (e || urls.length !== names.length || urls.some((u) => !u)) throw new Error(`links: ${e?.message ?? "a link is missing"}`);
  const pieces = Object.fromEntries(got.map((g, i) => [g.at, urls[i + 1] as string]));
  const scriptFont = fonts.map((f, i) => ({ url: urls[1 + got.length + i] as string, weight: f.weight }));
  lap(`voice and ${got.length} cut-outs${fonts.length ? ` and ${c.scriptFace!.family} (${fonts.length})` : ""} up for Remotion`);
  bar.note({ step: "submit", done: 0, of: 0 });
  const props = clipProps(motion, c.plans as ScenePlan<SceneKey>[], c.script, c.secs, c.total, urls[0] as string, pieces, scriptFont);
  await handOver(row, gcpKey, bar, c.total, lap, { remotion: { props } }, c.since);
}

/** a Chinese, Russian or Burmese clip's face, cut to its letters, up beside the voice; boxes otherwise, so no clip */
async function scriptFontLinks(id: string, scriptFace?: { family: string; text: string }): Promise<{ name: string; weight: number }[]> {
  if (!scriptFace) return [];
  const faces = await googleFontSubset(scriptFace.family, scriptFace.text);
  if (!faces) throw new Error(`font ${scriptFace.family} not loaded`);
  const fonts = faces.map((f) => ({ name: `script-${f.weight}.ttf`, weight: f.weight, data: Buffer.from(f.data) }));
  await Promise.all(fonts.map((f) => upload(id, f.name, f.data, "application/octet-stream")));
  return fonts.map(({ name, weight }) => ({ name, weight }));
}

/**
 * A แบบปกติ clip drawn by Remotion (remotion.ts ClassicClipProps): no frame is drawn here. The narration goes up as
 * one WAV (with a script face for Chinese, Russian, Burmese), and the job gets the clip's facts, each scene's
 * overlay states as planned, its layer, and the table's moves; the family photo is in the render's image.
 */
async function cutClassicWithRemotion(
  row: VideoRow & { input: VideoInput }, classic: NonNullable<ClipParts["classic$"]>,
  c: { plans: ScenePlan[]; script: { voice: string }[]; secs: number[]; total: number; pcms: Buffer[]; since: number; scriptFace?: { family: string; text: string } },
  gcpKey: string, bar: Bar, lap: Lap,
): Promise<void> {
  const id = row.id;
  bar.note({ step: "files", done: 0, of: 0 });
  const fonts = await scriptFontLinks(id, c.scriptFace);
  await upload(id, "voice.wav", mixNarration(c.pcms.map((pcm, i) => ({ pcm, at: c.plans[i].voiceAt })), c.total, TTS_RATE), "audio/wav");
  const names = ["voice.wav", ...fonts.map((f) => f.name)];
  const { data, error: e } = await bucket().createSignedUrls(names.map((n) => `${id}/${n}`), LINK_SECONDS);
  const urls = (data ?? []).map((d) => d.signedUrl);
  if (e || urls.length !== names.length || urls.some((u) => !u)) throw new Error(`links: ${e?.message ?? "a link is missing"}`);
  lap(`voice${fonts.length ? ` and ${c.scriptFace!.family} (${fonts.length})` : ""} up for Remotion`);
  bar.note({ step: "submit", done: 0, of: 0 });
  const { layers, ...drawn } = classic;
  const props: ClassicClipProps = {
    composition: "ClassicClip", drawing: REMOTION_DRAWING, ...drawn, total: c.total, audio: urls[0] as string,
    ...(fonts.length ? { scriptFont: fonts.map((f, i) => ({ url: urls[i + 1] as string, weight: f.weight })) } : {}),
    scenes: c.plans.map((p, i) => ({
      key: p.key as SceneKey, voice: c.script[i].voice, voiceSec: c.secs[i], start: p.start, dur: p.dur, frames: p.frames,
      ...(layers[i] ? { layer: layers[i] } : {}), ...(p.table ? { table: p.table } : {}),
    })),
  };
  await handOver(row, gcpKey, bar, c.total, lap, { remotion: { props } }, c.since);
}

/**
 * An FHC summary drawn by Remotion (remotion.ts FhcClipProps): no frame is drawn here. The narration (and
 * คอลลาจ's sounds) goes up as one WAV, a portrait คอลลาจ clip's picked pieces as pictures, and the job gets the
 * summary's facts with each scene's place.
 */
async function cutFhcWithRemotion(
  row: VideoRow & { input: FhcVideoInput }, agentName: string,
  c: { plans: ScenePlan[]; script: { voice: string }[]; secs: number[]; total: number; pcms: Buffer[]; since: number; sounds?: { at: number; kind: SoundKind }[] },
  gcpKey: string, bar: Bar, lap: Lap,
): Promise<void> {
  const id = row.id;
  bar.note({ step: "files", done: 0, of: 0 });
  const narration = mixNarration(c.pcms.map((pcm, i) => ({ pcm, at: c.plans[i].voiceAt })), c.total, TTS_RATE);
  const sfx = c.sounds?.length ? await collageSoundFiles() : undefined;
  await upload(id, "voice.wav", sfx ? addSounds(narration, c.sounds!.map((x) => ({ pcm: sfx[x.kind], at: x.at, gain: SOUND_GAIN[x.kind] })), TTS_RATE) : narration, "audio/wav");
  const size = clipSize(row.input);
  const theme = readTheme(row.input.theme);
  // the picked pieces stand in a portrait คอลลาจ clip's free room only (fhcPartsFor's decor)
  const picks = theme === "collage" && size === "portrait" ? Object.entries(row.input.picks ?? {}).filter((e): e is [FhcSceneKey, string] => typeof e[1] === "string") : [];
  const got = (await Promise.all(picks.map(async ([key, piece]) => {
    const png = await pieceSticker(piece).catch(() => null);
    if (!png) return null;
    const name = `pick-${key}.png`;
    await upload(id, name, png, "image/png");
    return { key, name };
  }))).filter((x): x is { key: FhcSceneKey; name: string } => x !== null);
  const names = ["voice.wav", ...got.map((g) => g.name)];
  const { data, error: e } = await bucket().createSignedUrls(names.map((n) => `${id}/${n}`), LINK_SECONDS);
  const urls = (data ?? []).map((d) => d.signedUrl);
  if (e || urls.length !== names.length || urls.some((u) => !u)) throw new Error(`links: ${e?.message ?? "a link is missing"}`);
  const contact = await contactOf(row.agent_id, agentName);
  lap(`voice and ${got.length} pieces up for Remotion`);
  bar.note({ step: "submit", done: 0, of: 0 });
  const props: FhcClipProps = {
    composition: "FhcClip", drawing: REMOTION_DRAWING, size, theme, facts: row.input.fhc, customer: row.customer_name, narrator: narratorOf(row.input), contact,
    picks: Object.fromEntries(got.map((g, i) => [g.key, urls[i + 1] as string])), total: c.total, audio: urls[0] as string,
    scenes: c.plans.map((p, i) => ({ key: p.key as FhcSceneKey, voice: c.script[i].voice, voiceSec: c.secs[i], start: p.start, dur: p.dur })),
  };
  await handOver(row, gcpKey, bar, c.total, lap, { remotion: { props } }, c.since);
}

/**
 * A คลิปเล่าเรื่อง or คลิปตามโจทย์ drawn by Remotion (remotion.ts StoryClipProps): no frame is drawn here. The
 * narration goes up as one WAV, a คลิปตามโจทย์'s pictures are linked where they are filed, and the job gets the
 * clip's input with each scene's place; the cartoon faces are in the render's image.
 */
async function cutStoryWithRemotion(
  row: VideoRow & { input: StoryVideoInput | PromptStoryInput }, agentName: string,
  c: { plans: ScenePlan[]; script: { voice: string }[]; secs: number[]; total: number; pcms: Buffer[]; since: number },
  gcpKey: string, bar: Bar, lap: Lap,
): Promise<void> {
  const id = row.id;
  bar.note({ step: "files", done: 0, of: 0 });
  await upload(id, "voice.wav", mixNarration(c.pcms.map((pcm, i) => ({ pcm, at: c.plans[i].voiceAt })), c.total, TTS_RATE), "audio/wav");
  // a คลิปตามโจทย์ scene's picture, filed when it was drawn; a scene whose picture fell back has the paper only
  const free = isPromptStory(row.input) ? row.input : null;
  const pictures = c.plans.map((p, s) => (free && p.key === "freeScene" ? free.pictures?.[s] ?? null : null));
  const paths = [`${id}/voice.wav`, ...pictures.filter((x): x is string => Boolean(x))];
  const { data, error: e } = await bucket().createSignedUrls(paths, LINK_SECONDS);
  const urls = (data ?? []).map((d) => d.signedUrl);
  if (e || urls.length !== paths.length || urls.some((u) => !u)) throw new Error(`links: ${e?.message ?? "a link is missing"}`);
  let next = 1;
  const pictureLinks = pictures.map((p) => (p ? (urls[next++] as string) : undefined));
  const contact = await contactOf(row.agent_id, agentName);
  lap(`voice${free ? ` and ${next - 1} pictures` : ""} up for Remotion`);
  bar.note({ step: "submit", done: 0, of: 0 });
  const props = storyClipProps(row.input, clipSize(row.input), row.customer_name, narratorOf(row.input), contact, c.plans, c.script, c.secs, c.total, urls[0] as string, pictureLinks);
  await handOver(row, gcpKey, bar, c.total, lap, { remotion: { props } }, c.since);
}

/** the script's fields as the agent knows them */
const FIELD: Record<string, string> = { voice: "คำพูด", screen: "ข้อความบนจอ", picture: "ภาพ" };
const reasonWords = (r: string) => r.replace(/^(voice|screen|picture): /, (_, f: string) => `${FIELD[f]}: `);

/**
 * Starts a คลิปตามโจทย์ (spec 2026-10-16, Money): the script, as the agent may have edited it, is
 * checked again — a scene that breaks the rules is refused by number — and the draft is claimed
 * for this clip in one conditional update (claimDraft), so it is not made twice; it is given back
 * when the clip cannot be paid for or fails. Then it is paid for as every clip is
 * (createVideo): one hold of the clip and every picture, or the pictures alone on a free clip.
 */
export async function createPromptStory(viewer: Viewer, input: PromptStoryInput, customer: string): Promise<{ id: string } | { refusal: string }> {
  const bad = checkScript(input.scenes, input.brief, input.figure)[0];
  if (bad) return { refusal: `ฉากที่ ${bad.scene + 1} ใช้ไม่ได้ — ${bad.reasons.map(reasonWords).join(", ")} แก้แล้วกดสร้างอีกครั้ง` };
  const allowed = allowedFor(input.brief, input.figure);
  const title = checkScene({ voice: "", screen: input.title, picture: "" }, allowed);
  if (title.length) return { refusal: `ชื่อคลิปใช้ไม่ได้ — ${title.map((r) => r.replace(/^screen: /, "")).join(", ")}` };
  const caption = checkScene({ voice: input.caption, screen: "", picture: "" }, allowed);
  if (caption.length) return { refusal: `ข้อความโพสต์ใช้ไม่ได้ — ${caption.map((r) => r.replace(/^voice: /, "")).join(", ")}` };
  if (!input.draftId) return { refusal: "เขียนบทก่อน แล้วค่อยกดสร้างคลิป" };
  // the draft is taken for this clip in one step: a second press, at once or later, finds it taken
  const id = randomUUID();
  if (!(await claimDraft(viewer.agentId, input.draftId, id))) return { refusal: "บทนี้กดสร้างคลิปไปแล้ว ดูคลิปในรายการด้านล่าง" };
  try {
    const made = await createVideo(viewer, input, customer, id);
    if ("refusal" in made) await releaseDraft(input.draftId, id);
    return made;
  } catch (e) {
    await releaseDraft(input.draftId, id);
    throw e;
  }
}

const BUSY = "คลิปนี้กำลังทำอยู่ รอให้เสร็จก่อนแล้วค่อยวาดใหม่";

/**
 * วาดภาพฉากนี้ใหม่ (spec 2026-10-16): one scene's picture of the agent's own finished คลิปตามโจทย์
 * drawn again for one picture's price (the owner free), and the clip cut again from the voice kept
 * with it — the voice is never asked again. The picture's price is held until the new cut is done
 * (finishVideo takes it); a picture that cannot be drawn, or a cut that fails, gives it back and
 * leaves the clip as it was. The answer comes once the clip is taken; the drawing and the cut are
 * handed to `run` (the action passes Next's after), or awaited here when none is given.
 */
export async function redrawPicture(
  viewer: Viewer, id: string, scene: number, run: (work: () => Promise<void>) => unknown = (work) => work(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await videoOf(viewer.agentId, id);
  if (!row || !isPromptStory(row.input)) return { ok: false, error: "ไม่พบวิดีโอนี้" };
  if (row.status === "drawing" || row.status === "rendering") return { ok: false, error: BUSY };
  if (row.status !== "done" || !row.video_path) return { ok: false, error: "วาดใหม่ได้เฉพาะคลิปที่ทำเสร็จแล้ว" };
  const input = row.input;
  if (!Number.isInteger(scene) || scene < 0 || scene >= input.scenes.length) return { ok: false, error: "ไม่พบฉากนี้" };
  const gcpKey = await providerKey("gcp");
  if (!gcpKey) return { ok: false, error: FAILED };
  const pcms = await keptVoice(id, input.scenes.length + 1);
  if (!pcms) return { ok: false, error: "คลิปนี้ไม่มีเสียงเก็บไว้ วาดใหม่ไม่ได้ ทำคลิปใหม่แทน" };

  let hold: string | null = null;
  let price = 0;
  if (!can(viewer, "owner")) {
    // as createVideo: an outside member pays while their pass is live
    const access = await memberAccess(viewer).catch(() => null);
    if (!access) return { ok: false, error: PASS_UNREADABLE };
    if (!passOpen(access)) return { ok: false, error: PASS_EXPIRED };
    price = promptPicturePrice(input, await walletPrices());
    if (price > 0) {
      const s = await walletSettings().catch(() => null);
      if (!s?.enabled) return { ok: false, error: "ค่าวาดภาพจ่ายจากกระเป๋าเงิน แต่กระเป๋าเงินยังไม่เปิดใช้" };
      const h = await holdFor(viewer.agentId, price, clipRound(row.input), `วาดภาพใหม่ต้องมีเงินในกระเป๋าอย่างน้อย ${formatBaht(price)} เติมเงินได้ที่เมนู "กระเป๋าเงิน"`);
      if ("refusal" in h) return { ok: false, error: h.refusal };
      hold = h.id;
    }
  }
  // the clip leaves done once: a second press finds it busy
  const { data: taken, error } = await rows().update({ status: "drawing", progress: null, error: null, updated_at: new Date().toISOString() })
    .eq("id", id).eq("agent_id", viewer.agentId).eq("status", "done").select("id").maybeSingle();
  if (error || !taken) {
    if (hold) await releaseWallet(hold).catch((e) => console.error("redraw hold not released:", e));
    return { ok: false, error: BUSY };
  }

  const agentName = viewer.name.trim();
  await run(async () => {
    const t0 = Date.now();
    const lap = lapper(id, t0);
    const bar = progressBar(id);
    let held = hold;
    const giveBack = async () => {
      if (!held) return;
      const h = held;
      held = null;
      await releaseWallet(h).catch((e) => console.error("redraw hold not released:", e));
    };
    try {
      bar.note({ step: "pictures", done: 0, of: 1 });
      const png = await drawScenePicture(input.scenes[scene], input.style, input.painter, clipSize(input));
      if (!png) {
        await giveBack();
        await bar.flush();
        await rows().update({ status: "done", error: `วาดภาพฉากที่ ${scene + 1} ไม่สำเร็จ ไม่ได้หักเงิน ลองใหม่อีกครั้ง`, updated_at: new Date().toISOString() })
          .eq("id", id).eq("status", "drawing");
        return;
      }
      await upload(id, picName(scene), png, "image/png");
      const pictures = input.scenes.map((_, s) => input.pictures?.[s] ?? null);
      pictures[scene] = `${id}/${picName(scene)}`;
      // the hold rides with the clip: taken when the new cut is done (finishVideo), given back if it fails (fail)
      const next: PromptStoryInput = { ...input, pictures, ...(held ? { redraw: { hold: held, satang: price, thb: pictureThb(input.painter) } } : {}) };
      const cost_parts: CostParts = { ...(row.cost_parts ?? {}), pictures: (row.cost_parts?.pictures ?? 0) + pictureThb(input.painter) };
      await setRow(id, { input: next, cost_thb: Number(row.cost_thb ?? 0) + pictureThb(input.painter), cost_parts });
      held = null;
      bar.note({ step: "pictures", done: 1, of: 1 });
      lap(`scene ${scene} picture drawn again`);
      await cutClip({ ...row, input: next, cost_parts, status: "drawing" }, agentName, pcms, gcpKey, bar, t0, lap);
    } catch (e) {
      await giveBack();
      await fail(id, e);
    }
  });
  return { ok: true };
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
export async function finishVideo(row: VideoRow, state: "done" | "failed", outPath?: string, jobError?: string): Promise<void> {
  // a clip failed for taking too long whose render still arrived: its file is nobody's, so it goes
  if (row.status === "failed" && !row.video_path && state === "done" && outPath === `${row.id}/quote.mp4`) {
    await bucket().remove([outPath]).catch(() => undefined);
    return;
  }
  if (row.status !== "rendering") return;
  if (state === "done" && outPath === `${row.id}/quote.mp4`) {
    // how long the run took, from the hand-over to this answer (run-record.ts)
    const renderSec = secondsBetween(row.job?.startedAt, Date.now());
    // the row moves once: a callback sent twice settles once
    const { data, error } = await rows().update({ status: "done", video_path: outPath, error: null, updated_at: new Date().toISOString() })
      .eq("id", row.id).eq("status", "rendering").select("id").maybeSingle();
    if (error) throw new Error(`video ${row.id} not finished: ${error.message}`);
    if (!data) return;
    const remotion = (row.input as { engine?: unknown }).engine === "remotion";
    const renderThb = remotion ? REMOTION_COST_THB : RENDER_COST_THB;
    await asWho(row.agent_id, () => recordUsage("cloudrun", VIDEO_TASK_RENDER, 0, 0, renderThb));
    const cost = Number(row.cost_thb ?? 0) + renderThb;
    let charged: number | null = null;
    // a free คลิปตามโจทย์ holds its pictures too; a clip cut again was settled at its first finish
    if (row.hold_id && row.charged_satang == null) {
      // the price is fixed: the whole hold is the charge; a free คลิปตามโจทย์ whose every picture
      // failed has nothing left to charge, and its hold goes back whole
      if (Number(row.held_satang) > 0) {
        charged = await settleWallet(row.hold_id, Number(row.held_satang), cost)
          .then((c) => {
            // the hold was gone before the clip finished: nothing was taken, and the clip's line
            // says so (paid-line.ts) instead of "กันเงินไว้ระหว่างทำ" for good (owner, 2026-10-18)
            if (c === null) console.error(`quote video ${row.id}: done, but hold ${row.hold_id} was gone — not charged`);
            return c ?? 0;
          })
          .catch((e) => { console.error("quote video settle failed:", e); return null; });
      } else await release(row);
    }
    // a คลิปตามโจทย์ cut again: the redrawn picture is in the clip now, so its hold is taken
    let input: PromptStoryInput | undefined;
    if (isPromptStory(row.input) && row.input.redraw) {
      const { redraw, ...rest } = row.input;
      await settleWallet(redraw.hold, redraw.satang, redraw.thb).catch((e) => console.error("redraw settle failed:", e));
      input = rest;
    }
    // the run's own seconds, priced at its machine's rate, beside the fixed figure charged above (run-record.ts)
    const engine: ClipEngine = remotion ? "remotion" : "ffmpeg";
    const cost_parts: CostParts = { ...(row.cost_parts ?? {}), engine, ...(renderSec !== null ? { renderSec, renderThb: renderThbFor(engine, renderSec) } : {}) };
    await setRow(row.id, { cost_thb: cost, cost_parts, ...(charged !== null ? { charged_satang: charged } : {}), ...(input ? { input } : {}) }).catch(() => undefined);
    await clearInputs(row.id, isPromptStory(row.input));
  } else {
    await fail(row.id, new Error(jobError ? `render failed: ${jobError}` : "render failed"));
  }
}

/**
 * Whether a clip is still being made past its time: drawing 20 minutes, rendering 25. A finished
 * clip cut again (redrawPicture) is timed from when it was taken again.
 */
export function isStuck(v: Pick<VideoRow, "status" | "video_path" | "created_at" | "updated_at">, now: number): boolean {
  if (v.status !== "drawing" && v.status !== "rendering") return false;
  const since = Date.parse(v.video_path ? v.updated_at : v.created_at);
  return now - since > (v.status === "rendering" ? RENDER_TIMEOUT_MS : VIDEO_TIMEOUT_MS);
}

/** the last whole-table sweep, so a burst of board loads asks the table once a minute at most */
let sweptAt = 0;

/**
 * Every agent's clips stuck past their time, failed and their holds given back (owner chose 2ก,
 * 2026-10-18): run when anyone opens /home or a clip board, and once a day by the cron
 * (/api/quote-video/sweep), so a clip whose maker closed the tab does not stay "กำลังสร้าง".
 * `force`: the cron's run, never skipped. Returns how many it failed.
 */
export async function sweepStuckVideos(now = Date.now(), force = false): Promise<number> {
  if (!force && now - sweptAt < 60_000) return 0;
  sweptAt = now;
  const { data, error } = await rows().select("id, status, video_path, created_at, updated_at")
    .in("status", ["drawing", "rendering"]).is("deleted_at", null)
    .lt("created_at", new Date(now - VIDEO_TIMEOUT_MS).toISOString()).limit(100);
  if (error) throw new Error(`stuck videos not read: ${error.message}`);
  let n = 0;
  for (const v of (data ?? []) as Pick<VideoRow, "id" | "status" | "video_path" | "created_at" | "updated_at">[]) {
    if (!isStuck(v, now)) continue;
    await fail(v.id, new Error("timed out"));
    n++;
  }
  return n;
}

/** An agent's clips, newest first; any stuck past the time limit, theirs or anyone's, is marked failed on the way. */
export async function listVideos(agentId: string, limit = 30): Promise<VideoRow[]> {
  await sweepStuckVideos().catch((e) => console.error("stuck clip sweep failed:", e instanceof Error ? e.message : e));
  const { data, error } = await rows().select("*").eq("agent_id", agentId).is("deleted_at", null).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`videos not read: ${error.message}`);
  const list = (data ?? []) as VideoRow[];
  const now = Date.now();
  for (const v of list) {
    if (isStuck(v, now)) {
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
  // updated_at is left as it was: a clip failed on the day's voice and deleted later would
  // otherwise read as that voice full again today (voiceFullUntil) (owner, 2026-10-18)
  const { data, error } = await rows().update({ deleted_at: new Date().toISOString() })
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
