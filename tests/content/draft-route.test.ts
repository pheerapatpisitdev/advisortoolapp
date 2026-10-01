import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const quota = vi.hoisted(() => ({ takeRound: vi.fn(async () => ({ ok: true, paidBy: "staff" })) }));
const run = vi.hoisted(() => ({ writeDraft: vi.fn(async () => ({ ok: true, items: [], costThb: 0, missing: 0 })) }));
vi.mock("@/lib/auth/quota", () => quota);
// the hourly limit keys on the caller's address, read from the request's headers
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": `10.3.1.${Math.random()}` }) }));
vi.mock("@/lib/content/draft-run", () => run);
// the owner's ceiling, asked before the round (ceiling.ts): not reached
vi.mock("@/lib/content/ceiling", () => ({ ceilingBeforeRound: vi.fn(async () => null) }));
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: vi.fn(async () => null), requireMember: vi.fn(async () => ({ agentId: "a1" })), getViewer: vi.fn(async () => ({ agentId: "a1" })) }));

const { POST } = await import("@/app/api/content-draft/route");
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/content-draft", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": `10.3.0.${Math.random()}` },
}));

beforeEach(() => vi.clearAllMocks());

describe("a เขียนเอง round", () => {
  it("takes one of the agent's rounds and polishes", async () => {
    expect((await (await post({ draft: "ร่าง", count: 2 })).json()).ok).toBe(true);
    expect(quota.takeRound).toHaveBeenCalledWith({ agentId: "a1" }, "ai-draft");
  });

  it("refuses an empty draft before counting a round", async () => {
    expect(await (await post({ draft: "   ", count: 1 })).json()).toEqual({ ok: false, error: "พิมพ์ร่างก่อนนะครับ" });
    expect(quota.takeRound).not.toHaveBeenCalled();
  });
});
