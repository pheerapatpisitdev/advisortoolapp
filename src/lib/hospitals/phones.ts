/**
 * The departments' numbers on โรงพยาบาลในเครือ (owner, 2026-11-24): who to call about the insurance,
 * for a room's price, for a doctor's appointment, and the front desk. Browser-safe.
 *
 * A number is kept as the hospital writes it ("UR Nurse 0 2561 1111 ต่อ 4537"), since the words round it
 * say which desk answers; `telOf` finds the part a phone can dial.
 */
export const DEPARTMENTS = [
  { key: "insurance", label: "ประกัน" },
  { key: "room", label: "ค่าห้อง" },
  { key: "appointment", label: "นัดแพทย์" },
  { key: "reception", label: "ต้อนรับ" },
] as const;

export type DeptKey = (typeof DEPARTMENTS)[number]["key"];
export type Phones = Record<DeptKey, string[]>;

export const LINE_MAX = 60;
export const LINES_MAX = 8;

/** Bangkok's and the provinces' landlines are nine digits, a mobile ten; a chain's line is four, starting with 1. */
const LANDLINE = /(?<!\d)0 ?[23457](?: ?\d){7}(?! ?\d)/;
const MOBILE = /(?<!\d)0 ?[689](?: ?\d){8}(?! ?\d)/;
const SHORT = /(?<!\d)1\d{3}(?!\d)/;

/**
 * The number a tap on these words dials, digits alone, or null. What follows ต่อ, ext or กด is an extension
 * asked for after the call is answered, so "นอกเวลา ต่อ 1170" dials nothing: 1170 is not a number to call.
 */
export function telOf(text: string): string | null {
  const before = text.split(/ต่อ|ext|กด/i)[0];
  const found = before.match(LANDLINE) ?? before.match(MOBILE) ?? before.match(SHORT);
  return found ? found[0].replace(/ /g, "") : null;
}

/** the insurer's central number: several written with commas, each dialled on its own */
export function dialParts(phone: string): { text: string; tel: string | null }[] {
  return phone.split(",").map((p) => p.trim()).filter(Boolean).map((text) => ({ text, tel: telOf(text) }));
}

/** the back office's four boxes, one number a line, as they may be saved */
export function cleanPhones(raw: Record<string, unknown>): { ok: true; value: Phones } | { ok: false; error: string } {
  const value = {} as Phones;
  for (const { key, label } of DEPARTMENTS) {
    const text = typeof raw[key] === "string" ? raw[key] : "";
    const lines = [...new Set(text.split(/\r?\n/).map((l) => l.trim().replace(/\s+/g, " ")).filter(Boolean))];
    const blank = lines.find((l) => !/\d/.test(l));
    if (blank) return { ok: false, error: `${label}: "${blank}" ไม่มีตัวเลข` };
    if (lines.some((l) => l.length > LINE_MAX)) return { ok: false, error: `${label}: บรรทัดละไม่เกิน ${LINE_MAX} ตัวอักษร` };
    if (lines.length > LINES_MAX) return { ok: false, error: `${label}: ไม่เกิน ${LINES_MAX} เบอร์` };
    value[key] = lines;
  }
  if (DEPARTMENTS.every(({ key }) => value[key].length === 0)) return { ok: false, error: "ใส่อย่างน้อยหนึ่งเบอร์" };
  return { ok: true, value };
}
