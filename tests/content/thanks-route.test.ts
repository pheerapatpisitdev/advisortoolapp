import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const quota = vi.hoisted(() => ({ takeRound: vi.fn(async () => ({ ok: true, paidBy: "staff" })) }));
const run = vi.hoisted(() => ({ writeThanks: vi.fn(async () => ({ ok: true, items: [], costThb: 0, missing: 0 })) }));
vi.mock("@/lib/auth/quota", () => quota);
// the hourly limit keys on the caller's address, read from the request's headers
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": `10.4.1.${Math.random()}` }) }));
vi.mock("@/lib/content/thanks-run", () => run);
// the owner's ceiling, asked before the round (ceiling.ts): not reached
vi.mock("@/lib/content/ceiling", () => ({ ceilingBeforeRound: vi.fn(async () => null) }));
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: vi.fn(async () => null), requireMember: vi.fn(async () => ({ agentId: "a1" })), getViewer: vi.fn(async () => ({ agentId: "a1" })) }));

const { POST } = await import("@/app/api/content-thanks/route");
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/content-thanks", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": `10.4.0.${Math.random()}` },
}));

beforeEach(() => vi.clearAllMocks());

describe("a ขอบคุณลูกค้า round", () => {
  it("takes one of the agent's rounds and writes", async () => {
    expect((await (await post({ occasion: "trust", count: 2 })).json()).ok).toBe(true);
    expect(quota.takeRound).toHaveBeenCalledWith({ agentId: "a1" }, "ai-thanks");
  });

  it("refuses a custom occasion with no words before counting a round", async () => {
    expect(await (await post({ occasion: "custom", custom: "  ", count: 1 })).json()).toEqual({ ok: false, error: "เลือกโอกาส หรือพิมพ์เองก่อนนะครับ" });
    expect(quota.takeRound).not.toHaveBeenCalled();
  });

  it("refuses an ad: a thank-you sells nothing, and ads moved to Ads Studio", async () => {
    expect(await (await post({ occasion: "trust", count: 1, format: "ad" })).json()).toEqual({ ok: false, error: "โฆษณาย้ายไปทำใน Ads Studio แล้ว" });
    expect(quota.takeRound).not.toHaveBeenCalled();
  });
});
