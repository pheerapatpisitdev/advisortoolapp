import { describe, expect, it } from "vitest";
import { picturePending, planLink, roundCost, sendBlocker, writeParam } from "@/lib/ads/room-view";

describe("the room's small decisions", () => {
  it("starts a round on arrival only for 1, 2 or 4", () => {
    expect(writeParam("1")).toBe(1);
    expect(writeParam("2")).toBe(2);
    expect(writeParam("4")).toBe(4);
    for (const v of ["3", "0", "8", "", "x", undefined, null]) expect(writeParam(v)).toBe(0);
  });

  it("says what a round costs about", () => {
    expect(roundCost(1)).toBe("ราว 0.5–1 บาท");
    expect(roundCost(2)).toBe("ราว 1–2 บาท");
    expect(roundCost(4)).toBe("ราว 2–4 บาท");
  });

  it("knows a piece written to a style still waits for its picture", () => {
    expect(picturePending({ variant: { style: "s" }, poster: { } })).toBe(true);
    expect(picturePending({ variant: { style: "s" }, poster: { background: "/x.png" } })).toBe(false);
    // older pieces, and pieces with no poster at all, are not waiting for a picture
    expect(picturePending({ variant: null, poster: {} })).toBe(false);
    expect(picturePending({ variant: { style: "s" }, poster: null })).toBe(false);
  });

  it("starts a send's link at the plan's page on the site", () => {
    expect(planLink("/lifeprotect")).toBe("https://advisortool.app/lifeprotect");
    expect(planLink("ihealthy")).toBe("https://advisortool.app/ihealthy");
  });
});

describe("why the send button is shut", () => {
  const ready = { approved: 3, accounts: [{ currency: "THB" }], thIdentity: true, pageConnected: true };
  it("opens with approved ads, a baht account, the Page and the verified identity", () => {
    expect(sendBlocker(ready)).toBeNull();
  });
  it("says each missing thing", () => {
    expect(sendBlocker({ ...ready, approved: 0 })).toContain("อนุมัติ");
    expect(sendBlocker({ ...ready, accounts: [] })).toContain("บัญชีโฆษณา");
    expect(sendBlocker({ ...ready, accounts: [{ currency: "USD" }] })).toContain("THB");
    expect(sendBlocker({ ...ready, thIdentity: false })).toContain("META_TH_VERIFIED_IDENTITY_ID");
    expect(sendBlocker({ ...ready, pageConnected: false })).toContain("เพจ");
  });
});
