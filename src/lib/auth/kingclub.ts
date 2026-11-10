// KingClub's agents (owner chose plan ข and ก, 2026-11-11; mockup
// https://claude.ai/artifact/5shfQXpgA1kqogXTapsT3W): on 2026-11-11 KingClub moved out of UnitClub's
// Supabase project into one of its own, keeping its room's id (ga83i) and every agent's id. Its menu
// now writes the one-time ticket there, and its agents and room are kept there; UnitClub's copy of the
// room was suspended and is no longer KingClub's word on anything.
//
// So, as for Bluewealth (./bluewealth.ts): the ticket is taken from KingClub, and who may come in is
// read live from KingClub on every request, through two functions of KingClub's
// (supabase/kingclub/20261111_advisortool_sso.sql) opened by KingClub's publishable key and a lookup
// key of our own; no service key of KingClub's. What the agents made here (pieces, FHC customers,
// wallets) stays in advisortool's own database under the same ids. KingClub's own rows go through the
// same gate as UnitClub's (./access.ts admit), its room's switches as they are. Server only.
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AgentRow } from "./access";

function lookupEnv(): { url: string; anon: string; key: string } | null {
  const url = process.env.KINGCLUB_SUPABASE_URL;
  const anon = process.env.KINGCLUB_ANON_KEY;
  const key = process.env.KINGCLUB_LOOKUP_KEY;
  return url && anon && key ? { url, anon, key } : null;
}

/** Unset, KingClub is never asked: the deploy that brings this in changes nothing until the keys are set. */
export const kingclubConfigured = (): boolean => lookupEnv() !== null;

function client(env: { url: string; anon: string }, timeoutMs?: number) {
  return createClient(env.url, env.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(timeoutMs ? { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) }) } } : {}),
  });
}

/**
 * The agent of a ticket KingClub's menu wrote, the ticket deleted as it is read: once only, and
 * only while younger than its 60 seconds (KingClub's advisortool_take_ticket). null for a ticket
 * KingClub does not have, and when the keys are not set. Throws when KingClub cannot be asked.
 */
export async function takeKingclubTicket(id: string): Promise<string | null> {
  const env = lookupEnv();
  if (!env) return null;
  const { data, error } = await client(env).rpc("advisortool_take_ticket", { p_key: env.key, p_id: id });
  if (error) throw new Error(`อ่านตั๋วจาก KingClub ไม่ได้: ${error.message}`);
  return typeof data === "string" && data ? data : null;
}

async function lookup(by: { p_id: string } | { p_code: string }): Promise<AgentRow[]> {
  const env = lookupEnv();
  if (!env) return [];
  const { data, error } = await client(env).rpc("advisortool_agents", { p_key: env.key, ...by });
  if (error) throw new Error(`อ่านข้อมูลตัวแทนไม่ได้: ${error.message}`);
  const rows = Array.isArray(data) ? (data as AgentRow[]) : [];
  return rows.map((r) => ({ ...r, system: "kingclub" as const }));
}

/** A KingClub agent with their room, or null. */
export async function kingclubAgentById(id: string): Promise<AgentRow | null> {
  return (await lookup({ p_id: id }))[0] ?? null;
}

/** Every KingClub agent holding this code (at most two, which says it repeats). */
export async function kingclubAgentsByCode(code: string): Promise<AgentRow[]> {
  return lookup({ p_code: code });
}

/**
 * Asks KingClub for a code nobody holds, as การเชื่อมต่อ does every 30 minutes
 * (src/lib/signin-health): an empty answer means the keys and the function work. Throws KingClub's
 * own words otherwise ("Invalid API key", "not allowed"), and "ไม่ได้ตั้งค่า" when the keys are not set.
 */
export async function kingclubPing(timeoutMs: number): Promise<void> {
  const env = lookupEnv();
  if (!env) throw new Error("ยังไม่ได้ตั้งค่าการเชื่อมกับ KingClub");
  const { error } = await client(env, timeoutMs).rpc("advisortool_agents", { p_key: env.key, p_code: "000000" });
  if (error) throw new Error(error.message);
}

/**
 * Whether this id signed in here as KingClub's before: then KingClub, not Bluewealth, is asked
 * first about an id UnitClub does not have. A read that fails says no, and both are asked.
 */
export async function knownKingclubAgent(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().from("ins_kingclub_agents").select("id").eq("id", id).maybeSingle();
  if (error) {
    console.error("kingclub agents unreadable:", error.message);
    return false;
  }
  return data != null;
}

/**
 * Remembers a KingClub agent who has just signed in, for names in the back office and so the
 * database knows the id is an agent's (the starter credit, owner chose ก). Never throws: a name
 * not written must not undo a sign-in.
 */
export async function rememberKingclubAgent(agent: AgentRow): Promise<void> {
  try {
    const { error } = await supabaseAdmin().from("ins_kingclub_agents").upsert({
      id: agent.id,
      agent_code: agent.agent_code,
      name: agent.name,
      unit: agent.unit ?? null,
      tenant_id: agent.tenant?.id ?? null,
      tenant_name: agent.tenant?.name?.trim() || agent.tenant?.slug || null,
      seen_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (error) console.error("kingclub agent not remembered:", error.message);
  } catch (e) {
    console.error("kingclub agent not remembered:", e instanceof Error ? e.message : e);
  }
}

export interface KingclubName {
  id: string;
  agent_code: string;
  name: string | null;
  unit: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
}

/** The KingClub agents among these ids, as of their last sign-in. A read that fails names nobody. */
export async function kingclubNames(ids: string[]): Promise<KingclubName[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const { data, error } = await supabaseAdmin().from("ins_kingclub_agents")
    .select("id, agent_code, name, unit, tenant_id, tenant_name").in("id", unique);
  if (error) {
    console.error("kingclub names unreadable:", error.message);
    return [];
  }
  return (data ?? []) as KingclubName[];
}
