import { createHash } from "node:crypto";
import { providerKey } from "@/lib/ai/client";
import { recordUsage } from "@/lib/ai/ledger";
import { asWho } from "@/lib/ai/who";
import { TtsQuotaError } from "@/lib/ai/tts";
import type { Viewer } from "@/lib/auth/access";
import { memberAccess, type MemberAccess } from "@/lib/members/access";
import { videosFrom } from "@/lib/members/pass";
import { releaseDraft } from "@/lib/prompt-story/drafts";
import { isPromptStory, type PromptStoryInput } from "@/lib/prompt-story/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderState, type ShotstackEnv } from "@/lib/shotstack/api";
import { releaseWallet, settleWallet } from "@/lib/wallet/store";
import { tellOwnerClipFailed } from "./fail-alert";
import type { FhcVideoInput } from "./fhc";
import { failReason, renderThbFor, secondsBetween, shotstackThbFor, type ClipEngine, type CostParts } from "./run-record";
import type { VideoInput } from "./script";
import type { StoryVideoInput } from "./story";
import { voiceDay, voiceFullText } from "./voice-quota";

/**
 * A วิดีโอนำเสนอ clip's row once it is asked for: reading it, its free clips, and its end — done,
 * failed or stuck — with the wallet settled (owner chose ก, 2026-10-19, mockup
 * https://claude.ai/artifact/7HwmKFHWKpBXwWncZQU9Nj). Kept apart from make.ts, which draws, so
 * /home, the wallet, the people history and the callback and sweep routes do not carry the
 * drawing, sharp and the story pictures in their functions.
 */

export const VIDEO_BUCKET = "quote-video";
export const VIDEO_TASK_RENDER = "quote-video-render";
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
/** a Cloud Run run of one clip: a couple of CPU-minutes, in baht */
const RENDER_COST_THB = 0.01 * 36;
/** a Remotion render (remotion.ts): about 80 s of 8 vCPU / 8 GiB at Cloud Run's list price, $0.0001920/s at 36 baht (trial 2026-10-17) */
const REMOTION_COST_THB = 80 * 0.000192 * 36;
export const FAILED = "ทำวิดีโอไม่สำเร็จ ลองใหม่อีกครั้ง";
/** a finished คลิปตามโจทย์ whose new cut failed: the clip as it was stands */
export const RECUT_FAILED = "ตัดคลิปใหม่ไม่สำเร็จ คลิปเดิมยังอยู่ ลองวาดใหม่อีกครั้ง";
/** every agent's free clips, once (owner, 2026-10-11); a member's pass carries its own (freeClips) */
export const FREE_VIDEOS = 2;

export type VideoStatus = "drawing" | "rendering" | "done" | "failed";
/** what a clip's row holds: a quote, an FHC summary (fhc.ts), or a คลิปเล่าเรื่อง (story.ts) */
export type ClipInput = VideoInput | FhcVideoInput | StoryVideoInput | PromptStoryInput;
export interface VideoRow {
  id: string;
  agent_id: string;
  created_at: string;
  updated_at: string;
  input: ClipInput;
  customer_name: string;
  status: VideoStatus;
  /** the render handed over; a ดีไซน์พิเศษ's also names Shotstack's render and the key's environment */
  job: { id: string; tokenHash: string; startedAt: string; render?: string; env?: "v1" | "stage" } | null;
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

export const rows = () => supabaseAdmin().from("ins_quote_videos");
export const bucket = () => supabaseAdmin().storage.from(VIDEO_BUCKET);
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

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
export async function freeUsed(agentId: string, from: Date | null, upTo?: string): Promise<number> {
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

/** the wallet's hold, if any, given back in full (a free คลิปตามโจทย์ holds its pictures) */
export async function release(row: Pick<VideoRow, "hold_id" | "paid_by">): Promise<void> {
  if (!row.hold_id) return;
  await releaseWallet(row.hold_id).catch((e) => console.error("quote video hold not released:", e));
}

export async function setRow(id: string, patch: Partial<VideoRow>): Promise<void> {
  const { error } = await rows().update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`video ${id} not updated: ${error.message}`);
}

/** a คลิปตามโจทย์'s pictures and voice, kept with a finished clip so one scene can be drawn again */
const KEPT = /\/(pic-\d+\.png|voice-\d+\.pcm|mov-\d+\.mp4)$/;

/** every file under the clip's folder but the finished video; `keep`: and the pictures and voice it can be cut again from */
export async function clearInputs(id: string, keep = false): Promise<void> {
  const { data } = await bucket().list(id, { limit: 1000 });
  const paths = (data ?? []).map((o) => `${id}/${o.name}`).filter((p) => !p.endsWith("/quote.mp4") && !(keep && KEPT.test(p)));
  for (let i = 0; i < paths.length; i += 100) await bucket().remove(paths.slice(i, i + 100)).catch(() => undefined);
}

export async function fail(id: string, why: unknown): Promise<void> {
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
    const said = (row.input as { engine?: unknown }).engine;
    const engine: ClipEngine = said === "remotion" || said === "shotstack" ? said : "ffmpeg";
    // the run's own seconds at its machine's rate (owner, 2026-10-20, ก: the fixed ฿0.55 was under
    // the ฿0.77 a clip averaged, and ฿1.87 for two minutes); the fixed figure only without a time.
    // Shotstack bills the clip's length instead (run-record.ts)
    const renderThb = engine === "shotstack" ? shotstackThbFor(Number(row.duration_sec ?? 0), row.job?.env)
      : renderSec !== null ? renderThbFor(engine, renderSec) : engine === "remotion" ? REMOTION_COST_THB : RENDER_COST_THB;
    await asWho(row.agent_id, () => recordUsage(engine === "shotstack" ? "shotstack" : "cloudrun", VIDEO_TASK_RENDER, 0, 0, renderThb));
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
    // the run's own seconds, priced at its machine's rate (run-record.ts), the same figure booked above
    const cost_parts: CostParts = { ...(row.cost_parts ?? {}), engine, ...(renderSec !== null ? { renderSec, renderThb } : {}) };
    await setRow(row.id, { cost_thb: cost, cost_parts, ...(charged !== null ? { charged_satang: charged } : {}), ...(input ? { input } : {}) }).catch(() => undefined);
    await clearInputs(row.id, isPromptStory(row.input));
  } else {
    await fail(row.id, new Error(jobError ? `render failed: ${jobError}` : "render failed"));
  }
}

/**
 * A ดีไซน์พิเศษ's render, asked of Shotstack itself (never a posted body's word): done, its file is
 * copied in as "<id>/quote.mp4" and the clip ends as every clip does (finishVideo); failed, the clip
 * fails and its hold goes back; still working, nothing. The callback route and the sweep both come
 * here. `render`: Shotstack's id when the row has not kept it yet (a callback faster than the row).
 * Returns whether the clip has ended.
 */
export async function collectShotstack(row: VideoRow, render?: string): Promise<boolean> {
  if (row.status !== "rendering") return false;
  const id = row.job?.render ?? render;
  if (!id) return false;
  const key = await providerKey("shotstack");
  if (!key) throw new Error("no shotstack key");
  const envs: ShotstackEnv[] = row.job?.env ? [row.job.env] : ["v1", "stage"];
  let state: Awaited<ReturnType<typeof renderState>> | null = null;
  let env: ShotstackEnv | undefined;
  for (const e of envs) {
    try {
      state = await renderState(key, e, id);
      env = e;
      break;
    } catch (err) {
      if (e === envs[envs.length - 1]) throw err;
    }
  }
  if (!state || state.status === "working") return false;
  const known = env && !row.job?.env && row.job ? { ...row, job: { ...row.job, render: id, env } } : row;
  if (state.status === "failed") {
    await finishVideo(known, "failed", undefined, `Shotstack: ${state.error}`.slice(0, 300));
    return true;
  }
  const res = await fetch(state.url, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`Shotstack file not read (${res.status})`);
  const file = Buffer.from(await res.arrayBuffer());
  const path = `${row.id}/quote.mp4`;
  const { error } = await bucket().upload(path, file, { contentType: "video/mp4", upsert: true });
  if (error) throw new Error(`Shotstack file not kept: ${error.message}`);
  await finishVideo(known, "done", path);
  return true;
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
  const { data, error } = await rows().select("id, status, video_path, created_at, updated_at, job, input")
    .in("status", ["drawing", "rendering"]).is("deleted_at", null)
    .lt("created_at", new Date(now - VIDEO_TIMEOUT_MS).toISOString()).limit(100);
  if (error) throw new Error(`stuck videos not read: ${error.message}`);
  let n = 0;
  for (const v of (data ?? []) as Pick<VideoRow, "id" | "status" | "video_path" | "created_at" | "updated_at" | "job" | "input">[]) {
    if (!isStuck(v, now)) continue;
    // a ดีไซน์พิเศษ whose callback never came: Shotstack is asked before the clip is failed
    if (v.status === "rendering" && v.job?.render) {
      const full = await rows().select("*").eq("id", v.id).maybeSingle<VideoRow>().then((r) => r.data ?? null, () => null);
      if (full && (await collectShotstack(full).catch((e) => { console.error(`shotstack ${v.id}: not collected:`, e instanceof Error ? e.message : e); return false; }))) continue;
    }
    await fail(v.id, new Error("timed out"));
    n++;
  }
  return n;
}

/**
 * Some of an agent's clips, as much as a board waiting on them needs (clipsMaking); one stuck past
 * its time is failed on the way, as listVideos does.
 */
export async function clipStates(agentId: string, ids: string[]): Promise<Pick<VideoRow, "id" | "status" | "video_path" | "created_at" | "updated_at" | "job" | "progress" | "input">[]> {
  const { data, error } = await rows().select("id, status, video_path, created_at, updated_at, job, progress, input")
    .eq("agent_id", agentId).in("id", ids).is("deleted_at", null);
  if (error) throw new Error(`clip states not read: ${error.message}`);
  const list = (data ?? []) as Pick<VideoRow, "id" | "status" | "video_path" | "created_at" | "updated_at" | "job" | "progress" | "input">[];
  const now = Date.now();
  for (const v of list) {
    if (isStuck(v, now)) {
      await fail(v.id, new Error("timed out"));
      v.status = "failed";
    }
  }
  return list;
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
