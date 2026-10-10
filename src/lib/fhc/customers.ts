import type { Viewer } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { EventRow, FhcFigures, FhcInput, Score } from "./health";
import { firstGap, gapsOf, isGap, type Gap } from "./gaps";
import type { AreaKey, PlanResult } from "@/lib/plan/recommend";

/**
 * Customers an agent saved from the Financial Health Check. Every call takes the signed-in
 * viewer from the server: an agent reads and changes their own rows only; the owner reads every
 * agent's. An id from a request only ever narrows within what the viewer may see.
 */

const TABLE = "ins_fhc_customers";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIGHT = "id, agent_id, created_at, name, contact, note, age, sex, gaps, first_area";

export const NAME_MAX = 100;
export const CONTACT_MAX = 100;
export const NOTE_MAX = 300;

export interface Details {
  name: string;
  contact: string;
  note: string;
}

/** The saved details made safe, or the sentence to show when they cannot be. */
export function cleanDetails(raw: unknown): Details | string {
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const name = text(r.name, NAME_MAX);
  if (!name) return "ใส่ชื่อลูกค้าก่อนนะครับ";
  if (r.consent !== true) return "ต้องได้รับความยินยอมจากลูกค้าก่อนเก็บชื่อ";
  return { name, contact: text(r.contact, CONTACT_MAX), note: text(r.note, NOTE_MAX) };
}

export interface CustomerRow {
  id: string;
  agentId: string;
  createdAt: string;
  name: string;
  contact: string;
  note: string;
  age: number;
  sex: "M" | "F";
  gaps: Gap[];
  firstArea: AreaKey | null;
}

export interface Snapshot {
  figures: FhcFigures;
  scores: Score[];
  events: EventRow[];
  plan: PlanResult;
}

interface Raw {
  id: string; agent_id: string; created_at: string; name: string; contact: string; note: string;
  age: number; sex: string; gaps: unknown; first_area: string | null;
}

const AREAS: AreaKey[] = ["life", "health", "ci", "retire"];

function shape(r: Raw): CustomerRow {
  return {
    id: r.id, agentId: r.agent_id, createdAt: r.created_at, name: r.name, contact: r.contact, note: r.note,
    age: r.age, sex: r.sex === "F" ? "F" : "M", gaps: isGap(r.gaps) ? r.gaps : [],
    firstArea: AREAS.find((k) => k === r.first_area) ?? null,
  };
}

const owns = (viewer: Viewer, agentId: string) => viewer.agentId === agentId;

/** Saves one customer into the viewer's own account. Returns the new row's id. */
export async function saveCustomer(
  viewer: Viewer,
  d: Details,
  form: FhcInput,
  snapshot: Snapshot,
): Promise<string> {
  const gaps = gapsOf(snapshot.plan);
  const { data, error } = await supabaseAdmin().from(TABLE).insert({
    agent_id: viewer.agentId, name: d.name, contact: d.contact, note: d.note,
    consent_at: new Date().toISOString(), age: form.age, sex: form.sex,
    gaps, first_area: firstGap(snapshot.plan, gaps), input: form, snapshot,
  }).select("id").single();
  if (error || !data) throw new Error(`เก็บรายชื่อไม่ได้: ${error?.message ?? "ไม่มีข้อมูลกลับมา"}`);
  return (data as { id: string }).id;
}

/** Newest first. The owner may ask for everyone's. */
export async function listCustomers(viewer: Viewer, all: boolean): Promise<CustomerRow[]> {
  let q = supabaseAdmin().from(TABLE).select(LIGHT).order("created_at", { ascending: false }).limit(1000);
  if (!all) q = q.eq("agent_id", viewer.agentId);
  const { data, error } = await q;
  if (error) throw new Error(`อ่านรายชื่อไม่ได้: ${error.message}`);
  return ((data ?? []) as Raw[]).map(shape);
}

/** One customer with the check as it stood the day it was saved, or null if the viewer may not see it. */
export async function getCustomer(viewer: Viewer, id: string, ownerMay: boolean): Promise<(CustomerRow & { snapshot: Snapshot }) | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await supabaseAdmin().from(TABLE).select(`${LIGHT}, snapshot`).eq("id", id).maybeSingle();
  if (error) throw new Error(`อ่านรายชื่อไม่ได้: ${error.message}`);
  if (!data) return null;
  const row = data as Raw & { snapshot: Snapshot };
  if (!owns(viewer, row.agent_id) && !ownerMay) return null;
  return { ...shape(row), snapshot: row.snapshot };
}

export async function deleteCustomer(viewer: Viewer, id: string, ownerMay: boolean): Promise<boolean> {
  if (!UUID.test(id)) return false;
  let q = supabaseAdmin().from(TABLE).delete().eq("id", id);
  if (!ownerMay) q = q.eq("agent_id", viewer.agentId);
  const { data, error } = await q.select("id");
  if (error) throw new Error(`ลบรายชื่อไม่ได้: ${error.message}`);
  return (data ?? []).length > 0;
}

/** Owner only (the caller checks): hands a customer to another agent. */
export async function moveCustomer(id: string, toAgentId: string): Promise<boolean> {
  if (!UUID.test(id) || !UUID.test(toAgentId)) return false;
  const { data, error } = await supabaseAdmin().from(TABLE).update({ agent_id: toAgentId }).eq("id", id).select("id");
  if (error) throw new Error(`ย้ายรายชื่อไม่ได้: ${error.message}`);
  return (data ?? []).length > 0;
}

/** Names for the owner's all-agents list: UnitOS agents and members alike. */
export async function agentNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids)].filter((i) => UUID.test(i));
  const names = new Map<string, string>();
  if (!uniq.length) return names;
  const db = supabaseAdmin();
  const [agents, members] = await Promise.all([
    db.from("agents").select("id, name, agent_code").in("id", uniq),
    db.from("ins_members").select("id, name, email").in("id", uniq),
  ]);
  for (const a of (agents.data ?? []) as { id: string; name: string | null; agent_code: string }[]) names.set(a.id, a.name?.trim() || a.agent_code);
  for (const m of (members.data ?? []) as { id: string; name: string; email: string }[]) names.set(m.id, m.name.trim() || m.email);
  return names;
}
