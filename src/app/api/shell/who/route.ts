import { getViewer } from "@/lib/auth/viewer";
import { shellWho } from "@/lib/shell/who";

/**
 * Who is looking, for the menu on the sales pages (owner chose ข, 2026-10-14). Those pages are
 * built ahead of time and cannot ask on the server, so the menu asks here once the page is up.
 * The answer is what the menu shows and nothing more; every door it lists asks again.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const who = await shellWho(await getViewer().catch(() => null));
  return Response.json({ who }, { headers: { "Cache-Control": "private, no-store" } });
}
