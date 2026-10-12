import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** The owner's price table on /admin/wallet (owner, 2026-10-12). */

vi.mock("@/app/admin/wallet/actions", () => ({ savePrices: vi.fn(), saveWallet: vi.fn(), adjustAgentWallet: vi.fn(), unfreezeAgentWallet: vi.fn() }));
const { WalletAdmin } = await import("@/app/admin/wallet/WalletAdmin");
const { DEFAULT_PRICES } = await import("@/lib/wallet/prices");

const draw = (canPrice: boolean, prices = DEFAULT_PRICES) => renderToStaticMarkup(createElement(WalletAdmin, {
  settings: { enabled: true, multiplier: 2 }, rows: [], frozen: [], prices, canPrice,
}));

describe("the price table", () => {
  it("shows each price in baht for the owner to change, with a save button", () => {
    const html = draw(true);
    expect(html).toContain("ราคาต่อชิ้น");
    expect(html).toMatch(/id="price-drawGemini"[^>]*value="5"/);
    expect(html).toMatch(/id="price-videoFhc"[^>]*value="3"/);
    expect(html).toContain("บันทึกราคา");
  });

  it("is read-only for an admin who is not the owner", () => {
    const html = draw(false);
    expect(html).not.toContain("บันทึกราคา");
    expect(html).toContain("เจ้าของเท่านั้นที่แก้ราคาได้");
    expect(html).toMatch(/id="price-drawStandard"[^>]*disabled/);
  });

  it("marks a price that is not above its cost", () => {
    const html = draw(true, { ...DEFAULT_PRICES, drawGemini: 200 });
    // Gemini costs about ฿2.44 a picture: ฿2 is under it
    expect(html).toMatch(/text-\[var\(--bot-red-ink\)\][^>]*>ต้นทุน ≈ ฿2\.44/);
  });
});
