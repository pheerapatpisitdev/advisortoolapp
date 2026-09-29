import { can, type Viewer } from "./access";
import { getViewer } from "./viewer";
import { pageConnections, type PageConnection } from "@/lib/facebook/connection";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Which Facebook Pages a caller may see and post to (owner, 2026-09-29): the owner and the
 * back office's admins every one; posting staff the ones the owner tied to them on /admin/team
 * (ins_staff_pages); anyone else none. A tie to a Page no longer connected shows nothing.
 *
 * Every place in Studio that lists Pages or posts to one asks here, read afresh per request,
 * so a Page taken from someone is gone on their next press, not their next sign-in.
 */

export const seesEveryPage = (viewer: Viewer | null): boolean => can(viewer, "admin");

/** The Page ids tied to one member of staff. */
export async function staffPageIds(agentId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin().from("ins_staff_pages").select("page_id").eq("agent_id", agentId);
  if (error) throw new Error(`อ่านเพจของทีมงานไม่ได้: ${error.message}`);
  return ((data ?? []) as { page_id: string }[]).map((r) => r.page_id);
}

export async function myPages(): Promise<PageConnection[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  const all = await pageConnections();
  if (seesEveryPage(viewer)) return all;
  if (!can(viewer, "publish")) return [];
  const mine = new Set(await staffPageIds(viewer.agentId));
  return all.filter((p) => mine.has(p.pageId));
}

export async function myPageIds(): Promise<Set<string>> {
  return new Set((await myPages()).map((p) => p.pageId));
}
