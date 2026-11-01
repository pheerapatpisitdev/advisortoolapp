import { NextResponse, type NextRequest } from "next/server";
import { cronCallerIsOurs } from "@/lib/chat/cron-token";
import { runLater } from "@/lib/later";
import { laterPing } from "@/lib/later-ping";

export const runtime = "nodejs";

/** sends the ping job through runLater (src/lib/later-ping.ts); the scheduler's token only */
export async function POST(req: NextRequest) {
  if (!(await cronCallerIsOurs(req.headers.get("authorization")))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  runLater(laterPing, { sentAt: Date.now() });
  return NextResponse.json({ ok: true });
}
