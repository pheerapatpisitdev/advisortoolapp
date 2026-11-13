"use server";
import { runLater } from "@/lib/later";
import { clipProduce, clipRedraw } from "@/lib/quote-video/jobs";
import { requireMember } from "@/lib/auth/viewer";
import { getContact } from "@/lib/quote-video/contact";
import { createPromptStory, redrawPicture } from "@/lib/quote-video/make";
import { cleanCustomerName } from "@/lib/quote-video/script";
import { storyFigure, type StoryFigure } from "@/lib/quote-video/story";
import { voiceAsked, voiceRefusal } from "@/lib/quote-video/voice-check";
import { geminiVoice } from "@/lib/voice/gemini";
import { mayPromptStory, PROMPT_STORY_CLOSED } from "@/lib/prompt-story/access";
import { BRIEF_MAX, checkedPromptStory, HOURLY_LIMIT, REWRITES_PER_DRAFT, SCENE_COUNTS } from "@/lib/prompt-story/checked";
import { isPromptFormat, isSceneCount, type SceneCount } from "@/lib/prompt-story/types";
import { draftsUpTo, dropDraft, keepRewrite, saveDraft, takeRewrite, writeDraft } from "@/lib/prompt-story/drafts";
import { rewriteScene, writeStory } from "@/lib/prompt-story/writer";
import type { PromptScene } from "@/lib/prompt-story/types";
import type { Made } from "@/app/studio/quote-video/actions";
import { closedFor } from "@/lib/switches/store";

/**
 * คลิปตามโจทย์: the agent's brief written into a script and kept as a draft, the clip made from
 * it, one scene written again, and one scene's picture drawn again. (A "use server" file exports async functions only: the
 * limits live in prompt-story/checked.ts.)
 */

export type WrittenPromptStory =
  | { ok: true; id: string; title: string; caption: string; scenes: PromptScene[]; notes: number[] }
  | { ok: false; error: string };

export async function writePromptStory(v: { brief: string; scenes: SceneCount; figure?: unknown; format?: unknown }): Promise<WrittenPromptStory> {
  const viewer = await requireMember();
  // the owner's alone since 2026-10-17 (prompt-story/access.ts)
  if (!mayPromptStory(viewer)) return { ok: false, error: PROMPT_STORY_CLOSED };
  const closed = await closedFor(viewer, "prompt-story");
  if (closed) return { ok: false, error: closed };
  const brief = typeof v?.brief === "string" ? v.brief.trim() : "";
  if (!brief) return { ok: false, error: "พิมพ์โจทย์ก่อนนะครับ" };
  if (brief.length > BRIEF_MAX) return { ok: false, error: `โจทย์ยาวเกินไป ใส่ได้ไม่เกิน ${BRIEF_MAX} ตัวอักษร` };
  if (!isSceneCount(v.scenes)) return { ok: false, error: `เลือกจำนวนฉาก ${SCENE_COUNTS.join(", ")}` };

  let figure: StoryFigure | undefined;
  if (v.figure) {
    const f = storyFigure(v.figure as Parameters<typeof storyFigure>[0]);
    if (typeof f === "string") return { ok: false, error: f };
    figure = f;
  }

  // ตามโจทย์ · ละครสั้น 3 ฉาก · รีวิวเคสเคลม; anything else is written as ตามโจทย์
  const format = isPromptFormat(v.format) ? v.format : undefined;
  const asked = { brief, scenes: v.scenes, figure: figure ?? null, ...(format ? { format } : {}) };
  // the draft's row is taken first and then counted, so presses at once each see the others
  // and the hour's cap holds (owner, 2026-10-18); one over the cap gives its row back
  const id = await saveDraft(viewer.agentId, asked, { pending: true });
  if ((await draftsUpTo(viewer.agentId, id)) > HOURLY_LIMIT) {
    await dropDraft(id).catch(() => undefined);
    return { ok: false, error: `เขียนบทครบ ${HOURLY_LIMIT} ครั้งในชั่วโมงนี้แล้ว รอสักครู่แล้วลองใหม่นะครับ` };
  }

  const w = await writeStory({ brief, scenes: v.scenes, figure, format });
  // a refused brief cost a model call too: kept, marked refused, so the hour counts it
  if (!w.ok) {
    await writeDraft(id, { refused: true, refusal: w.refusal });
    return { ok: false, error: w.refusal };
  }
  await writeDraft(id, { title: w.title, caption: w.caption, scenes: w.scenes, notes: w.notes });
  return { ok: true, id, title: w.title, caption: w.caption, scenes: w.scenes, notes: w.notes };
}

/**
 * สร้างคลิป: the script as the agent left it, checked and paid for (createPromptStory), then
 * made after the answer, as every clip is. The agent's name and phone go on the closing card.
 */
export async function makePromptStory(v: Record<string, unknown>, customer: string): Promise<Made> {
  const viewer = await requireMember();
  if (!mayPromptStory(viewer)) return { ok: false, error: PROMPT_STORY_CLOSED };
  const closed = await closedFor(viewer, "prompt-story");
  if (closed) return { ok: false, error: closed };
  const eleven = voiceAsked(v?.voice);
  // one of Gemini's 30 voices (owner, 2026-10-17)
  const gemini = eleven ? undefined : geminiVoice(v?.gemini);
  const asked = checkedPromptStory(v ?? {}, eleven ? eleven.sex : gemini ? gemini.sex : v?.narrator === "M" ? "M" : "F", eleven?.id);
  if (typeof asked === "string") return { ok: false, error: asked };
  const input = gemini ? { ...asked, gemini: gemini.name } : asked;
  const contact = await getContact(viewer.agentId);
  if (!(contact.name || viewer.name).trim() || !contact.phone) {
    return { ok: false, needContact: true, error: "ใส่ชื่อและเบอร์ในบัญชีของฉันก่อน ลูกค้าจะเห็นตอนท้ายวิดีโอนะครับ" };
  }
  const full = await voiceRefusal(input.voice);
  if (full) return { ok: false, error: full };
  try {
    const made = await createPromptStory(viewer, input, cleanCustomerName(typeof customer === "string" ? customer : ""));
    if ("refusal" in made) return { ok: false, error: made.refusal };
    const { id } = made;
    runLater(clipProduce, { id, agentName: viewer.name.trim() }, { agentId: viewer.agentId });
    return { ok: true, id };
  } catch (e) {
    console.error("prompt story not started:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "เริ่มทำวิดีโอไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

/**
 * เขียนฉากนี้ใหม่: `scene` from 0 of the agent's own written draft, free, REWRITES_PER_DRAFT times a
 * draft (the count taken before the AI is asked, kept in the draft: prompt-story/drafts.ts). `left` is
 * how many are left after this one.
 */
export async function rewritePromptScene(draftId: string, scene: number): Promise<{ ok: true; scene: PromptScene; left: number } | { ok: false; error: string }> {
  const viewer = await requireMember();
  if (!mayPromptStory(viewer)) return { ok: false, error: PROMPT_STORY_CLOSED };
  const closed = await closedFor(viewer, "prompt-story");
  if (closed) return { ok: false, error: closed };
  if (typeof draftId !== "string" || !/^[0-9a-f-]{36}$/i.test(draftId) || !Number.isInteger(scene) || scene < 0) return { ok: false, error: "ไม่พบฉากนี้" };
  try {
    const taken = await takeRewrite(viewer.agentId, draftId, scene);
    if (!taken.ok) return taken;
    const a = taken.asked;
    const f = a.figure && typeof a.figure === "object" ? storyFigure(a.figure as Parameters<typeof storyFigure>[0]) : undefined;
    const r = await rewriteScene({
      brief: typeof a.brief === "string" ? a.brief : "",
      scenes: taken.scenes,
      scene,
      figure: typeof f === "object" ? f : undefined,
      format: isPromptFormat(a.format) ? a.format : undefined,
    });
    if (!r.ok) return r;
    await keepRewrite(viewer.agentId, draftId, taken.n, scene, r.scene).catch((e) =>
      console.error("rewritten scene not kept:", e instanceof Error ? e.message : "unknown error"));
    return { ok: true, scene: r.scene, left: REWRITES_PER_DRAFT - taken.n };
  } catch (e) {
    console.error("prompt scene rewrite failed:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "เขียนฉากใหม่ไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

/** วาดภาพฉากนี้ใหม่: `scene` from 0; the drawing and the cut run after the answer */
export async function redrawPromptPicture(id: string, scene: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await requireMember();
  if (!mayPromptStory(viewer)) return { ok: false, error: PROMPT_STORY_CLOSED };
  const closed = await closedFor(viewer, "prompt-story");
  if (closed) return { ok: false, error: closed };
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id) || typeof scene !== "number") return { ok: false, error: "ไม่พบวิดีโอนี้" };
  try {
    return await redrawPicture(viewer, id, scene, (job) => runLater(clipRedraw, job, { agentId: viewer.agentId }));
  } catch (e) {
    console.error("prompt story redraw not started:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "วาดภาพใหม่ไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
