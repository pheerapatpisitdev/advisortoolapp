import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** The owner's price table (owner, 2026-10-12), on /admin/prices since 2026-10-15 (owner chose ข). */

vi.mock("@/app/admin/wallet/actions", () => ({ savePrices: vi.fn(), saveWallet: vi.fn(), adjustAgentWallet: vi.fn(), unfreezeAgentWallet: vi.fn(), saveMemberPass: vi.fn(), saveReferral: vi.fn() }));
const { PricesAdmin } = await import("@/app/admin/prices/PricesAdmin");
const { DEFAULT_PRICES } = await import("@/lib/wallet/prices");

const { DEFAULT_PASS_SETTINGS } = await import("@/lib/members/pass");

// the Super Admin's alone since 2026-10-15, so there is no read-only way to draw it any more
const draw = (_editable: true, prices = DEFAULT_PRICES, pass: typeof DEFAULT_PASS_SETTINGS | null = DEFAULT_PASS_SETTINGS) =>
  renderToStaticMarkup(createElement(PricesAdmin, { prices, pass, referral: null, report: null }));

describe("the price table", () => {
  it("shows each price in baht for the owner to change, with a save button", () => {
    const html = draw(true);
    expect(html).toContain("ราคาต่อชิ้น");
    expect(html).toMatch(/id="price-drawGemini"[^>]*value="5"/);
    expect(html).toMatch(/id="price-videoFhc"[^>]*value="3"/);
    expect(html).toContain("บันทึกราคา");
  });

  it("has no read-only mode: the back office is the Super Admin's alone (2026-10-15)", () => {
    const html = draw(true);
    expect(html).not.toContain("เจ้าของเท่านั้น");
    expect(html).not.toMatch(/id="price-drawStandard"[^>]*disabled/);
  });

  it("marks a price that is not above its cost", () => {
    const html = draw(true, { ...DEFAULT_PRICES, drawGemini: 200 });
    // Gemini costs about ฿2.44 a picture: ฿2 is under it
    expect(html).toMatch(/text-\[var\(--bot-red-ink\)\][^>]*>ต้นทุน ≈ ฿2\.44/);
  });
});

describe("the member pass box (owner, 2026-10-13)", () => {
  it("shows the switch, the price, the trial and the two credits for the owner, with a save button", () => {
    const html = draw(true, DEFAULT_PRICES, { enabled: true, satang: 14950, trialDays: 3, trialCreditSatang: 1500, creditSatang: 5000 });
    expect(html).toContain("ค่าสมาชิกทั่วไป");
    expect(html).toContain("เก็บค่าสมาชิกทั่วไป (ปิดอยู่ = สมาชิกทุกคนใช้ฟรีเหมือนวันนี้)");
    expect(html).toMatch(/id="pass-price"[^>]*value="149.50"/);
    expect(html).toMatch(/id="trial-days"[^>]*value="3"/);
    expect(html).toMatch(/id="trial-credit"[^>]*value="15"/);
    expect(html).toMatch(/id="pass-credit"[^>]*value="50"/);
    expect(html).not.toContain("pass-rounds");
    expect(html).toContain("ราคาต่ำกว่า ฿150 จ่ายได้แค่พร้อมเพย์");
  });

  it("opens with the pass's own price", () => {
    expect(draw(true)).toMatch(/id="pass-price"[^>]*value="99"/);
  });

  it("says so when the settings cannot be read", () => {
    expect(draw(true, DEFAULT_PRICES, null)).toContain("อ่านการตั้งค่าค่าสมาชิกไม่ได้");
  });
});
