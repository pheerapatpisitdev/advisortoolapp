import { randomUUID } from "node:crypto";
import { CLIP_BUCKET, CLIP_MIN_SEC, type ClipEdit, type ClipVideo, type EditPass, type EngineName } from "@/lib/content/clip";
import { clipReadUrl, removeClip } from "@/lib/content/clip-store";
import { captionFlags, clipYardstick } from "@/lib/content/clip-transcribe";
import { modeChecks } from "@/lib/content/mode-checks";
import { THEMES, type Theme } from "@/lib/content/poster";
import { getContentUnscoped, listWords, type ContentItem } from "@/lib/content/store";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { settleLater } from "@/lib/wallet/round";
import { renderJob, type OverlayInput } from "./command";
import { avoidAfterFailure, JOB_BUSY, releaseSubmit, submitJob, submitting } from "./jobs";
import { renderHookPng, renderSubPng } from "./overlays";
import { styleLook } from "./styles";
import { keepRanges, keptDuration, subsOnOutput, type Span } from "./timeline";

/**
 * A clip's render, up to the moment a render service has it (owner, 2026-10-02): the checks
 * made before a round is taken, the words drawn as pictures, the job handed over with the round
 * recorded on it. Nothing here waits for the render — the poll and the webhook collect it
 * (jobs.ts) — so all of it fits well inside the 300 s an action may run.
 */

export const RENDER_DOWN = "ระบบตัดต่อขัดข้อง ลองใหม่ภายหลัง";
export const TOO_SHORT = "คลิปที่เหลือสั้นเกินไป — Reel ต้องยาวอย่างน้อย 3 วินาที";
export const NOT_PREPARED = "ยังเตรียมคลิปไม่เสร็จ — รอสักครู่แล้วลองใหม่";
export const CLIP_GONE = "ไฟล์คลิปหมดอายุแล้ว — แนบคลิปใหม่ก่อน";

/** where the words sit on the 1080×1920 frame, and how long the hook stays (owner's hand-cut clip, 2026-10-02) */
export const HOOK_Y = 230;
export const SUB_Y = 1450;
export const HOOK_SEC = 2.6;
/** the engine reads the clip and the pictures through links good for two hours; a job is bounded at 15 minutes */
export const LINK_SECONDS = 2 * 60 * 60;
/** pictures drawn and filed at once */
const AT_ONCE = 6;
const THB_PER_USD = 36;

/** what stays of the clip under this edit */
export const keepOf = (v: ClipVideo, edit: ClipEdit): Span[] =>
  keepRanges({ duration: v.durationSec, segments: v.transcript ?? [], cut: edit.cut, silences: edit.silences ?? [], trimSilence: edit.trimSilence });

/**
 * What a render costs, in baht, by the engine that takes it: Rendi bills $0.10 a GB through it
 * (the clip in, about 25MB out); our Lambda about $0.002 a run.
 */
export const renderCostThb = (sizeBytes: number): Record<EngineName, number> => ({
  rendi: ((sizeBytes + 25e6) / 1e9) * 0.10 * THB_PER_USD,
  lambda: 0.002 * THB_PER_USD,
});

/** The theme of the Page's latest poster — what the "page" style is drawn in; navy when it has none. */
export async function pageTheme(pageId: string | null): Promise<Theme> {
  if (!pageId) return "navy";
  try {
    const { data, error } = await supabaseAdmin().from("ins_content").select("output")
      .eq("page_id", pageId).not("output->poster", "is", null).order("created_at", { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    const theme = ((data ?? []) as { output: { poster?: { theme?: unknown } } | null }[])[0]?.output?.poster?.theme;
    return THEMES.includes(theme as Theme) ? (theme as Theme) : "navy";
  } catch (e) {
    console.error(`page ${pageId} theme not read:`, e instanceof Error ? e.message : e);
    return "navy";
  }
}

/** Why this edit cannot be rendered now, in the agent's words; null when it can. Made before any round is taken. */
export async function renderChecks(item: ContentItem): Promise<string | null> {
  const v = item.output.video;
  if (!v || v.expired) return CLIP_GONE;
  const edit = v.edit;
  if (!edit?.proxyPath || !edit.silences) return NOT_PREPARED;
  if (edit.job || submitting(edit)) return JOB_BUSY;
  if (keptDuration(keepOf(v, edit)) < CLIP_MIN_SEC) return TOO_SHORT;
  const hook = [edit.hook.top ?? "", edit.hook.main].join("\n").trim();
  if (hook) {
    // the hook is burned into the picture: what the rules block cannot be fixed after the render
    const flags = captionFlags(hook, clipYardstick(item), await listWords(), modeChecks(item.planHref, v.brief));
    const blocked = (flags.policy ?? []).find((f) => f.severity === "block");
    if (blocked) return `hook ผิดกฎโฆษณาของ Facebook: ${blocked.message} — แก้ก่อนสร้างคลิป`;
    const banned = flags.words.find((w) => w.kind === "banned");
    if (banned) return `hook มีคำที่ห้ามใช้ “${banned.word}” — แก้ก่อนสร้างคลิป`;
  }
  return null;
}

/** the items mapped, AT_ONCE at a time, in order */
async function inBatches<T, R>(items: T[], run: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += AT_ONCE) out.push(...(await Promise.all(items.slice(i, i + AT_ONCE).map(run))));
  return out;
}

/**
 * Draws the edit's words, files them beside the clip, and hands the render to a service with
 * the round (`pass`), the edit's rev and the cost estimate recorded on the job. The source is
 * the full-quality original, never the preview. `claim`: the caller's submit claim (claimSubmit).
 * Anything that stops it hands the round back, lets the claim and the pictures go, and throws
 * RENDER_DOWN. The piece as it now is.
 */
export async function startRender(item: ContentItem, pass: EditPass, claim?: string): Promise<ContentItem> {
  const uploaded: string[] = [];
  try {
    const v = item.output.video;
    const edit = v?.edit;
    if (!v || v.expired || !edit) throw new Error("no clip to render");
    const keep = keepOf(v, edit);
    const kept = keptDuration(keep);
    // a stored line made before lines knew their sentence belongs to none, and is never cut with one
    const subs = subsOnOutput(edit.subs.map((s) => ({ ...s, seg: s.seg ?? -1 })), keep, edit.cut);
    const look = styleLook(edit.style, await pageTheme(item.pageId));

    const pictures: { draw: () => Promise<Buffer>; y: number; from: number; to: number }[] = [];
    if (edit.hook.main.trim()) pictures.push({ draw: () => renderHookPng(edit.hook, look), y: HOOK_Y, from: 0, to: Math.min(HOOK_SEC, kept) });
    for (const s of subs) pictures.push({ draw: () => renderSubPng(s.text, look), y: SUB_Y, from: s.start, to: s.end });

    const bucket = supabaseAdmin().storage.from(CLIP_BUCKET);
    const overlays: OverlayInput[] = await inBatches(pictures, async (p) => {
      const png = await p.draw();
      const path = `${item.id}/${randomUUID()}.png`;
      const { error } = await bucket.upload(path, png, { contentType: "image/png", upsert: false });
      if (error) throw new Error(`picture not filed: ${error.message}`);
      uploaded.push(path);
      return { url: await clipReadUrl(path, LINK_SECONDS), y: p.y, from: p.from, to: p.to };
    });

    const job = renderJob(await clipReadUrl(v.path, LINK_SECONDS), keep, overlays);
    await submitJob(item.id, "render", job, await avoidAfterFailure(edit), { rev: edit.rev, pass, costThb: renderCostThb(v.sizeBytes), claim });
  } catch (e) {
    console.error(`render of ${item.id} not started:`, e instanceof Error ? e.message.replace(/https?:\/\/\S+/g, "<url>") : e);
    await settleLater(pass, false, 0);
    if (claim) await releaseSubmit(item.id, claim);
    for (const p of uploaded) await removeClip(p);
    throw new Error(RENDER_DOWN);
  }
  return (await getContentUnscoped(item.id).catch(() => null)) ?? item;
}
