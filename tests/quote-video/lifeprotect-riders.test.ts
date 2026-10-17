import { describe, expect, it } from "vitest";
import { quoteVideoFacts, quoteVideoScript, type VideoInput } from "@/lib/quote-video/script";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";
import { tableNotes } from "@/lib/quote-video/table-pen";
import { colsOf, TABLE, valueHeads } from "@/lib/quote-video/table-geo";
import { factLines } from "@/lib/quote-video/writer";

const TODAY = new Date("2026-10-17T12:00:00+07:00");
const base = { product: "LIFEPROTECT" as const, variant: "WLF19H", age: 35, sex: "M" as const, sumAssured: 1_000_000 };
const WP_MEB = { waiver: { code: "WP", option: "FIT" }, medical: 1000 };
const facts = (v: VideoInput) => quoteVideoFacts(v, TODAY)!;
const voiceOf = (v: VideoInput, length?: "short") => quoteVideoScript(facts(v), undefined, "F", length).find((s) => s.key === "price")!.voice;

describe("Life Protect clip with the page's riders (owner, 2026-10-17, mockup 1ก)", () => {
  it("carries the riders from the page's button into the form, and only for Life Protect", () => {
    const href = videoStartHref({ ...base, riders: { ...WP_MEB } });
    expect(href).toContain("rider=WP.FIT");
    expect(href).toContain("meb=1000");
    const back = videoStartFrom(Object.fromEntries(new URL(href, "https://x").searchParams));
    expect(back?.riders).toEqual(WP_MEB);
    expect(videoStartFrom({ product: "ISHIELD", rider: "WP.FIT", meb: "1000" })?.riders).toBeUndefined();
    expect(videoStartFrom({ product: "LIFEPROTECT", rider: "<b>" })?.riders).toBeUndefined();
  });

  it("prices the clip as the page does: the total, and the split under it", () => {
    const plain = facts(base);
    const f = facts({ ...base, riders: WP_MEB });
    expect(plain.prices.find((p) => p.main)?.amount).toBe("2,583");
    expect(f.prices.find((p) => p.main)?.amount).toBe("2,712");
    expect(f.perDayAmount).toBe("83");
    expect(f.priceNotes).toEqual([
      "แยกตามสัญญา · รายเดือน",
      "สัญญาหลัก  2,583.00 บาท",
      "ดับบลิวพี ฟิต  +12.91 บาท",
      "ค่ารักษาพยาบาล MEB แผน 1,000  +117.00 บาท",
    ]);
    expect(f.pills).toContain("เบี้ยสัญญาหลักคงที่");
    expect(plain.priceNotes).toEqual([]);
    expect(plain.pills).toContain("เบี้ยคงที่ตลอด");
  });

  it("says what the price includes, and never that a rising medical premium stays level", () => {
    const voice = voiceOf({ ...base, riders: WP_MEB });
    expect(voice).toContain("เดือนละ 2,712 บาท เป็นสัญญาหลัก 2,583 บาท ดับบลิวพี ฟิต 13 บาท และค่าชดเชยรายวัน 117 บาท");
    expect(voice).toContain("ส่วนค่าชดเชยรายวันปรับตามอายุค่ะ");
    expect(voice).not.toContain("เท่าเดิมตลอด");
    expect(voiceOf(base)).toContain("ยอดออมเท่าเดิมตลอดค่ะ");
    expect(voiceOf({ ...base, riders: WP_MEB }, "short")).toContain("วันละ 83 บาท รวมสัญญายกเว้นเบี้ย และค่าชดเชยรายวัน");
    expect(factLines(facts({ ...base, riders: WP_MEB })).join("\n")).toContain("ยอดออมรวมสัญญายกเว้นเบี้ย และค่าชดเชยรายวันไว้แล้ว ค่าชดเชยรายวันปรับตามอายุ");
  });

  it("tells what each rider pays out after the death benefit (owner, 2026-10-17, ก)", () => {
    const cover = (v: VideoInput) => quoteVideoScript(facts(v), undefined, "F").find((s) => s.key === "cover")!.voice;
    expect(cover({ ...base, riders: WP_MEB })).toContain(
      "ยังมีสัญญาเพิ่มเติมอีก 2 ตัว ดับบลิวพี ฟิต ถ้าทุพพลภาพสิ้นเชิงถาวร ไม่ต้องจ่ายเบี้ยที่เหลือ แต่ความคุ้มครองยังอยู่ครบ และค่าชดเชยรายวัน นอนโรงพยาบาลรับเงินวันละ 1,000 บาทค่ะ",
    );
    expect(cover({ ...base, riders: { waiver: { code: "WP", option: "BEYOND" } } })).toContain("ยังมีสัญญาเพิ่มเติม ดับบลิวพี บียอนด์ ถ้าทุพพลภาพสิ้นเชิงถาวร หรือเป็นโรคร้ายแรง");
    // a child's พีบี is named without the payer the screen adds, and never with "เสียชีวิต"
    const pb = { ...base, age: 5, riders: { waiver: { code: "PB", option: "FIT" }, payer: { sex: "F" as const, age: 35 } } };
    expect(voiceOf(pb)).toContain("และพีบี ฟิต 20 บาท");
    expect(cover(pb)).toContain("พีบี ฟิต ถ้าผู้ชำระเบี้ยเป็นอะไรไป");
    expect(cover(pb)).not.toContain("เสียชีวิต");
    expect(cover(base)).not.toContain("สัญญาเพิ่มเติม");
    expect(factLines(facts({ ...base, riders: WP_MEB })).join("\n")).toContain("แยกตามสัญญา: สัญญาหลัก 2,583 บาท · ดับบลิวพี ฟิต 13 บาท · ค่าชดเชยรายวัน 117 บาท");
  });

  it("puts the riders' premium in a column of its own on the clip's table, still 960 wide", () => {
    const f = facts({ ...base, riders: WP_MEB });
    expect(valueHeads(f).map((h) => h.h)).toEqual(["ปีที่", "อายุ", "เบี้ย/ปี", "สัญญาเพิ่มเติม", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"]);
    expect(colsOf(f).reduce((s, w) => s + w, 0)).toBe(TABLE.w);
    expect(valueHeads(facts(base)).map((h) => h.h)).toHaveLength(6);
    // every pen note stays on the table
    for (const n of tableNotes(f)) for (const l of n.labels) expect(l.x).toBeGreaterThanOrEqual(0);
  });
});
