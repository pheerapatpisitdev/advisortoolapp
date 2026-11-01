import { NextResponse } from "next/server";
import { refuseUnlessCron } from "@/lib/cron-auth";
import { pruneTranscripts, runChatReview } from "@/lib/chat/review";

export const dynamic = "force-dynamic";
/** a reader and up to two behind it, ninety seconds each; the content routes run this long too */
export const maxDuration = 300;

/**
 * Vercel calls this once a day (vercel.json, 01:00 UTC = 08:00 in Bangkok) with the cron
 * secret. It first deletes what is past its ninety days, then reviews yesterday's chats; the
 * owner reads the result on /admin/knowledge.
 */
export async function GET(req: Request) {
  const refused = await refuseUnlessCron(req);
  if (refused) return refused;
  await pruneTranscripts();
  try {
    const result = await runChatReview();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (e) {
    console.error("chat review failed:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
