import { DEMO_ID } from "@/lib/auth/demo";
import { getViewer } from "@/lib/auth/viewer";
import { markOpened, updatesFor } from "@/lib/updates/store";

/**
 * "I opened the page that changed" (owner chose ก ก ก, 2026-11-24): the menu's New goes for this person.
 * Sent by the strip at the top of that page. Only rows this viewer is shown are written, whatever was sent.
 * The shared บัญชีสาธิต keeps nothing: one customer opening a page must not hide New from the next.
 * Never an error to the page: a mark that is not kept leaves New up, which is all that goes wrong.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const viewer = await getViewer().catch(() => null);
    if (!viewer || viewer.kind === "super" || viewer.agentId === DEMO_ID) return new Response(null, { status: 204 });
    const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
    const sent = Array.isArray(body?.ids) ? body.ids.filter((v): v is string => typeof v === "string").slice(0, 50) : [];
    const { rows } = await updatesFor(viewer);
    const shown = new Set(rows.map((r) => r.id));
    await markOpened(viewer.agentId, sent.filter((id) => shown.has(id)));
  } catch (e) {
    console.error("whats-new: opened page not kept:", e instanceof Error ? e.message : e);
  }
  return new Response(null, { status: 204 });
}
