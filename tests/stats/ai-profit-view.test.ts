import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildProfit } from "@/lib/stats/ai-profit";
import { ProfitView } from "@/app/admin/ai-profit/ProfitView";

// กำไรค่า AI as the first tab of การใช้งานและค่า AI (owner chose ก, 2026-10-23)
const profit = buildProfit({
  ledger: [
    { model: "gemini-2.5-flash", task: "studio-picture", agentId: "a1", thb: 3 },
    { model: "claude-sonnet-5", task: "bot-reply", agentId: null, thb: 1 },
  ],
  providerOf: (m) => (m.startsWith("claude") ? "anthropic" : "google"),
  charges: [],
  owners: new Set(),
  passes: [{ satang: 19900 }],
  moneyIn: [{ kind: "topup", satang: 50000 }],
  unspentSatang: 0,
});
const html = renderToStaticMarkup(createElement(ProfitView, { p: profit, costHref: "/admin/stats?tab=provider" }));

describe("ProfitView", () => {
  it("shows the sum: money in, less the AI cost, is the profit", () => {
    expect(html).toContain("เงินที่ลูกค้าเติมเข้าระบบ");
    expect(html).toContain("ต้นทุนค่า AI ที่จ่ายให้บริษัท AI");
    expect(html).toContain("กำไร");
  });

  it("sends the cost by company to the tab beside it instead of repeating it", () => {
    expect(html).toContain('href="/admin/stats?tab=provider"');
    expect(html).not.toContain("ต้นทุนจ่ายให้ใคร");
  });

  it("still says where the money came from", () => {
    expect(html).toContain("เงินเข้ามาจากไหน");
  });
});
