import type { NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { recordOpen } from "@/lib/stats/opens";

/**
 * A calculator page was opened (src/components/stats/CountOpen.tsx). Counted only for somebody
 * signed in; anyone else gets the same empty answer, so the page cannot tell and nothing is kept.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { path?: unknown } | null;
  const path = typeof body?.path === "string" ? body.path.slice(0, 64) : "";
  const viewer = await getViewer().catch(() => null);
  if (viewer && path) await recordOpen(viewer.agentId, path);
  return new Response(null, { status: 204 });
}
