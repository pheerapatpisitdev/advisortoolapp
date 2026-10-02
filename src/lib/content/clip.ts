import type { ContentOutput } from "./output";
import { footer } from "./output";
import type { PieceFormat } from "./prompt";
import type { ContentItem, Flags } from "./store";

/**
 * A clip an agent filmed and uploads to post as a Reel (owner, 2026-10-02): the rules a file
 * must meet, where it is filed, and what goes to Facebook with it. No I/O here — the browser
 * checks a file with the same clipProblem the server checks it with again.
 */

export const CLIP_BUCKET = "content-video";
/** the plan_href of a clip uploaded on its own, and the name the workbench shows for it */
export const CLIP_HREF = "clip";
export const CLIP_NAME = "คลิป";
/** 300MB: a 90-second phone clip at 1080p is 15–30MB; 4K runs to hundreds (owner chose 300, 2026-10-02) */
export const CLIP_MAX_BYTES = 300 * 1024 * 1024;
/** Reels take 3 to 90 seconds (Facebook's Reels publishing guide) */
export const CLIP_MIN_SEC = 3;
export const CLIP_MAX_SEC = 90;
/** an edited Reel is at most a minute (owner, 2026-10-02); the clip filmed may run to CLIP_MAX_SEC */
export const MAX_EDITED_SECONDS = 60;
/** a clip never scheduled keeps its file this long; then the sweep lets it go (owner, 2026-10-02) */
export const CLIP_DRAFT_DAYS = 60;
export const MAX_CLIP_BRIEF = 300;
export const MAX_CAPTION = 2200;

const EXT: Record<string, "mp4" | "mov"> = { "video/mp4": "mp4", "video/quicktime": "mov" };
export const CLIP_MIMES = Object.keys(EXT);

export interface ClipFile {
  sizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
  mime: string;
}

/** a stretch of speech, in seconds from the start of the clip */
export interface Segment {
  start: number;
  end: number;
  text: string;
  /** the listener thinks it should go (a filler, a retake); the agent decides */
  cut?: boolean;
  why?: string;
}

/** something said in the clip the checks would flag in a post — said, never blocked (owner, 2026-10-02) */
export interface SpokenFlag {
  at: number;
  kind: "word" | "number" | "policy";
  text: string;
  message: string;
}

/** the look of the words laid on a clip (owner, 2026-10-02: four ready styles, no free styling) */
export type ClipStyle = "box" | "outline" | "yellow" | "page";
export const CLIP_STYLES: readonly ClipStyle[] = ["box", "outline", "yellow", "page"];
export interface Hook { top?: string; main: string }
export const MAX_HOOK_MAIN = 28;
export const MAX_HOOK_TOP = 24;
export type EngineName = "rendi" | "lambda";
/** who pays for a render, kept on the job so the round is settled when the job ends */
export type EditPass =
  | { paidBy: "staff" }
  | { paidBy: "free"; auditId: number }
  | { paidBy: "wallet"; holdId: string; heldSatang: number; multiplier: number };
export interface EditJob {
  kind: "prepare" | "render";
  engine: EngineName;
  id: string;
  startedAt: string;
  /** sha256 (hex) of the secret a webhook for this job must carry; the secret itself goes only to the engine */
  tokenHash: string;
  /** where an engine that writes our storage itself (Lambda) was told to put each output, by alias; a callback must name exactly these */
  dest?: Record<string, string>;
  /** the edit a render was made from */
  rev?: string;
  pass?: EditPass;
  /** the job's estimated cost, for the round's charge */
  costThb?: number;
  /** engines already asked for this job, so a retry goes to the other */
  tried: EngineName[];
  /** when a poll or a webhook claimed the finished job to collect it (src/lib/video/jobs.ts); others leave it alone */
  collecting?: string;
}
/** An agent's edit of a clip (owner, 2026-10-02): what is cut, the subtitles, the hook, the look. */
export interface ClipEdit {
  proxyPath?: string;
  silences?: [number, number][];
  cut: number[];
  trimSilence: boolean;
  /** `seg`: the sentence (transcript index) a line was made from, so a cut sentence's lines go with it */
  subs: { start: number; end: number; text: string; seg?: number }[];
  hook: Hook;
  style: ClipStyle;
  rev: string;
  job?: EditJob | null;
  /**
   * A submit under way (src/lib/video/jobs.ts claimSubmit): written, guarded on the row's rev,
   * before an engine is asked, so two presses at once cannot both send a job (or both pay).
   * One older than SUBMIT_STALE_MS was left by a request that died and counts for nothing.
   */
  submitting?: { id: string; at: string; kind: EditJob["kind"] };
  /** the engine the last job failed on, so the next one goes to the other when there is one */
  failedOn?: EngineName;
  renderedPath?: string;
  renderedAt?: string;
  renderedRev?: string;
  error?: string;
}
/** a job that has not answered for this long has failed; the wallet hands a hold back at the same 15 minutes */
export const EDIT_JOB_TIMEOUT_MS = 15 * 60_000;

export interface ClipVideo {
  /** "<piece id>/<file id>.<ext>" in content-video */
  path: string;
  /** the sweep removed the file; the caption and the transcript stay */
  expired?: boolean;
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number;
  mime: string;
  uploadedAt: string;
  /** what the agent said the clip is about, for a clip uploaded on its own */
  brief?: string;
  /** absent: not transcribed yet, or the last try failed (transcribeFailed) */
  transcript?: Segment[];
  transcribeFailed?: boolean;
  /** the Reel's words; the agent edits them */
  caption: string;
  /** the caption's checks — what clear() reads for a Reel, never item.flags (a script's own) */
  flags: Flags;
  spokenFlags?: SpokenFlag[];
  /** the hook the listener suggested */
  hookSuggestion?: Hook;
  edit?: ClipEdit;
}

/**
 * A piece as the browser may see it: the clip's job without its round (a wallet hold's id),
 * its webhook secret's hash or the paths a render service was told to write. Every answer to
 * a person that carries a piece goes through this; the server's own reads keep them.
 */
export function forClient(item: ContentItem): ContentItem {
  const v = item.output?.video;
  const job = v?.edit?.job;
  if (!v?.edit || !job) return item;
  const shown: Partial<EditJob> = { ...job };
  delete shown.pass;
  delete shown.tokenHash;
  delete shown.dest;
  // the browser's copy only: it never goes back into a write (the server reads the row again)
  return { ...item, output: { ...item.output, video: { ...v, edit: { ...v.edit, job: shown as EditJob } } } };
}

/** every file a clip keeps in content-video: the clip, its preview, its edited take */
export function clipFiles(v: ClipVideo): string[] {
  return [v.path, v.edit?.proxyPath, v.edit?.renderedPath].filter((p): p is string => Boolean(p));
}

/** Why a file cannot be a Reel, in the agent's words; null when it can. */
export function clipProblem(f: ClipFile): string | null {
  if (!EXT[f.mime]) return "รับเฉพาะไฟล์ .mp4 หรือ .mov";
  if (!(f.sizeBytes > 0)) return "ไฟล์ว่าง — เลือกไฟล์ใหม่นะครับ";
  if (f.sizeBytes > CLIP_MAX_BYTES) return "ไฟล์ใหญ่เกิน 300MB — ตั้งกล้องถ่ายที่ 1080p แทน 4K แล้วลองใหม่";
  if (!Number.isFinite(f.durationSec) || f.durationSec <= 0) return "อ่านความยาวคลิปไม่ได้ — ลองบันทึกคลิปใหม่จากแอปกล้อง";
  if (f.durationSec < CLIP_MIN_SEC) return "คลิปสั้นเกินไป — Reel ต้องยาวอย่างน้อย 3 วินาที";
  // a phone's 90-second clip reads 90.3 now and then; Facebook counts whole seconds
  if (f.durationSec > CLIP_MAX_SEC + 0.5) return "คลิปยาวเกิน 90 วินาที — ตัดให้สั้นลงก่อนแล้วอัปโหลดใหม่";
  if (!(f.width > 0 && f.height > 0)) return "อ่านขนาดภาพของคลิปไม่ได้ — ลองบันทึกคลิปใหม่จากแอปกล้อง";
  if (f.height <= f.width) return "คลิปต้องเป็นแนวตั้ง (9:16) — Reel ไม่รับคลิปแนวนอน";
  return null;
}

export function clipPath(pieceId: string, mime: string): string {
  return `${pieceId}/${crypto.randomUUID()}.${EXT[mime] ?? "mp4"}`;
}

/** only a file filed under this piece, in the shape clipPath makes */
export function isClipPath(pieceId: string, path: string): boolean {
  const [dir, file, ...rest] = path.split("/");
  return rest.length === 0 && dir === pieceId && /^[0-9a-f-]{36}\.(mp4|mov)$/.test(file ?? "");
}

export const NO_FLAGS: Flags = { numbers: [], words: [], policy: [], fixes: null };

/** a clip piece's output: no words of the writer's, only the clip and its caption */
export function clipOutput(disclaimer = ""): ContentOutput {
  return { hooks: [], body: "", closing: "", hashtags: [], imagePrompt: "", disclaimer };
}

/** What goes up with the Reel: the caption, then the footer every post carries (output.ts). */
export function reelDescription(o: ContentOutput): string {
  const caption = (o.video?.caption ?? "").trim();
  return [caption, footer({ hooks: [], body: caption, closing: "", disclaimer: o.disclaimer ?? "" })].filter(Boolean).join("\n\n");
}

export function clockOf(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** What the agent confirms before a Reel goes: each thing said that a post would be flagged for, or that nobody has listened. */
export function spokenNotes(v: ClipVideo): string[] {
  if (!v.transcript) return ["ยังไม่ได้ตรวจเสียงพูดในคลิป"];
  return (v.spokenFlags ?? []).map((f) => `${clockOf(f.at)} ${f.message}`);
}

export function isReelPiece(item: { format: PieceFormat; output: ContentOutput }): boolean {
  return item.format === "clip" || Boolean(item.output.video);
}
