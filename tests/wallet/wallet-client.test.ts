import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/studio/wallet/actions", () => ({ startTopUp: vi.fn(), topUpStatus: vi.fn() }));
const { WalletClient } = await import("@/app/studio/wallet/WalletClient");

const draw = (multiplier: number, enabled = true) => renderToStaticMarkup(createElement(WalletClient, {
  enabled, multiplier, balanceSatang: 0, entries: [], rounds: { used: 0, limit: 10 }, paid: null,
}));

describe("the top-up buttons (owner, 2026-10-01)", () => {
  it("say what each buys in posts, not rounds", () => {
    const html = draw(2);
    for (const posts of [40, 80, 120, 160, 400]) expect(html).toContain(`ได้โพสต์ประมาณ ${posts} ชิ้น`);
    expect(html).not.toMatch(/ประมาณ \d+ รอบ/);
  });

  it("give the average price of a post once, under the buttons", () => {
    expect(draw(2)).toContain("เฉลี่ยโพสต์ละไม่ถึง ฿1.50");
  });

  it("follow the owner's multiplier", () => {
    expect(draw(3)).toContain("ได้โพสต์ประมาณ 25 ชิ้น");
    expect(draw(3)).toContain("เฉลี่ยโพสต์ละไม่ถึง ฿2.00");
  });

  it("are not drawn while the owner has the wallet off", () => {
    expect(draw(2, false)).not.toContain("ได้โพสต์ประมาณ");
  });
});

describe("a frozen wallet (owner, 2026-10-01)", () => {
  const frozen = renderToStaticMarkup(createElement(WalletClient, {
    enabled: true, multiplier: 2, balanceSatang: 0, frozen: true, entries: [
      { id: "e1", kind: "clawback", amountSatang: -1500, round: null, note: "คืนเงินยอดเติมผ่าน Stripe รวม ฿100.00", createdAt: "2026-10-01T03:00:00Z" },
    ], rounds: { used: 10, limit: 10 }, paid: null,
  }));

  it("says it is paused and to contact the office", () => {
    expect(frozen).toContain("ถูกพักไว้ชั่วคราว");
    expect(frozen).toContain("ติดต่อสำนักงาน");
  });

  it("offers no top-up while paused", () => {
    expect(frozen).not.toContain("ได้โพสต์ประมาณ");
  });

  it("names the money taken back in the history", () => {
    expect(frozen).toContain("หักคืน (คืนเงินยอดเติมผ่าน Stripe รวม ฿100.00)");
  });

  it("says nothing of a pause on a wallet that is not frozen", () => {
    expect(draw(2)).not.toContain("ถูกพักไว้");
  });
});
