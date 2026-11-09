import type { Viewer } from "@/lib/auth/access";
import { bluewealthNames } from "@/lib/auth/bluewealth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { EventRow, FhcFigures, FhcInput, Score } from "./health";
import { firstGap, gapsOf, isGap, type Gap } from "./gaps";
import type { AreaKey, PlanResult } from "@/lib/plan/recommend";
import type { SurveyAnswers, WorryKey } from "@/lib/survey/answers";

/**
 * Customers an agent saved from the Financial Health Check. Every call takes the signed-in
 * viewer from the server: an agent reads and changes their own rows only; a room lead also reads
 * (never changes) their office's; the owner reads every agent's. An id from a request only ever narrows within what the viewer may see.
 */

const TABLE = "ins_fhc_customers";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// a survey row's meeting and top worry come out of its answers; an FHC row's are null
const LIGHT = "id, agent_id, created_at, name, contact, note, age, sex, gaps, first_area, kind, meet_date:input->>date, meet_time:input->>time, top:input->>top";

export const NAME_MAX = 100;
export const CONTACT_MAX = 100;
export const NOTE_MAX = 300;

export interface Details {
  name: string;
  contact: string;
  note: string;
}

/** The saved details made safe, or the sentence to show when they cannot be. An edit asks no consent again: it was given when the customer was saved. */
export function cleanDetails(raw: unknown, needConsent = true): Details | string {
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const name = text(r.name, NAME_MAX);
  if (!name) return "ใส่ชื่อลูกค้าก่อนนะครับ";
  if (needConsent && r.consent !== true) return "ต้องได้รับความยินยอมจากลูกค้าก่อนเก็บชื่อ";
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
  /** saved from the FHC check, or from สำรวจความคุ้มครอง (owner, 2026-10-22) */
  kind: "fhc" | "survey";
  /** a survey's meeting, yyyy-mm-dd and HH:MM, and the worry ranked top */
  meet: { date: string; time: string } | null;
  top: WorryKey | null;
}

export interface Snapshot {
  figures: FhcFigures;
  scores: Score[];
  events: EventRow[];
  plan: PlanResult;
  /** set when the agent replaced the first check with a corrected one; created_at stays the first day */
  updatedAt?: string;
}

interface Raw {
  id: string; agent_id: string; created_at: string; name: string; contact: string; note: string;
  age: number; sex: string; gaps: unknown; first_area: string | null;
  kind: string | null; meet_date: string | null; meet_time: string | null; top: string | null;
}

const AREAS: AreaKey[] = ["life", "health", "ci", "retire"];
const WORRIES: WorryKey[] = ["health", "retire", "education", "income"];

function shape(r: Raw): CustomerRow {
  return {
    id: r.id, agentId: r.agent_id, createdAt: r.created_at, name: r.name, contact: r.contact, note: r.note,
    age: r.age, sex: r.sex === "F" ? "F" : "M", gaps: isGap(r.gaps) ? r.gaps : [],
    firstArea: AREAS.find((k) => k === r.first_area) ?? null,
    kind: r.kind === "survey" ? "survey" : "fhc",
    meet: r.meet_date && r.meet_time ? { date: r.meet_date, time: r.meet_time } : null,
    top: WORRIES.find((k) => k === r.top) ?? null,
  };
}

const owns = (viewer: Viewer, agentId: string) => viewer.agentId === agentId;

/** a second save of the same name by the same agent this soon is the first one again (review, 2026-10-22) */
export const RESAVE_MS = 60_000;

/** The columns a check fills, for a new row and for a corrected one alike. */
function checkColumns(form: FhcInput, snapshot: Snapshot) {
  const gaps = gapsOf(snapshot.plan);
  return { age: form.age, sex: form.sex, gaps, first_area: firstGap(snapshot.plan, gaps), input: form, snapshot };
}

/** Saves one customer into the viewer's own account. Returns the new row's id, or the one just saved under this name. */
export async function saveCustomer(
  viewer: Viewer,
  d: Details,
  form: FhcInput,
  snapshot: Snapshot,
): Promise<string> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - RESAVE_MS).toISOString();
  const { data: recent } = await db.from(TABLE).select("id")
    .eq("agent_id", viewer.agentId).eq("name", d.name).gte("created_at", since).limit(1);
  const again = (recent ?? []) as { id: string }[];
  if (again.length) return again[0].id;
  const { data, error } = await db.from(TABLE).insert({
    agent_id: viewer.agentId, name: d.name, contact: d.contact, note: d.note,
    consent_at: new Date().toISOString(), ...checkColumns(form, snapshot),
  }).select("id").single();
  if (error || !data) throw new Error(`เก็บรายชื่อไม่ได้: ${error?.message ?? "ไม่มีข้อมูลกลับมา"}`);
  return (data as { id: string }).id;
}

/**
 * Saves a สำรวจความคุ้มครอง customer into the viewer's own list (owner chose the one list,
 * 2026-10-22). The answers and meeting are the row's `input`; it has no check, so no gaps.
 */
export async function saveSurveyCustomer(viewer: Viewer, a: SurveyAnswers, age: number): Promise<string> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - RESAVE_MS).toISOString();
  const { data: recent } = await db.from(TABLE).select("id")
    .eq("agent_id", viewer.agentId).eq("name", a.name).eq("kind", "survey").gte("created_at", since).limit(1);
  const again = (recent ?? []) as { id: string }[];
  if (again.length) return again[0].id;
  const { data, error } = await db.from(TABLE).insert({
    agent_id: viewer.agentId, kind: "survey", name: a.name, contact: a.phone, note: a.address,
    consent_at: new Date().toISOString(), age, sex: a.sex, gaps: [], first_area: null, input: a, snapshot: {},
  }).select("id").single();
  if (error || !data) throw new Error(`เก็บรายชื่อไม่ได้: ${error?.message ?? "ไม่มีข้อมูลกลับมา"}`);
  return (data as { id: string }).id;
}

/**
 * Replaces a saved customer's check with a corrected one, when the agent asks (owner, 2026-10-22,
 * mockup MGFQ7GbQGeBxhUVisLjtij ข). Name, contact, note, consent and the first day stay.
 */
export async function updateCustomerCheck(
  viewer: Viewer,
  id: string,
  ownerMay: boolean,
  form: FhcInput,
  snapshot: Snapshot,
): Promise<boolean> {
  if (!UUID.test(id)) return false;
  let q = supabaseAdmin().from(TABLE).update(checkColumns(form, { ...snapshot, updatedAt: new Date().toISOString() }))
    .eq("id", id).eq("kind", "fhc");
  if (!ownerMay) q = q.eq("agent_id", viewer.agentId);
  const { data, error } = await q.select("id");
  if (error) throw new Error(`อัปเดตผลไม่ได้: ${error.message}`);
  return (data ?? []).length > 0;
}

/** Corrects the name, contact and note (owner, 2026-10-22, mockup J1QgqER7XRAXde4AyTeEkr); the check and the consent stay. */
export async function updateCustomerDetails(viewer: Viewer, id: string, ownerMay: boolean, d: Details): Promise<boolean> {
  if (!UUID.test(id)) return false;
  let q = supabaseAdmin().from(TABLE).update({ name: d.name, contact: d.contact, note: d.note }).eq("id", id);
  if (!ownerMay) q = q.eq("agent_id", viewer.agentId);
  const { data, error } = await q.select("id");
  if (error) throw new Error(`แก้ข้อมูลไม่ได้: ${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * Whose customers a list holds: the viewer's own, the viewer's office's (a room lead, owner
 * 2026-11-09), or everyone's (the owner; the caller checks).
 */
export type Scope = "mine" | "office" | "all";

/** An admin or manager of a UnitOS room, who may look at the room's customers. */
export const isRoomLead = (viewer: Viewer): boolean => viewer.roomLead === true && !!viewer.tenantId;

/** The office (UnitOS room) of each agent among these ids: UnitClub's agents and Bluewealth's as of their last sign-in. A member has none. */
export async function agentRooms(ids: string[]): Promise<Map<string, { id: string; name: string }>> {
  const uniq = [...new Set(ids)].filter((i) => UUID.test(i));
  const rooms = new Map<string, { id: string; name: string }>();
  if (!uniq.length) return rooms;
  const db = supabaseAdmin();
  const [agents, outside] = await Promise.all([
    db.from("agents").select("id, tenant:tenants(id, slug, name)").in("id", uniq),
    db.from("ins_bluewealth_agents").select("id, tenant_id, tenant_name").in("id", uniq),
  ]);
  if (agents.error) throw new Error(`อ่านสำนักงานไม่ได้: ${agents.error.message}`);
  type Room = { id: string; slug: string; name: string | null };
  for (const a of (agents.data ?? []) as unknown as { id: string; tenant: Room | Room[] | null }[]) {
    const t = Array.isArray(a.tenant) ? a.tenant[0] : a.tenant;
    if (t) rooms.set(a.id, { id: t.id, name: t.name?.trim() || t.slug });
  }
  for (const b of (outside.data ?? []) as { id: string; tenant_id: string | null; tenant_name: string | null }[]) {
    if (b.tenant_id && !rooms.has(b.id)) rooms.set(b.id, { id: b.tenant_id, name: b.tenant_name ?? "" });
  }
  return rooms;
}

/** The agents among `ids` who sit in this room. */
export function inRoom(rooms: Map<string, { id: string }>, ids: string[], roomId: string): string[] {
  return [...new Set(ids)].filter((i) => rooms.get(i)?.id === roomId);
}

/** Newest first. A scope the viewer may not have falls back to their own: the caller checks the owner's, this checks the room lead's. */
export async function listCustomers(viewer: Viewer, scope: Scope): Promise<CustomerRow[]> {
  const db = supabaseAdmin();
  let q = db.from(TABLE).select(LIGHT).order("created_at", { ascending: false }).limit(1000);
  if (scope === "office" && isRoomLead(viewer)) {
    // the agents who have saved anyone, then those of them in the viewer's room
    const { data: who, error } = await db.from(TABLE).select("agent_id").limit(10000);
    if (error) throw new Error(`อ่านรายชื่อไม่ได้: ${error.message}`);
    const ids = ((who ?? []) as { agent_id: string }[]).map((r) => r.agent_id);
    const team = inRoom(await agentRooms(ids), ids, viewer.tenantId as string);
    if (!team.includes(viewer.agentId)) team.push(viewer.agentId);
    q = q.in("agent_id", team);
  } else if (scope !== "all") {
    q = q.eq("agent_id", viewer.agentId);
  }
  const { data, error } = await q;
  if (error) throw new Error(`อ่านรายชื่อไม่ได้: ${error.message}`);
  return ((data ?? []) as Raw[]).map(shape);
}

/**
 * One customer with the check as it stood the day it was saved (and the form it came from), or
 * null if the viewer may not see it. `officeMay`: a room lead may also look at a customer of an
 * agent in their room, and gets it `readOnly` (only the customer page asks; owner, 2026-11-09).
 */
export async function getCustomer(
  viewer: Viewer, id: string, ownerMay: boolean, officeMay = false,
): Promise<(CustomerRow & { snapshot: Snapshot; input: unknown; readOnly: boolean }) | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await supabaseAdmin().from(TABLE).select(`${LIGHT}, snapshot, input`).eq("id", id).maybeSingle();
  if (error) throw new Error(`อ่านรายชื่อไม่ได้: ${error.message}`);
  if (!data) return null;
  const row = data as Raw & { snapshot: Snapshot; input: unknown };
  let readOnly = false;
  if (!owns(viewer, row.agent_id) && !ownerMay) {
    if (!officeMay || !isRoomLead(viewer)) return null;
    const room = (await agentRooms([row.agent_id])).get(row.agent_id);
    if (room?.id !== viewer.tenantId) return null;
    readOnly = true;
  }
  return { ...shape(row), snapshot: row.snapshot, input: row.input, readOnly };
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
  const [agents, members, outside] = await Promise.all([
    db.from("agents").select("id, name, agent_code").in("id", uniq),
    db.from("ins_members").select("id, name, email").in("id", uniq),
    bluewealthNames(uniq),
  ]);
  for (const a of [...(agents.data ?? []), ...outside] as { id: string; name: string | null; agent_code: string }[]) names.set(a.id, a.name?.trim() || a.agent_code);
  for (const m of (members.data ?? []) as { id: string; name: string; email: string }[]) names.set(m.id, m.name.trim() || m.email);
  return names;
}
