import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** The owner's price table (owner, 2026-10-12), on /admin/prices since 2026-10-15 (owner chose ข). */

vi.mock("@/app/admin/wallet/actions", () => ({ savePrices: vi.fn(), saveWallet: vi.fn(), adjustAgentWallet: vi.fn(), unfreezeAgentWallet: vi.fn(), saveMemberPass: vi.fn(), saveReferral: vi.fn(), saveFreeCap: vi.fn() }));
const { PricesAdmin } = await import("@/app/admin/prices/PricesAdmin");
const { DEFAULT_PRICES } = await import("@/lib/wallet/prices");

const { DEFAULT_PASS_SETTINGS } = await import("@/lib/members/pass");

// the Super Admin's alone since 2026-10-15, so there is no read-only way to draw it any more
type Free = Parameters<typeof PricesAdmin>[0]["free"];
const draw = (_editable: true, prices = DEFAULT_PRICES, pass: typeof DEFAULT_PASS_SETTINGS | null = DEFAULT_PASS_SETTINGS, free: Free = null) =>
  renderToStaticMarkup(createElement(PricesAdmin, { prices, pass, referral: null, report: null, free }));

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
  it("shows the switch and the three numbers for the owner, with a save button", () => {
    const html = draw(true, DEFAULT_PRICES, { enabled: true, satang: 14950, trialDays: 3, rounds: 10, videos: 2 });
    expect(html).toContain("ค่าสมาชิกทั่วไป");
    expect(html).toContain("เก็บค่าสมาชิกทั่วไป (ปิดอยู่ = สมาชิกทุกคนใช้ฟรีเหมือนวันนี้)");
    expect(html).toMatch(/id="pass-price"[^>]*value="149.50"/);
    expect(html).toMatch(/id="trial-days"[^>]*value="3"/);
    expect(html).toMatch(/id="pass-rounds"[^>]*value="10"/);
    expect(html).toMatch(/id="pass-videos"[^>]*value="2"/);
    expect(html).toContain("ราคาต่ำกว่า ฿150 จ่ายได้แค่พร้อมเพย์");
  });

  it("opens with the pass's own price", () => {
    expect(draw(true)).toMatch(/id="pass-price"[^>]*value="99"/);
  });

  it("says so when the settings cannot be read", () => {
    expect(draw(true, DEFAULT_PRICES, null)).toContain("อ่านการตั้งค่าค่าสมาชิกไม่ได้");
  });
});

describe("เพดานงบใช้ฟรีต่อเดือน (owner, 2026-10-15)", () => {
  const free = (cap: number | null, studioThb: number, clipsThb: number): Free =>
    ({ cap, spent: { studioThb, clipsThb, thb: studioThb + clipsThb }, monthly: 500, until: "1 พ.ย." });

  it("shows the ceiling, the month's use split by Studio and clips, and how far along it is", () => {
    const html = draw(true, DEFAULT_PRICES, DEFAULT_PASS_SETTINGS, free(300, 111.55, 54.21));
    expect(html).toMatch(/id="free-cap"[^>]*value="300"/);
    expect(html).toContain("ใช้ไปเดือนนี้ <b>฿165.76</b> จาก ฿300");
    expect(html).toContain("55% · ยังใช้ได้");
    expect(html).toContain("รอบฟรี Studio ฿111.55");
    expect(html).toContain("คลิปฟรี ฿54.21");
    expect(html).toContain("ต้องไม่เกินงบ AI รวม ฿500");
  });

  it("says when it is full and when the free rounds come back", () => {
    expect(draw(true, DEFAULT_PRICES, DEFAULT_PASS_SETTINGS, free(300, 250, 60))).toContain("เต็มแล้ว · รอบฟรีหยุดถึงวันที่ 1 พ.ย.");
  });

  it("is an empty box with no ceiling, and says so when it cannot be read", () => {
    const none = draw(true, DEFAULT_PRICES, DEFAULT_PASS_SETTINGS, free(null, 10, 0));
    expect(none).toMatch(/id="free-cap"[^>]*value=""/);
    expect(none).not.toContain("% · ยังใช้ได้");
    expect(draw(true)).toContain("อ่านเพดานงบใช้ฟรีไม่ได้");
  });
});
