import { describe, expect, it } from "vitest";
import { ctaLabel, foldSplit, pickAd, rowChips, sendOf, startTab } from "@/lib/ads/ads-list";

const pieces = [
  { id: "d1", tab: "draft" as const },
  { id: "d2", tab: "draft" as const },
  { id: "s1", tab: "sent" as const },
  { id: "t1", tab: "trash" as const },
];

describe("which ad the preview shows", () => {
  it("keeps the ad asked for when it sits in the sub-tab", () => {
    expect(pickAd(pieces, "draft", "d2")).toBe("d2");
    expect(pickAd(pieces, "sent", "s1")).toBe("s1");
  });

  it("falls back to the sub-tab's first when the asked ad sits elsewhere (binned or sent meanwhile)", () => {
    expect(pickAd(pieces, "draft", "t1")).toBe("d1");
    expect(pickAd(pieces, "draft", "s1")).toBe("d1");
  });

  it("falls back to the first for an id that is gone, or none asked", () => {
    expect(pickAd(pieces, "draft", "nope")).toBe("d1");
    expect(pickAd(pieces, "trash", null)).toBe("t1");
  });

  it("shows nothing in an empty sub-tab", () => {
    expect(pickAd(pieces.filter((p) => p.tab !== "trash"), "trash", "t1")).toBeNull();
    expect(pickAd([], "draft", "d1")).toBeNull();
  });

  it("opens on the asked ad's sub-tab, ร่าง otherwise", () => {
    expect(startTab(pieces, "s1")).toBe("sent");
    expect(startTab(pieces, "t1")).toBe("trash");
    expect(startTab(pieces, "gone")).toBe("draft");
    expect(startTab(pieces, null)).toBe("draft");
  });
});

describe("the fold in the full text", () => {
  it("leaves nothing after the fold when the text fits", () => {
    expect(foldSplit("สั้นๆ", 125)).toEqual({ before: "สั้นๆ", after: "" });
  });

  it("splits at a space and keeps every letter", () => {
    const text = `${"ก".repeat(100)} ${"ข".repeat(60)}`;
    const { before, after } = foldSplit(text, 125);
    expect(before + after).toBe(text);
    expect(before).toBe("ก".repeat(100));
    expect(after.startsWith(" ")).toBe(true);
  });

  it("never splits a Thai letter from its vowel", () => {
    const text = "ที่".repeat(60);
    const { before, after } = foldSplit(text, 125);
    expect(before + after).toBe(text);
    expect(after === "" || !/^[ัิ-ฺ็-๎]/.test(after)).toBe(true);
  });
});

describe("the button under the post", () => {
  it("says ส่งข้อความ for a draft and for a messages send", () => {
    expect(ctaLabel(null)).toBe("ส่งข้อความ");
    expect(ctaLabel({ objective: "messages", cta: null })).toBe("ส่งข้อความ");
  });

  it("uses the lead button for a lead form, ดูเพิ่มเติม for traffic", () => {
    expect(ctaLabel({ objective: "leads", cta: "GET_QUOTE" })).toBe("รับใบเสนอราคา");
    expect(ctaLabel({ objective: "leads", cta: null })).toBe("ดูเพิ่มเติม");
    expect(ctaLabel({ objective: "traffic", cta: null })).toBe("ดูเพิ่มเติม");
  });

  it("finds the send a piece went up in, newest first", () => {
    const sends = [{ id: "new", items: [{ pieceId: "a" }] }, { id: "old", items: [{ pieceId: "a" }, { pieceId: "b" }] }];
    expect(sendOf(sends, "a")?.id).toBe("new");
    expect(sendOf(sends, "b")?.id).toBe("old");
    expect(sendOf(sends, "c")).toBeNull();
  });
});

describe("a list row's chips", () => {
  it("names the sex and age, then the headline's row", () => {
    expect(rowChips({ sex: "F", age: 30, head: "ประกันชีวิตคุ้มครอง 1,000,000 บาท" })).toEqual(["หญิง · อายุ 30", "ประกันชีวิตคุ้มครอง 1,000,000 บาท"]);
    expect(rowChips({ sex: "M", age: null, head: null })).toEqual(["ชาย"]);
  });

  it("has none for a piece written before the grid", () => {
    expect(rowChips(null)).toEqual([]);
    expect(rowChips({ sex: null, age: null, head: " " })).toEqual([]);
  });
});
