import type { PayMode } from "@/calc/types";
import { DEMO_ID } from "@/lib/auth/demo";
import type { Viewer } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_PAY_PREFS, HIDE_KEY, hiddenModes, readHide, type PayPrefs } from "@/lib/pay-prefs";

/** ins_agent_prefs (supabase/migrations/20261212_agent_prefs.sql); see src/lib/pay-prefs.ts */
const table = () => supabaseAdmin().from("ins_agent_prefs");

/**
 * An agent's setting; everything shown when they never set one. The trial account 012345 is
 * shared by every trial customer, so it always shows everything (owner chose this on the mockup).
 */
export async function getPayPrefs(agentId: string): Promise<PayPrefs> {
  if (agentId === DEMO_ID) return DEFAULT_PAY_PREFS;
  const { data, error } = await table().select("show_monthly, show_semi").eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(`prefs not read: ${error.message}`);
  return data ? { monthly: data.show_monthly !== false, semi: data.show_semi !== false } : DEFAULT_PAY_PREFS;
}

/**
 * What an agent's quotes leave out. A setting that cannot be read shows everything rather than
 * stopping the page: the figures are right either way, only more of them.
 */
export async function hiddenFor(agentId: string | null | undefined): Promise<PayMode[]> {
  if (!agentId) return [];
  try {
    return hiddenModes(await getPayPrefs(agentId));
  } catch (e) {
    console.error("prefs not read:", e);
    return [];
  }
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

export async function savePayPrefs(agentId: string, p: PayPrefs): Promise<void> {
  const { error } = await table().upsert(
    { agent_id: agentId, show_monthly: p.monthly, show_semi: p.semi, updated_at: new Date().toISOString() },
    { onConflict: "agent_id" },
  );
  if (error) throw new Error(`prefs not saved: ${error.message}`);
}
