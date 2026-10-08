import { supabaseAdmin } from "@/lib/supabase/admin";
import { MAX_HEADLINE, MAX_SUB, isStyle, type ThumbSize, type ThumbStyle } from "./thumbnail";

/**
 * The owner's history of video covers (owner, 2026-10-09), modelled on describe-history.ts: the
 * picture and every setting that made it, the latest HISTORY_MAX each, theirs alone. The agent
 * id always comes from the server; both ids are checked to be UUIDs before any call. Pictures sit
 * in a private bucket at "<agent id>/<row id>.<ext>" and are handed out as signed links of an hour.
 */

const TABLE = "ins_thumbnail_history";
const BUCKET = "thumbnail-images";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_SECONDS = 3600;
export const HISTORY_MAX = 200;
export const MAX_SCENE = 2500;

export interface ThumbSettings {
  size: ThumbSize;
  style: ThumbStyle;
  headline: string;
  sub: string;
  /** the owner's own picture prompt as typed; empty uses the style's scene */
  scene: string;
  source: "ai" | "person";
  personId: string | null;
  pose: string;
}

/** what reading the words back off the picture found (poster-read.ts) */
export interface ThumbCheck { read: string; issues: string[] }

export interface Thumbnail {
  id: string;
  createdAt: string;
  settings: ThumbSettings;
  check: ThumbCheck | null;
  model: string;
  costThb: number;
  /** a signed link, or null when the file is gone */
  imageUrl: string | null;
}

/** settings from a request or a stored row; null when they cannot make a cover */
export function parseSettings(v: unknown): ThumbSettings | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  if (r.size !== "9:16" && r.size !== "16:9") return null;
  if (!isStyle(r.style)) return null;
  const text = (x: unknown, max: number) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const headline = text(r.headline, MAX_HEADLINE);
  if (!headline) return null;
  const source = r.source === "person" ? "person" : "ai";
  let personId: string | null = null;
  if (source === "person") {
    if (typeof r.personId !== "string" || !UUID.test(r.personId)) return null;
    personId = r.personId;
  }
  return {
    size: r.size, style: r.style, headline, sub: text(r.sub, MAX_SUB),
    // a prompt keeps its line breaks; only its ends are trimmed
    scene: typeof r.scene === "string" ? r.scene.trim().slice(0, MAX_SCENE) : "",
    source, personId, pose: typeof r.pose === "string" ? r.pose.slice(0, 40) : "auto",
  };
}

const parseCheck = (v: unknown): ThumbCheck | null => {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  return {
    read: typeof r.read === "string" ? r.read.slice(0, 2000) : "",
    issues: Array.isArray(r.issues) ? r.issues.filter((x): x is string => typeof x === "string").slice(0, 20) : [],
  };
};

/**
 * Keeps a cover: the picture first, then the row that points at it (the picture is taken back if
 * the row cannot be written), then everything past the newest HISTORY_MAX is removed. Returns the
 * new row's id. Throws on any failure; the caller decides that saving must not spoil the cover.
 */
export async function saveThumbnail(agentId: string, t: {
  settings: ThumbSettings; check: ThumbCheck; model: string; costThb: number; bytes: Buffer; mimeType: string;
}): Promise<string> {
  if (!UUID.test(agentId)) throw new Error("history: not an agent id");
  const db = supabaseAdmin();
  const id = crypto.randomUUID();
  const path = `${agentId}/${id}.${t.mimeType === "image/png" ? "png" : "jpg"}`;
  const up = await db.storage.from(BUCKET).upload(path, t.bytes, { contentType: t.mimeType === "image/png" ? "image/png" : "image/jpeg", upsert: false });
  if (up.error) throw new Error(`thumbnail picture: ${up.error.message}`);
  const ins = await db.from(TABLE).insert({
    id, agent_id: agentId, settings: { ...t.settings, check: t.check }, model: t.model, cost_thb: t.costThb, image_path: path,
  });
  if (ins.error) {
    const back = await db.storage.from(BUCKET).remove([path]);
    if (back.error) console.error("thumbnail picture not taken back:", path, back.error.message);
    throw new Error(`thumbnail row: ${ins.error.message}`);
  }
  await trim(agentId);
  return id;
}

async function trim(agentId: string): Promise<void> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.from(TABLE).select("id, image_path").eq("agent_id", agentId)
      .order("created_at", { ascending: false }).range(HISTORY_MAX, HISTORY_MAX + 999);
    if (error) throw new Error(error.message);
    const old = (data ?? []) as { id: string; image_path: string }[];
    if (!old.length) return;
    // the rows stay while their files do: a file with no row is one nothing can find to delete
    const gone = await db.storage.from(BUCKET).remove(old.map((o) => o.image_path));
    if (gone.error) throw new Error(gone.error.message);
    const del = await db.from(TABLE).delete().in("id", old.map((o) => o.id));
    if (del.error) throw new Error(del.error.message);
  } catch (e) {
    console.error("thumbnail history not trimmed:", e);
  }
}

export async function listThumbnails(agentId: string): Promise<Thumbnail[]> {
  if (!UUID.test(agentId)) return [];
  const db = supabaseAdmin();
  const { data, error } = await db.from(TABLE).select("id, created_at, settings, model, cost_thb, image_path")
    .eq("agent_id", agentId).order("created_at", { ascending: false }).limit(HISTORY_MAX);
  if (error) throw new Error(`history: ${error.message}`);
  const rows = (data ?? []) as { id: string; created_at: string; settings: unknown; model: string; cost_thb: number; image_path: string }[];
  if (!rows.length) return [];
  const signed = await db.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.image_path), SIGNED_SECONDS);
  const links = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl ?? null]));
  const out: Thumbnail[] = [];
  for (const r of rows) {
    const settings = parseSettings(r.settings);
    if (!settings) continue;
    out.push({
      id: r.id, createdAt: r.created_at, settings, check: parseCheck((r.settings as Record<string, unknown>).check),
      model: r.model, costThb: Number(r.cost_thb), imageUrl: links.get(r.image_path) ?? null,
    });
  }
  return out;
}

/** one of the owner's own covers, row and picture; another's id removes nothing */
export async function deleteThumbnail(agentId: string, id: string): Promise<void> {
  if (!UUID.test(agentId) || !UUID.test(id)) return;
  const db = supabaseAdmin();
  const { data, error } = await db.from(TABLE).select("image_path").eq("agent_id", agentId).eq("id", id);
  if (error) throw new Error(`history: ${error.message}`);
  const paths = ((data ?? []) as { image_path: string }[]).map((r) => r.image_path);
  // before the row goes: a picture that stays must stay reachable through its row, to be deleted again
  if (paths.length) {
    const gone = await db.storage.from(BUCKET).remove(paths);
    if (gone.error) throw new Error(`history: ${gone.error.message}`);
  }
  const del = await db.from(TABLE).delete().eq("agent_id", agentId).eq("id", id);
  if (del.error) throw new Error(`history: ${del.error.message}`);
}
