import { ageWord } from "@/lib/lifeprotect-cta";

/**
 * The sentences that close a sales page's quote, written once for the page and the card that
 * pictures it (owner, 2026-10-06: every card says what its page says), so the two cannot
 * come to say different things. Life Protect's are in lifeprotect-cta.ts, beside its riders.
 */

const STANDARD_RATE = "เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน";

/**
 * Why to start young: the premium is set at the age it starts. `during` is how long it is
 * held, "ตลอดระยะเวลาชำระ" or a plan's own "ตลอด 6 ปีที่ชำระ".
 */
export function priceLockNote(age: number, during = "ตลอดระยะเวลาชำระ"): string {
  return `✦ เบี้ยล็อกที่อายุ${age === 0 ? "" : " "}${ageWord(age)} ${during} ยิ่งเริ่มเร็วยิ่งถูก`;
}

/** Easy Protect and Life Treasure: a level premium, and the smallest sum they are sold at. */
export function levelPremiumFootnote(saMin: number): string {
  return `เบี้ยคงที่ตลอดระยะเวลาชำระ · ทุนขั้นต่ำ ${saMin.toLocaleString("en-US")} บาท · ${STANDARD_RATE}`;
}

/** iShield: when the illnesses are covered from, and what an early claim does to the sum. */
export function iShieldFootnote(waitingDays: number): string {
  return `โรคร้ายแรงคุ้มครองหลังกรมธรรม์มีผลบังคับ ${waitingDays} วัน · เมื่อรับผลประโยชน์ระยะเริ่มต้นแล้ว`
    + ` ทุนประกันจะลดลงตามสัดส่วนที่จ่ายไป · ${STANDARD_RATE}`;
}

/**
 * PLB: a level premium that is cheaper per thousand the larger the sum. The page adds a nudge
 * to try its slider; a card has no slider, so it goes without.
 */
export function plbFootnote(withSlider: boolean): string {
  return `เบี้ยคงที่ตลอดสัญญา · ทุนยิ่งสูง เบี้ยต่อพันยิ่งลด${withSlider ? " ลองเลื่อนทุนดูราคาต่อล้าน" : ""} · ${STANDARD_RATE}`;
}
