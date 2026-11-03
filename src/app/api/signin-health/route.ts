import type { NextRequest } from "next/server";
import { cronCallerIsOurs } from "@/lib/chat/cron-token";
import { runSigninCheck } from "@/lib/signin-health/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Asks the four ways in and tells the owner's LINE when one stops working or comes back
 * (owner chose ก ก ก, 2026-11-03). Called every 30 minutes by the database's own scheduler, with
 * the same token as the AI check.
 */
export async function POST(req: NextRequest) {
  if (!(await cronCallerIsOurs(req.headers.get("authorization")))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const r = await runSigninCheck();
    return Response.json({ ok: true, standing: r.standing.map((s) => `${s.route} ${s.ok ? "ok" : "down"}`), events: r.events.map((e) => `${e.kind} ${e.provider}`), sent: r.sent });
  } catch (e) {
    console.error("[signin-health] check failed:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
