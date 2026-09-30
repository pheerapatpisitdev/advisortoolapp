import { beforeEach, describe, expect, it, vi } from "vitest";

const construct = vi.hoisted(() => vi.fn());
const client = vi.hoisted(() => ({ stripe: vi.fn() }));
vi.mock("@/lib/stripe/client", () => client);
const events = vi.hoisted(() => ({ actionFor: vi.fn(() => ({ kind: "ignore", why: "t" })), applyWalletAction: vi.fn(async () => "ignored") }));
vi.mock("@/lib/wallet/events", () => events);

const { POST } = await import("@/app/api/stripe/webhook/route");

const req = (body = "{}", sig: string | null = "t=1,v1=x") =>
  new Request("https://x.test/api/stripe/webhook", { method: "POST", body, headers: sig ? { "stripe-signature": sig } : {} }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  client.stripe.mockReturnValue({ webhooks: { constructEvent: construct } });
  construct.mockReturnValue({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });
});

describe("the Stripe webhook", () => {
  it("checks the signature over the exact body Stripe sent", async () => {
    const res = await POST(req('{"a":1}'));
    expect(res.status).toBe(200);
    expect(construct).toHaveBeenCalledWith('{"a":1}', "t=1,v1=x", "whsec_test");
  });

  it("refuses a body whose signature does not check out, and applies nothing", async () => {
    construct.mockImplementationOnce(() => { throw new Error("bad sig"); });
    expect((await POST(req())).status).toBe(400);
    expect(events.applyWalletAction).not.toHaveBeenCalled();
  });

  it("refuses when no signature came", async () => {
    expect((await POST(req("{}", null))).status).toBe(400);
  });

  it("answers 500 when the database fails, so Stripe sends it again", async () => {
    events.applyWalletAction.mockRejectedValueOnce(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(req())).status).toBe(500);
    err.mockRestore();
  });

  it("answers 500 when the secret is not set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(req())).status).toBe(500);
    err.mockRestore();
  });

  it("answers 500, not a bad signature, when the Stripe key is not set", async () => {
    client.stripe.mockImplementationOnce(() => { throw new Error("STRIPE_SECRET_KEY is not set"); });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("not configured");
    expect(construct).not.toHaveBeenCalled();
    expect(events.applyWalletAction).not.toHaveBeenCalled();
    err.mockRestore();
  });
});
