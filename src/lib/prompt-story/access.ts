import { can, type Viewer } from "@/lib/auth/access";

/**
 * whether this viewer may make a คลิปตามโจทย์: the owner (015495) alone since 2026-10-17 (owner,
 * mockup https://claude.ai/artifact/LcRWfmRo4opwx7mymfd7fM); every agent and live-pass member before that
 */
export function mayPromptStory(viewer: Viewer | null): boolean {
  return Boolean(viewer?.agentId) && can(viewer, "owner");
}

/** what anyone else is told, on the page and from every step (owner chose ก, 2026-10-17) */
export const PROMPT_STORY_CLOSED = "ฟังก์ชันนี้ปิดใช้งานอยู่";
