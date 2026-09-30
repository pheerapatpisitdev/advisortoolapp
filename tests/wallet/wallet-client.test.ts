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
