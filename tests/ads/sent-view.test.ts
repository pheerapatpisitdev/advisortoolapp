import { describe, expect, it } from "vitest";
import {
  CTA_LABEL,
  OBJECTIVE_LABEL,
  activateQuestion, badStatus, pauseQuestion, sendBadge, sendButtons, sendOutcome, statusText, switchedOn, type BadgeShape, type SendShape,
} from "@/lib/ads/sent-view";
import type { SendResult } from "@/lib/ads/send";
import type { AdSend, AdSendItem } from "@/lib/ads/send-store";

const send = (over: Partial<SendShape> = {}): SendShape => ({
  step: "ads", activatedAt: null, pausedAt: null, hasMetaCampaign: true, hasAdset: true, metaStatus: "PAUSED",
  madeAfterActivation: 0, items: [{ adId: "A1" }, { adId: "A2" }], ...over,
});
const T1 = "2026-10-04T01:00:00.000Z";
const T2 = "2026-10-04T02:00:00.000Z";

describe("a send's buttons", () => {
  it("a paused send made in full: switch on and pause, nothing to retry", () => {
    expect(sendButtons(send())).toEqual({ retry: false, activate: true, pause: true });
  });

  it("a running send: pause only", () => {
    expect(sendButtons(send({ activatedAt: T1, metaStatus: "ACTIVE" }))).toEqual({ retry: false, activate: false, pause: true });
  });

  it("offers pause whenever there is a Meta campaign, whatever the switch-on record says", () => {
    expect(sendButtons(send({ activatedAt: null })).pause).toBe(true);
    expect(sendButtons(send({ hasMetaCampaign: false, hasAdset: false, step: "none", items: [{ adId: null }] })).pause).toBe(false);
  });

  it("offers switch-on again after a pause, for ads made after the switch-on, or when Meta says it is not running", () => {
    expect(sendButtons(send({ activatedAt: T1, pausedAt: T2, metaStatus: "PAUSED" })).activate).toBe(true);
    expect(sendButtons(send({ activatedAt: T1, madeAfterActivation: 1, metaStatus: "ACTIVE" })).activate).toBe(true);
    expect(sendButtons(send({ activatedAt: T1, metaStatus: "PAUSED" })).activate).toBe(true);
    // a switch-on after a pause counts as on
    expect(sendButtons(send({ activatedAt: T2, pausedAt: T1, metaStatus: "ACTIVE" })).activate).toBe(false);
  });

  it("does not offer switch-on before the ad set and one ad exist", () => {
    expect(sendButtons(send({ hasAdset: false, step: "campaign", items: [{ adId: null }] })).activate).toBe(false);
    expect(sendButtons(send({ items: [{ adId: null }] })).activate).toBe(false);
  });

  it("offers retry when a step or an ad is missing", () => {
    expect(sendButtons(send({ step: "adset" })).retry).toBe(true);
    expect(sendButtons(send({ items: [{ adId: "A1" }, { adId: null }] })).retry).toBe(true);
  });
});

describe("switched on", () => {
  it("is on after a switch-on not followed by a pause", () => {
    expect(switchedOn({ activatedAt: null, pausedAt: null })).toBe(false);
    expect(switchedOn({ activatedAt: T1, pausedAt: null })).toBe(true);
    expect(switchedOn({ activatedAt: T1, pausedAt: T2 })).toBe(false);
    expect(switchedOn({ activatedAt: T2, pausedAt: T1 })).toBe(true);
  });
});

describe("the words", () => {
  it("names Meta's status in Thai, and keeps one it does not know", () => {
    expect(statusText("ACTIVE")).toBe("กำลังวิ่ง");
    expect(statusText("SOMETHING_NEW")).toBe("SOMETHING_NEW");
    expect(statusText(null)).toBeNull();
    expect(badStatus("DISAPPROVED")).toBe(true);
    expect(badStatus("PAUSED")).toBe(false);
  });

  it("asks before spending with the account, the Page and the daily budget", () => {
    const q = activateQuestion({ what: "เปิดใช้ทั้งชุด", account: "LuckyPlanner (act_1)", page: "เพจ A", dailyBudgetBaht: 1500 });
    expect(q).toContain("เปิดใช้ทั้งชุด?");
    expect(q).toContain("LuckyPlanner (act_1)");
    expect(q).toContain("เพจ A");
    expect(q).toContain("฿1,500 ต่อวัน");
    const p = pauseQuestion({ what: "หยุดทั้งชุด", account: "acc", page: "เพจ B", dailyBudgetBaht: 200 });
    expect(p).toContain("หยุดทั้งชุด?");
    expect(p).toContain("acc");
    expect(p).toContain("เพจ B");
    expect(p).toContain("฿200 ต่อวัน");
  });
});

describe("a send's badge", () => {
  const badge = (over: Partial<BadgeShape> = {}) => sendBadge({
    activatedAt: null, pausedAt: null, hasMetaCampaign: true, metaStatus: "PAUSED",
    items: [{ effectiveStatus: "CAMPAIGN_PAUSED" }], ...over,
  });

  it("says no money is spent only when Meta says paused, or there is no Meta campaign", () => {
    expect(badge()).toEqual({ on: false, text: "หยุดไว้ — ยังไม่เสียเงิน", since: null });
    expect(badge({ hasMetaCampaign: false, metaStatus: null, items: [{ effectiveStatus: null }] }).text).toBe("หยุดไว้ — ยังไม่เสียเงิน");
  });

  it("makes no money claim when Meta's status could not be read", () => {
    expect(badge({ metaStatus: null, items: [{ effectiveStatus: null }] })).toEqual({ on: false, text: "หยุดไว้", since: null });
    expect(badge({ metaStatus: "IN_PROCESS", items: [{ effectiveStatus: null }] }).text).toBe("หยุดไว้");
  });

  it("says running whenever Meta says the campaign or any ad is ACTIVE, even with no switch-on record", () => {
    expect(badge({ metaStatus: "ACTIVE" })).toEqual({ on: true, text: "กำลังวิ่ง — เปิดใช้ไม่ครบ", since: null });
    expect(badge({ metaStatus: null, items: [{ effectiveStatus: "ACTIVE" }] }).text).toBe("กำลังวิ่ง — เปิดใช้ไม่ครบ");
    expect(badge({ activatedAt: T1, metaStatus: "ACTIVE" })).toEqual({ on: true, text: "กำลังวิ่ง — เปิดใช้แล้ว", since: T1 });
    // a pause on record that Meta does not show: still running, never "no money"
    expect(badge({ activatedAt: T1, pausedAt: T2, metaStatus: "ACTIVE" })).toEqual({ on: true, text: "กำลังวิ่ง", since: null });
  });

  it("keeps the switch-on record when Meta does not say ACTIVE and does not say paused", () => {
    expect(badge({ activatedAt: T1, metaStatus: null, items: [{ effectiveStatus: null }] })).toEqual({ on: true, text: "เปิดใช้แล้ว", since: T1 });
    expect(badge({ activatedAt: T1, metaStatus: "PAUSED" })).toEqual({ on: false, text: "หยุดไว้ — ยังไม่เสียเงิน", since: null });
  });
});

describe("how each piece went, after a send", () => {
  const SEND = { id: "S1" } as unknown as AdSend;

  it("names made, failed and left-out pieces", () => {
    const res: SendResult = {
      ok: true, send: SEND, skipped: [{ pieceId: "P3", reason: "ยังไม่ได้อนุมัติ" }],
      items: [{ pieceId: "P1", adId: "A1", error: null }, { pieceId: "P2", adId: null, error: "Meta ปฏิเสธ" }] as unknown as AdSendItem[],
    };
    expect(sendOutcome(res, "P1")).toEqual({ tone: "ok", text: "สร้างแล้ว (หยุดไว้)" });
    expect(sendOutcome(res, "P2")).toEqual({ tone: "bad", text: "ไม่สำเร็จ — Meta ปฏิเสธ" });
    expect(sendOutcome(res, "P3")).toEqual({ tone: "warn", text: "กันออก — ยังไม่ได้อนุมัติ" });
  });

  it("sends a piece to the sent tab's retry only when the send exists", () => {
    const broke: SendResult = { ok: false, step: "campaign", error: "x", send: SEND };
    expect(sendOutcome(broke, "P1").text).toContain("แท็บส่งแล้ว");
  });

  it("says nothing was made, and to press send again, when the send was refused before it existed", () => {
    const refused: SendResult = { ok: false, step: "check", error: "มีรอบส่งอื่นกำลังเริ่มอยู่" };
    const line = sendOutcome(refused, "P1");
    expect(line.text).not.toContain("แท็บส่งแล้ว");
    expect(line.text).toContain("ยังไม่ได้สร้างอะไร");
    expect(line.text).toContain("กดส่งอีกครั้ง");
  });
});

describe("an objective and a lead button in Thai", () => {
  it("names every objective and the three buttons", () => {
    expect(OBJECTIVE_LABEL).toEqual({ traffic: "ทราฟฟิก", leads: "ฟอร์มลีด", messages: "ข้อความ" });
    expect(CTA_LABEL).toEqual({ GET_QUOTE: "รับใบเสนอราคา", SIGN_UP: "ลงทะเบียน", LEARN_MORE: "ดูเพิ่มเติม" });
  });
});
