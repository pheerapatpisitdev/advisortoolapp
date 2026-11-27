import { describe, expect, it } from "vitest";
import ci123 from "../../data/riders/ci123-diseases.json";
import { hidePay, quoteVideoFacts, quoteVideoScript, riderIndex, type VideoInput } from "@/lib/quote-video/script";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { motionSpec, motionWindows } from "@/lib/quote-video/motion";

/**
 * Life Protect with riders, a scene a rider (owner, 2026-11-21, ก ก ก on
 * https://claude.ai/artifact/HvVdgdGq4oajv1Hjd1ZBv2): the mockup's example, ชาย 35, 19 ปี, 1 ล้าน.
 */
const TODAY = new Date("2026-11-21T12:00:00+07:00");
const base = { product: "LIFEPROTECT" as const, variant: "WLF19H", age: 35, sex: "M" as const, sumAssured: 1_000_000 };
const ALL = {
  waiver: { code: "WP", option: "FIT" }, medical: 1000,
  illness: [{ code: "DCI", sumAssured: 1_000_000 }, { code: "CI123", sumAssured: 1_000_000 }, { code: "AP", sumAssured: 1_000_000 }],
};
const facts = (v: VideoInput) => quoteVideoFacts(v, TODAY)!;
const script = (v: VideoInput, length: "short" | "full" | "long" | "max" = "full") => quoteVideoScript(facts(v), "สมชาย", "F", length);
const keys = (v: VideoInput, length?: "short" | "full" | "long" | "max") => script(v, length).map((s) => s.key);
const say = (v: VideoInput, key: string) => script(v).find((s) => s.key === key)?.voice;

describe("Life Protect's rider scenes (owner, 2026-11-21)", () => {
  it("goes from 5 scenes to 12: the package, a rider each, the payout", () => {
    expect(keys(base)).toEqual(["lead", "price", "cover", "value", "contact"]);
    expect(keys({ ...base, riders: ALL })).toEqual(["lead", "price", "cover", "riders", "rider1", "rider2", "rider3", "rider4", "rider5", "payout", "value", "contact"]);
    // the longer clips keep their own scenes round them; the 15-second one stays three
    expect(keys({ ...base, riders: ALL }, "max")).toEqual(["lead", "story", "price", "cover", "riders", "rider1", "rider2", "rider3", "rider4", "rider5", "payout", "value", "versus", "qa", "steps", "contact"]);
    expect(keys({ ...base, riders: ALL }, "short")).toEqual(["lead", "price", "contact"]);
  });

  it("says the mockup's lines", () => {
    const v = { ...base, riders: ALL };
    expect(say(v, "price")).toBe("ออมแค่วันละ 114 บาท หรือเดือนละ 3,735 บาท รวมสัญญาหลักกับสัญญาเพิ่มเติมอีก 5 ตัวไว้แล้ว ออมเพียง 19 ปีก็ครบ ส่วนค่าชดเชยรายวันปรับตามอายุค่ะ");
    expect(say(v, "cover")).toBe("ถ้าเป็นอะไรไปก่อนอายุ 60 ครอบครัวได้ 2 ล้าน หลังจากนั้นได้ 1 ล้าน และดูแลยาวไปถึงอายุ 99 เลยค่ะ");
    expect(say(v, "riders")).toBe("นอกจากประกันชีวิตแล้ว แผนนี้ยังมีสัญญาเพิ่มเติมอีก 5 ตัว มาดูทีละตัวกันนะคะ");
    expect(say(v, "rider3")).toBe("ตัวที่สาม สัญญาโรคร้ายแรง DCI เดือนละ 362 บาท ถ้าเป็นโรคร้ายแรง 1 ใน 31 โรค หรือเป็นอะไรไป รับเงินก้อน 1 ล้านบาทค่ะ");
    expect(say(v, "rider4")).toBe("ตัวที่สี่ สัญญาโรคร้ายแรง CI 123 เดือนละ 390 บาท ไม่ต้องรอให้เป็นหนัก เจอระยะเริ่มต้นก็รับ 250,000 บาท ระยะรุนแรงรับสูงสุด 1 ล้านบาท คุ้มครอง 122 โรค เคลมได้หลายครั้งค่ะ");
    expect(say(v, "rider5")).toBe("ตัวสุดท้าย สัญญาอุบัติเหตุ AP เดือนละ 270 บาท ถ้าเป็นอะไรไปหรือสูญเสียอวัยวะจากอุบัติเหตุ รับสูงสุด 1 ล้านบาท คุ้มครองถึงอายุ 65 ค่ะ");
    expect(say(v, "payout")).toBe("สรุปง่ายๆ นะคะ ป่วยโรคร้ายแรงระยะรุนแรง รับสูงสุด 2 ล้านบาท นอนโรงพยาบาลรับวันละ 1,000 บาท ถ้าเป็นอะไรไปจากอุบัติเหตุ ก่อนอายุ 60 ครอบครัวได้สูงสุด 4 ล้านบาทค่ะ");
  });

  it("prices each rider as its share of the instalment the voice says, adding up to it", () => {
    const f = facts({ ...base, riders: ALL });
    expect(f.riders!.scenes.map((s) => s.price)).toEqual(["13", "117", "362", "390", "270"]);
    const sum = [2583, ...f.riders!.scenes.map((s) => Number(s.price))].reduce((a, b) => a + b, 0);
    expect(sum.toLocaleString("en-US")).toBe(f.spokenPrice.amount);
    // an agent who hides the monthly instalment hears the yearly one: the monthly shares go unsaid
    const yearly = hidePay(f, ["monthly"]);
    expect(yearly.spokenPrice.per).toBe("ปีละ");
    expect(yearly.riders!.scenes.every((s) => s.price === undefined)).toBe(true);
    expect(quoteVideoScript(yearly, undefined, "F").find((s) => s.key === "rider3")!.voice).toBe("ตัวที่สาม สัญญาโรคร้ายแรง DCI ถ้าเป็นโรคร้ายแรง 1 ใน 31 โรค หรือเป็นอะไรไป รับเงินก้อน 1 ล้านบาทค่ะ");
  });

  it("draws CI 123's stages from the rate sheet, in the policy's own groups", () => {
    const ci = facts({ ...base, riders: ALL }).riders!.scenes.find((s) => s.kind === "ci123")!;
    if (ci.kind !== "ci123") throw new Error("not CI 123");
    expect(ci.stairs).toEqual([
      { label: "ระยะก่อนเริ่มต้น", share: "20% ไม่เกิน 100,000", amount: 100_000 },
      { label: "ระยะเริ่มต้นถึงปานกลาง", share: "25%", amount: 250_000 },
      { label: "ระยะรุนแรง", share: "100%", amount: 1_000_000 },
    ]);
    // the juvenile illnesses only for a child
    expect(ci.more.map((x) => x.label)).toEqual(["กรณีวิกฤต", "เงื่อนไขพิเศษ"]);
    const child = facts({ ...base, age: 10, riders: { illness: [{ code: "CI123", sumAssured: 500_000 }] } }).riders!.scenes[0];
    expect(child.kind === "ci123" && child.more.map((x) => x.label)).toEqual(["กรณีวิกฤต", "โรคเด็ก", "เงื่อนไขพิเศษ"]);
    // the rate sheet's six parts are the policy's six groups, in the same order
    const parts = lifeProtectTable(TODAY).illness.find((x) => x.code === "CI123")!.parts;
    expect(parts.map((p) => p.key)).toEqual(["major ci", "critical care benefit", "juvenile ci", "pre-early ci", "early to intermediate ci", "special conditions"]);
    expect(ci123.groups.map((g) => g.title.match(/\(([^)]+)\)/)![1])).toEqual([
      "Major Stage Critical Illness", "Critical Care Benefit", "Juvenile Critical Illness", "Pre-Early Stage Critical Illness",
      "Early to Intermediate Stage Critical Illness", "Special Critical Illness",
    ]);
  });

  it("adds up what each event pays, saying สูงสุด where a stage may pay less", () => {
    expect(facts({ ...base, riders: ALL }).riders!.payout).toEqual([
      { tone: "early", event: "ป่วยโรคร้ายแรง ระยะเริ่มต้น", from: "CI 123", amount: "250,000" },
      { tone: "major", event: "ป่วยโรคร้ายแรง ระยะรุนแรง", from: "DCI 1 ล้าน + CI 123 สูงสุด 1 ล้าน", amount: "2,000,000" },
      { tone: "hospital", event: "นอนโรงพยาบาล", from: "ค่าชดเชยรายวัน", amount: "1,000/วัน" },
      { tone: "accident", event: "อุบัติเหตุถึงชีวิต ก่อนอายุ 60", from: "ชีวิต 2 ล้าน + DCI 1 ล้าน + AP 1 ล้าน", amount: "4,000,000" },
      { tone: "waiver", event: "ทุพพลภาพสิ้นเชิงถาวร", from: "ดับบลิวพี ฟิต", amount: "หยุดจ่ายเบี้ย" },
    ]);
  });

  it("keeps a lone rider to its own scene: no package, no payout, no ordinal", () => {
    const v = { ...base, riders: { illness: [{ code: "DCI", sumAssured: 500_000 }] } };
    expect(keys(v)).toEqual(["lead", "price", "cover", "rider1", "value", "contact"]);
    expect(say(v, "rider1")).toMatch(/^สัญญาโรคร้ายแรง DCI เดือนละ \d+ บาท ถ้าเป็นโรคร้ายแรง 1 ใน 31 โรค หรือเป็นอะไรไป รับเงินก้อน 500,000 บาทค่ะ$/);
    expect(say(v, "price")).toContain("รวมสัญญาหลักกับสัญญาโรคร้ายแรง DCI ไว้แล้ว");
  });

  it("gives every new scene a motion the drawers can time", () => {
    const f = facts({ ...base, riders: ALL });
    for (const k of ["riders", "rider1", "rider4", "payout"] as const) {
      expect(Object.keys(motionSpec(k, f, 8)).length).toBeGreaterThan(2);
      expect(motionWindows(k, f, 8).length).toBeGreaterThan(0);
    }
    expect(riderIndex("rider3")).toBe(2);
    expect(riderIndex("value")).toBeUndefined();
  });
});
