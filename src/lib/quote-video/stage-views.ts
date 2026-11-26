import { CI_BASE_KICKER, CI_BASE_SUB, CI_MORE_KICKER, CI_STAIRS_FOOT, CI_STAIRS_KICKER, CI_STAIRS_SUB, ciBaseFoot, ciBaseRows, ciMoreRows, ciStairs } from "./ci123-pictures";
import type { CancerVideoFacts } from "./cancer";
import type { PaVideoFacts } from "./pa";
import type { QuoteVideoFacts, SceneKey } from "./script";
import type { AmountRow, Stair } from "./stage-pictures";

/**
 * The scenes of the plans that pay by stage or by event (CI 123, the cancer plan, PA; the group plan after
 * them), as words and figures every drawer lays out the same way (stage-pictures.tsx): a kicker and the line
 * under it, then stairs, or a column of rows with a big figure over them where one is the point.
 */
export interface StageView {
  kicker: string;
  sub: string;
  /** the stairs that climb to the largest sum */
  stairs?: Stair[];
  /** a figure said big over the rows (the cancer plan's daily sum) */
  big?: { amount: number; unit: string };
  rows?: AmountRow[];
  /** under the stairs: the first a pill in the highlight, the rest plain lines */
  pills?: string[];
  /** a plain line under the rows */
  foot?: string;
}

const STAGE_KEYS: readonly SceneKey[] = ["critical", "cover", "family"];

/** a scene's view where the plan draws it from one; undefined for any other scene or plan */
export function stageView(key: SceneKey, f: QuoteVideoFacts): StageView | undefined {
  if (!STAGE_KEYS.includes(key)) return undefined;
  if (f.ci123) {
    const g = f.ci123;
    if (key === "critical") return { kicker: CI_STAIRS_KICKER, sub: CI_STAIRS_SUB, stairs: ciStairs(g), pills: [CI_STAIRS_FOOT] };
    if (key === "cover") return { kicker: CI_MORE_KICKER, sub: `ทุน CI 123 ${f.lead.amount} บาท`, rows: ciMoreRows(g) };
    return { kicker: CI_BASE_KICKER, sub: CI_BASE_SUB, rows: ciBaseRows(g), foot: ciBaseFoot(g) };
  }
  if (f.cancer) return cancerView(key, f.cancer);
  if (f.pa) return paView(key, f.pa);
  return undefined;
}

/**
 * The cancer plan's three (owner, 2026-11-26, mockup https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p, "ca"): the four
 * stages as stairs, the daily sum and how long it pays, what every contract pays together.
 */
function cancerView(key: SceneKey, g: CancerVideoFacts): StageView {
  if (key === "critical") {
    return {
      kicker: "จ่ายตามขั้นของมะเร็ง", sub: "ตรวจพบมะเร็ง รับเงินก้อนตามขั้น",
      stairs: g.stages.map((s) => ({ label: `ขั้น ${s.no}`, sub: s.lines, amount: s.amount })),
      pills: [`ขั้น ${g.repeatNos} เคลมซ้ำได้ รวมไม่เกินทุน`, `ระยะรอคอย ${g.waiting.min}–${g.waiting.max} วัน`],
    };
  }
  if (key === "cover") {
    return {
      kicker: "นอนโรงพยาบาล ได้รายวัน", sub: "ค่าชดเชยรายวัน เมื่อนอนโรงพยาบาลเพราะมะเร็ง",
      big: { amount: g.hic, unit: "บาท ต่อวัน" },
      rows: [
        { label: "สูงสุด", amount: g.hicDays, unit: "วัน", on: true },
        { label: "ระยะลุกลาม เพิ่มอีก", amount: g.hicExtraDays, unit: "วัน" },
      ],
    };
  }
  return {
    // the page's deathTotalsTitle, in the clip's words: the age only for someone still under it
    kicker: `รวมทุกสัญญา${g.beforeAge ? ` ก่อนอายุ ${g.beforeAge}` : ""}`, sub: "ครอบครัวได้รับจากทุกสัญญา",
    rows: g.totals.map((r) => ({ label: r.label, sub: r.sub, amount: r.amount, on: r.on })),
    foot: "เงินมะเร็งจ่ายเมื่อตรวจพบ · ยังไม่รวมค่าชดเชยรายวัน",
  };
}

/**
 * PA's three (owner, 2026-11-26, mockup https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p, "pa"): what it covers
 * ("cover"), the injury cover ("family": the medical sum and the weeks off work on Platinum, the medical sum said big on
 * Classic, none on Max), the sum each renewal year as stairs ("critical").
 */
function paView(key: SceneKey, g: PaVideoFacts): StageView | undefined {
  if (key === "cover") {
    return {
      kicker: "คุ้มครองอะไรบ้าง", sub: "อุบัติเหตุ 24 ชั่วโมง ทั่วโลก",
      rows: [
        { label: "จากไป สูญเสียอวัยวะ", sub: "หรือทุพพลภาพถาวรสิ้นเชิง", amount: g.death, on: true },
        { label: "ถูกฆาตกรรม ลอบทำร้าย", amount: g.murder },
        { label: "ขับขี่ โดยสารมอเตอร์ไซค์", amount: g.motorcycle },
      ],
    };
  }
  if (key === "family") {
    if (!g.medical) return undefined;
    if (!g.weekly) {
      return {
        kicker: "บาดเจ็บ ก็ช่วยค่ารักษา", sub: "ค่ารักษาพยาบาลต่ออุบัติเหตุ",
        big: { amount: g.medical, unit: "บาท ต่อครั้ง" }, foot: "รวมอุบัติเหตุจากมอเตอร์ไซค์",
      };
    }
    return {
      kicker: "บาดเจ็บ หยุดงาน ก็ช่วย", sub: "เมื่อบาดเจ็บจากอุบัติเหตุ",
      rows: [
        { label: "ค่ารักษาต่ออุบัติเหตุ", sub: "รวมมอเตอร์ไซค์", amount: g.medical, on: true },
        { label: "ชดเชยหยุดงาน ต่อสัปดาห์", sub: `ทุพพลภาพชั่วคราว สูงสุด ${g.weeks} สัปดาห์`, amount: g.weekly },
      ],
    };
  }
  return {
    kicker: "ต่ออายุ ทุนโตทุกปี", sub: "ต่ออายุต่อเนื่อง ทุนคุ้มครองเพิ่มทุกปี",
    stairs: g.years.map((y) => ({ label: `ปี ${y.year}`, amount: y.sum })),
    pills: [`เพิ่มปีละ ${g.stepPercent}% ของทุนเริ่มต้น สูงสุด ${g.maxPercent}%`],
  };
}
