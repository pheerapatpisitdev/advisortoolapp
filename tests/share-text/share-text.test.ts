import { describe, expect, it } from "vitest";
import { readArranged } from "@/lib/share-text/arrange";
import { SHARE_PLAN_KEYS, SHARE_PLANS } from "@/lib/share-text/plans";
import { samplePreview, shareSample } from "@/lib/share-text/samples";
import { thaiDay } from "@/lib/share-text/store";
import { blockSlots, fillTemplate, instalmentBlock, shareText, slotNames, systemNote } from "@/lib/share-text/template";

/**
 * ข้อความส่งให้ลูกค้า in a member's own words (owner, 2026-11-14, ง on mockup
 * https://claude.ai/artifact/6v1b98UZnP7jpCa6AL6opV).
 */
describe("a template filled for a quote", () => {
  it("puts each figure where its slot is", () => {
    expect(fillTemplate("ทุน {ทุน} บาท ปีละ {เบี้ยรายปี} บาท", { "ทุน": "1,000,000", "เบี้ยรายปี": "28,700" }))
      .toBe("ทุน 1,000,000 บาท ปีละ 28,700 บาท");
  });

  /** A monthly premium the company will not take, or one the member hides, has no value. */
  it("leaves out the whole line whose figure this quote does not have", () => {
    const text = fillTemplate("สวัสดีครับ\nเดือนละ {เบี้ยรายเดือน} บาท\nปีละ {เบี้ยรายปี} บาท", { "เบี้ยรายปี": "5,470" });
    expect(text).toBe("สวัสดีครับ\nปีละ 5,470 บาท");
  });

  it("does not leave a gap where lines went", () => {
    expect(fillTemplate("ก\n\n{ไม่มี}\n\nข", {})).toBe("ก\n\nข");
  });

  it("names the slots a template uses, once each", () => {
    expect(slotNames("{ทุน} {เบี้ยรายปี} {ทุน}")).toEqual(["ทุน", "เบี้ยรายปี"]);
  });
});

describe("what a page sends", () => {
  const lp = shareSample("lifeprotect");

  /** A member who never opened the menu sees no change at all. */
  it("is the standard text, to the letter, without a template", () => {
    expect(shareText(undefined, lp.standard, lp.slots, SHARE_PLANS.lifeprotect.blocks)).toBe(lp.standard);
  });

  it("is the member's wording with the quote's figures, then the system's conditions", () => {
    const text = shareText("พี่ครับ ทุน {ทุน} บาท ปีละ {เบี้ยรายปี} บาท\nสมชาย 081-234-5678", lp.standard, lp.slots, SHARE_PLANS.lifeprotect.blocks);
    expect(text).toBe([
      "พี่ครับ ทุน 1,000,000 บาท ปีละ 28,700 บาท",
      "สมชาย 081-234-5678",
      "",
      "📌 เบี้ยคงที่ตลอดระยะเวลาชำระ",
      "เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน",
    ].join("\n"));
  });

  it("offers whole parts of the standard text by name", () => {
    expect(blockSlots(lp.standard, SHARE_PLANS.lifeprotect.blocks)["ครอบครัวได้รับ"])
      .toBe("👪 ครอบครัวได้รับเมื่อเสียชีวิต\n- เสียชีวิตก่อนอายุ 60 ปี 2,000,000 บาท\n- อายุ 60 ปีขึ้นไป 1,000,000 บาท");
    expect(instalmentBlock(lp.standard))
      .toBe("รายเดือน 2,583 บาท\n(ชำระเบี้ยครั้งแรก 2 งวด 5,166 บาท)\nราย 6 เดือน 14,924 บาท\nรายปี 28,700 บาท");
  });

  /** A template that fills to nothing must not send an empty message. */
  it("falls back to the standard text when the member's comes out empty", () => {
    expect(shareText("{ไม่มีช่องนี้}", lp.standard, lp.slots, [])).toBe(lp.standard);
  });
});

describe("every plan a member may write for", () => {
  it.each(SHARE_PLAN_KEYS)("%s: each named figure is worded as the standard text words it", (plan) => {
    const s = shareSample(plan);
    const def = SHARE_PLANS[plan];
    for (const slot of def.slots.filter((d) => d.name !== "เบี้ยทุกงวด")) {
      const v = s.slots[slot.name];
      // a figure this example has none of (a monthly premium under the floor) is simply absent
      if (v === undefined) continue;
      expect(s.standard, `${plan} {${slot.name}} = ${v}`).toContain(v);
    }
    // nothing is filled that the registry does not offer
    expect(Object.keys(s.slots).filter((k) => !def.slots.some((d) => d.name === k))).toEqual([]);
  });

  it.each(SHARE_PLAN_KEYS)("%s: every whole part is found in the standard text", (plan) => {
    const s = shareSample(plan);
    const found = blockSlots(s.standard, SHARE_PLANS[plan].blocks);
    expect(Object.keys(found).sort()).toEqual(SHARE_PLANS[plan].blocks.map((b) => b.name).sort());
  });

  it.each(SHARE_PLAN_KEYS)("%s: the closing conditions follow a custom text", (plan) => {
    const s = shareSample(plan);
    const note = systemNote(s.standard);
    expect(note.length).toBeGreaterThan(10);
    expect(samplePreview(plan, "สวัสดีครับ").endsWith(`สวัสดีครับ\n\n${note}`)).toBe(true);
  });
});

describe("the AI's reply", () => {
  const reply = (o: object) => JSON.stringify(o);

  it("is taken when it uses the plan's own slots", () => {
    const a = readArranged("lifeprotect", reply({ template: "ทุน {ทุน} บาท\n{ครอบครัวได้รับ}", removed: [{ text: "การันตี", why: "เกินกรมธรรม์" }], own: [] }));
    expect(a).toEqual({ template: "ทุน {ทุน} บาท\n{ครอบครัวได้รับ}", removed: [{ text: "การันตี", why: "เกินกรมธรรม์" }], own: [] });
  });

  /** A slot the page cannot fill would drop its line from every message without a word. */
  it("is refused when it names a slot the plan does not have", () => {
    expect(readArranged("lifeprotect", reply({ template: "ลด {ส่วนลด} บาท" }))).toEqual({ error: expect.stringContaining("{ส่วนลด}") });
  });

  /** The member's own figure is theirs to send: an arrangement that lost it is not their draft. */
  it("is refused when a figure it lists as the member's own is not in the template", () => {
    expect(readArranged("lifeprotect", reply({ template: "ทุน {ทุน} บาท", own: ["ลด 5%"] }))).toEqual({ error: expect.stringContaining("ลด 5%") });
  });

  it("is refused when it has no template or too long a one", () => {
    expect(readArranged("plb", "ขอโทษครับ")).toEqual({ error: expect.any(String) });
    expect(readArranged("plb", reply({ template: "ก".repeat(1501) }))).toEqual({ error: expect.any(String) });
  });
});

describe("the free daily allowance", () => {
  it("turns over at midnight in Thailand", () => {
    expect(thaiDay(new Date("2026-11-14T16:59:59Z"))).toBe("2026-11-14");
    expect(thaiDay(new Date("2026-11-14T17:00:00Z"))).toBe("2026-11-15");
  });
});
