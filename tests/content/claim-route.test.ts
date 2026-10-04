import { beforeEach, describe, expect, it, vi } from "vitest";

/** รีวิวเคลม's writing step counts against the agent's monthly allowance, as its reading does. */

const quota = vi.hoisted(() => ({ takeRound: vi.fn() }));
const run = vi.hoisted(() => ({ readClaim: vi.fn(), writeClaim: vi.fn() }));
vi.mock("@/lib/auth/quota", () => quota);
vi.mock("@/lib/content/claim-run", () => run);
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: vi.fn(async () => null), requireMember: vi.fn(async () => ({ agentId: "a1" })) }));
const pages = vi.hoisted(() => ({ projectPage: vi.fn() }));
vi.mock("@/lib/auth/pages", () => pages);
const ceiling = vi.hoisted(() => ({ ceilingBeforeRound: vi.fn(async (): Promise<number | null> => null) }));
vi.mock("@/lib/content/ceiling", () => ceiling);

const { POST, PUT } = await import("@/app/api/content-claim/route");

function readRequest(): Request {
  const form = new FormData();
  form.set("consent", "on");
  form.append("docs", new File([new Uint8Array([1, 2, 3])], "bill.jpg", { type: "image/jpeg" }));
  return new Request("http://localhost/api/content-claim", { method: "POST", body: form, headers: { "x-forwarded-for": `10.0.1.${Math.random()}` } });
}

function writeRequest(format?: string): Request {
  const form = new FormData();
  if (format) form.set("format", format);
  form.set("consent", "on");
  form.set("facts", JSON.stringify({ kind: "ipd" }));
  form.set("count", "1");
  return new Request("http://localhost/api/content-claim", { method: "PUT", body: form, headers: { "x-forwarded-for": `10.0.0.${Math.random()}` } });
}

beforeEach(() => {
  vi.clearAllMocks();
  run.writeClaim.mockResolvedValue({ ok: true, items: [] });
  pages.projectPage.mockResolvedValue({ ok: true, pageId: "p1" });
  ceiling.ceilingBeforeRound.mockResolvedValue(null);
});

describe("writing a รีวิวเคลม", () => {
  it("takes one of the agent's rounds", async () => {
    quota.takeRound.mockResolvedValue({ ok: true, paidBy: "staff" });
    const res = await PUT(writeRequest() as never);
    expect(res.status).toBe(200);
    expect(quota.takeRound).toHaveBeenCalledWith({ agentId: "a1" }, "ai-claim");
    expect(run.writeClaim).toHaveBeenCalledTimes(1);
    expect(run.writeClaim).toHaveBeenCalledWith(expect.anything(), "p1");
  });

  it("refuses an ad before anything is counted or written — ads moved to Ads Studio", async () => {
    const res = await PUT(writeRequest("ad") as never);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "โฆษณาย้ายไปทำใน Ads Studio แล้ว" });
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(run.writeClaim).not.toHaveBeenCalled();
  });

  it("gives an ad request the same answer even without the consent tick", async () => {
    const form = new FormData();
    form.set("format", "ad");
    const res = await PUT(new Request("http://localhost/api/content-claim", { method: "PUT", body: form }) as never);
    expect(await res.json()).toEqual({ ok: false, error: "โฆษณาย้ายไปทำใน Ads Studio แล้ว" });
  });

  it("writes nothing, and counts no round, for a Page the caller does not look after", async () => {
    pages.projectPage.mockResolvedValue({ ok: false, error: "เพจนี้ไม่ได้อยู่ในเพจที่คุณดูแล" });
    const res = await PUT(writeRequest() as never);
    expect(res.status).toBe(403);
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(run.writeClaim).not.toHaveBeenCalled();
  });

  it("writes nothing once the month's rounds are used", async () => {
    quota.takeRound.mockResolvedValue({ ok: false, refusal: "ใช้ครบแล้วเดือนนี้" });
    const res = await PUT(writeRequest() as never);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, error: "ใช้ครบแล้วเดือนนี้" });
    expect(run.writeClaim).not.toHaveBeenCalled();
  });

  it("is refused before a round is counted once the owner's ceiling is reached — reading and writing both", async () => {
    // the round's own check came after takeRound, so a refused round still cost a free round (review, 2026-10-01)
    ceiling.ceilingBeforeRound.mockResolvedValue(30);
    for (const res of [await PUT(writeRequest() as never), await POST(readRequest() as never)]) {
      expect(await res.json()).toEqual({ ok: false, error: expect.stringContaining("ครบ 30 บาท") });
    }
    expect(ceiling.ceilingBeforeRound).toHaveBeenCalledWith({ agentId: "a1" });
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(run.writeClaim).not.toHaveBeenCalled();
    expect(run.readClaim).not.toHaveBeenCalled();
  });
});
