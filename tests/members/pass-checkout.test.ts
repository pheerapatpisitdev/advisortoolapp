import { describe, expect, it } from "vitest";
import { PASS_CHECKOUT_TAG, PASS_PURPOSE, passCheckoutParams } from "@/lib/members/pass-checkout";

const base = { memberId: "00000000-0000-4000-8000-000000000003", origin: "https://www.advisortool.app" };

describe("the Checkout Session for a member pass", () => {
  it("charges the pass price in baht, once, under the pass's own name", () => {
    const p = passCheckoutParams({ ...base, satang: 9900 });
    expect(p.mode).toBe("payment");
    expect(p.line_items).toEqual([
      { quantity: 1, price_data: { currency: "thb", unit_amount: 9900, product_data: { name: "ค่าสมาชิก AdvisorTool 30 วัน" } } },
    ]);
  });

  it("says whose pass it is and that it is a pass, and comes back to the membership page", () => {
    const p = passCheckoutParams({ ...base, satang: 9900 });
    expect(p.client_reference_id).toBe(base.memberId);
    expect(p.metadata).toEqual({ purpose: "member_pass", member_id: base.memberId });
    expect(PASS_PURPOSE).toBe("member_pass");
    expect(p.success_url).toBe("https://www.advisortool.app/membership?paid={CHECKOUT_SESSION_ID}");
    expect(p.cancel_url).toBe("https://www.advisortool.app/membership");
  });

  it("leaves the card out below ฿150 and offers it from ฿150, never naming the methods", () => {
    const at99 = passCheckoutParams({ ...base, satang: 9900 }) as Record<string, unknown>;
    expect(at99.excluded_payment_method_types).toEqual(["card"]);
    const at150 = passCheckoutParams({ ...base, satang: 15000 }) as Record<string, unknown>;
    expect(at150.excluded_payment_method_types).toBeUndefined();
    expect(at99.payment_method_types).toBeUndefined();
    expect(at150.payment_method_types).toBeUndefined();
  });

  it("is tagged as the pass checkout, apart from the wallet's", () => {
    const p = passCheckoutParams({ ...base, satang: 9900 }) as Record<string, unknown>;
    expect(p.integration_identifier).toBe(PASS_CHECKOUT_TAG);
    expect(PASS_CHECKOUT_TAG).toBe("member-pass-r7kq2wne");
    expect(p.automatic_tax).toBeUndefined();
  });
});
