import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { verifySignature, verifyTokenMatches } from "@/lib/facebook/verify";
import { handle } from "@/lib/facebook/conversation";
import { customerOf, type Messaging } from "@/lib/facebook/events";
import { eachBySender } from "@/lib/chat/batch";

export const runtime = "nodejs";
/**
 * Five minutes, not one. The answers run inside after(), and at 60 seconds a batch of a few
 * slow answers was killed mid-turn — the customer neither answered nor apologised to. Each
 * turn now has its own clock inside this (src/lib/chat/batch.ts, which holds the same number
 * as WEBHOOK_LIMIT_MS) so the apology always has time to go (review, 2026-10-01).
 */
export const maxDuration = 300;

interface Entry {
  /** the Page this batch of events belongs to; ins_open_conversation wants it by name */
  id?: string;
  messaging?: Messaging[];
}

/** Meta checks it owns this URL by asking for a challenge back, once, when the webhook is set. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  if (params.get("hub.mode") === "subscribe" && verifyTokenMatches(params.get("hub.verify_token"))) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  // the signature is computed over the exact bytes Meta sent, so the body is read as text
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let entries: Entry[] = [];
  try {
    const body = JSON.parse(raw);
    if (body.object !== "page") return NextResponse.json({ ok: true });
    entries = (body.entry ?? []) as Entry[];
  } catch {
    return new NextResponse("bad body", { status: 400 });
  }

  // Meta gives up on a webhook that takes more than a few seconds, and an answer takes
  // longer than that, so the reply happens after this response has already been sent.
  //
  // Different customers are answered side by side, so one stuck answer does not hold up the
  // rest; one customer's own events still go in order, one at a time. The Page goes into the
  // key as well, because a page-scoped id names a person only on its own Page.
  const startedAt = Date.now();
  const events = entries.flatMap((entry) => (entry.messaging ?? []).map((m) => ({ m, pageId: entry.id })));
  after(() => eachBySender(
    events,
    ({ m, pageId }) => {
      const who = customerOf(m);
      return who ? `${pageId ?? ""}:${who}` : undefined;
    },
    ({ m, pageId }) => handle(m, pageId, { startedAt }),
    "facebook",
  ));

  return NextResponse.json({ ok: true });
}
