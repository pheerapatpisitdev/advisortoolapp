"use server";
import { requireMember } from "@/lib/auth/viewer";
import { storyFigure, type StoryFigure } from "@/lib/quote-video/story";
import { draftsLastHour, saveDraft } from "@/lib/prompt-story/drafts";
import { writeStory } from "@/lib/prompt-story/writer";
import type { PromptScene } from "@/lib/prompt-story/types";

/** คลิปตามโจทย์: the agent's brief written into a script and kept as a draft. */
export const HOURLY_LIMIT = 20;
export const BRIEF_MAX = 600;

export type WrittenPromptStory =
  | { ok: true; id: string; title: string; caption: string; scenes: PromptScene[]; notes: number[] }
  | { ok: false; error: string };

export async function writePromptStory(v: { brief: string; scenes: 3 | 5 | 8; figure?: unknown }): Promise<WrittenPromptStory> {
  const viewer = await requireMember();
  const brief = typeof v?.brief === "string" ? v.brief.trim() : "";
  if (!brief) return { ok: false, error: "พิมพ์โจทย์ก่อนนะคะ" };
  if (brief.length > BRIEF_MAX) return { ok: false, error: `โจทย์ยาวเกินไป ใส่ได้ไม่เกิน ${BRIEF_MAX} ตัวอักษร` };
  if (v.scenes !== 3 && v.scenes !== 5 && v.scenes !== 8) return { ok: false, error: "เลือกจำนวนฉาก 3, 5 หรือ 8" };

  let figure: StoryFigure | undefined;
  if (v.figure) {
    const f = storyFigure(v.figure as Parameters<typeof storyFigure>[0]);
    if (typeof f === "string") return { ok: false, error: f };
    figure = f;
  }

  if ((await draftsLastHour(viewer.agentId)) >= HOURLY_LIMIT) return { ok: false, error: `เขียนบทครบ ${HOURLY_LIMIT} ครั้งในชั่วโมงนี้แล้ว รอสักครู่แล้วลองใหม่นะคะ` };

  const w = await writeStory({ brief, scenes: v.scenes, figure });
  if (!w.ok) return { ok: false, error: w.refusal };
  const id = await saveDraft(viewer.agentId, { brief, scenes: v.scenes, figure: figure ?? null }, { title: w.title, caption: w.caption, scenes: w.scenes, notes: w.notes });
  return { ok: true, id, title: w.title, caption: w.caption, scenes: w.scenes, notes: w.notes };
}
