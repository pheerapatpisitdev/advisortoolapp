import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseSwatches, type Swatch } from "./palette";

/**
 * A member's history of pictures read into prompts (owner, 2026-10-08): the thumbnail, the
 * prompt, its Thai summary and its colours, the latest HISTORY_MAX each, theirs alone.
 *
 * Every call here takes the signed-in member's agent id from the server and filters by it —
 * an id from a request only ever narrows within the member's own rows, so another member's id
 * removes nothing. Thumbnails sit in a private bucket at "<agent id>/<row id>.jpg" and are
 * handed out as signed links of an hour; both ids are checked to be UUIDs before any call.
 */

const TABLE = "ins_describe_history";
const BUCKET = "describe-thumbs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_SECONDS = 3600;
/** the column's limit; the model's sentence has no cap of its own */
const SUMMARY_MAX = 300;

export const HISTORY_MAX = 200;
/** a 256 px JPEG at 0.7 is about 15–25 KB, 20–35 KB as base64; this leaves room and stops a body of a different kind */
export const MAX_THUMB_BASE64 = 150_000;

/** a base64 string of a JPEG (its first bytes encode as "/9j/"), within the size a thumbnail can have */
export function isThumbBase64(v: unknown): v is string {
  return typeof v === "string" && v.length <= MAX_THUMB_BASE64 && v.startsWith("/9j/") && /^[A-Za-z0-9+/]+={0,2}$/.test(v);
}

export interface Reading {
  id: string;
  createdAt: string;
  prompt: string;
  summaryTh: string;
  palette: Swatch[];
  /** a signed link, or null when the file is gone */
  thumbUrl: string | null;
}

/**
 * Keeps a good read: the thumbnail first, then the row that points at it (the thumbnail is
 * taken back if the row cannot be written), then everything past the member's newest
 * HISTORY_MAX — rows and files — is removed. Returns the new row's id. Throws on any failure;
 * the caller decides that saving must not spoil the read.
 */
export async function saveReading(
  agentId: string,
  r: { prompt: string; summaryTh: string; palette: Swatch[]; thumbBase64: string },
): Promise<string> {
  if (!UUID.test(agentId)) throw new Error("history: not an agent id");
  const db = supabaseAdmin();
  const id = crypto.randomUUID();
  const path = `${agentId}/${id}.jpg`;
  const up = await db.storage.from(BUCKET).upload(path, Buffer.from(r.thumbBase64, "base64"), { contentType: "image/jpeg", upsert: false });
  if (up.error) throw new Error(`history thumbnail: ${up.error.message}`);
  const ins = await db.from(TABLE).insert({
    id, agent_id: agentId, prompt: r.prompt, summary_th: r.summaryTh.slice(0, SUMMARY_MAX), palette: r.palette, thumb_path: path,
  });
  if (ins.error) {
    await db.storage.from(BUCKET).remove([path]);
    throw new Error(`history row: ${ins.error.message}`);
  }
  await trim(agentId);
  return id;
}

/** the member's rows past the newest HISTORY_MAX, files and rows both; a failure here is logged, never thrown — the read was saved */
async function trim(agentId: string): Promise<void> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.from(TABLE).select("id, thumb_path").eq("agent_id", agentId)
      .order("created_at", { ascending: false }).range(HISTORY_MAX, HISTORY_MAX + 999);
    if (error) throw new Error(error.message);
    const old = (data ?? []) as { id: string; thumb_path: string }[];
    if (!old.length) return;
    await db.storage.from(BUCKET).remove(old.map((o) => o.thumb_path));
    const del = await db.from(TABLE).delete().in("id", old.map((o) => o.id));
    if (del.error) throw new Error(del.error.message);
  } catch (e) {
    console.error("describe history not trimmed:", e);
  }
}

/** the member's own history, newest first, each with a signed link to its thumbnail */
export async function listReadings(agentId: string): Promise<Reading[]> {
  if (!UUID.test(agentId)) return [];
  const db = supabaseAdmin();
  const { data, error } = await db.from(TABLE).select("id, created_at, prompt, summary_th, palette, thumb_path")
    .eq("agent_id", agentId).order("created_at", { ascending: false }).limit(HISTORY_MAX);
  if (error) throw new Error(`history: ${error.message}`);
  const rows = (data ?? []) as { id: string; created_at: string; prompt: string; summary_th: string; palette: unknown; thumb_path: string }[];
  if (!rows.length) return [];
  const signed = await db.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.thumb_path), SIGNED_SECONDS);
  const links = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl ?? null]));
  return rows.map((r) => ({
    id: r.id, createdAt: r.created_at, prompt: r.prompt, summaryTh: r.summary_th,
    palette: parseSwatches(r.palette), thumbUrl: links.get(r.thumb_path) ?? null,
  }));
}

/** one of the member's own readings, row and thumbnail; another member's id removes nothing */
export async function deleteReading(agentId: string, id: string): Promise<void> {
  if (!UUID.test(agentId) || !UUID.test(id)) return;
  await removeWhere(agentId, id);
}

/** all of the member's own history */
export async function clearReadings(agentId: string): Promise<void> {
  if (!UUID.test(agentId)) return;
  await removeWhere(agentId);
}

async function removeWhere(agentId: string, id?: string): Promise<void> {
  const db = supabaseAdmin();
  let find = db.from(TABLE).select("thumb_path").eq("agent_id", agentId);
  if (id) find = find.eq("id", id);
  const { data, error } = await find;
  if (error) throw new Error(`history: ${error.message}`);
  const paths = ((data ?? []) as { thumb_path: string }[]).map((r) => r.thumb_path);
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
  let del = db.from(TABLE).delete().eq("agent_id", agentId);
  if (id) del = del.eq("id", id);
  const res = await del;
  if (res.error) throw new Error(`history: ${res.error.message}`);
}
