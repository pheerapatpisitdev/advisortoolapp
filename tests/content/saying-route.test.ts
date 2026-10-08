import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const quota = vi.hoisted(() => ({ takeRound: vi.fn(async () => ({ ok: true, paidBy: "staff" })) }));
const run = vi.hoisted(() => ({ writeSaying: vi.fn(async () => ({ ok: true, items: [], costThb: 0, missing: 0 })) }));
vi.mock("@/lib/auth/quota", () => quota);
// the hourly limit keys on the caller's address, read from the request's headers
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": `10.5.1.${Math.random()}` }) }));
vi.mock("@/lib/content/saying-run", () => run);
// the owner's ceiling, asked before the round (ceiling.ts): not reached
vi.mock("@/lib/content/ceiling", () => ({ ceilingBeforeRound: vi.fn(async () => null) }));
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: vi.fn(async () => null), requireMember: vi.fn(async () => ({ agentId: "a1" })), getViewer: vi.fn(async () => ({ agentId: "a1" })) }));

const { POST } = await import("@/app/api/content-saying/route");
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/content-saying", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": `10.5.0.${Math.random()}` },
}));

beforeEach(() => vi.clearAllMocks());

describe("a คำคม round", () => {
  it("takes one of the agent's rounds and writes, from a topic or the agent's own words", async () => {
    expect((await (await post({ source: "topic", topic: "life", count: 2 })).json()).ok).toBe(true);
    expect((await (await post({ source: "own", own: "เตรียมวันนี้ อุ่นใจวันหน้า", count: 1 })).json()).ok).toBe(true);
    expect(quota.takeRound).toHaveBeenCalledTimes(2);
    expect(quota.takeRound).toHaveBeenCalledWith({ agentId: "a1" }, "ai-saying");
  });

  it("refuses nothing to write from before counting a round", async () => {
    expect(await (await post({ source: "own", own: "  ", count: 1 })).json()).toEqual({ ok: false, error: "เลือกหัวข้อ หรือพิมพ์คำคมก่อนนะครับ" });
    expect((await (await post({ source: "own", own: "ก".repeat(71), count: 1 })).json()).ok).toBe(false);
    expect(quota.takeRound).not.toHaveBeenCalled();
  });

  it("refuses an ad: a saying sells nothing, and ads moved to Ads Studio", async () => {
    expect(await (await post({ source: "topic", topic: "life", count: 1, format: "ad" })).json()).toEqual({ ok: false, error: "โฆษณาย้ายไปทำใน Ads Studio แล้ว" });
    expect(quota.takeRound).not.toHaveBeenCalled();
  });
});
