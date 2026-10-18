import { can } from "@/lib/auth/access";
import { getViewer } from "@/lib/auth/viewer";

/**
 * The words for the owner's monthly content ceiling, reached or too near (owner, 2026-10-18):
 * the owner is pointed at /admin/ai, where the ceiling is raised; anyone else cannot open that
 * page, and is told to tell the admin. Work running after the answer went back (no request to
 * read a viewer from) gets the agent's words.
 */
async function isOwner(): Promise<boolean> {
  try {
    return can(await getViewer(), "owner");
  } catch {
    return false;
  }
}

export async function capReached(cap: number): Promise<string> {
  return (await isOwner())
    ? `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${cap} บาทแล้ว (กันไว้ให้บอทตอบลูกค้า) — เพิ่มงบได้ที่หน้า /admin/ai`
    : "งบ AI ของระบบเดือนนี้เต็มแล้ว แจ้งแอดมิน";
}

/** the ceiling not reached, but `what` would pass it; `fewer`: a round, which fewer pieces or a cheaper writer may fit */
export async function tooDear(what: string, left: number, fewer = false): Promise<string> {
  const smaller = fewer ? "ลดจำนวนชิ้น เลือกโมเดลประหยัด หรือ" : "";
  return (await isOwner())
    ? `งบสร้างคอนเทนต์เดือนนี้เหลือ ${left.toFixed(2)} บาท ไม่พอ${what} — ${smaller}เพิ่มงบได้ที่หน้า /admin/ai`
    : `งบ AI ของระบบเดือนนี้เหลือไม่พอ${what} — ${smaller}แจ้งแอดมิน`;
}
