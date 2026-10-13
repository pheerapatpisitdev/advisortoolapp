import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** The owner's price table on /admin/wallet (owner, 2026-10-12). */

vi.mock("@/app/admin/wallet/actions", () => ({ savePrices: vi.fn(), saveWallet: vi.fn(), adjustAgentWallet: vi.fn(), unfreezeAgentWallet: vi.fn(), saveMemberPass: vi.fn() }));
const { WalletAdmin } = await import("@/app/admin/wallet/WalletAdmin");
const { DEFAULT_PRICES } = await import("@/lib/wallet/prices");

const { DEFAULT_PASS_SETTINGS } = await import("@/lib/members/pass");

const draw = (canPrice: boolean, prices = DEFAULT_PRICES, pass: typeof DEFAULT_PASS_SETTINGS | null = DEFAULT_PASS_SETTINGS) =>
  renderToStaticMarkup(createElement(WalletAdmin, {
    settings: { enabled: true, multiplier: 2 }, rows: [], frozen: [], prices, pass, canPrice,
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

describe("the member pass box (owner, 2026-10-13)", () => {
  it("shows the switch and the three numbers for the owner, with a save button", () => {
    const html = draw(true, DEFAULT_PRICES, { enabled: true, satang: 14950, trialDays: 3, rounds: 10 });
    expect(html).toContain("ค่าสมาชิกทั่วไป");
    expect(html).toContain("เก็บค่าสมาชิกทั่วไป (ปิดอยู่ = สมาชิกทุกคนใช้ฟรีเหมือนวันนี้)");
    expect(html).toMatch(/id="pass-price"[^>]*value="149.50"/);
    expect(html).toMatch(/id="trial-days"[^>]*value="3"/);
    expect(html).toMatch(/id="pass-rounds"[^>]*value="10"/);
    expect(html).toContain("ราคาต่ำกว่า ฿150 จ่ายได้แค่พร้อมเพย์");
  });

  it("is read-only for an admin who is not the owner", () => {
    const html = draw(false);
    expect(html).toContain("เจ้าของเท่านั้นที่แก้ได้");
    expect(html).toMatch(/id="pass-price"[^>]*disabled/);
    expect(html).toMatch(/id="pass-price"[^>]*value="99"/);
  });

  it("says so when the settings cannot be read", () => {
    expect(draw(true, DEFAULT_PRICES, null)).toContain("อ่านการตั้งค่าค่าสมาชิกไม่ได้");
  });
});
