import type { NextRequest } from "next/server";
import { drawBackground } from "@/app/studio/actions";
import { refuseUnless } from "@/lib/auth/viewer";

/**
 * The content page's picture orders, as a plain request rather than a server action.
 *
 * Next runs a page's server actions one after another. Drawn that way, five pictures took
 * five turns of half a minute each, and everything else on the page — a tab, a delete, a
 * save — waited in the same line. A fetch is not in that line, so the pictures draw side by
 * side and the page stays usable. The limits and the budget are drawBackground's own.
 */

/** two image models at 90 s each plus the request's translation; 120 cut the fallback off */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const body = await req.json().catch(() => null) as { id?: unknown; request?: unknown; painter?: unknown; person?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ ok: false, error: "ไม่พบชิ้นงานนี้" }, { status: 400 });
  const request = typeof body?.request === "string" ? body.request.slice(0, 300) : "";
  const painter = typeof body?.painter === "string" ? body.painter : undefined;
  // absent: the piece's own person; null: none; { id, pose }: this one
  const p = body?.person as { id?: unknown; pose?: unknown } | null | undefined;
  const person = p === null ? null
    : p && typeof p.id === "string" && typeof p.pose === "string" ? { id: p.id, pose: p.pose } : undefined;
  return Response.json(await drawBackground(id, request, painter, person));
}
