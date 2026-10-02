"use server";

import { randomUUID } from "node:crypto";
import {
  CLIP_STYLES, forClient, MAX_HOOK_MAIN, MAX_HOOK_TOP,
  type ClipEdit, type ClipStyle, type ClipVideo, type EditPass, type Hook,
} from "@/lib/content/clip";
import { clipReadUrl, removeClip } from "@/lib/content/clip-store";
import { onPage } from "@/lib/content/publish-label";
import { getContent, saveOutputIf, type ContentItem } from "@/lib/content/store";
import { requireMember } from "@/lib/auth/viewer";
import { limiter } from "@/lib/assistant/rate-limit";
import { ceilingBeforeRound } from "@/lib/content/ceiling";
import { takeRound } from "@/lib/auth/quota";
import { prepareJob } from "@/lib/video/command";
import { avoidAfterFailure, checkJob, claimSubmit, JOB_BUSY, releaseSubmit, submitJob, submitting } from "@/lib/video/jobs";
import { CLIP_GONE, LINK_SECONDS, NOT_PREPARED, pageTheme, RENDER_DOWN, renderChecks, renderCostThb, startRender } from "@/lib/video/render-run";
import type { Theme } from "@/lib/content/poster";

/**
 * The agent's clip editor, on the server (owner, 2026-10-02): open it (the preview is made, free),
 * save what is cut and what the words say, render the Reel (a paid "ai-edit" round), or go back
 * to the original. Every answer carries the piece through forClient: the job's round, webhook
 * secret hash and storage paths stay on the server.
 */

export type EditResult = { ok: true; item: ContentItem } | { ok: false; error: string };
export interface EditPatch {
  cut?: number[];
  trimSilence?: boolean;
  subs?: { start: number; end: number; text: string; seg?: number }[];
  hook?: Hook;
  style?: ClipStyle;
}

const READ_FAILED = "อ่านชิ้นงานไม่ได้ ลองใหม่อีกครั้งนะครับ";
const NO_CLIP = "ชิ้นนี้ยังไม่มีคลิป";
const NOT_HEARD = "ถอดเสียงก่อนแล้วค่อยตัดต่อ";
/** both ffmpeg commands need the clip's sound (command.ts), and a clip nobody speaks in has no subtitles to edit */
const NO_SPEECH = "คลิปนี้ไม่มีเสียงพูด — ตัดต่อซับไม่ได้";
const HELD = "Reel นี้ตั้งเวลาหรือลงเพจแล้ว — ยกเลิกคิวก่อนตัดต่อ";
const BAD_PATCH = "ข้อมูลการตัดต่อไม่ถูกต้อง — โหลดหน้าใหม่แล้วลองอีกครั้ง";
const CUT_RANGE = "ประโยคที่เลือกตัดไม่มีในคลิปนี้ — โหลดหน้าใหม่แล้วลองอีกครั้ง";
const RACED = "มีการแก้คลิปนี้พร้อมกันอยู่ — โหลดหน้าใหม่แล้วลองอีกครั้ง";
const MAX_SUBS = 200;
const MAX_SUB_TEXT = 120;

/** a preview is free to the agent but not to the owner: five a piece an hour is room for any retry */
const preparesPerHour = limiter(5, 60 * 60_000);
const PREPARES_SPENT = "เตรียมคลิปนี้ครบ 5 ครั้งในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ";

const answer = (item: ContentItem): EditResult => ({ ok: true, item: forClient(item) });
const len = (s: string) => [...s].length;

type Guarded = { ok: true; item: ContentItem; video: ClipVideo } | { ok: false; error: string };

/**
 * Every action's guards: the asker's piece, with a clip whose file is still there (an expired
 * clip mints no link to a file the sweep removed), that was listened to and has speech in it,
 * and — unless `held` is false — not held by the Page.
 */
async function guarded(id: string, held = true): Promise<Guarded> {
  const item = await getContent(id).catch(() => undefined);
  if (item === undefined) return { ok: false, error: READ_FAILED };
  const video = item?.output.video;
  if (!item || !video) return { ok: false, error: NO_CLIP };
  if (video.expired) return { ok: false, error: CLIP_GONE };
  if (!video.transcript) return { ok: false, error: NOT_HEARD };
  if (video.transcript.length === 0) return { ok: false, error: NO_SPEECH };
  if (held && onPage(item.publish)) return { ok: false, error: HELD };
  return { ok: true, item, video };
}

/**
 * เปิดหน้าตัดต่อ: a clip with no preview yet gets one made — free, no round (owner, 2026-10-02).
 * A job already running is asked after instead; a submit another request holds is waited for.
 */
export async function openEdit(id: string): Promise<EditResult> {
  await requireMember();
  const g = await guarded(id);
  if (!g.ok) return g;
  const { item, video } = g;
  try {
    if (video.edit?.job) return answer((await checkJob(id)).item);
    if (submitting(video.edit) || (video.edit?.proxyPath && video.edit.silences)) return answer(item);
    if (!preparesPerHour(`prepare:${id}`)) return { ok: false, error: PREPARES_SPENT };
    const claimed = await claimSubmit(item, "prepare");
    // another press got there first: the piece as it now is, with its claim (or its job) on it
    if (typeof claimed === "string") return answer((await getContent(id)) ?? item);
    try {
      const job = prepareJob(await clipReadUrl(video.path, LINK_SECONDS));
      // free to the agent, not to the owner: its estimate goes to the usage ledger when it is delivered (jobs.ts)
      await submitJob(id, "prepare", job, await avoidAfterFailure(claimed.item.output.video?.edit), { claim: claimed.claim, costThb: renderCostThb(video.sizeBytes) });
    } catch (e) {
      console.error(`prepare of ${id} not started:`, e instanceof Error ? e.message.replace(/https?:\/\/\S+/g, "<url>") : e);
      await releaseSubmit(id, claimed.claim);
      return { ok: false, error: RENDER_DOWN };
    }
    return answer((await getContent(id)) ?? claimed.item);
  } catch (e) {
    console.error(`edit of ${id} not opened:`, e);
    return { ok: false, error: RENDER_DOWN };
  }
}

/**
 * The theme the "สีของเพจ" look is drawn in — the Page's latest poster's, as the render reads it
 * (render-run.ts pageTheme) — so the editor's preview shows the colours the Reel will carry.
 * Only for someone who may see the piece; navy otherwise.
 */
export async function editTheme(id: string): Promise<Theme> {
  await requireMember();
  const item = await getContent(id).catch(() => null);
  return item ? pageTheme(item.pageId) : "navy";
}

/**
 * The edit page's poll: collects a job that has finished. Not refused for a held Reel — the Reel
 * went up with the file it had, and a job left uncollected would never settle its round.
 */
export async function pollEdit(id: string): Promise<EditResult> {
  await requireMember();
  const g = await guarded(id, false);
  if (!g.ok) return g;
  if (!g.video.edit?.job) return answer(g.item);
  try {
    return answer((await checkJob(id)).item);
  } catch (e) {
    console.error(`edit of ${id} not polled:`, e);
    return { ok: false, error: RENDER_DOWN };
  }
}

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const isIndex = (n: unknown, count: number): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < count;

/** the patch checked against the clip: each part given, in range and within its limits */
function cleanPatch(patch: EditPatch, v: ClipVideo): { ok: true; value: Partial<ClipEdit> } | { ok: false; error: string } {
  if (!patch || typeof patch !== "object") return { ok: false, error: BAD_PATCH };
  const sentences = v.transcript?.length ?? 0;
  const value: Partial<ClipEdit> = {};
  if (patch.cut !== undefined) {
    if (!Array.isArray(patch.cut)) return { ok: false, error: BAD_PATCH };
    if (!patch.cut.every((i) => isIndex(i, sentences))) return { ok: false, error: CUT_RANGE };
    value.cut = [...new Set(patch.cut)].sort((a, b) => a - b);
  }
  if (patch.trimSilence !== undefined) {
    if (typeof patch.trimSilence !== "boolean") return { ok: false, error: BAD_PATCH };
    value.trimSilence = patch.trimSilence;
  }
  if (patch.subs !== undefined) {
    if (!Array.isArray(patch.subs)) return { ok: false, error: BAD_PATCH };
    if (patch.subs.length > MAX_SUBS) return { ok: false, error: `ซับได้ไม่เกิน ${MAX_SUBS} บรรทัด` };
    const subs: ClipEdit["subs"] = [];
    for (const s of patch.subs) {
      if (!s || typeof s !== "object" || typeof s.text !== "string" || !isNum(s.start) || !isNum(s.end)) return { ok: false, error: BAD_PATCH };
      if (s.start < 0 || s.end <= s.start || s.start >= v.durationSec) return { ok: false, error: BAD_PATCH };
      if (s.seg !== undefined && !isIndex(s.seg, sentences)) return { ok: false, error: BAD_PATCH };
      const text = s.text.trim();
      if (len(text) > MAX_SUB_TEXT) return { ok: false, error: `ซับแต่ละบรรทัดยาวได้ไม่เกิน ${MAX_SUB_TEXT} ตัวอักษร` };
      // a line emptied in the editor is a line taken out
      if (!text) continue;
      subs.push({ start: s.start, end: Math.min(s.end, v.durationSec), text, ...(s.seg !== undefined ? { seg: s.seg } : {}) });
    }
    value.subs = subs.sort((a, b) => a.start - b.start);
  }
  if (patch.hook !== undefined) {
    const h = patch.hook;
    if (!h || typeof h !== "object" || typeof h.main !== "string" || (h.top !== undefined && typeof h.top !== "string")) return { ok: false, error: BAD_PATCH };
    const main = h.main.trim();
    const top = (h.top ?? "").trim();
    if (len(main) > MAX_HOOK_MAIN) return { ok: false, error: `hook ยาวได้ไม่เกิน ${MAX_HOOK_MAIN} ตัวอักษร` };
    if (len(top) > MAX_HOOK_TOP) return { ok: false, error: `ข้อความบน hook ยาวได้ไม่เกิน ${MAX_HOOK_TOP} ตัวอักษร` };
    value.hook = { ...(top ? { top } : {}), main };
  }
  if (patch.style !== undefined) {
    if (!CLIP_STYLES.includes(patch.style)) return { ok: false, error: BAD_PATCH };
    value.style = patch.style;
  }
  return { ok: true, value };
}

/** The agent's changes to the edit, checked and kept with a new rev. Not while a render is being made. */
export async function saveEdit(id: string, patch: EditPatch): Promise<EditResult> {
  await requireMember();
  try {
    // a save can race a job's write: read again and build on that, up to three times
    for (let attempt = 0; attempt < 3; attempt++) {
      const g = await guarded(id);
      if (!g.ok) return g;
      const { item, video } = g;
      const edit = video.edit;
      if (!edit?.proxyPath || !edit.silences) return { ok: false, error: NOT_PREPARED };
      if (edit.job || submitting(edit)) return { ok: false, error: JOB_BUSY };
      const clean = cleanPatch(patch, video);
      if (!clean.ok) return clean;
      const next: ClipEdit = { ...edit, ...clean.value, rev: randomUUID() };
      const saved = await saveOutputIf(id, { ...item.output, video: { ...video, edit: next } }, undefined, item.output.rev ?? null);
      if (saved) return answer(saved);
    }
    return { ok: false, error: RACED };
  } catch (e) {
    console.error(`edit of ${id} not saved:`, e);
    return { ok: false, error: "บันทึกการตัดต่อไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

/**
 * สร้างคลิป: the checks first, then the claim (so two presses cannot both send a job or both
 * pay), then the round, then the render handed over with the round on it. A refusal before
 * the round costs nothing; a render that is not handed over gives the round back (startRender).
 */
export async function renderEdit(id: string): Promise<EditResult> {
  const viewer = await requireMember();
  const g = await guarded(id);
  if (!g.ok) return g;
  try {
    const refusal = await renderChecks(g.item);
    if (refusal) return { ok: false, error: refusal };
    const ceiling = await ceilingBeforeRound(viewer);
    if (ceiling !== null) return { ok: false, error: `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${ceiling} บาทแล้ว` };
    const claimed = await claimSubmit(g.item, "render", g.video.edit!.rev);
    if (claimed === "busy") return { ok: false, error: JOB_BUSY };
    if (claimed === "moved") return { ok: false, error: RACED };
    // a send may have claimed the Reel since it was read: the row as the claim wrote it says so.
    // send() looks for a render claim after its own claim too, so one of the two always sees the other
    if (onPage(claimed.item.publish)) {
      await releaseSubmit(id, claimed.claim);
      return { ok: false, error: HELD };
    }
    const round = await takeRound(viewer, "ai-edit", id).catch(async (e) => {
      await releaseSubmit(id, claimed.claim);
      throw e;
    });
    if (!round.ok) {
      await releaseSubmit(id, claimed.claim);
      return { ok: false, error: round.refusal };
    }
    // the round as the job keeps it, to be settled when the render ends
    const pass: EditPass = round.paidBy === "wallet"
      ? { paidBy: "wallet", holdId: round.holdId, heldSatang: round.heldSatang, multiplier: round.multiplier }
      : round.paidBy === "free" ? { paidBy: "free", auditId: round.auditId } : { paidBy: "staff" };
    return answer(await startRender(claimed.item, pass, claimed.claim));
  } catch (e) {
    console.error(`render of ${id} not made:`, e instanceof Error ? e.message : e);
    return { ok: false, error: RENDER_DOWN };
  }
}

/** ใช้คลิปต้นฉบับ: the edited take is let go (its file too), so the Reel goes up as it was filmed. */
export async function useOriginal(id: string): Promise<EditResult> {
  await requireMember();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const g = await guarded(id);
      if (!g.ok) return g;
      const { item, video } = g;
      const edit = video.edit;
      if (!edit?.renderedPath) return answer(item);
      // a render on its way would bring an edited take straight back
      if (edit.job || submitting(edit)) return { ok: false, error: JOB_BUSY };
      const old = edit.renderedPath;
      const next: ClipEdit = { ...edit, renderedPath: undefined, renderedAt: undefined, renderedRev: undefined };
      // only while no send has claimed the Reel since it was read: one may be handing Facebook this very take
      const saved = await saveOutputIf(id, { ...item.output, video: { ...video, edit: next } }, undefined, item.output.rev ?? null, item.publish);
      if (!saved) continue;
      await removeClip(old);
      return answer(saved);
    }
    return { ok: false, error: RACED };
  } catch (e) {
    console.error(`original of ${id} not restored:`, e);
    return { ok: false, error: "เปลี่ยนกลับเป็นคลิปต้นฉบับไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
