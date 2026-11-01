import { NextResponse, type NextRequest } from "next/server";
import { openSealed, runMessage } from "@/lib/later";
import { laterJob } from "@/lib/later-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Where a queued job is run on Cloudflare (src/lib/later.ts): the queue's consumer (worker.ts)
 * posts each message here and waits, so the job has the whole request rather than the 30 seconds
 * a Worker's tail is given. Only a message runLater sealed, in the last hour, is run.
 */
export async function POST(req: NextRequest) {
  const message = openSealed(await req.json().catch(() => null));
  if (!message) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const job = laterJob(message.job);
  if (!job) return NextResponse.json({ error: `no job ${message.job}` }, { status: 404 });
  await runMessage(job, message);
  return NextResponse.json({ ok: true });
}
