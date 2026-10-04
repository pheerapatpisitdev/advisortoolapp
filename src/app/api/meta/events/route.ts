import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { sendConversion, type Conversion } from "@/lib/meta/capi";

/**
 * The browser half of a conversion asks the server to send the same event.
 *
 * The id in the body is the one the pixel already used. Email and phone, when a page has
 * them, are hashed inside sendConversion and never logged here.
 */

const NAMES = new Set<Conversion["eventName"]>(["PageView", "ViewContent", "Contact", "Lead", "Quote"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    eventName?: string;
    eventId?: string;
    eventSourceUrl?: string;
    customData?: Record<string, unknown>;
    email?: string;
    phone?: string;
  } | null;
  if (!body || !body.eventName || !NAMES.has(body.eventName as Conversion["eventName"]) || !body.eventId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const jar = await cookies();
  const h = await headers();
  await sendConversion({
    eventName: body.eventName as Conversion["eventName"],
    eventId: body.eventId.slice(0, 80),
    actionSource: "website",
    eventSourceUrl: typeof body.eventSourceUrl === "string" ? body.eventSourceUrl.slice(0, 500) : undefined,
    fbp: jar.get("_fbp")?.value,
    fbc: jar.get("_fbc")?.value,
    email: typeof body.email === "string" ? body.email : undefined,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    customData: body.customData && typeof body.customData === "object" ? body.customData : undefined,
    clientIp: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: h.get("user-agent") ?? undefined,
  });
  return NextResponse.json({ ok: true });
}
