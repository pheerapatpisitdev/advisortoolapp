import { createHash } from "crypto";

/**
 * One conversion, sent to Meta from the server.
 *
 * The browser pixel cannot see Messenger, and a browser can block the pixel, so the same
 * event is also posted here. `eventId` is the dedup key: it must match the pixel's eventID
 * when both fire. Nothing here throws — a Meta outage must not stop a quote or a chat.
 */

const GRAPH = "https://graph.facebook.com/v23.0";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Meta wants a trimmed, lowercased email before the hash. */
export function hashEmail(email: string): string {
  return sha256(email.trim().toLowerCase());
}

/** Digits only, then the hash. A formatted phone and a bare one must match. */
export function hashPhone(phone: string): string {
  return sha256(phone.replace(/\D/g, ""));
}

export interface Conversion {
  eventName: "PageView" | "ViewContent" | "Contact" | "Lead" | "Quote";
  eventId: string;
  actionSource: "website" | "business_messaging";
  eventSourceUrl?: string;
  fbp?: string;
  fbc?: string;
  email?: string;
  phone?: string;
  externalId?: string;
  customData?: Record<string, unknown>;
  clientIp?: string;
  userAgent?: string;
}

export async function sendConversion(event: Conversion): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return;
  const userData: Record<string, string> = {};
  if (event.email) userData.em = hashEmail(event.email);
  if (event.phone) userData.ph = hashPhone(event.phone);
  if (event.externalId) userData.external_id = sha256(event.externalId);
  if (event.fbp) userData.fbp = event.fbp;
  if (event.fbc) userData.fbc = event.fbc;
  if (event.clientIp) userData.client_ip_address = event.clientIp;
  if (event.userAgent) userData.client_user_agent = event.userAgent;
  const payload: Record<string, unknown> = {
    data: [{
      event_name: event.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: event.eventId,
      action_source: event.actionSource,
      event_source_url: event.eventSourceUrl,
      user_data: userData,
      custom_data: event.customData,
    }],
  };
  const test = process.env.META_TEST_EVENT_CODE;
  if (test) payload.test_event_code = test;
  try {
    const res = await fetch(`${GRAPH}/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      // awaited by /api/meta/events: a Graph that hangs must not hold the route to its limit
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) console.error("ส่งเหตุการณ์ไป Meta ไม่สำเร็จ:", res.status);
  } catch (e) {
    console.error("ส่งเหตุการณ์ไป Meta ไม่สำเร็จ:", e);
  }
}
