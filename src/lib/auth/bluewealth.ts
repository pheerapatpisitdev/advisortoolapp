// Bluewealth's agents (owner, 2026-10-24; mockup https://claude.ai/artifact/QtMeowzf8BfkaBXgSksLzY):
// Bluewealth runs a copy of UnitOS in a Supabase project of its own, and its agents sign in with
// their 6-digit code on the same "ตัวแทน UnitOS" tab and get what a UnitOS agent gets. Nothing on
// screen names Bluewealth (owner); the back office shows the room's real name.
//
// Who may come in is read live from Bluewealth on every request, as UnitOS's agents are from
// UnitClub: Bluewealth's function advisortool_agents (supabase/bluewealth/) answers with rows
// shaped like UnitClub's, which go through the same gate (./access.ts admit). advisortool holds
// only Bluewealth's publishable key and a lookup key of its own, which open that one function.
// Server only.
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AgentRow } from "./access";

/** where the Super Admin's switch is kept in ins_ai_settings.feature_switches, beside the tools' own */
export const BLUEWEALTH_KEY = "bluewealth";

function lookupEnv(): { url: string; anon: string; key: string } | null {
  const url = process.env.BLUEWEALTH_SUPABASE_URL;
  const anon = process.env.BLUEWEALTH_ANON_KEY;
  const key = process.env.BLUEWEALTH_LOOKUP_KEY;
  return url && anon && key ? { url, anon, key } : null;
}

/** Unset, Bluewealth's agents are simply not found: the deploy that brings this in changes nothing until the keys are set. */
export const bluewealthConfigured = (): boolean => lookupEnv() !== null;

/** the switch as stored: open unless the Super Admin closed it */
export function bluewealthOpenOf(switches: unknown): boolean {
  const row = switches && typeof switches === "object" ? (switches as Record<string, unknown>)[BLUEWEALTH_KEY] : undefined;
  return !(row && typeof row === "object" && (row as Record<string, unknown>).open === false);
}

/** Read once a request, and only for a Bluewealth agent. A read that fails is open, as every other switch is. */
export const bluewealthOpen = cache(async (): Promise<boolean> => {
  try {
    const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("feature_switches").maybeSingle();
    if (error) throw new Error(error.message);
    return bluewealthOpenOf(data?.feature_switches);
  } catch (e) {
    console.error("bluewealth switch unreadable, open:", e instanceof Error ? e.message : e);
    return true;
  }
});

/** the switch saved, the tools' switches beside it left as they are */
export async function saveBluewealthOpen(open: boolean): Promise<void> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("ins_ai_settings").select("feature_switches").maybeSingle();
  if (error) throw new Error(`อ่านสถานะฟังก์ชันไม่ได้: ${error.message}`);
  const all = (data?.feature_switches && typeof data.feature_switches === "object" ? data.feature_switches : {}) as Record<string, unknown>;
  const { error: saved } = await db.from("ins_ai_settings").upsert(
    { id: true, feature_switches: { ...all, [BLUEWEALTH_KEY]: { open, at: new Date().toISOString() } }, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (saved) throw new Error(`บันทึกไม่ได้: ${saved.message}`);
}

/**
 * A Bluewealth row as the gate reads it. Bluewealth's room has the Console's Application+ switch
 * (adStudio) off, since advisortool is not opened from a menu there; the Super Admin's switch
 * stands in for it instead: closed, every Bluewealth room is a room turned off, and the front
 * page answers as it does for any closed room.
 */
export function asGateRow(raw: AgentRow, open: boolean): AgentRow {
  const room = raw.tenant;
  if (!room) return { ...raw, system: "bluewealth" };
  const features = { ...room.config?.features };
  delete features.adStudio;
  return {
    ...raw,
    system: "bluewealth",
    tenant: { ...room, config: { ...room.config, features: open ? features : { ...features, advisorTool: false } } },
  };
}

async function lookup(by: { p_id: string } | { p_code: string }): Promise<AgentRow[]> {
  const env = lookupEnv();
  if (!env) return [];
  const client = createClient(env.url, env.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc("advisortool_agents", { p_key: env.key, ...by });
  if (error) throw new Error(`อ่านข้อมูลตัวแทนไม่ได้: ${error.message}`);
  const rows = Array.isArray(data) ? (data as AgentRow[]) : [];
  if (rows.length === 0) return [];
  const open = await bluewealthOpen();
  return rows.map((r) => asGateRow(r, open));
}

/** A Bluewealth agent with their room, or null. */
export async function bluewealthAgentById(id: string): Promise<AgentRow | null> {
  return (await lookup({ p_id: id }))[0] ?? null;
}

/** Every Bluewealth agent holding this code (at most two, which says it repeats). */
export async function bluewealthAgentsByCode(code: string): Promise<AgentRow[]> {
  return lookup({ p_code: code });
}

/**
 * Remembers a Bluewealth agent who has just signed in, for names in the back office and so the
 * database knows the id is an agent's (the starter credit). Never throws: a name not written
 * must not undo a sign-in.
 */
export async function rememberBluewealthAgent(agent: AgentRow): Promise<void> {
  try {
    const { error } = await supabaseAdmin().from("ins_bluewealth_agents").upsert({
      id: agent.id,
      agent_code: agent.agent_code,
      name: agent.name,
      unit: agent.unit ?? null,
      tenant_id: agent.tenant?.id ?? null,
      tenant_name: agent.tenant?.name?.trim() || agent.tenant?.slug || null,
      seen_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (error) console.error("bluewealth agent not remembered:", error.message);
  } catch (e) {
    console.error("bluewealth agent not remembered:", e instanceof Error ? e.message : e);
  }
}

export interface BluewealthName {
  id: string;
  agent_code: string;
  name: string | null;
  unit: string | null;
  tenant_name: string | null;
}

/** The Bluewealth agents among these ids, as of their last sign-in. A read that fails names nobody. */
export async function bluewealthNames(ids: string[]): Promise<BluewealthName[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const { data, error } = await supabaseAdmin().from("ins_bluewealth_agents")
    .select("id, agent_code, name, unit, tenant_name").in("id", unique);
  if (error) {
    console.error("bluewealth names unreadable:", error.message);
    return [];
  }
  return (data ?? []) as BluewealthName[];
}
