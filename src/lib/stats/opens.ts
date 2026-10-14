import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculatorName } from "./calculators";

/** a reload or a quick back-and-forth is one open, not several */
export const REPEAT_MS = 10 * 60 * 1000;

/**
 * Notes that a signed-in person opened a calculator page (owner, 2026-10-14). A path that is
 * not a calculator, or a repeat within REPEAT_MS, writes nothing. Never throws: a lost count
 * must not break the page that sent it.
 */
export async function recordOpen(agentId: string, path: string, now = new Date()): Promise<boolean> {
  if (!calculatorName(path)) return false;
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.from("ins_tool_opens").select("id")
      .eq("agent_id", agentId).eq("tool", path).gte("at", new Date(now.getTime() - REPEAT_MS).toISOString()).limit(1);
    if (error) throw new Error(error.message);
    if (data?.length) return false;
    const { error: put } = await db.from("ins_tool_opens").insert({ agent_id: agentId, tool: path });
    if (put) throw new Error(put.message);
    return true;
  } catch (e) {
    console.error("tool open not recorded:", e);
    return false;
  }
}
