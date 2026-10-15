/**
 * The words of เสียงของฉัน (owner, 2026-10-15, mockup https://claude.ai/artifact/8aEHEDbMbeCJXiaKa3ie7m):
 * what the agent reads into the microphone, the sentence they consent in, and the line the clone
 * reads back. Browser-safe: the recorder shows them, the server checks against them.
 *
 * Four takes. The last is the consent, read aloud with a code drawn fresh each time, so a clip
 * of someone else's voice cannot be played in for it; it is kept as the record of consent.
 */

export type VoiceSex = "F" | "M";

export const TAKES = 4;
/** how long one take may run, in seconds: long enough to clone from, short enough to upload */
export const TAKE_MIN_SEC = 6;
export const TAKE_MAX_SEC = 60;
/** re-recordings before approval, and of an approved voice in a year, at no charge (owner, 2026-10-15) */
export const PREVIEW_REDOS = 2;
export const YEARLY_REDOS = 2;

const said = (sex: VoiceSex) => ({ end: sex === "F" ? "ค่ะ" : "ครับ", ask: sex === "F" ? "คะ" : "ครับ", me: sex === "F" ? "ดิฉัน" : "ผม" });

/** a four-digit code, read out digit by digit */
export const drawCode = (rand: () => number = Math.random) => Array.from({ length: 4 }, () => Math.floor(rand() * 10)).join("");
export const spokenCode = (code: string) => code.split("").join(" ");

/** the sentence of consent, as it is read and as it is kept */
export function consentText(sex: VoiceSex, name: string, code: string): string {
  const s = said(sex);
  return `${s.me} ${name} ยืนยันว่าเสียงนี้เป็นเสียงของ${s.me}เอง และยินยอมให้ใช้สร้างเสียงสังเคราะห์ สำหรับคลิปของ${s.me}ในแอปนี้เท่านั้น รหัส ${spokenCode(code)}`;
}

/** the four takes: an introduction, a stretch about insurance, numbers and dates, and the consent */
export function takeTexts(sex: VoiceSex, name: string, code: string): { title: string; text: string }[] {
  const s = said(sex);
  return [
    { title: "แนะนำตัว", text: `สวัสดี${s.end} ${s.me}ชื่อ ${name} เป็นตัวแทนประกันชีวิต ยินดีที่ได้รู้จักนะ${s.ask} วันนี้จะมาเล่าเรื่องประกันแบบเข้าใจง่าย ๆ ให้ฟัง${s.end}` },
    { title: "เรื่องประกัน", text: `ถ้าป่วยต้องนอนโรงพยาบาล ค่ารักษาอาจสูงกว่าที่คิด การวางแผนไว้ก่อน ช่วยให้ทั้งครอบครัวอุ่นใจกว่า${s.end} ประกันไม่ได้ทำให้เกิดเรื่องร้าย แต่ทำให้คนที่เรารักไม่ต้องลำบาก` },
    { title: "ตัวเลขและวันที่", text: `เบี้ยปีละสามหมื่นสามพันแปดร้อยบาท ได้ความคุ้มครองหนึ่งล้านบาท ครบกำหนดชำระวันที่สิบห้าพฤศจิกายน มีคำถามอะไร ทักมาได้ตลอดเลยนะ${s.ask}` },
    { title: "ประโยคยินยอม", text: consentText(sex, name, code) },
  ];
}

/** what the clone reads back, for the agent and the reviewer to hear */
export function previewLine(sex: VoiceSex, name: string): string {
  const s = said(sex);
  return `สวัสดี${s.end} ${name}เองนะ${s.ask} วันนี้มีแผนประกันที่เหมาะกับคุณมาเล่าให้ฟัง${s.end}`;
}
