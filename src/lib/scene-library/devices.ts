import type { HealthLayout } from "@/lib/quote-video/story-knowledge";

/** One system-drawn health device (a story-scene layout). Browser-safe: names and fields only. */
export interface DeviceInfo {
  key: HealthLayout;
  name: string;
  family: "สุขภาพ";
  product: "health";
  clips: ("story" | "prompt")[];
  /** fields that hold a number: each is checked against its source before it is drawn */
  numberFields: string[];
  wordFields: string[];
}

const both: ("story" | "prompt")[] = ["story", "prompt"];
const dev = (key: HealthLayout, name: string, numberFields: string[], wordFields: string[]): DeviceInfo =>
  ({ key, name, family: "สุขภาพ", product: "health", clips: both, numberFields, wordFields });

export const DEVICES: DeviceInfo[] = [
  dev("split", "เหมาจ่าย vs แยกจ่าย", [], ["title", "parts", "whole"]),
  dev("limit", "วงเงินต่อปีเติมหลอด", ["limit", "used"], ["title", "planName"]),
  dev("room", "ค่าห้องต่อคืน", ["plan", "real"], ["title", "planName"]),
  dev("overflow", "ส่วนต่างที่จ่ายเอง", ["bill", "limit"], ["title"]),
  dev("waiting", "ระยะรอคอย", [], ["title", "rows"]),
  dev("cashless", "เคลมไม่ต้องสำรองจ่าย", [], ["title", "note"]),
  dev("groupgap", "ประกันกลุ่มไม่พอ", ["bill", "group"], ["title"]),
  dev("agecost", "เบี้ยขึ้นตามอายุ", ["rows"], ["title", "source"]),
];

export const deviceInfo = (key: string): DeviceInfo | undefined => DEVICES.find((d) => d.key === key);
