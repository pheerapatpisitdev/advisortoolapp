import { describe, expect, it } from "vitest";
import { CHECKOUT_TAG, checkoutParams } from "@/lib/wallet/checkout";

const base = { agentId: "00000000-0000-4000-8000-000000000002", origin: "https://www.advisortool.app" };

describe("the Checkout Session for a top-up", () => {
  it("charges the amount in satang, in baht, once", () => {
    const p = checkoutParams({ ...base, thb: 150 });
    expect(p.mode).toBe("payment");
    expect(p.line_items).toEqual([{ quantity: 1, price_data: { currency: "thb", unit_amount: 15000, product_data: { name: "เติมเงิน Studio ฿150" } } }]);
  });

  it("says whose wallet it is, and comes back to the wallet page", () => {
    const p = checkoutParams({ ...base, thb: 100 });
    expect(p.client_reference_id).toBe(base.agentId);
    expect(p.metadata).toEqual({ agent_id: base.agentId, amount_satang: "10000" });
    expect(p.success_url).toBe("https://www.advisortool.app/studio/wallet?paid={CHECKOUT_SESSION_ID}");
    expect(p.cancel_url).toBe("https://www.advisortool.app/studio/wallet");
  });

  it("never names the payment methods, and leaves cards out below ฿150", () => {
    for (const thb of [50, 100, 150, 200, 500] as const) {
      const p = checkoutParams({ ...base, thb }) as Record<string, unknown>;
      expect(p.payment_method_types).toBeUndefined();
      expect(p.excluded_payment_method_types).toEqual(thb < 150 ? ["card"] : undefined);
    }
  });

  it("is tagged as this checkout, and asks Stripe for no tax", () => {
    const p = checkoutParams({ ...base, thb: 50 }) as Record<string, unknown>;
    expect(p.integration_identifier).toBe(CHECKOUT_TAG);
    expect(CHECKOUT_TAG).toMatch(/^studio-wallet-[a-z]{8}$/);
    expect(p.automatic_tax).toBeUndefined();
  });
});
