import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PassRow } from "@/lib/members/pass";

/** What /membership says in each state, in the words of the approved mockup (owner, 2026-10-13). */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/app/membership/actions", () => ({ startPass: vi.fn(), passConfirmed: vi.fn() }));
const { MembershipClient } = await import("@/app/membership/MembershipClient");

type Props = Parameters<typeof MembershipClient>[0];
const NOW = "2026-10-13T03:00:00Z";
const row = (r: Partial<PassRow> & Pick<PassRow, "id" | "kind" | "days">): PassRow =>
  ({ revokes: null, createdAt: "2026-10-13T02:00:00Z", amountSatang: null, note: null, ...r });
const base: Props = {
  on: true, pass: { status: "none" }, now: NOW, credit: null, passCredit: 5000,
  priceSatang: 9900, balanceSatang: null, rows: [], paid: null,
};
const draw = (p: Partial<Props>) => renderToStaticMarkup(createElement(MembershipClient, { ...base, ...p }));

describe("the membership page", () => {
  it("in the trial: free until the date, the trial credit left, and renewing by PromptPay below ฿150 (owner, 2026-10-17)", () => {
    const html = draw({
      pass: { status: "live", kind: "trial", end: "2026-10-15T17:30:00Z", periodEnd: "2026-10-15T17:30:00Z" },
      credit: { satang: 1100, of: 1500, expiresAt: "2026-10-15T17:30:00Z" }, rows: [row({ id: 1, kind: "trial", days: 3 })],
    });
    expect(html).toContain("ทดลองใช้ฟรีถึง 16 ต.ค. 2569");
    expect(html).toContain("เหลือ 3 วัน");
    expect(html).toContain("เครดิตทดลอง");
    expect(html).toContain("<b>฿11</b> / ฿15");
    expect(html).toContain("หมดอายุพร้อมช่วงทดลอง · จ่ายแล้วได้ ฿50 ทุกครั้ง");
    expect(html).toContain("ต่ออายุ 30 วัน ฿99");
    expect(html).toContain("ได้ 30 วัน + เครดิต ฿50 · จ่ายด้วยพร้อมเพย์");
    expect(html).toContain("ทดลองใช้ฟรี · +3 วัน");
  });

  it("paid: usable until the end, renewing stacks on it, history newest first", () => {
    const html = draw({
      pass: { status: "live", kind: "paid", end: "2026-11-14T17:30:00Z", periodEnd: "2026-11-14T17:30:00Z" },
      credit: { satang: 3800, of: 5000, expiresAt: "2026-11-14T17:30:00Z" },
      rows: [
        row({ id: 1, kind: "trial", days: 3, createdAt: "2026-10-12T02:00:00Z" }),
        row({ id: 2, kind: "paid", days: 30, amountSatang: 9900 }),
        row({ id: 3, kind: "granted", days: 5, note: "ชดเชย" }),
        row({ id: 4, kind: "revoked", days: 0, revokes: 2 }),
      ],
    });
    expect(html).toContain("ใช้ได้ถึง 15 พ.ย. 2569");
    expect(html).toContain("เครดิต Studio รอบนี้");
    expect(html).toContain("<b>฿38</b> / ฿50");
    expect(html).toContain("ที่เหลือหมดอายุ 15 พ.ย. ไม่ทบ · หมดแล้วใช้เงินที่เติมเอง");
    expect(html).toContain("ต่ออายุอีก 30 วัน ฿99");
    expect(html).toContain("นับต่อจาก 15 พ.ย. · ได้เครดิตอีก ฿50");
    expect(html).toContain("จ่าย ฿99 · +30 วัน");
    expect(html).toContain("เพิ่มให้โดยเจ้าของ · +5 วัน · ชดเชย");
    expect(html).toContain("ยกเลิกเพราะคืนเงิน");
    expect(html.indexOf("ยกเลิกเพราะคืนเงิน")).toBeLessThan(html.indexOf("ทดลองใช้ฟรี · +3 วัน"));
  });

  it("a trial with a paid month stacked after it reads as paid, to the stacked end", () => {
    const html = draw({ pass: { status: "live", kind: "trial", end: "2026-11-14T17:30:00Z", periodEnd: "2026-10-15T17:30:00Z" } });
    expect(html).toContain("ใช้ได้ถึง 15 พ.ย. 2569");
    expect(html).not.toContain("ทดลองใช้ฟรีถึง");
  });

  it("expired: when, and the wallet money still there", () => {
    const html = draw({ pass: { status: "expired", end: "2026-10-10T00:00:00Z" }, balanceSatang: 4250 });
    expect(html).toContain("หมดอายุแล้ว");
    expect(html).toContain("เมื่อ 10 ต.ค. 2569");
    expect(html).toContain("เงินในกระเป๋า Studio ฿42.50 ยังอยู่ครบ ใช้ได้อีกเมื่อต่ออายุ");
    expect(html).toContain("ต่ออายุ 30 วัน ฿99");
    expect(html).not.toContain("เครดิต Studio รอบนี้");
    expect(html).toContain("ได้ 30 วัน + เครดิต ฿50");
  });

  it("lists what every 30 days brings, on the live page and the expired one (owner, 2026-10-17)", () => {
    const live = draw({ pass: { status: "live", kind: "paid", end: "2026-11-14T17:30:00Z", periodEnd: "2026-11-14T17:30:00Z" } });
    expect(live).toContain("ทุก 30 วันได้");
    expect(live).toContain("ถาม AI ไม่จำกัด");
    expect(live).toContain("เครดิต Studio ฿50");
    expect(live).toContain("หน้าคำนวณเบี้ยทุกแบบ");
    expect(live).not.toContain("รอบ</");
    expect(live).not.toContain("คลิป</");

    const expired = draw({ pass: { status: "expired", end: "2026-10-10T00:00:00Z" } });
    expect(expired).toContain("ต่ออายุ ฿99 ได้ 30 วัน");
    expect(expired).toContain("เครดิต Studio ฿50");
    expect(expired).not.toContain("ทุก 30 วันได้");
  });

  it("leaves the credit out of the list and the meter when the owner sets none", () => {
    const html = draw({
      pass: { status: "live", kind: "paid", end: "2026-11-14T17:30:00Z", periodEnd: "2026-11-14T17:30:00Z" },
      credit: { satang: 0, of: 0, expiresAt: null }, passCredit: 0,
    });
    expect(html).not.toContain("เครดิต Studio");
    expect(html).toContain("ถาม AI ไม่จำกัด");
  });

  it("no pass at all reads as expired, without a date", () => {
    const html = draw({ pass: { status: "none" } });
    expect(html).toContain("หมดอายุแล้ว");
    expect(html).not.toContain("เมื่อ ");
  });

  it("offers the card as well from ฿150", () => {
    expect(draw({ priceSatang: 15000 })).toContain("พร้อมเพย์ หรือ บัตร");
  });

  it("while the owner has the pass off: free, and no button to pay", () => {
    const html = draw({ on: false });
    expect(html).toContain("ตอนนี้สมาชิกใช้งานได้ฟรี");
    expect(html).not.toContain("ต่ออายุ");
    expect(html).not.toContain("หมดอายุแล้ว");
  });

  it("back from Stripe: says it is confirming the payment", () => {
    expect(draw({ paid: "cs_test_1" })).toContain("กำลังยืนยันการชำระเงิน…");
  });
});
