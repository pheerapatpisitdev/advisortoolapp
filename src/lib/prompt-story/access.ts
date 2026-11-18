import type { Viewer } from "@/lib/auth/access";

/**
 * whether this viewer may make a คลิปตามโจทย์: every agent and every สมาชิกทั่วไป, as คลิปเล่าเรื่อง
 * (owner chose ก, 2026-11-18, mockup https://claude.ai/artifact/NpbKD2nHykvZXRH5dYMbWP). The owner's alone
 * 2026-10-17 to 2026-11-18. A member's pass is checked on each paid or AI step (actions.ts passRefusal,
 * make.ts createVideo / redrawPicture), not here, so a lapsed member still sees the page and is told why.
 */
export function mayPromptStory(viewer: Viewer | null): boolean {
  return Boolean(viewer?.agentId);
}

/** what anyone else is told, on the page and from every step (owner chose ก, 2026-10-17) */
export const PROMPT_STORY_CLOSED = "ฟังก์ชันนี้ปิดใช้งานอยู่";
