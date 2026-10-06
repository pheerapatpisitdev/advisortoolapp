import { beforeEach, describe, expect, it, vi } from "vitest";

/** โชว์ผลงาน's reading and writing each count against the agent's monthly allowance, as รีวิวเคลม's do. */

const quota = vi.hoisted(() => ({ takeRound: vi.fn() }));
const run = vi.hoisted(() => ({ readShowcase: vi.fn(), writeShowcase: vi.fn() }));
vi.mock("@/lib/auth/quota", () => quota);
vi.mock("@/lib/content/showcase-run", () => run);
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: vi.fn(async () => null), requireMember: vi.fn(async () => ({ agentId: "a1" })) }));
const pages = vi.hoisted(() => ({ projectPage: vi.fn() }));
vi.mock("@/lib/auth/pages", () => pages);
const ceiling = vi.hoisted(() => ({ ceilingBeforeRound: vi.fn(async (): Promise<number | null> => null) }));
vi.mock("@/lib/content/ceiling", () => ceiling);

const { POST, PUT } = await import("@/app/api/content-showcase/route");

function readRequest(consent = true): Request {
  const form = new FormData();
  if (consent) form.set("consent", "on");
  form.append("docs", new File([new Uint8Array([1, 2, 3])], "receipt.jpg", { type: "image/jpeg" }));
  return new Request("http://localhost/api/content-showcase", { method: "POST", body: form, headers: { "x-forwarded-for": `10.5.1.${Math.random()}` } });
}

function writeRequest(extra: Record<string, string> = {}): Request {
  const form = new FormData();
  form.set("consent", "on");
  form.set("facts", JSON.stringify({ kind: "policy", what: "กรมธรรม์ออกแล้ว" }));
  form.set("count", "1");
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  return new Request("http://localhost/api/content-showcase", { method: "PUT", body: form, headers: { "x-forwarded-for": `10.5.0.${Math.random()}` } });
}

beforeEach(() => {
  vi.clearAllMocks();
  run.writeShowcase.mockResolvedValue({ ok: true, items: [], costThb: 0, missing: 0 });
  run.readShowcase.mockResolvedValue({ ok: true, costThb: 0, facts: {}, docs: [] });
  pages.projectPage.mockResolvedValue({ ok: true, pageId: "p1" });
  ceiling.ceilingBeforeRound.mockResolvedValue(null);
  quota.takeRound.mockResolvedValue({ ok: true, paidBy: "staff" });
});

describe("reading the pictures", () => {
  it("takes one of the agent's rounds", async () => {
    expect((await POST(readRequest() as never)).status).toBe(200);
    expect(quota.takeRound).toHaveBeenCalledWith({ agentId: "a1" }, "ai-showcase");
    expect(run.readShowcase).toHaveBeenCalledTimes(1);
  });

  it("is refused without the customer's consent before anything is counted or read", async () => {
    const res = await POST(readRequest(false) as never);
    expect(res.status).toBe(400);
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(run.readShowcase).not.toHaveBeenCalled();
  });
});

describe("writing a showcase", () => {
  it("takes one of the agent's rounds and writes into the Page it settled", async () => {
    expect((await PUT(writeRequest() as never)).status).toBe(200);
    expect(quota.takeRound).toHaveBeenCalledWith({ agentId: "a1" }, "ai-showcase");
    expect(run.writeShowcase).toHaveBeenCalledWith(expect.anything(), "p1");
  });

  it("refuses an ad: a showcase sells nothing, and ads moved to Ads Studio", async () => {
    const res = await PUT(writeRequest({ format: "ad" }) as never);
    expect(await res.json()).toEqual({ ok: false, error: "โฆษณาย้ายไปทำใน Ads Studio แล้ว" });
    expect(quota.takeRound).not.toHaveBeenCalled();
  });

  it("is refused without consent, for a Page that is not the caller's, and once the ceiling or the allowance is reached", async () => {
    const form = new FormData();
    form.set("facts", "{}");
    expect((await PUT(new Request("http://localhost/api/content-showcase", { method: "PUT", body: form }) as never)).status).toBe(400);

    pages.projectPage.mockResolvedValue({ ok: false, error: "เพจนี้ไม่ได้อยู่ในเพจที่คุณดูแล" });
    expect((await PUT(writeRequest() as never)).status).toBe(403);
    pages.projectPage.mockResolvedValue({ ok: true, pageId: "p1" });

    ceiling.ceilingBeforeRound.mockResolvedValue(30);
    expect(await (await PUT(writeRequest() as never)).json()).toEqual({ ok: false, error: expect.stringContaining("ครบ 30 บาท") });
    ceiling.ceilingBeforeRound.mockResolvedValue(null);

    quota.takeRound.mockResolvedValue({ ok: false, refusal: "ใช้ครบแล้วเดือนนี้" });
    expect((await PUT(writeRequest() as never)).status).toBe(429);
    expect(run.writeShowcase).not.toHaveBeenCalled();
  });
});
