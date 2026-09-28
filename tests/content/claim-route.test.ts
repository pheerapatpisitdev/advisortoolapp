import { beforeEach, describe, expect, it, vi } from "vitest";

/** รีวิวเคลม's writing step counts against the agent's monthly allowance, as its reading does. */

const quota = vi.hoisted(() => ({ takeRound: vi.fn() }));
const run = vi.hoisted(() => ({ readClaim: vi.fn(), writeClaim: vi.fn() }));
vi.mock("@/lib/auth/quota", () => quota);
vi.mock("@/lib/content/claim-run", () => run);
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: vi.fn(async () => null), requireMember: vi.fn(async () => ({ agentId: "a1" })) }));

const { PUT } = await import("@/app/api/content-claim/route");

function writeRequest(): Request {
  const form = new FormData();
  form.set("consent", "on");
  form.set("facts", JSON.stringify({ kind: "ipd" }));
  form.set("count", "1");
  return new Request("http://localhost/api/content-claim", { method: "PUT", body: form, headers: { "x-forwarded-for": `10.0.0.${Math.random()}` } });
}

beforeEach(() => {
  vi.clearAllMocks();
  run.writeClaim.mockResolvedValue({ ok: true, items: [] });
});

describe("writing a รีวิวเคลม", () => {
  it("takes one of the agent's rounds", async () => {
    quota.takeRound.mockResolvedValue(null);
    const res = await PUT(writeRequest() as never);
    expect(res.status).toBe(200);
    expect(quota.takeRound).toHaveBeenCalledWith({ agentId: "a1" }, "ai-claim");
    expect(run.writeClaim).toHaveBeenCalledTimes(1);
  });

  it("writes nothing once the month's rounds are used", async () => {
    quota.takeRound.mockResolvedValue("ใช้ครบแล้วเดือนนี้");
    const res = await PUT(writeRequest() as never);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, error: "ใช้ครบแล้วเดือนนี้" });
    expect(run.writeClaim).not.toHaveBeenCalled();
  });
});
