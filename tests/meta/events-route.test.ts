import { beforeEach, describe, expect, it, vi } from "vitest";

/** What /api/meta/events passes on to Meta (review, 2026-10-11). */
const sent = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("@/lib/meta/capi", () => ({ sendConversion: async (e: Record<string, unknown>) => { sent.push(e); } }));
const ip = vi.hoisted(() => ({ value: "203.0.113.7" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": ip.value, "x-forwarded-for": "1.1.1.1, 10.0.0.1", "user-agent": "UA" }),
  cookies: async () => ({ get: () => undefined }),
}));

const { POST } = await import("@/app/api/meta/events/route");
const post = (body: unknown) => POST(new Request("http://x/api/meta/events", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => { sent.length = 0; });

describe("/api/meta/events", () => {
  it("passes on what our pages send, from the visitor's real address", async () => {
    ip.value = "203.0.113.7";
    const r = await post({ eventName: "ViewContent", eventId: "e1", eventSourceUrl: "https://www.advisortool.app/lifeprotect", customData: { content_name: "/lifeprotect" } });
    expect(r.status).toBe(200);
    expect(sent[0]).toMatchObject({ eventName: "ViewContent", customData: { content_name: "/lifeprotect" }, clientIp: "203.0.113.7" });
  });

  it("refuses a Lead, which no page of ours fires from the browser", async () => {
    expect((await post({ eventName: "Lead", eventId: "e2" })).status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("drops an email, a phone and any made-up value", async () => {
    ip.value = "203.0.113.8";
    await post({ eventName: "Quote", eventId: "e3", email: "a@b.c", phone: "0812345678", customData: { value: 99999, currency: "THB" } });
    expect(sent[0]).not.toHaveProperty("email");
    expect(sent[0]).not.toHaveProperty("phone");
    expect(sent[0].customData).toBeUndefined();
  });

  it("stops one address firing in a loop", async () => {
    ip.value = "198.51.100.9";
    const codes: number[] = [];
    for (let i = 0; i < 35; i++) codes.push((await post({ eventName: "Contact", eventId: `c${i}` })).status);
    expect(codes.filter((c) => c === 200)).toHaveLength(30);
    expect(codes.at(-1)).toBe(429);
  });
});
