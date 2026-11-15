import { PA_FAMILIES, PA_WEEKLY_MAX_WEEKS } from "@/lib/pa-plans";
import { HEALTH_PARENTS_CAP } from "./tax-th";

/**
 * The fixed-source figures of round 5's eight health devices (spec 2026-11-15-devices-health2-design.md, "The rules that do
 * not move"): the values a คลิปตามโจทย์ script may use without the brief saying them, per device.
 *
 * Browser-safe on purpose. checkDevice (prompt-story/check.ts) is imported by the script editor, which runs in the browser, so
 * it must not pull in the 537-hospital list (230 KB), the iHealthy sheet (44 KB) or the group premium file (12 KB). What it
 * needs of them is a few dozen numbers, kept here as a snapshot; the real files are read by health2-sources.ts (server, the
 * story topic, the drawers) and tests/scene-library/health2-sources.test.ts fails the moment this snapshot and the files
 * differ, so a refreshed hospital list or a new rate sheet cannot go unnoticed. The PA plans and the tax cap are small and
 * imported as they are.
 */
/** what the sheet says of OPD for one plan: baht a year, "none" where it prints "-", "actual" where it prints "ตามที่จ่ายจริง" */
export type OpdFigure = number | "none" | "actual";

export interface Health2Fixed {
  /** `plans`: the six plans' own pairs (code, the English label the page shows, room a day, OPD a year): fixed-source room and OPD must be one plan's */
  ipdopd: { room: number[]; opd: number[]; plans: { code: string; label: string; room: number; opd: OpdFigure }[] };
  deductible: number[];
  copayPercent: number;
  renewalToAge: number;
  parentsCap: number;
  /** every healthIpdPremiums value, ascending, once each */
  groupPerYear: number[];
  /** every premium of each head-count band's column (all three risk classes, all six plans), ascending, once each */
  groupByBand: { "10-25": number[]; "26-50": number[]; "51-100": number[] };
  /** `pairs`: a plan's medical and weekly sums together: fixed-source figures of one clip are one plan's */
  pa: { medical: number[]; weekly: number[]; weeks: number; pairs: [number, number][] };
  hospitals: { total: number; fetchedAt: string; counts: Record<string, number> };
}

const uniq = (xs: (number | undefined)[]): number[] => [...new Set(xs.filter((x): x is number => x !== undefined))].sort((a, b) => a - b);
const plans = PA_FAMILIES.flatMap((f) => f.plans);

/** the medical and weekly sums of each PA plan that has both (Platinum), once each */
function paPairs(): [number, number][] {
  const seen = new Map<string, [number, number]>();
  for (const p of plans) if (p.medical !== undefined && p.weekly !== undefined) seen.set(`${p.medical}/${p.weekly}`, [p.medical, p.weekly]);
  return [...seen.values()];
}

// premiums.json, per band column (snapshot; the drift test holds it to the file)
const BAND_COLUMNS = {
  "10-25": [2552, 2638, 3336, 3942, 4114, 5161, 5382, 5640, 6497, 6841, 7050, 7821, 8251, 8518, 9184, 9700, 10_258, 12_047],
  "26-50": [2526, 2606, 3300, 3890, 4050, 5089, 5304, 5544, 6393, 6713, 6942, 7691, 8091, 8374, 9028, 9508, 10_078, 11_831],
  "51-100": [2499, 2575, 3264, 3836, 3988, 5017, 5223, 5451, 6285, 6589, 6834, 7556, 7936, 8230, 8866, 9322, 9898, 11_615],
};

export const HEALTH2_FIXED: Health2Fixed = {
  // iHealthy Ultra sheet: row 1 (ค่าห้องต่อวัน) and rows 18 / 19 (OPD a year, one shared limit) of the six plans; "-" and "ตามที่จ่ายจริง" are words, not numbers
  ipdopd: {
    room: [1_500, 3_000, 5_500, 9_000, 15_000, 21_000],
    opd: [6_000, 12_000, 60_000],
    plans: [
      { code: "SMART", label: "Smart", room: 1_500, opd: "none" },
      { code: "BRONZE", label: "Bronze", room: 3_000, opd: "none" },
      { code: "SILVER", label: "Silver", room: 5_500, opd: 6_000 },
      { code: "GOLD", label: "Gold", room: 9_000, opd: 12_000 },
      { code: "DIAMOND", label: "Diamond", room: 15_000, opd: 60_000 },
      { code: "PLATINUM", label: "Platinum", room: 21_000, opd: "actual" },
    ],
  },
  // the plans' deductibles (plans[].deductible)
  deductible: [30_000, 50_000, 100_000],
  copayPercent: 20,
  renewalToAge: 98,
  parentsCap: HEALTH_PARENTS_CAP,
  groupPerYear: [2499, 2526, 2552, 2575, 2606, 2638, 3264, 3300, 3336, 3836, 3890, 3942, 3988, 4050, 4114, 5017, 5089, 5161, 5223, 5304, 5382, 5451, 5544, 5640, 6285, 6393, 6497, 6589, 6713, 6834, 6841, 6942, 7050, 7556, 7691, 7821, 7936, 8091, 8230, 8251, 8374, 8518, 8866, 9028, 9184, 9322, 9508, 9700, 9898, 10_078, 10_258, 11_615, 11_831, 12_047],
  groupByBand: BAND_COLUMNS,
  pa: { medical: uniq(plans.map((p) => p.medical)), weekly: uniq(plans.map((p) => p.weekly)), weeks: PA_WEEKLY_MAX_WEEKS, pairs: paPairs() },
  // data/hospitals/ktaxa-network.json: the count of hospitals in each province, and the date the list was fetched
  hospitals: {
    total: 537,
    fetchedAt: "2026-10-02",
    counts: {
      "กรุงเทพมหานคร": 135,
      "ชลบุรี": 49,
      "ระยอง": 38,
      "สมุทรปราการ": 25,
      "นนทบุรี": 22,
      "ปทุมธานี": 22,
      "สุราษฎร์ธานี": 16,
      "เชียงใหม่": 14,
      "นครราชสีมา": 11,
      "ภูเก็ต": 10,
      "สงขลา": 9,
      "สมุทรสาคร": 9,
      "เชียงราย": 9,
      "ฉะเชิงเทรา": 6,
      "นครศรีธรรมราช": 6,
      "ปราจีนบุรี": 6,
      "ลำพูน": 6,
      "สระบุรี": 6,
      "สุพรรณบุรี": 6,
      "กระบี่": 5,
      "ขอนแก่น": 5,
      "นครสวรรค์": 5,
      "พระนครศรีอยุธยา": 5,
      "พิษณุโลก": 5,
      "อุบลราชธานี": 5,
      "กาญจนบุรี": 4,
      "ตาก": 4,
      "นครปฐม": 4,
      "หนองคาย": 4,
      "อุดรธานี": 4,
      "จันทบุรี": 3,
      "ชัยภูมิ": 3,
      "ชุมพร": 3,
      "ตรัง": 3,
      "ตราด": 3,
      "นราธิวาส": 3,
      "ปัตตานี": 3,
      "มุกดาหาร": 3,
      "ราชบุรี": 3,
      "ศรีสะเกษ": 3,
      "สกลนคร": 3,
      "สุรินทร์": 3,
      "กาฬสินธุ์": 2,
      "กำแพงเพชร": 2,
      "บุรีรัมย์": 2,
      "ประจวบคีรีขันธ์": 2,
      "พัทลุง": 2,
      "พิจิตร": 2,
      "ยโสธร": 2,
      "ร้อยเอ็ด": 2,
      "ลพบุรี": 2,
      "ลำปาง": 2,
      "สมุทรสงคราม": 2,
      "สุโขทัย": 2,
      "เพชรบุรี": 2,
      "เพชรบูรณ์": 2,
      "แพร่": 2,
      "แม่ฮ่องสอน": 2,
      "ชัยนาท": 1,
      "บึงกาฬ": 1,
      "พะเยา": 1,
      "พังงา": 1,
      "มหาสารคาม": 1,
      "ยะลา": 1,
      "สตูล": 1,
      "สระแก้ว": 1,
      "สิงห์บุรี": 1,
      "หนองบัวลำภู": 1,
      "อุตรดิตถ์": 1,
      "อุทัยธานี": 1,
      "อ่างทอง": 1,
      "เลย": 1,
    },
  },
};
