import { describe, expect, it } from "vitest";
import { renderPng } from "@/lib/content/poster-png";
import { clipSize } from "@/lib/quote-video/make";
import { motionBgHeight, MOTION_BG_H } from "@/lib/quote-video/motion";
import { fhcScript, type FhcVideoFacts } from "@/lib/quote-video/fhc";
import { quoteVideoFacts, quoteVideoScript } from "@/lib/quote-video/script";
import { SIZES, sizeOf } from "@/lib/quote-video/timeline";
import { wideFhcFrame, wideQuoteFrame } from "@/lib/quote-video/wide";

const lp = { variant: "WLF19H", age: 35, sex: "M" as const, sumAssured: 1_000_000 };

describe("video sizes (owner, 2026-10-11)", () => {
  it("reads a size, portrait for anything else", () => {
    expect(sizeOf({ size: "square" })).toBe("square");
    expect(sizeOf({ size: "landscape" })).toBe("landscape");
    expect(sizeOf({ size: "huge" })).toBe("portrait");
    expect(sizeOf({})).toBe("portrait");
    expect(SIZES.square).toEqual({ w: 1080, h: 1080 });
    expect(SIZES.landscape).toEqual({ w: 1920, h: 1080 });
  });

  it("gives every clip the shape asked for (owner, 2026-10-13: classic and the short clip too)", () => {
    expect(clipSize({ ...lp, style: "motion", size: "landscape" })).toBe("landscape");
    expect(clipSize({ ...lp, style: "classic", size: "landscape" })).toBe("landscape");
    expect(clipSize({ ...lp, style: "motion", length: "short", size: "square" })).toBe("square");
    expect(clipSize({ product: "FHC", customerId: "x", age: 35, sex: "M", style: "motion", length: "full", size: "square", fhc: {} as FhcVideoFacts })).toBe("square");
    // a row written before sizes existed
    expect(clipSize({ ...lp, style: "motion" })).toBe("portrait");
  });

  it("keeps the portrait background as it was", () => {
    expect(motionBgHeight()).toBe(MOTION_BG_H);
    expect(motionBgHeight(SIZES.landscape)).toBe(1080 + MOTION_BG_H - 1920);
  });

});

describe("square and landscape scenes draw", () => {
  const contact = { name: "ภีรพัฒน์", phone: "0812345678", more: "ตัวแทนประกันชีวิต กรุงไทย-แอกซ่า\nใบอนุญาตเลขที่ 6501012345" };
  const today = new Date("2026-10-11T00:00:00+07:00");
  const quotes = [
    quoteVideoFacts(lp, today)!,
    quoteVideoFacts({ product: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", sumAssured: 1_000_000 }, today)!,
    quoteVideoFacts({ product: "IHEALTHY", age: 35, sex: "F", plan: "GOLD", compare: ["SILVER", "DIAMOND"] }, today)!,
  ];
  const fhc: FhcVideoFacts = {
    age: 35, sex: "M", checkedOn: "12 ตุลาคม 2569",
    scores: [{ key: "emergency", label: "เงินสำรองฉุกเฉิน", level: "red", value: "2.5 เดือน" }, { key: "saving", label: "เงินเหลือต่อเดือน", level: "green", value: "29%" }],
    gaps: [{ key: "life", label: "ชีวิต", state: "short", unit: "sum", have: 500_000, should: 2_000_000 }, { key: "ci", label: "โรคร้ายแรง", state: "missing", unit: "sum", have: 0, should: 1_000_000 }],
    events: [{ key: "jobLoss", name: "ตกงาน", level: "red", line: "ไม่มีประกัน · ควรมีเงินสำรอง 6 เดือน" }],
    plan: [{ key: "life", label: "ชีวิต", product: "Life Protect x 2 ชำระ 19 ปี", detail: "ทุน 1,500,000 บาท", monthly: 3_600, per: "ออมเดือนละ" }],
  };

  for (const size of ["square", "landscape"] as const) {
    it(`every ${size} scene, mid-way and done`, async () => {
      const { w, h } = SIZES[size];
      for (const f of quotes) {
        for (const s of quoteVideoScript(f, "สมชาย")) {
          for (const t of [0.5, 9]) {
            const png = await renderPng(wideQuoteFrame(s.key, { facts: f, customer: "สมชาย", contact, words: s.voice.split(" "), voiceSec: 8 }, t, size), { width: w, height: h });
            expect(png.readUInt32BE(16)).toBe(w);
          }
        }
      }
      for (const s of fhcScript(fhc, "สมชาย")) {
        const png = await renderPng(wideFhcFrame(s.key, { facts: fhc, customer: "", contact, words: s.voice.split(" "), voiceSec: 8 }, 9, size), { width: w, height: h });
        expect(png.readUInt32BE(20)).toBe(h);
      }
      // the summary with nothing left to buy draws its own scene
      const done = { ...fhc, plan: [], gaps: fhc.gaps.map((g) => ({ ...g, state: "ok" as const })) };
      await renderPng(wideFhcFrame("fhcPlan", { facts: done, customer: "", contact, words: ["ครบ"], voiceSec: 2 }, 3, size), { width: w, height: h });
    }, 120_000);
  }
});
