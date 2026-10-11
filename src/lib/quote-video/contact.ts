import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * How customers reach an agent (owner, 2026-10-11): the phone, LINE and photo the closing scene
 * of a วิดีโอนำเสนอ shows, edited in บัญชีของฉัน. The name is the agent's display name, kept
 * where it always was. Name and phone are needed for a clip; photo and LINE are not.
 */

export const CONTACT_BUCKET = "agent-contact";
export interface AgentContact { phone: string; line: string; photoPath: string | null }
const EMPTY: AgentContact = { phone: "", line: "", photoPath: null };

const table = () => supabaseAdmin().from("ins_agent_contact");
const bucket = () => supabaseAdmin().storage.from(CONTACT_BUCKET);

/** "081-234-5678", "+66 81 234 5678": digits with spaces, dashes or a leading +; 9–15 digits */
export function cleanPhone(raw: string): string | null {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return "";
  if (!/^\+?[\d\s-]+$/.test(s)) return null;
  const n = s.replace(/\D/g, "").length;
  return n >= 9 && n <= 15 ? s : null;
}

/** "@somying.plan" or a personal id: letters, digits, . _ - and an optional leading @, at most 40 */
export function cleanLine(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "";
  return /^@?[A-Za-z0-9._-]{1,40}$/.test(s) ? s : null;
}

export async function getContact(agentId: string): Promise<AgentContact> {
  const { data, error } = await table().select("phone, line_id, photo_path").eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(`contact not read: ${error.message}`);
  return data ? { phone: data.phone ?? "", line: data.line_id ?? "", photoPath: data.photo_path ?? null } : EMPTY;
}

export async function saveContact(agentId: string, phone: string, line: string): Promise<void> {
  const { error } = await table().upsert({ agent_id: agentId, phone, line_id: line, updated_at: new Date().toISOString() }, { onConflict: "agent_id" });
  if (error) throw new Error(`contact not saved: ${error.message}`);
}

/** A new photo (already a small JPEG, made in the browser); the old one is let go. */
export async function savePhoto(agentId: string, jpeg: Buffer): Promise<string> {
  const before = (await getContact(agentId)).photoPath;
  const path = `${agentId}/${randomUUID()}.jpg`;
  const up = await bucket().upload(path, jpeg, { contentType: "image/jpeg", upsert: false });
  if (up.error) throw new Error(`photo not stored: ${up.error.message}`);
  const { error } = await table().upsert({ agent_id: agentId, photo_path: path, updated_at: new Date().toISOString() }, { onConflict: "agent_id" });
  if (error) {
    await bucket().remove([path]);
    throw new Error(`photo not saved: ${error.message}`);
  }
  if (before) await bucket().remove([before]).catch(() => undefined);
  return path;
}

export async function photoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await bucket().createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** the photo as a data URI, for a picture drawn on the server; null when there is none or it cannot be read */
export async function photoDataUri(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await bucket().download(path);
  if (error || !data) return null;
  return `data:image/jpeg;base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
}
