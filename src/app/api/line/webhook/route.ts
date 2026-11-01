import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@/lib/line/verify";
import type { LineEvent } from "@/lib/line/conversation";
import { lineAnswers } from "@/lib/line/answer-job";
import { runLater } from "@/lib/later";

export const runtime = "nodejs";
/** five minutes, with a clock on each turn inside it — the same as Messenger's webhook */
export const maxDuration = 300;

/**
 * The LINE official account's webhook — the address the account has pointed at since
 * 2026-09-04, and which answered nothing from 2026-09-11, when the first assistant was taken
 * out, until it was put back on the same brains as the Page's inbox.
 */
export async function POST(req: NextRequest) {
  // the signature is computed over the exact bytes LINE sent, so the body is read as text
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-line-signature"))) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let events: LineEvent[] = [];
  let destination = "";
  try {
    const body = JSON.parse(raw);
    events = (body.events ?? []) as LineEvent[];
    destination = typeof body.destination === "string" ? body.destination : "";
  } catch {
    return new NextResponse("bad body", { status: 400 });
  }

  // LINE gives up on a webhook that is slow to answer, and a model is slow, so the reply goes
  // out after this response. The console's "Verify" button sends no events and gets its 200.
  // Different people side by side, one person's events in order (src/lib/line/answer-job.ts).
  runLater(lineAnswers, { events, destination, startedAt: Date.now() });

  return NextResponse.json({ ok: true });
}
