import { can } from "@/lib/auth/access";
import { getViewer } from "@/lib/auth/viewer";
import { pageConnections } from "@/lib/facebook/connection";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LOGO_TYPES, type LogoSpot, type PosterLogo } from "./logo";

/**
 * The logos themselves (logo.ts has the shapes): a row per upload in ins_logos, the file in
 * the private content-media bucket under logos/. A Page's logo is the posting staff's to set
 * and to draw; an agent's own is theirs, and the posting staff's to draw, as they see the
 * pieces it is on.
 */

const MEDIA = "content-media";

export type LogoOwner = { pageId: string } | { agentId: string };

/**
 * Whose logo a round made by the caller carries: the Page's it is for, when the caller posts to
 * Pages and that Page is connected; the caller's own otherwise.
 */
export async function logoOwner(pageId?: string | null): Promise<LogoOwner | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  if (pageId && can(viewer, "publish") && (await pageConnections().catch(() => [])).some((p) => p.pageId === pageId)) {
    return { pageId };
  }
  return { agentId: viewer.agentId };
}

/** The newest logo of an owner, or null. */
export async function currentLogo(owner: LogoOwner): Promise<string | null> {
  let q = supabaseAdmin().from("ins_logos").select("path");
  q = "pageId" in owner ? q.eq("page_id", owner.pageId) : q.eq("agent_id", owner.agentId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as { path: string } | undefined)?.path ?? null;
}

/** A new logo for an owner: the file first, then its row; a row that fails takes its file back. */
export async function saveLogo(owner: LogoOwner, bytes: Buffer, mimeType: string): Promise<string> {
  const ext = LOGO_TYPES[mimeType];
  if (!ext) throw new Error("unsupported logo type");
  const db = supabaseAdmin();
  const path = `logos/${crypto.randomUUID()}.${ext}`;
  const { error: up } = await db.storage.from(MEDIA).upload(path, bytes, { contentType: mimeType, upsert: false });
  if (up) throw new Error(up.message);
  const { error } = await db.from("ins_logos").insert({ path, ...("pageId" in owner ? { page_id: owner.pageId } : { agent_id: owner.agentId }) });
  if (error) {
    await db.storage.from(MEDIA).remove([path]);
    throw new Error(error.message);
  }
  return path;
}

/** Whether the caller may have this logo drawn: a Page's for the posting staff, an agent's for them and the staff. */
export async function mayUseLogo(path: string): Promise<boolean> {
  const viewer = await getViewer();
  if (!viewer) return false;
  const { data, error } = await supabaseAdmin().from("ins_logos").select("page_id, agent_id").eq("path", path).maybeSingle();
  if (error || !data) return false;
  const row = data as { page_id: string | null; agent_id: string | null };
  if (can(viewer, "publish")) return true;
  return !row.page_id && row.agent_id === viewer.agentId;
}

/** The logo a round's posters carry: the owner's newest in the spot asked for, or none. */
export async function roundLogo(pageId: string | null | undefined, spot: LogoSpot | null): Promise<PosterLogo | null> {
  if (!spot) return null;
  const owner = await logoOwner(pageId);
  const path = owner ? await currentLogo(owner).catch(() => null) : null;
  return path ? { path, spot } : null;
}
