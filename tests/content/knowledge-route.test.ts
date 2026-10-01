import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const quota = vi.hoisted(() => ({ takeRound: vi.fn(async () => ({ ok: true, paidBy: "staff" })) }));
const run = vi.hoisted(() => ({ writeKnowledge: vi.fn(async () => ({ ok: true, items: [], costThb: 0, missing: 0 })) }));
vi.mock("@/lib/auth/quota", () => quota);
// the hourly limit keys on the caller's address, read from the request's headers
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": `10.2.1.${Math.random()}` }) }));
vi.mock("@/lib/content/knowledge-run", () => run);
// the owner's ceiling, asked before the round (ceiling.ts): not reached
vi.mock("@/lib/content/ceiling", () => ({ ceilingBeforeRound: vi.fn(async () => null) }));
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: vi.fn(async () => null), requireMember: vi.fn(async () => ({ agentId: "a1" })), getViewer: vi.fn(async () => ({ agentId: "a1" })) }));

const { POST } = await import("@/app/api/content-knowledge/route");
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/content-knowledge", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": `10.2.0.${Math.random()}` },
}));

beforeEach(() => vi.clearAllMocks());

describe("a ความรู้ round", () => {
  it("takes one of the agent's rounds and writes", async () => {
    const res = await post({ kind: "myth", subject: "group", count: 1 });
    expect((await res.json()).ok).toBe(true);
    expect(quota.takeRound).toHaveBeenCalledWith({ agentId: "a1" }, "ai-knowledge");
  });

  it("refuses a custom subject left empty before counting a round", async () => {
    const res = await post({ kind: "article", subject: "custom", custom: "   ", count: 1 });
    expect(await res.json()).toEqual({ ok: false, error: "เลือกหัวข้อ หรือพิมพ์หัวข้อเองก่อนนะครับ" });
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(run.writeKnowledge).not.toHaveBeenCalled();
  });

  it("refuses a body that is not an object", async () => {
    const res = await POST(new NextRequest("http://localhost/api/content-knowledge", { method: "POST", body: "nope" }));
    expect(res.status).toBe(400);
  });
});
