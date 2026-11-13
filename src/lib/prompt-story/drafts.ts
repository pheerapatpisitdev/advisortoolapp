import { supabaseAdmin } from "@/lib/supabase/admin";
import { REWRITES_DONE, REWRITES_PER_DRAFT } from "./checked";
import type { PromptScene } from "./types";

const drafts = () => supabaseAdmin().from("ins_prompt_drafts");

/** keep a written script, or a refused brief as `{ refused: true, refusal }` (counted toward the hour, never made into a clip); returns the draft's id */
export async function saveDraft(agentId: string, brief: unknown, script: unknown): Promise<string> {
  const { data, error } = await drafts().insert({ agent_id: agentId, brief, script }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "บันทึกบทไม่สำเร็จ");
  return (data as { id: string }).id;
}

/** a draft's script written once the AI answered (writePromptStory took the row first, as `{ pending: true }`) */
export async function writeDraft(id: string, script: unknown): Promise<void> {
  const { error } = await drafts().update({ script }).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * The hour's scripts up to and including this draft's row: the presses before it, not after, so
 * of two at once on the 20th the first goes through and the second is turned away.
 */
export async function draftsUpTo(agentId: string, id: string): Promise<number> {
  const { data: own, error: e1 } = await drafts().select("created_at").eq("id", id).maybeSingle();
  if (e1 || !own) throw new Error(e1?.message ?? "draft not read");
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error } = await drafts().select("id", { count: "exact", head: true }).eq("agent_id", agentId)
    .gte("created_at", since).lte("created_at", (own as { created_at: string }).created_at);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** a draft row taken over the hour's cap, given back */
export async function dropDraft(id: string): Promise<void> {
  const { error } = await drafts().delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * The draft taken for one clip, in one conditional update: true only for the agent's own draft not
 * yet made into a clip. A second press, or someone else's draft, gets false.
 */
export async function claimDraft(agentId: string, draftId: string, clipId: string): Promise<boolean> {
  const { data, error } = await drafts().update({ made_clip_id: clipId })
    .eq("id", draftId).eq("agent_id", agentId).is("made_clip_id", null).select("id").maybeSingle();
  if (error) throw new Error(`draft not claimed: ${error.message}`);
  return Boolean(data);
}

/** the draft given back, only if it is still held by this clip */
export async function releaseDraft(draftId: string, clipId: string): Promise<void> {
  const { error } = await drafts().update({ made_clip_id: null }).eq("id", draftId).eq("made_clip_id", clipId);
  if (error) console.error("draft not given back:", error.message);
}

export type TakenRewrite =
  | { ok: true; asked: Record<string, unknown>; scenes: PromptScene[]; n: number }
  | { ok: false; error: string };

const NO_DRAFT = "ไม่พบบทนี้ ลองเขียนบทใหม่อีกครั้ง";

/**
 * One of a draft's REWRITES_PER_DRAFT scene rewrites (เขียนฉากนี้ใหม่), taken before the AI is asked.
 * The count is kept in the draft's own script as `rewrites` (no column, no migration) and moved on by
 * one conditional update that matches the count just read: of two presses at once only one update
 * matches, the other reads again and sees the new count. Only the agent's own written draft, not yet
 * made into a clip, and a scene it has.
 */
export async function takeRewrite(agentId: string, id: string, scene: number): Promise<TakenRewrite> {
  for (let tries = 0; tries < 3; tries++) {
    const { data, error } = await drafts().select("brief, script, made_clip_id").eq("id", id).eq("agent_id", agentId).maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as { brief: unknown; script: unknown; made_clip_id: string | null } | null;
    const script = (row?.script ?? null) as Record<string, unknown> | null;
    // a pending or refused draft has no scenes
    if (!row || !script || typeof script !== "object" || !Array.isArray(script.scenes)) return { ok: false, error: NO_DRAFT };
    if (row.made_clip_id) return { ok: false, error: "บทนี้ทำเป็นคลิปไปแล้ว" };
    if (!Number.isInteger(scene) || scene < 0 || scene >= script.scenes.length) return { ok: false, error: "ไม่พบฉากนี้" };
    const seen = typeof script.rewrites === "number" ? script.rewrites : null;
    const n = seen ?? 0;
    if (n >= REWRITES_PER_DRAFT) return { ok: false, error: REWRITES_DONE };
    const q = drafts().update({ script: { ...script, rewrites: n + 1 } }).eq("id", id).eq("agent_id", agentId).is("made_clip_id", null);
    const { data: won, error: e2 } = await (seen === null ? q.is("script->>rewrites", null) : q.eq("script->>rewrites", String(seen))).select("id").maybeSingle();
    if (e2) throw new Error(e2.message);
    if (won) {
      const asked = row.brief && typeof row.brief === "object" ? (row.brief as Record<string, unknown>) : {};
      return { ok: true, asked, scenes: script.scenes as PromptScene[], n: n + 1 };
    }
  }
  return { ok: false, error: "กดเขียนฉากใหม่ซ้อนกัน ลองอีกครั้ง" };
}

/** the rewritten scene put in the draft (the next rewrite reads it), unless a later rewrite was taken since */
export async function keepRewrite(agentId: string, id: string, n: number, scene: number, written: PromptScene): Promise<void> {
  const { data, error } = await drafts().select("script").eq("id", id).eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(error.message);
  const script = ((data as { script?: unknown } | null)?.script ?? null) as Record<string, unknown> | null;
  if (!script || !Array.isArray(script.scenes) || script.rewrites !== n) return;
  const scenes = [...script.scenes];
  scenes[scene] = written;
  const { error: e2 } = await drafts().update({ script: { ...script, scenes } }).eq("id", id).eq("agent_id", agentId).eq("script->>rewrites", String(n));
  if (e2) throw new Error(e2.message);
}
