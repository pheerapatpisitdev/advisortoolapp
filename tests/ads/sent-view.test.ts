import { describe, expect, it } from "vitest";
import {
  activateQuestion, badStatus, legacyButtons, pauseQuestion, sendButtons, statusText, switchedOn, type SendShape,
} from "@/lib/ads/sent-view";

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

describe("an ad launched one by one", () => {
  it("switches on when made and off, and pauses whenever the ad exists", () => {
    expect(legacyButtons({ step: "ad", activatedAt: null, canPause: true })).toEqual({ activate: true, pause: true });
    expect(legacyButtons({ step: "ad", activatedAt: T1, canPause: true })).toEqual({ activate: false, pause: true });
    expect(legacyButtons({ step: "creative", activatedAt: null, canPause: false })).toEqual({ activate: false, pause: false });
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
