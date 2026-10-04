"use client";

/**
 * One event, from the browser and from the server, sharing one id so Meta counts it once.
 */
export function trackMeta(eventName: "Contact" | "Lead" | "Quote" | "ViewContent", customData?: Record<string, unknown>) {
  const eventId = crypto.randomUUID();
  const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;
  if (eventName === "Quote") fbq?.("trackCustom", eventName, customData ?? {}, { eventID: eventId });
  else fbq?.("track", eventName, customData ?? {}, { eventID: eventId });
  void fetch("/api/meta/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eventName,
      eventId,
      eventSourceUrl: location.href,
      customData,
    }),
  }).catch(() => {});
}
