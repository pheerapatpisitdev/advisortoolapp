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
  // an agent who posts to no Page reads no Page list: every request asks this (scope.ts)
  if (!seesEveryPage(viewer) && !can(viewer, "publish")) return [];
  const all = await pageConnections();
  if (seesEveryPage(viewer)) return all;
  const mine = new Set(await staffPageIds(viewer.agentId));
  return all.filter((p) => mine.has(p.pageId));
}

export async function myPageIds(): Promise<Set<string>> {
  return new Set((await myPages()).map((p) => p.pageId));
}

/** said when a request names a Page the caller does not look after */
export const NOT_YOUR_PAGE = "เพจนี้ไม่ได้อยู่ในเพจที่คุณดูแล — เปิดงานของเพจจากหน้ารวม Studio";

/**
 * The Page whose project a request works in (owner, 2026-09-30): the one asked for when the
 * caller looks after it, the first of theirs when none is named, none for a caller with no
 * Pages. A Page named that is not theirs is refused, and so is a list that cannot be read — a
 * round would otherwise land in another Page's project, or in none.
 */
export async function projectPage(asked?: string | null): Promise<{ ok: true; pageId: string | null } | { ok: false; error: string }> {
  let pages: PageConnection[];
  try {
    pages = await myPages();
  } catch (e) {
    console.error("project Page not read:", e);
    return { ok: false, error: "อ่านรายชื่อเพจไม่ได้ ลองใหม่อีกครั้งนะครับ" };
  }
  if (pages.length === 0) return { ok: true, pageId: null };
  if (!asked) return { ok: true, pageId: pages[0].pageId };
  return pages.some((p) => p.pageId === asked) ? { ok: true, pageId: asked } : { ok: false, error: NOT_YOUR_PAGE };
}
