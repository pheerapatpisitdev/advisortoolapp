import type { NextRequest } from "next/server";
import { cronCallerIsOurs } from "@/lib/chat/cron-token";
import { sendDue } from "@/lib/line/broadcasts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sends the LINE broadcasts whose time has come (/admin/line, set to send later). Called every
 * five minutes by the database's own scheduler, with the same token as the Messenger follow-ups.
 * Each broadcast is claimed before it is sent, so a second call sends nothing twice.
 */
export async function POST(req: NextRequest) {
  if (!(await cronCallerIsOurs(req.headers.get("authorization")))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return Response.json({ ok: true, sent: await sendDue() });
  } catch (e) {
    console.error("[line] broadcast sweep failed:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
