/**
 * An action's throw, answered as a refusal (owner, 2026-10-18): Next hides a server action's
 * thrown message in production, so the board only saw it fail and said "การเชื่อมต่อหลุด".
 * A message written for the agent (in Thai: กรุณาเข้าสู่ระบบก่อน, ไม่มีสิทธิ์ใช้ส่วนนี้, a Page
 * that is not theirs) is passed on; anything else is logged and said as `fallback`.
 */
export async function said<T>(run: () => Promise<T>, fallback = "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้งนะครับ"): Promise<T | { ok: false; error: string }> {
  try {
    return await run();
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (/[฀-๿]/.test(m)) return { ok: false, error: m };
    console.error("action failed:", e);
    return { ok: false, error: fallback };
  }
}
