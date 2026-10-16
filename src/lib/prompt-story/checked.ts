import { storyFigure, type StoryFigure } from "@/lib/quote-video/story";
import { sizeOf } from "@/lib/quote-video/timeline";
import { DEFAULT_NARRATOR_FACE, FACES } from "@/lib/story/faces";
import { BRIEF_MAX, MOVE_MAX, SCREEN_MAX, TITLE_MAX, type PictureStyle, type PromptScene, type PromptStoryInput } from "./types";

/**
 * คลิปตามโจทย์'s form, checked on the server before anything is held: the brief and the script as
 * the agent may have edited them, the picture style and painter, the clip's shape. The rules of
 * what may be said are checkScript's (createPromptStory); this is only the form's shape.
 */

/** scripts per agent per rolling hour, to cap the owner's model spend (spec, Money) */
export const HOURLY_LIMIT = 20;
export { BRIEF_MAX };
export const SCENE_COUNTS = [3, 5, 8] as const;
const STYLES: PictureStyle[] = ["cartoon", "real", "flat"];
const PAINTER_IDS: PromptStoryInput["painter"][] = ["standard", "sharp", "gemini"];
const VOICE_MAX = 400;
const PICTURE_MAX = 300;
const CAPTION_MAX = 400;
const DRAFT_ID = /^[0-9a-f-]{36}$/i;

const text = (x: unknown) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim() : "");
const len = (s: string) => [...s].length;

export function checkedPromptStory(v: Record<string, unknown>, narrator: "F" | "M", voice?: string): PromptStoryInput | string {
  if (typeof v.draftId !== "string" || !DRAFT_ID.test(v.draftId)) return "เขียนบทก่อน แล้วค่อยกดสร้างคลิป";
  const brief = typeof v.brief === "string" ? v.brief.trim() : "";
  if (!brief) return "พิมพ์โจทย์ก่อนนะคะ";
  if (brief.length > BRIEF_MAX) return `โจทย์ยาวเกินไป ใส่ได้ไม่เกิน ${BRIEF_MAX} ตัวอักษร`;
  const title = text(v.title);
  if (!title || len(title) > TITLE_MAX) return `ใส่ชื่อคลิป ไม่เกิน ${TITLE_MAX} ตัวอักษร`;
  const caption = text(v.caption);
  if (len(caption) > CAPTION_MAX) return `ข้อความโพสต์ยาวเกินไป ใส่ได้ไม่เกิน ${CAPTION_MAX} ตัวอักษร`;
  if (!Array.isArray(v.scenes) || !(SCENE_COUNTS as readonly number[]).includes(v.scenes.length)) return "เลือกจำนวนฉาก 3, 5 หรือ 8";
  if (!STYLES.includes(v.style as PictureStyle)) return "เลือกแบบภาพ";
  if (!PAINTER_IDS.includes(v.painter as PromptStoryInput["painter"])) return "เลือกคุณภาพภาพ";

  let figure: StoryFigure | undefined;
  if (v.figure) {
    const f = storyFigure(v.figure as Parameters<typeof storyFigure>[0]);
    if (typeof f === "string") return f;
    figure = f;
  }
  const scenes: PromptScene[] = [];
  let shown = false;
  for (const [i, raw] of (v.scenes as unknown[]).entries()) {
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const sc: PromptScene = { voice: text(o.voice), screen: text(o.screen), picture: text(o.picture) };
    if (!sc.voice || len(sc.voice) > VOICE_MAX) return `ฉากที่ ${i + 1}: ใส่คำพูด ไม่เกิน ${VOICE_MAX} ตัวอักษร`;
    if (!sc.screen || len(sc.screen) > SCREEN_MAX) return `ฉากที่ ${i + 1}: ใส่ข้อความบนจอ ไม่เกิน ${SCREEN_MAX} ตัวอักษร`;
    if (!sc.picture || len(sc.picture) > PICTURE_MAX) return `ฉากที่ ${i + 1}: ใส่ภาพที่อยากได้ ไม่เกิน ${PICTURE_MAX} ตัวอักษร`;
    // ภาพขยับ: what moves, and whether this scene's picture is made to move
    const move = text(o.move);
    if (len(move) > MOVE_MAX) return `ฉากที่ ${i + 1}: การขยับยาวเกินไป ใส่ได้ไม่เกิน ${MOVE_MAX} ตัวอักษร`;
    if (move) sc.move = move;
    if (o.animate === true) sc.animate = true;
    // the figure card is drawn on one scene at most, and only when a plan was priced
    if (o.showFigure === true && figure && !shown) {
      sc.showFigure = true;
      shown = true;
    }
    scenes.push(sc);
  }
  const face = v.faces && typeof v.faces === "object" ? (v.faces as Record<string, unknown>).narrator : undefined;
  return {
    product: "FREESTORY", draftId: v.draftId, brief, title, caption, scenes,
    style: v.style as PictureStyle, painter: v.painter as PromptStoryInput["painter"],
    size: sizeOf(v), narrator, ...(voice ? { voice } : {}),
    faces: { narrator: typeof face === "string" && FACES.some((f) => f.id === face) ? face : DEFAULT_NARRATOR_FACE },
    ...(figure ? { figure } : {}),
  };
}
