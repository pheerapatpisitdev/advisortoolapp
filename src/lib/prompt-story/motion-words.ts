import type { MotionKind } from "./types";

/**
 * A โมชันกราฟิก layout's reasons (checkMotion's "motion.bad.head: ว่างอยู่") in the words of the editor's boxes
 * (MotionFields): "แบบฉาก ฝั่งแรก (✕): ว่างอยู่", so the agent finds the box to fix. Read by the server's refusals
 * (checked.ts, make.ts) only: never by check.ts nor the drawing, which the Remotion image carries.
 */

const SIDE: Record<string, string> = { bad: "ฝั่งแรก (✕)", good: "ฝั่งสอง (✓)" };
const ONE: Record<string, string> = {
  tag: "ป้ายบน", chips: "ป้าย", value: "ตัวเลข", unit: "หน่วย", bill: "หัวใบเสร็จ", title: "หัวข้อ", ticks: "ข้อ",
  photo: "ภาพวงกลม", key: "คำเน้น", icon: "ไอคอน",
};

/** the box a reason's path names ("bad.lines[1]", "chips[0]"), as MotionFields labels it; "" when it names none (the kind, the whole layout) */
export function motionFieldLabel(path: string, kind?: MotionKind): string {
  const m = /^(\w+)(?:\.(\w+))?(?:\[(\d+)\])?$/.exec(path);
  if (!m) return "";
  const [, head, sub, at] = m;
  const n = at === undefined ? undefined : Number(at) + 1;
  if (SIDE[head]) {
    if (sub === "lines") return n ? `${SIDE[head]} บรรทัด ${n}` : `${SIDE[head]} บรรทัด`;
    return SIDE[head];
  }
  if (sub) return "";
  if (head === "lines") {
    if (kind === "check") return n ? `หัวข้อบรรทัด ${n}` : "หัวข้อ";
    return n ? `บรรทัดที่ ${n}` : "บรรทัด";
  }
  if (head === "chips") return n ? `ป้ายที่ ${n}` : ONE.chips;
  if (head === "ticks") return n ? `ข้อ ${n}` : ONE.ticks;
  return ONE[head] ?? "";
}

/** "motion.<path>: why" as "แบบฉาก <box>: why"; any other reason as it is */
export function motionReason(reason: string, kind?: MotionKind): string {
  const m = /^motion(?:\.([^:]+))?: ([\s\S]*)$/.exec(reason);
  if (!m) return reason;
  const label = m[1] ? motionFieldLabel(m[1], kind) : "";
  return `แบบฉาก${label ? ` ${label}` : ""}: ${m[2]}`;
}

/** every failing box of a scene's layout, each once, joined with " · " */
export const motionReasons = (reasons: string[], kind?: MotionKind): string => [...new Set(reasons.map((r) => motionReason(r, kind)))].join(" · ");
