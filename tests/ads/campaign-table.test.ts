import { describe, expect, it } from "vitest";
import { footLine, money, resultCells, switchPlan, switchQuestion, tableLine, type CampaignRow, type RowSend } from "@/lib/ads/campaign-table";
import { deleteQuestion } from "@/lib/ads/campaign-view";
import { studioHref } from "@/lib/ads/manager-view";

const send = (id: string, on: boolean | null, minor: number, accountName = "บัญชี A (act_1)", ads = 3): RowSend => ({
  id,
  activatedAt: on === null ? null : "2026-10-04T01:00:00Z",
  pausedAt: on === false ? "2026-10-04T02:00:00Z" : null,
  dailyBudgetMinor: minor,
  accountName,
  ads,
});
const row = (id: string, sends: RowSend[], drafts = 2, sent = 1): CampaignRow => ({ id, name: `แคมเปญ ${id}`, planName: "iHealthy", drafts, sent, sends });
const result = { spend: 1234.5, impressions: 12000, clicks: 30, messaging: 4 };

describe("resultCells", () => {
  it("is all dashes with no result, not 0", () => {
    expect(resultCells(undefined)).toEqual({ spend: "—", impressions: "—", clicks: "—", messaging: "—", perChat: "—" });
    expect(resultCells(null).spend).toBe("—");
  });
  it("formats th-TH with ฿ for money", () => {
    expect(resultCells(result)).toEqual({ spend: "฿1,234.50", impressions: "12,000", clicks: "30", messaging: "4", perChat: "฿308.63" });
  });
  it("has no cost per chat without chats", () => {
    expect(resultCells({ ...result, messaging: 0 }).perChat).toBe("—");
  });
  it("money keeps two decimals", () => expect(money(150)).toBe("฿150.00"));
});

describe("tableLine", () => {
  it("a campaign with no sends is a draft with no budget and no results", () => {
    expect(tableLine(row("C", []), undefined)).toEqual({ state: "draft", budget: "—", cells: resultCells(null) });
  });
  it("sums the budgets of the on sends across accounts", () => {
    const line = tableLine(row("C", [send("S1", true, 15000), send("S2", true, 5050, "บัญชี B (act_2)"), send("S3", false, 99900)]), result);
    expect(line.state).toBe("on");
    expect(line.budget).toBe("฿200.50");
    expect(line.cells.spend).toBe("฿1,234.50");
  });
  it("paused sends: paused, no budget", () => {
    expect(tableLine(row("C", [send("S1", false, 15000), send("S2", null, 15000)]), undefined)).toMatchObject({ state: "paused", budget: "—" });
  });
});

describe("footLine", () => {
  it("adds counts, running budgets and the results there are", () => {
    const rows = [row("A", [send("S1", true, 10000)], 1, 2), row("B", [], 3, 0), row("C", [send("S2", true, 5000)], 0, 4)];
    const foot = footLine(rows, { A: result, C: { spend: 100, impressions: 1000, clicks: 5, messaging: 1 } });
    expect(foot.drafts).toBe(4);
    expect(foot.sent).toBe(6);
    expect(foot.budget).toBe("฿150.00");
    expect(foot.cells).toEqual({ spend: "฿1,334.50", impressions: "13,000", clicks: "35", messaging: "5", perChat: "฿266.90" });
  });
  it("is dashes with no results and no running budget", () => {
    const foot = footLine([row("A", [send("S1", false, 1000)])], {});
    expect(foot.budget).toBe("—");
    expect(foot.cells.spend).toBe("—");
    expect(foot.cells.messaging).toBe("—");
  });
});

describe("switchPlan / switchQuestion", () => {
  it("no send: no switch", () => expect(switchPlan([])).toBeNull());
  it("on: pauses every send that is on", () => {
    const plan = switchPlan([send("S1", true, 15000), send("S2", false, 1000), send("S3", true, 5000, "บัญชี B (act_2)")]);
    expect(plan?.kind).toBe("pause");
    expect(plan?.kind === "pause" && plan.sends.map((s) => s.id)).toEqual(["S1", "S3"]);
    const q = switchQuestion(plan!, { campaign: "แคมเปญ X", page: "เพจ Y" });
    expect(q).toContain('หยุดแคมเปญ "แคมเปญ X" (2 ชุดที่เปิดอยู่)?');
    expect(q).toContain("บัญชีโฆษณา: บัญชี A (act_1), บัญชี B (act_2)");
    expect(q).toContain("เพจ: เพจ Y");
    expect(q).toContain("งบ: ฿200 ต่อวัน");
    expect(q).toContain("หยุดใช้เงิน");
  });
  it("off: switches on the newest send, with the activate question", () => {
    const plan = switchPlan([send("NEW", false, 30000, "บัญชี B (act_2)", 4), send("OLD", null, 1000)]);
    expect(plan).toMatchObject({ kind: "activate", send: { id: "NEW" } });
    const q = switchQuestion(plan!, { campaign: "แคมเปญ X", page: "เพจ Y" });
    expect(q).toContain('เปิดใช้ทั้งชุด (4 แอด) ของแคมเปญ "แคมเปญ X"?');
    expect(q).toContain("บัญชีโฆษณา: บัญชี B (act_2)");
    expect(q).toContain("งบ: ฿300 ต่อวัน");
    expect(q).toContain("เริ่มใช้เงิน");
  });
});

describe("deleteQuestion", () => {
  it("warns about live sends first, then sent ads, else nothing extra", () => {
    expect(deleteQuestion({ title: "X", live: 2, sent: true })).toContain("มีแอดที่เปิดใช้อยู่ 2 ชุด");
    const sent = deleteQuestion({ title: "X", live: 0, sent: true });
    expect(sent).toContain("จะยังอยู่ในตัวจัดการโฆษณา (หยุดไว้)");
    expect(sent).not.toContain("เปิดใช้อยู่");
    expect(deleteQuestion({ title: "X", live: 0, sent: false })).toBe('ลบแคมเปญ "X" และแอดทั้งหมดในแคมเปญนี้ออกจาก Ads Studio?\n\nลบแล้วกู้คืนไม่ได้');
  });
});

describe("studioHref", () => {
  it("keeps the Page, the campaign, the tab and a 30-day range", () => {
    expect(studioHref({ page: "P1", campaign: "C1", tab: "ads", days: 30 })).toBe("/studio/ads?page=P1&campaign=C1&tab=ads&days=30");
  });
  it("leaves out what is not chosen", () => {
    expect(studioHref({ page: null, campaign: null, tab: "campaigns", days: 7 })).toBe("/studio/ads?tab=campaigns");
  });
  it("encodes ids", () => expect(studioHref({ page: "a&b", campaign: null, tab: "page", days: 7 })).toBe("/studio/ads?page=a%26b&tab=page"));
});
