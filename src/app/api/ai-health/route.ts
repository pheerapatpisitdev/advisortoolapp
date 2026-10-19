import type { NextRequest } from "next/server";
import { cronCallerIsOurs } from "@/lib/chat/cron-token";
import { runHealthCheck } from "@/lib/ai/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Asks every AI provider one word and tells the owner's LINE when one stops answering or comes
 * back (owner chose ก ก, 2026-10-19). Called every 30 minutes by the database's own scheduler,
 * with the same token as the Messenger follow-ups.
 */
export async function POST(req: NextRequest) {
  if (!(await cronCallerIsOurs(req.headers.get("authorization")))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const r = await runHealthCheck();
    return Response.json({ ok: true, checked: r.checked, events: r.events.map((e) => `${e.kind} ${e.provider}`), sent: r.sent });
  } catch (e) {
    console.error("[ai-health] check failed:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
