import { randomBytes, randomUUID } from "node:crypto";
import { providerKey } from "@/lib/ai/client";
import { TTS_RATE } from "@/lib/ai/tts";
import { speakClip } from "./speak";
import { sayNumbers } from "./say-numbers";
import { valueTableChart } from "@/lib/quote-card";
import { can } from "@/lib/auth/access";
import type { Viewer } from "@/lib/auth/access";
import { memberAccess, PASS_EXPIRED, PASS_UNREADABLE, passOpen } from "@/lib/members/access";
import { siteUrl } from "@/lib/site-url";
import { formatBaht } from "@/lib/wallet/money";
import { videoPriceKey, type PriceKey, type Prices } from "@/lib/wallet/prices";

/** the prices the board shows under its button: each look and length, and the FHC summary */
const VIDEO_KEYS: PriceKey[] = ["videoClassic", "videoMotion", "videoLongClassic", "videoLongMotion", "videoMaxClassic", "videoMaxMotion", "videoFhc", "videoStory", "videoStoryShort", "videoPrompt"];
import { balanceSatang, holdWallet, releaseWallet, walletFrozen, walletPrices, walletSettings } from "@/lib/wallet/store";
import { cloudRunEngine } from "@/lib/video/engines/cloudrun";
import type { FfmpegJob } from "@/lib/video/command";
import { getContact, photoDataUri } from "./contact";
import { CHART_W, type Contact } from "./draw";
import { tablePlan } from "./table-pen";
import { pensionTablePlan } from "./pension-table";
import { gsTablePlan } from "./gsaving-table";
import { mixNarration, pcmSeconds } from "./job";
import { fhcScript, isFhcInput, type FhcSceneKey, type FhcVideoInput } from "./fhc";
import { fhcWindows } from "./fhc-motion";
import { topicOf } from "@/lib/story/topics";
import { isPromptStory, promptFreePrice, promptPicturePrice, promptStoryPrice, type PromptStoryInput } from "@/lib/prompt-story/types";
import { allowedFor, checkScene, checkScript } from "@/lib/prompt-story/check";
import { drawScenePicture } from "@/lib/prompt-story/pictures";
import { claimDraft, releaseDraft } from "@/lib/prompt-story/drafts";
import { figureLines, freeWindows } from "@/lib/prompt-story/frames";
import { submitRender } from "@/lib/shotstack/api";
import { DESIGN_LOOKS, designEdit, isDesignLook, type DesignLook, type DesignPart } from "@/lib/shotstack/looks";
import { PAINTERS } from "@/lib/content/models";
import { isStoryInput, storyScript, type StoryVideoInput } from "./story";
import { contactSpec } from "./story-motion";
import { clipWindows } from "./story-frames";
import { jarFits, motionWindows, MOTION_FPS, roadFits } from "./motion";
import { readTheme } from "./theme-keys";
import { festivalGreeting, readFestival } from "./festival";
import { MY_COLORS, type MyColor } from "@/lib/card-theme";
import { fxPropsOf, type FxChoice } from "./fx";
import { fxFor } from "./fx-switch";
import { clipProps, REMOTION_DRAWING, REMOTION_JOB, storyClipProps, type ClassicClipProps, type ClipProps, type FhcClipProps, type RemotionMotion, type StoryClipProps } from "./remotion";
import { secondsBetween, type CostParts } from "./run-record";
import { WIDE_CHART_W } from "./classic-wide";
import { CLASSIC_BOXES } from "./table-geo";
import { extraOf, linesOf, loops, readLength, type Told } from "./told";
import { writes } from "./brief";
import { writeLines } from "./writer";
import { planInput, productOf, quoteVideoFacts, quoteVideoScript, sceneMotion, spokenBy, type SceneKey, type VideoInput } from "./script";
import { clipLength, LOOP_TAIL, planScenes, sizeOf, type ScenePlan, type VideoSize } from "./timeline";
import { VOICE_FULL, voiceDay } from "./voice-quota";
import { geminiVoice } from "@/lib/voice/gemini";
import { googleFontSubset } from "@/lib/google-font";
import { readVideoLang, SCRIPT_FAMILY, wordsLetters, type VideoLang } from "./video-words";
import { clipKind, DEFAULT_ESTIMATES, estimatesFrom, type ClipKind, type Estimate, type ProgressNote } from "./progress";
import { bucket, fail, FAILED, freeClips, freeUsed, hashToken, rows, setRow, videoOf, type ClipInput, type VideoRow } from "./rows";

/**
 * Making one วิดีโอนำเสนอ clip (owner, 2026-10-11; spec docs/superpowers/specs/2026-10-11-quote-video-design.md).
 *
 * `produce` runs after the agent's request has been answered: the five lines spoken, every
 * picture drawn, all of it filed under "<video id>/" in the quote-video bucket, and the job
 * handed to the Cloud Run engine the Studio clips use. The engine calls back on
 * /api/quote-video/job (finishVideo). Tokens and signed links never reach a log or the row.
 */

// the row's reading, free clips and end live in rows.ts, which the pages that only list clips import
export {
  FAILED, FREE_VIDEOS, RECUT_FAILED, RENDER_TIMEOUT_MS, VIDEO_BUCKET, VIDEO_TASK_RENDER, VIDEO_TIMEOUT_MS,
  finishVideo, freeClips, freeVideosLeft, hashToken, isStuck, listVideos, sweepStuckVideos, videoOf, videoOfJob,
  type ClipInput, type FreeClips, type PaidBy, type VideoRow, type VideoStatus,
} from "./rows";
export const VIDEO_TASK_VOICE = "quote-video-voice";
export const VIDEO_CALLBACK_PATH = "/api/quote-video/job";
const LINK_SECONDS = 2 * 3600;
/**
 * What a clip costs an agent, fixed, from the owner's price list (src/lib/wallet/prices.ts,
 * /admin/wallet — owner 2026-10-12): ฿5 แบบปกติ, ฿10 Motion Graphic, ฿3 an FHC summary whatever
 * its look, and an ElevenLabs voice on top (+฿2). The wallet holds the price when the clip is
 * asked for and takes it when the clip is done.
 */
export const videoPrice = (v: ClipInput, prices: Prices): number =>
  isPromptStory(v) ? promptStoryPrice(v, prices) :
  (isFhcInput(v) ? prices.videoFhc : isStoryInput(v) ? (topicOf(v.topic)?.short ? prices.videoStoryShort : prices.videoStory)
    : prices[videoPriceKey(v.style === "motion" ? "motion" : "classic", readLength(v.length))]) + (v.voice ? prices.elevenExtra : 0);
/** the round name on the wallet's hold and charge lines */
export const VIDEO_ROUND = "quote-video";
/**
 * Each clip tool's own round, so the wallet's history names it (owner, 2026-10-18): every one
 * starts "quote-video", which the hold sweep keeps 30 minutes (20261124_clip_rounds.sql).
 */
export const clipRound = (v: ClipInput): string =>
  isPromptStory(v) ? `${VIDEO_ROUND}-prompt` : isStoryInput(v) ? `${VIDEO_ROUND}-story` : VIDEO_ROUND;

export type { VideoInput } from "./script";
/** a quote clip: neither an FHC summary nor a story */
export const isQuoteInput = (v: ClipInput): v is VideoInput => !isFhcInput(v) && !isStoryInput(v) && !isPromptStory(v);



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
      // a คลิปตามโจทย์'s free clip covers the clip only: its pictures, and ดีไซน์พิเศษ's extra, are still paid from the wallet (spec, Money)
      const pictures = isPromptStory(input) ? promptFreePrice(input, await walletPrices()) : 0;
      if (pictures > 0) {
        const s = await walletSettings().catch(() => null);
        if (!s?.enabled) return { refusal: "ค่าภาพประกอบจ่ายจากกระเป๋าเงิน แต่กระเป๋าเงินยังไม่เปิดใช้" };
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
  // every clip is drawn by Remotion (owner, 2026-10-20, ข): the row says so, for its progress estimate (progress.ts);
  // ลูกเล่นคลิปใหม่ is kept on the row when the back office's switch gives it to this maker (fx-switch.ts); the
  // music choice only means something with it
  const fx = await fxFor(viewer);
  const { fx: _asked, noMusic, ...plain } = input as ClipInput & FxChoice;
  void _asked;
  // a คลิปตามโจทย์ in ดีไซน์พิเศษ is Shotstack's (owner, 2026-10-21); ลูกเล่นคลิปใหม่ is Remotion's, so not on it
  const shotstack = isPromptStory(input) && Boolean(input.design);
  input = { ...plain, engine: shotstack ? "shotstack" : "remotion", ...(fx && !shotstack ? { fx: true, ...(noMusic ? { noMusic: true } : {}) } : {}) } as ClipInput;
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

/** a คลิปตามโจทย์'s kept pictures and voice, by these names (rows.ts KEPT) */
const picName = (s: number) => `pic-${s}.png`;
const voiceName = (s: number) => `voice-${s}.pcm`;


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
  /** a Motion Graphic quote clip: what its frames are drawn from (remotion.ts ClipProps) */
  motion$?: RemotionMotion;
  /** a แบบปกติ quote clip: what its layers are drawn from (remotion.ts ClassicClipProps) */
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

/**
 * A คลิปตามโจทย์'s parts: its lines and scenes as planned (StoryClip draws them with prompt-story/frames.tsx),
 * each scene's picture linked where it was filed (cutStoryWithRemotion).
 */
function freeParts(row: VideoRow & { input: PromptStoryInput }, secs: number[]): ClipParts {
  const input = row.input;
  const script = freeScript(input, row.customer_name, narratorOf(input));
  if (secs.length !== script.length) throw new Error("voice lengths do not match the script");
  const card = Object.values(contactSpec()).map((x): [number, number] => [x.at, x.at + x.dur]);
  const plans = planScenes(script.map((s, i) => ({ key: s.key, voice: s.voice, voiceSec: secs[i], windows: s.key === "storyContact" ? card : freeWindows(), fps: MOTION_FPS })));
  return { size: clipSize(input), script, motion: true, plans };
}

/** An FHC summary's parts: always the Motion Graphic world, six scenes (fhc-motion.tsx; FhcClip draws them). */
export function fhcPartsFor(row: Pick<VideoRow, "customer_name"> & { input: FhcVideoInput }, secs: number[]): ClipParts {
  const facts = row.input.fhc;
  const size = clipSize(row.input);
  const script = fhcScript(facts, row.customer_name, narratorOf(row.input));
  if (secs.length !== script.length) throw new Error("voice lengths do not match the script");
  const plans = planScenes(script.map((s, i) => ({ key: s.key, voice: s.voice, voiceSec: secs[i], windows: fhcWindows(s.key, facts), fps: MOTION_FPS })));
  return { size, script, motion: true, plans };
}

/** น้องโล่ and the carried figures, for a Motion Graphic quote clip that asked for them (not แชทถาม-ตอบ) */
function extrasOf(input: VideoInput): { mascot?: boolean; carry?: boolean } {
  if (input.style !== "motion") return {};
  return { ...(input.mascot ? { mascot: true } : {}), ...(input.carry ? { carry: true } : {}) };
}

/** สีของฉัน's colour for the clip; nothing for another look, or a colour not on the list */
function myColorOf(theme: string | undefined, kept: unknown): { myColor?: MyColor } {
  return theme === "mine" && MY_COLORS.includes(kept as MyColor) ? { myColor: kept as MyColor } : {};
}

/** ธีมเทศกาล's festival and its greeting for the clip (festival.ts); nothing for another look, or a festival not named */
function festivalOf(theme: string | undefined, kept: unknown): { festival?: { key: NonNullable<ReturnType<typeof readFestival>>; greeting: string } } {
  const key = theme === "festival" ? readFestival(kept) : undefined;
  return key ? { festival: { key, greeting: festivalGreeting(key, new Date()) } } : {};
}

/** A story clip's parts: its lines and scenes as planned (StoryClip draws them with story-frames.tsx). */
function storyParts(row: VideoRow & { input: StoryVideoInput }, secs: number[]): ClipParts {
  const input = row.input;
  const size = clipSize(input);
  const script = storyScript(input, row.customer_name, narratorOf(input));
  if (secs.length !== script.length) throw new Error("voice lengths do not match the script");
  const plans = planScenes(script.map((s, i) => ({ key: s.key, voice: s.voice, voiceSec: secs[i], windows: clipWindows(s.key, input, size), fps: MOTION_FPS })));
  return { size, script, motion: true, plans };
}

async function clipParts(row: VideoRow, agentName: string, secs: number[]): Promise<ClipParts> {
  if (isFhcInput(row.input)) return fhcPartsFor(row as VideoRow & { input: FhcVideoInput }, secs);
  if (isStoryInput(row.input)) return storyParts(row as VideoRow & { input: StoryVideoInput }, secs);
  if (isPromptStory(row.input)) return freeParts(row as VideoRow & { input: PromptStoryInput }, secs);
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
  // แชทถาม-ตอบ (owner, 2026-10-20) is drawn the Motion way, with the chat for its drawing
  const motion = row.input.style === "motion" || row.input.style === "chat";
  // the Motion Graphic look (owner, 2026-10-17)
  const theme = row.input.style === "chat" ? "chat" as const : motion ? readTheme(row.input.theme) : undefined;
  // the piggy jar tells the price in one portrait Motion clip in two, at random (owner, 2026-10-20, ค); it needs a daily price
  const priceJar = row.input.style === "motion" && size === "portrait" && jarFits(facts) && Math.random() < 0.5;
  // the road of life tells the cover the same way (owner, 2026-10-20, idea 4)
  const coverRoad = row.input.style === "motion" && size === "portrait" && roadFits(facts) && Math.random() < 0.5;
  // the classic value scene: where the table stops and which pen note is written at each stop
  // Global Savings has its table on the third scene, where the others list their cover (owner, 2026-10-20, ก ก)
  const tableKey = facts.gsaving ? "cover" : "value";
  const valueAt = script.findIndex((s) => s.key === tableKey);
  // บำนาญ 95's and Global Savings' tables carry their notes in the picture, and only walk down (pension-table.tsx, gsaving-table.tsx)
  const pen = !motion && valueAt >= 0
    ? (facts.pension ? pensionTablePlan : facts.gsaving ? gsTablePlan : tablePlan)(facts, script[valueAt].voice, secs[valueAt], boxes.table)
    : undefined;
  const plans = planScenes(script.map((s, i) => ({
    key: s.key, voice: s.voice, voiceSec: secs[i],
    ...(motion ? { windows: motionWindows(s.key, facts, secs[i], s.voice), fps: MOTION_FPS } : sceneMotion(facts, s.key)),
    ...(pen && i === valueAt ? { table: pen.plan } : {}),
    ...(loop && i === script.length - 1 ? { tail: LOOP_TAIL } : {}),
  })));
  // a แบบปกติ scene's layer: the family photo on the lead (and a looping clip's last scene, its opening again,
  // owner 2026-10-13, choice ก), the value table on the value scene (ClassicClip)
  const layers = plans.map((p) => (motion ? undefined
    : p.key === "lead" || (loop && p.key === "contact") ? "photo" as const : p.key === tableKey ? "table" as const : undefined));
  // a landscape clip's chart stands beside the table, narrower; a square one has no room for it
  // Protection Life has a variant but no value table, so no chart
  const chart = "variant" in row.input && productOf(row.input) !== "IHEALTHY" && productOf(row.input) !== "PLB" && size !== "square"
    ? valueTableChart(planInput(row.input), size === "landscape" ? WIDE_CHART_W : CHART_W) : undefined;
  // Chinese, Russian and Burmese letters come from a face of their own, cut to what this clip shows
  const family = SCRIPT_FAMILY[lang];
  const script$ = family
    ? { script: { family, text: [JSON.stringify(facts), ...script.map((x) => x.voice), wordsLetters(lang), customer, contact.name, contact.line ?? ""].join("") } }
    : {};
  return {
    script, motion, plans, size,
    ...(motion ? { motion$: { theme: theme!, ...festivalOf(theme, row.input.festival), ...myColorOf(theme, row.input.myColor), ...extrasOf(row.input), ...(size !== "portrait" ? { size } : {}), sex: row.input.sex, facts, customer, narrator, contact, shown: { loop, extra: shown.extra, ...(shown.headline ? { headline: shown.headline } : {}), ...(priceJar ? { priceJar } : {}), ...(coverRoad ? { coverRoad } : {}) } } } : {}),
    ...(!motion ? { classic$: { size, facts, narrator, customer, contact, ...(chart ? { chart } : {}), ...(pen?.notes.length ? { notes: pen.notes } : {}), shown: { loop, extra: shown.extra, ...(shown.headline ? { headline: shown.headline } : {}) }, layers } } : {}),
    ...(script$.script ? { scriptFace: script$.script } : {}),
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
 * The voice is made here; Remotion on Cloud Run draws every frame (cutClip).
 * A คลิปตามโจทย์ draws its pictures first and keeps them, and its voice, with the clip.
 */
export async function produce(id: string, agentName: string): Promise<void> {
  const t0 = Date.now();
  const lap = lapper(id, t0);
  try {
    const { data: row, error } = await rows().select("*").eq("id", id).single<VideoRow>();
    if (error || !row) throw new Error("row not read");
    const gcpKey = await renderKeyOf(row.input);
    if (!gcpKey) throw new Error(shotstackOf(row.input) ? "no shotstack key" : "no gcp key");
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
    const { spoken, fellBackTo, google } = await speakClip(
      spokenScript.map((s) => (lang === "th" ? sayNumbers(s.voice) : s.voice)),
      { task: VIDEO_TASK_VOICE, narrator, voice: voiceId, gemini: geminiVoice(row.input.gemini)?.name, lang, pool,
        onLine: () => bar.note({ step: "voice", done: ++lines, of: spokenScript.length }),
        onSwitch: () => { lines = 0; bar.note({ step: "voice", done: 0, of: spokenScript.length }); } },
    );
    const pcms = spoken.map((s) => s.pcm);
    const voiceThb = spoken.reduce((n, s) => n + s.costThb, 0);
    row.cost_parts = { voice: voiceThb, pictures: picturesThb, ...(google ? { googleVoice: google } : {}) };
    const voicePatch: Partial<VideoRow> = { cost_thb: voiceThb + picturesThb, cost_parts: row.cost_parts };
    // the ElevenLabs voice was not used: its +฿2 comes off what the wallet takes (owner, 2026-10-20, ก)
    if (google && row.paid_by === "wallet" && row.hold_id && row.held_satang) {
      row.held_satang = voicePatch.held_satang = Math.max(0, Number(row.held_satang) - (await walletPrices()).elevenExtra);
    }
    await setRow(id, voicePatch);
    lap(`voice done (${spokenScript.length} lines${google ? `, Google ${google} in place of ElevenLabs` : voiceId || fellBackTo ? ", ElevenLabs" : ""}${fellBackTo ? " (in place of Gemini)" : ""}${lang === "th" ? "" : `, ${lang}`})`);
    // kept with the clip, so a picture redrawn later is cut without speaking again
    if (isPromptStory(row.input)) await pool(pcms, 8, (pcm, i) => upload(id, voiceName(i), pcm, "application/octet-stream"));
    await cutClip(row, agentName, pcms, gcpKey, bar, t0, lap);
  } catch (e) {
    await fail(id, e);
  }
}

/**
 * From the spoken lines to Cloud Run taking the job: the scenes planned and handed to Remotion with the
 * voice and pictures as links (no frame is drawn here). produce and redrawPicture both end here.
 * Throws; the caller fails the clip.
 */
async function cutClip(row: VideoRow, agentName: string, pcms: Buffer[], gcpKey: string, bar: Bar, t0: number, lap: Lap): Promise<void> {
  // the cut starts here: what comes before it is the voice (run-record.ts prepSec)
  const since = Date.now();
  const secs = pcms.map((pcm) => pcmSeconds(pcm, TTS_RATE));
  const { plans, motion$, classic$, script, scriptFace } = await clipParts(row, agentName, secs);
  const total = clipLength(plans);
  // every clip is drawn by Remotion (owner, 2026-10-20: "ให้ใช้ Remotion ตลอดไปเลย ไม่ต้องมีสวิตช์"):
  // สรุป FHC, คลิปเล่าเรื่อง and คลิปตามโจทย์, then วิดีโอนำเสนอ in its look
  if (isFhcInput(row.input)) {
    return cutFhcWithRemotion(row as VideoRow & { input: FhcVideoInput }, agentName, { plans, script, secs, total, pcms, since }, gcpKey, bar, lap);
  }
  if (shotstackOf(row.input)) {
    return cutWithShotstack(row as VideoRow & { input: PromptStoryInput }, agentName, { plans, secs, total, pcms, since }, gcpKey, bar, lap);
  }
  if (isStoryInput(row.input) || isPromptStory(row.input)) {
    return cutStoryWithRemotion(row as VideoRow & { input: StoryVideoInput | PromptStoryInput }, agentName, { plans, script, secs, total, pcms, since }, gcpKey, bar, lap);
  }
  if (classic$) return cutClassicWithRemotion(row as VideoRow & { input: VideoInput }, classic$, { plans, script, secs, total, pcms, since, scriptFace }, gcpKey, bar, lap);
  if (motion$) return cutWithRemotion(row as VideoRow & { input: VideoInput }, motion$, { plans, script, secs, total, pcms, scriptFace, since }, gcpKey, bar, lap);
  throw new Error("no way to draw this clip");
}

/**
 * The run handed over, as every clip ends: the finished video's upload link, the payload file the
 * job reads (JOB_URL) with the Remotion render's props (remotion.ts), the row marked rendering, the
 * drawing's own job (REMOTION_JOB) started.
 */
async function handOver(row: VideoRow, gcpKey: string, bar: Bar, total: number, lap: Lap, run: { remotion: { props: ClipProps | StoryClipProps | FhcClipProps | ClassicClipProps } }, since: number): Promise<void> {
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
  // the engine's job shape, with no ffmpeg command: job.mjs renders the props and puts out_1
  const job: FfmpegJob = { inputs: [], command: "", outputs: [{ name: "out_1", file: "quote.mp4", contentType: "video/mp4" }] };
  const payloadPath = `${id}/job.json`;
  const pay = await bucket().upload(payloadPath, JSON.stringify({ id: jobId, ...run, job, uploads: uploadsTo, callbackUrl, token }), { contentType: "text/plain", upsert: true });
  if (pay.error) throw new Error(`payload: ${pay.error.message}`);
  const payLink = await bucket().createSignedUrl(payloadPath, LINK_SECONDS);
  if (payLink.error || !payLink.data?.signedUrl) throw new Error("no payload link");

  // the last progress write lands before the row leaves "drawing" (it writes only a drawing row)
  await bar.flush();
  const parts: CostParts = { ...(row.cost_parts ?? {}), engine: "remotion", prepSec: secondsBetween(since, Date.now()) ?? undefined };
  // recorded before the run is asked, so a callback that comes back at once finds it
  await setRow(id, { status: "rendering", duration_sec: total, cost_parts: parts, job: { id: jobId, tokenHash: hashToken(token), startedAt: new Date().toISOString() } });
  await cloudRunEngine(gcpKey, { job: REMOTION_JOB }).submit(job, { callbackUrl, token, uploads: uploadsTo, id: jobId, payloadUrl: payLink.data.signedUrl });
  lap("handed to Cloud Run (Remotion)");
}

/**
 * A Motion Graphic clip drawn by Remotion (remotion.ts): no frame is drawn here. The narration goes
 * up as one WAV, a Chinese, Russian or Burmese clip's face cut to its letters, and the job gets the
 * clip's motion context with links to them.
 */
async function cutWithRemotion(
  row: VideoRow & { input: VideoInput }, motion: RemotionMotion,
  c: { plans: ScenePlan[]; script: { voice: string }[]; secs: number[]; total: number; pcms: Buffer[]; scriptFace?: { family: string; text: string }; since: number },
  gcpKey: string, bar: Bar, lap: Lap,
): Promise<void> {
  const id = row.id;
  bar.note({ step: "files", done: 0, of: 0 });
  // the same face the old engine draws these letters in; without it they would be boxes, so no clip (poster-png's rule)
  const faces = c.scriptFace ? await googleFontSubset(c.scriptFace.family, c.scriptFace.text) : undefined;
  if (c.scriptFace && !faces) throw new Error(`font ${c.scriptFace.family} not loaded`);
  const fonts = (faces ?? []).map((f) => ({ name: `script-${f.weight}.ttf`, weight: f.weight, data: Buffer.from(f.data) }));
  await Promise.all(fonts.map((f) => upload(id, f.name, f.data, "application/octet-stream")));
  await upload(id, "voice.wav", mixNarration(c.pcms.map((pcm, i) => ({ pcm, at: c.plans[i].voiceAt })), c.total, TTS_RATE), "audio/wav");
  const names = ["voice.wav", ...fonts.map((f) => f.name)];
  const { data, error: e } = await bucket().createSignedUrls(names.map((n) => `${id}/${n}`), LINK_SECONDS);
  const urls = (data ?? []).map((d) => d.signedUrl);
  if (e || urls.length !== names.length || urls.some((u) => !u)) throw new Error(`links: ${e?.message ?? "a link is missing"}`);
  const scriptFont = fonts.map((f, i) => ({ url: urls[1 + i] as string, weight: f.weight }));
  lap(`voice${fonts.length ? ` and ${c.scriptFace!.family} (${fonts.length})` : ""} up for Remotion`);
  bar.note({ step: "submit", done: 0, of: 0 });
  const props: ClipProps = { ...clipProps(motion, c.plans as ScenePlan<SceneKey>[], c.script, c.secs, c.total, urls[0] as string, scriptFont), ...fxPropsOf(row.input) };
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
    composition: "ClassicClip", drawing: REMOTION_DRAWING, ...drawn, ...fxPropsOf(row.input), total: c.total, audio: urls[0] as string,
    ...(fonts.length ? { scriptFont: fonts.map((f, i) => ({ url: urls[i + 1] as string, weight: f.weight })) } : {}),
    scenes: c.plans.map((p, i) => ({
      key: p.key as SceneKey, voice: c.script[i].voice, voiceSec: c.secs[i], start: p.start, dur: p.dur, frames: p.frames,
      ...(layers[i] ? { layer: layers[i] } : {}), ...(p.table ? { table: p.table } : {}),
    })),
  };
  await handOver(row, gcpKey, bar, c.total, lap, { remotion: { props } }, c.since);
}

/**
 * An FHC summary drawn by Remotion (remotion.ts FhcClipProps): no frame is drawn here. The narration goes up as
 * one WAV, and the job gets the summary's facts with each scene's place.
 */
async function cutFhcWithRemotion(
  row: VideoRow & { input: FhcVideoInput }, agentName: string,
  c: { plans: ScenePlan[]; script: { voice: string }[]; secs: number[]; total: number; pcms: Buffer[]; since: number },
  gcpKey: string, bar: Bar, lap: Lap,
): Promise<void> {
  const id = row.id;
  bar.note({ step: "files", done: 0, of: 0 });
  await upload(id, "voice.wav", mixNarration(c.pcms.map((pcm, i) => ({ pcm, at: c.plans[i].voiceAt })), c.total, TTS_RATE), "audio/wav");
  const size = clipSize(row.input);
  const theme = readTheme(row.input.theme);
  const { data, error: e } = await bucket().createSignedUrl(`${id}/voice.wav`, LINK_SECONDS);
  if (e || !data?.signedUrl) throw new Error(`links: ${e?.message ?? "a link is missing"}`);
  const contact = await contactOf(row.agent_id, agentName);
  lap("voice up for Remotion");
  bar.note({ step: "submit", done: 0, of: 0 });
  const props: FhcClipProps = {
    composition: "FhcClip", drawing: REMOTION_DRAWING, size, theme, ...festivalOf(theme, row.input.festival), ...(row.input.mascot ? { mascot: true } : {}), ...myColorOf(theme, row.input.myColor), facts: row.input.fhc, customer: row.customer_name, narrator: narratorOf(row.input), contact,
    ...fxPropsOf(row.input), total: c.total, audio: data.signedUrl,
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
  const props: StoryClipProps = { ...storyClipProps(row.input, clipSize(row.input), row.customer_name, narratorOf(row.input), contact, c.plans, c.script, c.secs, c.total, urls[0] as string, pictureLinks), ...fxPropsOf(row.input) };
  await handOver(row, gcpKey, bar, c.total, lap, { remotion: { props } }, c.since);
}

/** a คลิปตามโจทย์ in ดีไซน์พิเศษ: Shotstack puts it together (owner, 2026-10-21) */
const shotstackOf = (input: ClipInput): input is PromptStoryInput => isPromptStory(input) && input.engine === "shotstack" && isDesignLook(input.design);

/** the key the clip's cut needs: Shotstack's for ดีไซน์พิเศษ, Cloud Run's for every clip Remotion draws */
const renderKeyOf = (input: ClipInput): Promise<string | null> => providerKey(shotstackOf(input) ? "shotstack" : "gcp");

/** ดีไซน์พิเศษ opens on the clip's title for this long, before the first scene and its voice */
const DESIGN_COVER_SEC = 2.5;
/** where Shotstack calls back when a render is done or failed */
export const SHOTSTACK_CALLBACK_PATH = "/api/quote-video/shotstack";

/**
 * A คลิปตามโจทย์ in ดีไซน์พิเศษ (owner, 2026-10-21, mockup https://claude.ai/artifact/FqkpbJneL55sMh9HSyGr4L
 * v2, ก ก): the same scenes, voice and pictures as Remotion's, put together by Shotstack in the chosen
 * look (shotstack/looks.ts) after a short title cover. The narration goes up as one WAV, the pictures
 * are linked where they are filed, and Shotstack posts to SHOTSTACK_CALLBACK_PATH with this job's id
 * and token; that route copies the finished file in as "<id>/quote.mp4" and ends the clip as every
 * clip ends (finishVideo). The row is marked rendering before Shotstack is asked, as handOver does.
 */
async function cutWithShotstack(
  row: VideoRow & { input: PromptStoryInput }, agentName: string,
  c: { plans: ScenePlan[]; secs: number[]; total: number; pcms: Buffer[]; since: number },
  key: string, bar: Bar, lap: Lap,
): Promise<void> {
  const id = row.id;
  const input = row.input;
  const look = input.design as DesignLook;
  bar.note({ step: "files", done: 0, of: 0 });
  await upload(id, "voice.wav", mixNarration(c.pcms.map((pcm, i) => ({ pcm, at: c.plans[i].voiceAt })), c.total, TTS_RATE), "audio/wav");
  const pictures = input.pictures ?? [];
  const paths = [`${id}/voice.wav`, ...pictures.filter((x): x is string => Boolean(x))];
  const { data, error: e } = await bucket().createSignedUrls(paths, LINK_SECONDS);
  const urls = (data ?? []).map((d) => d.signedUrl);
  if (e || urls.length !== paths.length || urls.some((u) => !u)) throw new Error(`links: ${e?.message ?? "a link is missing"}`);
  let next = 1;
  const pictureLinks = pictures.map((p) => (p ? (urls[next++] as string) : null));
  const contact = await contactOf(row.agent_id, agentName);
  const narrator = narratorOf(input);
  const figure = figureLines(input)?.map((l) => l.text) ?? null;
  const at = DESIGN_COVER_SEC;
  const parts: DesignPart[] = [{ kind: "cover", start: 0, length: at + 0.4, title: input.title }];
  c.plans.forEach((plan, i) => {
    if (plan.key === "storyContact") {
      parts.push({
        kind: "contact", start: at + plan.start, length: plan.dur,
        greeting: `${row.customer_name ? `คุณ${row.customer_name} ` : ""}ทักมาคุยกันได้${narrator === "M" ? "นะครับ" : "นะคะ"}`,
        name: contact.name, reach: contact.line ? `LINE ${contact.line}` : contact.phone,
      });
      return;
    }
    const scene = input.scenes[i];
    if (!scene) return;
    parts.push({
      kind: "scene", start: at + plan.start, length: plan.dur, picture: pictureLinks[i] ?? null, text: scene.screen,
      ...(scene.showFigure && figure ? { lines: figure } : {}),
    });
  });
  const total = Math.round((at + c.total) * 1000) / 1000;
  const music = DESIGN_LOOKS.find((l) => l.id === look)?.music ?? "calm";
  const edit = designEdit({
    look, size: clipSize(input), total, voice: urls[0] as string, voiceAt: at,
    music: siteUrl(`/video/music-${music}.mp3`),
    fonts: { regular: siteUrl("/video/IBMPlexSansThai-Regular.ttf"), semibold: siteUrl("/video/IBMPlexSansThai-SemiBold.ttf") },
    parts,
  });
  lap(`voice and ${next - 1} pictures up for Shotstack (${look})`);
  bar.note({ step: "submit", done: 0, of: 0 });
  const jobId = randomUUID();
  const token = randomBytes(32).toString("hex");
  const callback = siteUrl(`${SHOTSTACK_CALLBACK_PATH}?job=${jobId}&token=${token}`);
  await bar.flush();
  const job = { id: jobId, tokenHash: hashToken(token), startedAt: new Date().toISOString() };
  const cost: CostParts = { ...(row.cost_parts ?? {}), engine: "shotstack", prepSec: secondsBetween(c.since, Date.now()) ?? undefined };
  // recorded before Shotstack is asked, so a callback that comes back at once finds it
  await setRow(id, { status: "rendering", duration_sec: total, cost_parts: cost, job });
  const sent = await submitRender(key, edit, callback);
  await setRow(id, { job: { ...job, render: sent.id, env: sent.env } });
  lap(`handed to Shotstack (${sent.env}, render ${sent.id})`);
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
  const gcpKey = await renderKeyOf(input);
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
