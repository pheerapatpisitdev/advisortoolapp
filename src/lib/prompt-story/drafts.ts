import { supabaseAdmin } from "@/lib/supabase/admin";

const drafts = () => supabaseAdmin().from("ins_prompt_drafts");

/** keep a written script; returns the draft's id */
export async function saveDraft(agentId: string, brief: unknown, script: unknown): Promise<string> {
  const { data, error } = await drafts().insert({ agent_id: agentId, brief, script }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "บันทึกบทไม่สำเร็จ");
  return (data as { id: string }).id;
}

/** how many scripts this person had written in the last rolling hour */
export async function draftsLastHour(agentId: string): Promise<number> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error } = await drafts().select("id", { count: "exact", head: true }).eq("agent_id", agentId).gte("created_at", since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
