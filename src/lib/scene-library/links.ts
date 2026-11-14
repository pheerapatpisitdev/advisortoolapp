import { INFO_SHELVES, infoArt, topicOf, type InfoArt, type StoryTopic } from "@/lib/story/topics";
import { isPromptFormat, type PromptFormat } from "@/lib/prompt-story/types";
import { isUploadId } from "./upload-rules";

/**
 * คลังแอนิเมชัน's links into the clip forms (spec 2026-11-14, "Links into the forms"): the library's
 * "ใช้แบบนี้" opens คลิปเล่าเรื่อง on a topic and look, and คลิปตามโจทย์ on a format and style. Browser-safe.
 * Nothing in an address is trusted: an unknown value is left out, and the form opens as it would anyway.
 */

/** คลิปเล่าเรื่อง's seven looks, as its form names them (`art`): the four, then ไวต์บอร์ด นีออน บลูพริ้นท์ (2026-11-14) */
export type StoryLook = "paper" | "minimal" | "line" | InfoArt;
const STORY_LOOKS: readonly StoryLook[] = ["paper", "minimal", "plot", "line", "board", "neon", "blueprint"];
/** คลิปตามโจทย์'s seven styles a link may name (the form calls แสงอุ่น "warm") */
export type PromptStyle = "paper" | "warm" | "plot" | "line" | "board" | "neon" | "blueprint";
const PROMPT_STYLES: readonly PromptStyle[] = ["paper", "warm", "plot", "line", "board", "neon", "blueprint"];

export interface StoryStart { topic?: StoryTopic; look?: StoryLook }
/**
 * `asset`: a library part's id (spec 2026-11-14-library-uploads), the script editor's picker opens with it first;
 * `ref`: a library style's id, the form opens with it as the picture style reference
 */
export interface PromptStart { format?: PromptFormat; style?: PromptStyle; asset?: string; ref?: string }
type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** the links into the clip forms; absent params are left out */
export const storyLibraryHref = (p: { topic?: string; look?: string }): string => {
  const q = new URLSearchParams();
  if (p.topic) q.set("topic", p.topic);
  if (p.look) q.set("look", p.look);
  const s = q.toString();
  return `/studio/story-clip${s ? `?${s}` : ""}`;
};
export const promptLibraryHref = (p: { format?: string; style?: string }): string => {
  const q = new URLSearchParams();
  if (p.format) q.set("format", p.format);
  if (p.style) q.set("style", p.style);
  const s = q.toString();
  return `/studio/prompt-story${s ? `?${s}` : ""}`;
};

/**
 * What a คลิปเล่าเรื่อง address asked for. ปากกาพล็อตเตอร์, ไวต์บอร์ด, นีออน and บลูพริ้นท์ (INFO_ARTS) draw only the
 * shelves told in points (INFO_SHELVES): on a topic of any other shelf the topic is kept and the look left out, so
 * the form opens on the topic in the look it would have anyway. With no topic there is nothing to check it against.
 */
export function storyStartFrom(params: Params): StoryStart {
  const topic = topicOf(one(params.topic) ?? "");
  const look = one(params.look) as StoryLook | undefined;
  const lookOk = look !== undefined && STORY_LOOKS.includes(look) && !(infoArt(look) && topic && !INFO_SHELVES.includes(topic.shelf));
  return { ...(topic ? { topic: topic.key } : {}), ...(lookOk ? { look } : {}) };
}

/** what a คลิปตามโจทย์ address asked for */
export function promptStartFrom(params: Params): PromptStart {
  const format = one(params.format);
  const style = one(params.style) as PromptStyle | undefined;
  const asset = one(params.asset);
  const ref = one(params.ref);
  return {
    ...(isPromptFormat(format) ? { format } : {}),
    ...(style !== undefined && PROMPT_STYLES.includes(style) ? { style } : {}),
    // whether it is an approved part the page's list says; an id that is not one is passed over there
    ...(isUploadId(asset) ? { asset } : {}),
    // likewise an approved style, checked against the page's list of styles
    ...(isUploadId(ref) ? { ref } : {}),
  };
}

/** the look the form opens in: the link's, over the one remembered in this browser */
export function startLook(start: StoryStart | undefined, remembered: StoryLook): StoryLook;
export function startLook(start: PromptStart | undefined, remembered: PromptStyle): PromptStyle;
export function startLook(start: (StoryStart & PromptStart) | undefined, remembered: string): string {
  return start?.look ?? start?.style ?? remembered;
}
