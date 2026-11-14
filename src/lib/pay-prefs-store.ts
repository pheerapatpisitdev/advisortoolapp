import type { PayMode } from "@/calc/types";
import { DEMO_ID } from "@/lib/auth/demo";
import type { Viewer } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_AGENT_PREFS, HIDE_KEY, PEN_KEY, hiddenModes, readHide, readPen, type AgentPrefs } from "@/lib/pay-prefs";

/** ins_agent_prefs (supabase/migrations/20261212_agent_prefs.sql, 20261214_agent_prefs_pen.sql); see src/lib/pay-prefs.ts */
const table = () => supabaseAdmin().from("ins_agent_prefs");

/**
 * An agent's settings; the defaults when they never set any. The trial account 012345 is
 * shared by every trial customer, so it always has the defaults (owner chose this on the mockup).
 */
export async function getAgentPrefs(agentId: string): Promise<AgentPrefs> {
  if (agentId === DEMO_ID) return DEFAULT_AGENT_PREFS;
  const { data, error } = await table().select("show_monthly, show_semi, show_pen").eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(`prefs not read: ${error.message}`);
  return data
    ? { monthly: data.show_monthly !== false, semi: data.show_semi !== false, pen: data.show_pen !== false }
    : DEFAULT_AGENT_PREFS;
}

/**
 * An agent's settings for drawing; a setting that cannot be read gives the defaults rather than
 * stopping the page: the figures are right either way.
 */
export async function prefsFor(agentId: string | null | undefined): Promise<AgentPrefs> {
  if (!agentId) return DEFAULT_AGENT_PREFS;
  try {
    return await getAgentPrefs(agentId);
  } catch (e) {
    console.error("prefs not read:", e);
    return DEFAULT_AGENT_PREFS;
  }
}

/** What an agent's quotes leave out. */
export async function hiddenFor(agentId: string | null | undefined): Promise<PayMode[]> {
  return hiddenModes(await prefsFor(agentId));
}

/**
 * For a calculator page: the signed-in agent's own setting, or — for the PDF printer, which has
 * no session (gateCalc gives it null) — what the printed link asks to hide.
 */
export async function hiddenOnPage(
  viewer: Pick<Viewer, "agentId"> | null,
  query: Record<string, string | string[] | undefined> | undefined,
): Promise<PayMode[]> {
  return viewer ? hiddenFor(viewer.agentId) : readHide(query?.[HIDE_KEY]);
}

/** The same for the table notes: the agent's setting, or what the printed link asks. */
export async function penOnPage(
  viewer: Pick<Viewer, "agentId"> | null,
  query: Record<string, string | string[] | undefined> | undefined,
): Promise<boolean> {
  return viewer ? (await prefsFor(viewer.agentId)).pen : readPen(query?.[PEN_KEY]);
}

/** Saves what is given and leaves the rest as it was. */
export async function saveAgentPrefs(agentId: string, p: Partial<AgentPrefs>): Promise<void> {
  const row: Record<string, unknown> = { agent_id: agentId, updated_at: new Date().toISOString() };
  if (p.monthly !== undefined) row.show_monthly = p.monthly;
  if (p.semi !== undefined) row.show_semi = p.semi;
  if (p.pen !== undefined) row.show_pen = p.pen;
  const { error } = await table().upsert(row, { onConflict: "agent_id" });
  if (error) throw new Error(`prefs not saved: ${error.message}`);
}
