"use server";
import { after } from "next/server";
import { asWho } from "@/lib/ai/who";
import { can } from "@/lib/auth/access";
import { requireMember } from "@/lib/auth/viewer";
import { memberAccess, PASS_EXPIRED, PASS_UNREADABLE, passOpen } from "@/lib/members/access";
import { getContact } from "@/lib/quote-video/contact";
import { createPromptStory, produce, redrawPicture } from "@/lib/quote-video/make";
import { cleanCustomerName } from "@/lib/quote-video/script";
import { storyFigure, type StoryFigure } from "@/lib/quote-video/story";
import { voiceAsked, voiceRefusal } from "@/lib/quote-video/voice-check";
import { mayPromptStory, PROMPT_STORY_CLOSED } from "@/lib/prompt-story/access";
import { BRIEF_MAX, checkedPromptStory, HOURLY_LIMIT } from "@/lib/prompt-story/checked";
import { draftsLastHour, saveDraft } from "@/lib/prompt-story/drafts";
import { writeStory } from "@/lib/prompt-story/writer";
import type { PromptScene } from "@/lib/prompt-story/types";
import type { Made } from "@/app/studio/quote-video/actions";

/**
 * คลิปตามโจทย์: the agent's brief written into a script and kept as a draft, the clip made from
 * it, and one scene's picture drawn again. (A "use server" file exports async functions only: the
 * limits live in prompt-story/checked.ts.)
 */

export type WrittenPromptStory =
  | { ok: true; id: string; title: string; caption: string; scenes: PromptScene[]; notes: number[] }
  | { ok: false; error: string };

export async function writePromptStory(v: { brief: string; scenes: 3 | 5 | 8; figure?: unknown }): Promise<WrittenPromptStory> {
  const viewer = await requireMember();
  // the owner's alone since 2026-10-17 (prompt-story/access.ts)
  if (!mayPromptStory(viewer)) return { ok: false, error: PROMPT_STORY_CLOSED };
  // an outside member writes scripts while their pass is live, as they make clips (make.ts createVideo)
  if (!can(viewer, "owner")) {
    const access = await memberAccess(viewer).catch((e) => {
      console.error("prompt story refused, pass unreadable:", e);
      return null;
    });
    if (!access) return { ok: false, error: PASS_UNREADABLE };
    if (!passOpen(access)) return { ok: false, error: PASS_EXPIRED };
  }
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
  const asked = { brief, scenes: v.scenes, figure: figure ?? null };
  // a refused brief cost a model call too: kept, marked refused, so the hour counts it
  if (!w.ok) {
    await saveDraft(viewer.agentId, asked, { refused: true, refusal: w.refusal });
    return { ok: false, error: w.refusal };
  }
  const id = await saveDraft(viewer.agentId, asked, { title: w.title, caption: w.caption, scenes: w.scenes, notes: w.notes });
  return { ok: true, id, title: w.title, caption: w.caption, scenes: w.scenes, notes: w.notes };
}

/**
 * สร้างคลิป: the script as the agent left it, checked and paid for (createPromptStory), then
 * made after the answer, as every clip is. The agent's name and phone go on the closing card.
 */
export async function makePromptStory(v: Record<string, unknown>, customer: string): Promise<Made> {
  const viewer = await requireMember();
  if (!mayPromptStory(viewer)) return { ok: false, error: PROMPT_STORY_CLOSED };
  const eleven = voiceAsked(v?.voice);
  const input = checkedPromptStory(v ?? {}, eleven ? eleven.sex : v?.narrator === "M" ? "M" : "F", eleven?.id);
  if (typeof input === "string") return { ok: false, error: input };
  const contact = await getContact(viewer.agentId);
  if (!viewer.name.trim() || !contact.phone) {
    return { ok: false, needContact: true, error: "ใส่ชื่อและเบอร์ในบัญชีของฉันก่อน ลูกค้าจะเห็นตอนท้ายวิดีโอ" };
  }
  const full = await voiceRefusal(input.voice);
  if (full) return { ok: false, error: full };
  try {
    const made = await createPromptStory(viewer, input, cleanCustomerName(typeof customer === "string" ? customer : ""));
    if ("refusal" in made) return { ok: false, error: made.refusal };
    const { id } = made;
    after(() => asWho(viewer.agentId, () => produce(id, viewer.name.trim())));
    return { ok: true, id };
  } catch (e) {
    console.error("prompt story not started:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "เริ่มทำวิดีโอไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

/** วาดภาพฉากนี้ใหม่: `scene` from 0; the drawing and the cut run after the answer */
export async function redrawPromptPicture(id: string, scene: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await requireMember();
  if (!mayPromptStory(viewer)) return { ok: false, error: PROMPT_STORY_CLOSED };
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id) || typeof scene !== "number") return { ok: false, error: "ไม่พบวิดีโอนี้" };
  try {
    return await redrawPicture(viewer, id, scene, (work) => after(() => asWho(viewer.agentId, work)));
  } catch (e) {
    console.error("prompt story redraw not started:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "วาดภาพใหม่ไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}
