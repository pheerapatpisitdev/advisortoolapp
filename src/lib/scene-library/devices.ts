import type { DeviceLayout, HealthLayout, LifeLayout } from "@/lib/quote-video/story-knowledge";

/** One system-drawn device (a story-scene layout). Browser-safe: names and fields only. */
export interface DeviceInfo {
  key: DeviceLayout;
  name: string;
  /** when a script should pick it: one line the คลิปตามโจทย์ writer reads */
  when: string;
  /** สุขภาพ: round 1's health devices; ชีวิต ภาษี มรดก: round 2's */
  family: "สุขภาพ" | "ชีวิต ภาษี มรดก";
  /** the catalogue's product */
  product: "health" | "life" | "saving";
  clips: ("story" | "prompt")[];
  /** fields that hold a number: each is checked against its source before it is drawn */
  numberFields: string[];
  wordFields: string[];
}

const both: ("story" | "prompt")[] = ["story", "prompt"];
const dev = (key: HealthLayout, name: string, when: string, numberFields: string[], wordFields: string[]): DeviceInfo =>
  ({ key, name, when, family: "สุขภาพ", product: "health", clips: both, numberFields, wordFields });
const dev2 = (key: LifeLayout, name: string, product: DeviceInfo["product"], when: string, numberFields: string[], wordFields: string[]): DeviceInfo =>
  ({ key, name, when, family: "ชีวิต ภาษี มรดก", product, clips: both, numberFields, wordFields });

export const DEVICES: DeviceInfo[] = [
  dev("split", "เหมาจ่าย vs แยกจ่าย", "เทียบแผนแยกจ่ายที่มีเพดานแต่ละหมวด กับแผนเหมาจ่ายที่จ่ายตามจริงในวงเงินเดียว", [], ["title", "parts", "whole"]),
  dev("limit", "วงเงินต่อปีเติมหลอด", "พูดถึงวงเงินค่ารักษาต่อปีของแผน และใช้ไปแล้วเท่าไร", ["limit", "used"], ["title", "planName"]),
  dev("room", "ค่าห้องต่อคืน", "เทียบค่าห้องจริงต่อคืนกับค่าห้องที่แผนจ่าย", ["plan", "real"], ["title", "planName"]),
  dev("overflow", "ส่วนต่างที่จ่ายเอง", "บิลค่ารักษาเกินวงเงิน ส่วนที่เกินต้องจ่ายเอง", ["bill", "limit"], ["title"]),
  dev("waiting", "ระยะรอคอย", "อธิบายระยะรอคอยหลังเริ่มสัญญา ก่อนเคลมโรคบางกลุ่มได้", [], ["title", "rows"]),
  dev("cashless", "เคลมไม่ต้องสำรองจ่าย", "เล่าว่าเข้าโรงพยาบาลในเครือข่ายแล้วไม่ต้องสำรองจ่ายเอง", [], ["title", "note"]),
  dev("groupgap", "ประกันกลุ่มไม่พอ", "สวัสดิการประกันกลุ่มจากที่ทำงานจ่ายได้ไม่พอค่ารักษาจริง", ["bill", "group"], ["title"]),
  dev("agecost", "เบี้ยขึ้นตามอายุ", "เล่าว่าค่าประกันสุขภาพต่อปีสูงขึ้นตามช่วงอายุ", ["rows"], ["title", "source"]),
  // ชีวิต โรคร้าย ภาษี มรดก (round 2, spec 2026-11-14-devices-life-tax-design.md); no `when` line says a word no script may (FORBIDDEN)
  dev2("lifeneed", "ทุนชีวิตที่ควรมี", "life", "คิดว่าครอบครัวควรมีทุนประกันชีวิตเท่าไร จากหนี้ ค่าใช้จ่ายครอบครัวต่อปี จำนวนปี และค่าการศึกษาลูก เทียบกับทุนที่มีอยู่",
    ["debts", "expenses", "years", "education", "have"], ["title"]),
  dev2("beneficiary", "ผู้รับประโยชน์", "life", "อธิบายการระบุชื่อผู้รับประโยชน์และสัดส่วนของแต่ละคนในกรมธรรม์", ["rows"], ["title", "rows"]),
  dev2("cilump", "เงินก้อนตอนวินิจฉัย", "health", "เล่าว่าประกันโรคร้ายแรงจ่ายเป็นเงินก้อนเมื่อแพทย์วินิจฉัยตามเงื่อนไข", ["sum"], ["title", "note"]),
  dev2("incomestop", "รายได้หยุดระหว่างรักษา", "health", "ป่วยหนักต้องหยุดงานรักษาตัวหลายเดือน รายได้ที่หายไประหว่างนั้น", ["monthly", "months"], ["title"]),
  dev2("taxback", "ภาษีที่ได้คืนตามฐาน", "saving", "ค่าประกันชีวิตที่จ่ายต่อปีนำไปลดหย่อนภาษีได้ แล้วได้ภาษีคืนเท่าไรตามฐานภาษี", ["premium", "bracket"], ["title"]),
  dev2("taxcap", "เพดานลดหย่อนรวม", "saving", "สรุปเพดานลดหย่อนภาษีของประกันชีวิต ประกันสุขภาพ และประกันแบบบำนาญ", [], ["title"]),
  dev2("moneysplit", "แบ่งเงินให้คนในบ้าน", "life", "เงินก้อนจากประกันแบ่งให้คนในบ้าน 2–3 คน แต่ละคนได้เท่าไร", ["total", "parts"], ["title", "parts"]),
  dev2("threegen", "ส่งต่อสามรุ่น", "life", "วางแผนส่งต่อเงินก้อนเป็นมรดกจากรุ่นหนึ่งไปอีกรุ่น สามรุ่นในครอบครัว", [], ["title", "rows", "note"]),
];

export const deviceInfo = (key: string): DeviceInfo | undefined => DEVICES.find((d) => d.key === key);

/** a round-1 health device: consumers not yet taught round 2's (the writer until Task 6, the catalogue until Task 7) list only these */
export const isHealthDevice = (d: DeviceInfo): d is DeviceInfo & { key: HealthLayout } => d.family === "สุขภาพ";
