import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/studio/wallet/actions", () => ({ startTopUp: vi.fn(), topUpStatus: vi.fn() }));
const { WalletClient, historyLines } = await import("@/app/studio/wallet/WalletClient");
const { DEFAULT_PRICES } = await import("@/lib/wallet/prices");

const draw = (multiplier: number, enabled = true) => renderToStaticMarkup(createElement(WalletClient, {
  enabled, multiplier, balanceSatang: 0, entries: [], rounds: { used: 0, limit: 10 }, paid: null,
  videos: { left: 1, of: 2 }, prices: DEFAULT_PRICES,
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

describe("the price list (owner, 2026-10-12)", () => {
  it("shows every fixed price, and the free clips left", () => {
    const html = draw(2);
    expect(html).toContain('id="prices"');
    expect(html).toContain("วิดีโอฟรีเหลือ 1/2");
    for (const price of ["฿5 / คลิป", "฿10 / คลิป", "฿3 / คลิป", "+฿2 / คลิป", "฿1 / รูป", "฿2 / รูป", "฿5 / รูป", "฿1 / ครั้ง"]) {
      expect(html).toContain(price);
    }
    expect(html).toContain("เฉลี่ยไม่ถึง ฿1.50 / ชิ้น");
  });

  it("follows the owner's own prices", () => {
    const html = renderToStaticMarkup(createElement(WalletClient, {
      enabled: true, multiplier: 2, balanceSatang: 0, entries: [], rounds: { used: 0, limit: 10 }, paid: null,
      videos: null, prices: { ...DEFAULT_PRICES, drawStandard: 150 },
    }));
    expect(html).toContain("฿1.50 / รูป");
    expect(html).not.toContain("วิดีโอฟรีเหลือ");
  });
});

describe("a frozen wallet (owner, 2026-10-01)", () => {
  const frozen = renderToStaticMarkup(createElement(WalletClient, {
    enabled: true, multiplier: 2, balanceSatang: 0, frozen: true, entries: [
      { id: "e1", kind: "clawback", amountSatang: -1500, creditSatang: 0, round: null, note: "คืนเงินยอดเติมผ่าน Stripe รวม ฿100.00", createdAt: "2026-10-01T03:00:00Z" },
    ], rounds: { used: 10, limit: 10 }, paid: null, videos: null, prices: DEFAULT_PRICES,
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

describe("a member's wallet with pass credit (owner, 2026-10-17; mockup 3NoZWL3b)", () => {
  const NOW = new Date("2026-10-25T03:00:00Z");
  const lots = [
    { id: 12, passId: 2, kind: "paid" as const, amountSatang: 5000, leftSatang: 3800, startsAt: "2026-10-20T03:00:00Z", expiresAt: "2026-11-19T03:00:00Z", voided: false, voidedAt: null },
    { id: 11, passId: 1, kind: "trial" as const, amountSatang: 1500, leftSatang: 1100, startsAt: "2026-10-17T03:00:00Z", expiresAt: "2026-10-20T03:00:00Z", voided: false, voidedAt: null },
  ];
  const entries = [
    { id: "c2", kind: "charge" as const, amountSatang: -300, creditSatang: 700, round: "ai-draw", note: null, createdAt: "2026-10-24T03:00:00Z" },
    { id: "c1", kind: "charge" as const, amountSatang: 0, creditSatang: 500, round: "quote-video", note: null, createdAt: "2026-10-22T03:00:00Z" },
    { id: "t1", kind: "topup" as const, amountSatang: 2000, creditSatang: 0, round: null, note: null, createdAt: "2026-10-21T03:00:00Z" },
  ];

  it("splits the balance into credit first and own money", () => {
    const html = renderToStaticMarkup(createElement(WalletClient, {
      enabled: true, multiplier: 2, balanceSatang: 5500, entries, rounds: { used: 0, limit: 0 }, paid: null, videos: null, prices: DEFAULT_PRICES,
      credit: { name: "เครดิตสมาชิก", own: 1700, satang: 3800, expiresAt: "2026-11-19T03:00:00Z", lots },
    }));
    expect(html).toContain("฿55.00");
    expect(html).toContain("เครดิตสมาชิก (ใช้ก่อน · หมดอายุ 19 พ.ย.)");
    expect(html).toContain("฿38.00");
    expect(html).toContain("เงินที่เติมเอง (ไม่มีวันหมดอายุ)");
    expect(html).toContain("฿17.00");
    expect(html).not.toContain("รอบ AI ฟรีเหลือ");
  });

  it("reads each charge at its whole price, marks what the credit paid, and shows lots given and run out", () => {
    expect(historyLines(entries, lots, NOW).map((l) => [l.label, l.satang])).toEqual([
      ["วาดภาพ · เครดิต ฿7.00", -1000],
      ["วิดีโอนำเสนอ · เครดิตสมาชิก", -500],
      ["เติมเงิน", 2000],
      ["เครดิตสมาชิก 30 วัน", 5000],
      ["เครดิตทดลอง หมดอายุ", -1100],
      ["เครดิตทดลอง", 1500],
    ]);
  });

  it("says a refunded pass's credit was cancelled, not that it ran out", () => {
    const voided = [{ ...lots[0], voided: true, voidedAt: "2026-10-23T03:00:00Z" }];
    expect(historyLines([], voided, NOW).map((l) => l.label)).toEqual([
      "เครดิตสมาชิก 30 วัน ถูกยกเลิก (คืนเงินค่าสมาชิก)", "เครดิตสมาชิก 30 วัน",
    ]);
  });
});

describe("a UnitClub agent's starter credit (owner, 2026-10-18; mockup TFmpdUSV)", () => {
  const starter = { id: 30, passId: null, kind: "starter" as const, amountSatang: 1500, leftSatang: 800, startsAt: "2026-10-18T03:00:00Z", expiresAt: "9999-12-31T00:00:00+00:00", voided: false, voidedAt: null };

  it("is named as UnitClub's and never said to run out", () => {
    const html = renderToStaticMarkup(createElement(WalletClient, {
      enabled: true, multiplier: 2, balanceSatang: 3300, entries: [], rounds: { used: 4, limit: 0 }, paid: null, videos: null, prices: DEFAULT_PRICES,
      credit: { name: "เครดิตเริ่มต้น UnitClub", own: 2500, satang: 800, expiresAt: starter.expiresAt, lots: [starter] },
    }));
    expect(html).toContain("เครดิตเริ่มต้น UnitClub");
    expect(html).toContain("ไม่มีวันหมดอายุ");
    expect(html).not.toContain("หมดอายุ 31");
    expect(historyLines([], [starter], new Date("2026-10-25T03:00:00Z")).map((l) => [l.label, l.satang])).toEqual([["เครดิตเริ่มต้น UnitClub", 1500]]);
  });
});

describe("credit that could not be read (owner, 2026-10-18)", () => {
  it("says so, not 0/0 free rounds", () => {
    const html = renderToStaticMarkup(createElement(WalletClient, {
      enabled: true, multiplier: 2, balanceSatang: 0, entries: [], rounds: { used: 0, limit: 0 }, paid: null, videos: null, prices: DEFAULT_PRICES, creditUnread: true,
    }));
    expect(html).toContain("อ่านเครดิตไม่ได้ ลองเปิดหน้านี้ใหม่");
    expect(html).not.toContain("รอบ AI ฟรีเหลือ 0/0");
  });
});
