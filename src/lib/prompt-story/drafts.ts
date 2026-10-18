import { supabaseAdmin } from "@/lib/supabase/admin";

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
