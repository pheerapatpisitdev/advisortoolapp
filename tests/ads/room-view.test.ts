import { describe, expect, it } from "vitest";
import { drawOffer, inBin, picturePending, planLink, sendBlocker, settledPictures, writeParam, type PictureState } from "@/lib/ads/room-view";

describe("the room's small decisions", () => {
  it("starts a round on arrival only for 1, 2 or 4", () => {
    expect(writeParam("1")).toBe(1);
    expect(writeParam("2")).toBe(2);
    expect(writeParam("4")).toBe(4);
    for (const v of ["3", "0", "8", "", "x", undefined, null]) expect(writeParam(v)).toBe(0);
  });

  it("knows a piece whose poster has no picture still waits for it, whatever its ad holds", () => {
    expect(picturePending({ poster: {} })).toBe(true);
    expect(picturePending({ poster: { background: "/x.png" } })).toBe(false);
    // a piece with no poster at all is not waiting for a picture
    expect(picturePending({ poster: null })).toBe(false);
  });

  it("starts a send's link at the plan's page on the site", () => {
    expect(planLink("/lifeprotect")).toBe("https://advisortool.app/lifeprotect");
    expect(planLink("ihealthy")).toBe("https://advisortool.app/ihealthy");
  });
});

describe("why the send button is shut", () => {
  const ready = { ticked: 3, accounts: [{ currency: "THB" }], thIdentity: true, pageConnected: true };
  it("opens with ticked ads, a baht account, the Page and the verified identity", () => {
    expect(sendBlocker(ready)).toBeNull();
  });
  it("says each missing thing", () => {
    expect(sendBlocker({ ...ready, ticked: 0 })).toBe("ติ๊กเลือกแอดในแท็บร่างก่อน");
    expect(sendBlocker({ ...ready, accounts: [] })).toContain("บัญชีโฆษณา");
    expect(sendBlocker({ ...ready, accounts: [{ currency: "USD" }] })).toContain("THB");
    expect(sendBlocker({ ...ready, thIdentity: false })).toContain("META_TH_VERIFIED_IDENTITY_ID");
    expect(sendBlocker({ ...ready, pageConnected: false })).toContain("เพจ");
  });
});

describe("a picture drawn, until the room has it", () => {
  const style = { variant: { style: "ภาพจริง" }, poster: {} };
  const drawn = { variant: { style: "ภาพจริง" }, poster: { background: "p/bg.png" } };

  it("offers no paid draw button for a picture just drawn, while the refreshed piece is on its way", () => {
    expect(drawOffer("done", true, "draft")).toBeNull();
    expect(drawOffer("wait", true, "draft")).toBeNull();
    expect(drawOffer("drawing", true, "draft")).toBeNull();
    expect(drawOffer(undefined, true, "draft")).toBe("draw");
    expect(drawOffer({ error: "x" }, true, "draft")).toBe("redraw");
    expect(drawOffer(undefined, true, "trash")).toBeNull();
    expect(drawOffer(undefined, false, "draft")).toBeNull();
  });

  it("forgets a drawn picture once the refreshed piece has its background — not before the piece is in", () => {
    const pictures: Record<string, PictureState> = { a: "done", b: "done", c: "drawing", d: "done" };
    const next = settledPictures(pictures, [{ id: "a", ...drawn }, { id: "b", ...style }, { id: "c", ...drawn }]);
    expect(next).toEqual({ b: "done", c: "drawing", d: "done" });
  });

  it("gives back the same record when nothing settles, so the room does not re-render for nothing", () => {
    const pictures: Record<string, PictureState> = { b: "done", c: "wait" };
    expect(settledPictures(pictures, [{ id: "b", ...style }, { id: "c", ...drawn }])).toBe(pictures);
  });
});

describe("a picture waiting its turn", () => {
  it("is skipped when its piece went to the bin meanwhile, not when the room has not seen it yet", () => {
    const pieces = [{ id: "a", tab: "trash" }, { id: "b", tab: "draft" }];
    expect(inBin(pieces, "a")).toBe(true);
    expect(inBin(pieces, "b")).toBe(false);
    expect(inBin(pieces, "new")).toBe(false);
  });
});
