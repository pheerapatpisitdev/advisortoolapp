import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildProfit } from "@/lib/stats/ai-profit";
import { Charged } from "@/app/admin/ai-profit/Charged";

// เงินที่ตัดจากกระเป๋าผู้ใช้ on กำไรค่า AI (owner chose ก ก, 2026-10-20)
const profit = buildProfit({
  ledger: [
    { model: "gemini-2.5-flash", task: "quote-video-brief", agentId: "a1", thb: 2 },
    { model: "gemini-2.5-flash", task: "studio-picture", agentId: "owner", thb: 3 },
    { model: "gemini-2.5-flash", task: "bot-reply", agentId: null, thb: 1 },
  ],
  providerOf: () => "google",
  charges: [
    { round: "quote-video", satang: -1000, costThb: 1.5 },
    { round: "quote-video", satang: -500, costThb: 0.5 },
  ],
  owners: new Set(["owner"]),
  passes: [{ satang: 19900 }],
  moneyIn: [{ kind: "topup", satang: 50000 }],
  unspentSatang: 0,
});
const html = renderToStaticMarkup(createElement(Charged, { p: profit }));

describe("the charged card", () => {
  it("shows what was taken from wallets, by job, with its cost and margin", () => {
    expect(html).toContain("เงินที่ตัดจากกระเป๋าผู้ใช้");
    expect(html).toContain("วิดีโอนำเสนอ");
    expect(html).toContain("฿15.00"); // ฿10 + ฿5 taken
    expect(html).toContain("฿2.00"); // their AI cost
    expect(html).toContain("฿13.00"); // the margin
  });

  it("leaves the members' pass out: it is money in, not a charge", () => {
    expect(html).not.toContain("ค่าสมาชิกทั่วไป");
    expect(html).not.toContain("฿199.00");
  });

  it("splits the whole cost by whose work it was", () => {
    expect(html).toContain("ต้นทุน ฿6.00 ไปอยู่ที่ไหน");
    for (const name of ["งานที่เก็บเงินแล้ว", "รอบฟรีของผู้ใช้", "งานของเจ้าของ", "ถาม AI (ฟรีทุกคน)", "บอทและระบบ"]) expect(html).toContain(name);
  });

  it("says so when nothing was taken", () => {
    const none = buildProfit({ ledger: [], providerOf: () => "google", charges: [], owners: new Set(), passes: [], moneyIn: [], unspentSatang: 0 });
    expect(renderToStaticMarkup(createElement(Charged, { p: none }))).toContain("ช่วงนี้ยังไม่มีการตัดเงินจากกระเป๋า");
  });
});
