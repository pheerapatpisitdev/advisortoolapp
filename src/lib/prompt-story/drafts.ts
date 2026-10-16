import { supabaseAdmin } from "@/lib/supabase/admin";

const drafts = () => supabaseAdmin().from("ins_prompt_drafts");

/** keep a written script, or a refused brief as `{ refused: true, refusal }` (counted toward the hour, never made into a clip); returns the draft's id */
export async function saveDraft(agentId: string, brief: unknown, script: unknown): Promise<string> {
  const { data, error } = await drafts().insert({ agent_id: agentId, brief, script }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "บันทึกบทไม่สำเร็จ");
  return (data as { id: string }).id;
}

/** how many scripts this person asked for in the last rolling hour, refused ones too */
export async function draftsLastHour(agentId: string): Promise<number> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error } = await drafts().select("id", { count: "exact", head: true }).eq("agent_id", agentId).gte("created_at", since);
  if (error) throw new Error(error.message);
  return count ?? 0;
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
