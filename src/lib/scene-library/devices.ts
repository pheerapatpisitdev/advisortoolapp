import type { HealthLayout } from "@/lib/quote-video/story-knowledge";

/** One system-drawn health device (a story-scene layout). Browser-safe: names and fields only. */
export interface DeviceInfo {
  key: HealthLayout;
  name: string;
  /** when a script should pick it: one line the คลิปตามโจทย์ writer reads */
  when: string;
  family: "สุขภาพ";
  product: "health";
  clips: ("story" | "prompt")[];
  /** fields that hold a number: each is checked against its source before it is drawn */
  numberFields: string[];
  wordFields: string[];
}

const both: ("story" | "prompt")[] = ["story", "prompt"];
const dev = (key: HealthLayout, name: string, when: string, numberFields: string[], wordFields: string[]): DeviceInfo =>
  ({ key, name, when, family: "สุขภาพ", product: "health", clips: both, numberFields, wordFields });

export const DEVICES: DeviceInfo[] = [
  dev("split", "เหมาจ่าย vs แยกจ่าย", "เทียบแผนแยกจ่ายที่มีเพดานแต่ละหมวด กับแผนเหมาจ่ายที่จ่ายตามจริงในวงเงินเดียว", [], ["title", "parts", "whole"]),
  dev("limit", "วงเงินต่อปีเติมหลอด", "พูดถึงวงเงินค่ารักษาต่อปีของแผน และใช้ไปแล้วเท่าไร", ["limit", "used"], ["title", "planName"]),
  dev("room", "ค่าห้องต่อคืน", "เทียบค่าห้องจริงต่อคืนกับค่าห้องที่แผนจ่าย", ["plan", "real"], ["title", "planName"]),
  dev("overflow", "ส่วนต่างที่จ่ายเอง", "บิลค่ารักษาเกินวงเงิน ส่วนที่เกินต้องจ่ายเอง", ["bill", "limit"], ["title"]),
  dev("waiting", "ระยะรอคอย", "อธิบายระยะรอคอยหลังเริ่มสัญญา ก่อนเคลมโรคบางกลุ่มได้", [], ["title", "rows"]),
  dev("cashless", "เคลมไม่ต้องสำรองจ่าย", "เล่าว่าเข้าโรงพยาบาลในเครือข่ายแล้วไม่ต้องสำรองจ่ายเอง", [], ["title", "note"]),
  dev("groupgap", "ประกันกลุ่มไม่พอ", "สวัสดิการประกันกลุ่มจากที่ทำงานจ่ายได้ไม่พอค่ารักษาจริง", ["bill", "group"], ["title"]),
  dev("agecost", "เบี้ยขึ้นตามอายุ", "เล่าว่าค่าประกันสุขภาพต่อปีสูงขึ้นตามอายุ ยิ่งทำตอนอายุน้อยยิ่งดี", ["rows"], ["title", "source"]),
];

export const deviceInfo = (key: string): DeviceInfo | undefined => DEVICES.find((d) => d.key === key);
