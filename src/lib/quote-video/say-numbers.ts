/**
 * Figures turned into Thai words for the voice only (owner, 2026-10-14: the narrator misread
 * "850,000" and "1.5 ล้าน"). The voices guess at digits, commas and a decimal before ล้าน; words
 * leave nothing to guess. Subtitles and on-screen figures keep their digits — only the text sent
 * to the voice goes through here.
 */

const DIGIT = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACE = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
const UNIT: Record<string, number> = { ล้าน: 1_000_000, แสน: 100_000, หมื่น: 10_000, พัน: 1_000 };

/** below one million; `after` = a higher part was already said, so a closing 1 is เอ็ด */
function group(n: number, after: boolean): string {
  const ds = String(n).split("").map(Number);
  let out = "";
  ds.forEach((d, i) => {
    const place = ds.length - 1 - i;
    if (d === 0) return;
    if (place === 1) out += d === 1 ? "สิบ" : d === 2 ? "ยี่สิบ" : `${DIGIT[d]}สิบ`;
    else if (place === 0 && d === 1 && (after || n > 10)) out += "เอ็ด";
    else out += DIGIT[d] + PLACE[place];
  });
  return out;
}

/** 850000 → "แปดแสนห้าหมื่น", 1000001 → "หนึ่งล้านเอ็ด", 21 → "ยี่สิบเอ็ด" */
export function thaiNumberWords(n: number): string {
  n = Math.round(n);
  if (n === 0) return DIGIT[0];
  if (n < 1_000_000) return group(n, false);
  const hi = Math.floor(n / 1_000_000);
  const lo = n % 1_000_000;
  return `${thaiNumberWords(hi)}ล้าน${lo ? group(lo, true) : ""}`;
}

/**
 * Every figure in a spoken line said in words: "850,000" → "แปดแสนห้าหมื่น", "1.5 ล้าน" →
 * "หนึ่งล้านห้าแสน", "99" → "เก้าสิบเก้า", "27.50" → "ยี่สิบเจ็ดจุดห้าศูนย์".
 */
export function sayNumbers(line: string): string {
  return line.replace(/(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?:\s*(ล้าน|แสน|หมื่น|พัน))?/g, (_m, int: string, frac: string | undefined, unit: string | undefined) => {
    const whole = Number(int.replace(/,/g, ""));
    if (unit) return thaiNumberWords(Number(`${whole}.${frac ?? 0}`) * UNIT[unit]);
    const said = thaiNumberWords(whole);
    return frac ? `${said}จุด${frac.split("").map((d) => DIGIT[+d]).join("")}` : said;
  });
}
