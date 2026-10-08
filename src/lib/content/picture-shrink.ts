import { ACCEPTED_TYPES } from "./describe";

/** What is done to a picture in the browser before it is sent to be read; pure, so it can be tested. */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_SIDE = 1024;
/** the long side of the thumbnail kept in a member's history */
export const THUMB_SIDE = 256;

/** the long side brought down to `side` with the shape kept; a small picture is never enlarged */
export function shrunkSize(w: number, h: number, side = MAX_SIDE): { w: number; h: number } {
  const long = Math.max(w, h);
  if (long <= side) return { w, h };
  const k = side / long;
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

/** why a file cannot be read, in Thai, or null when it can */
export function fileProblem(f: { type: string; size: number }): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(f.type)) return "ใช้ได้เฉพาะรูป jpg, png หรือ webp (รูป HEIC จากไอโฟนให้บันทึกเป็น jpg ก่อน)";
  if (f.size > MAX_UPLOAD_BYTES) return "ไฟล์ใหญ่เกิน 8 MB ลองรูปที่เล็กกว่านี้นะครับ";
  return null;
}
