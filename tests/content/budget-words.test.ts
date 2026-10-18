import { describe, expect, it, vi } from "vitest";

/** the content ceiling's words: /admin/ai for the owner, "แจ้งแอดมิน" for anyone else (owner, 2026-10-18) */
const who = vi.hoisted(() => ({ viewer: null as unknown }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => who.viewer }));
const { capReached, tooDear } = await import("@/lib/content/budget-words");

describe("budget words", () => {
  it("points the owner at /admin/ai", async () => {
    who.viewer = { agentId: "o", staff: { owner: true } };
    expect(await capReached(300)).toContain("/admin/ai");
    expect(await tooDear("รอบนี้", 1.5, true)).toBe("งบสร้างคอนเทนต์เดือนนี้เหลือ 1.50 บาท ไม่พอรอบนี้ — ลดจำนวนชิ้น เลือกโมเดลประหยัด หรือเพิ่มงบได้ที่หน้า /admin/ai");
  });

  it("tells an agent to tell the admin, never a page they cannot open", async () => {
    who.viewer = { agentId: "a", staff: null };
    expect(await capReached(300)).toBe("งบ AI ของระบบเดือนนี้เต็มแล้ว แจ้งแอดมิน");
    expect(await tooDear("รอบนี้", 1.5, true)).not.toContain("/admin");
  });
});
