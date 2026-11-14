import { INFO_SHELVES, topicOf, type StoryTopic } from "@/lib/story/topics";
import { isPromptFormat, type PromptFormat } from "@/lib/prompt-story/types";

/**
 * คลังแอนิเมชัน's links into the clip forms (spec 2026-11-14, "Links into the forms"): the library's
 * "ใช้แบบนี้" opens คลิปเล่าเรื่อง on a topic and look, and คลิปตามโจทย์ on a format and style. Browser-safe.
 * Nothing in an address is trusted: an unknown value is left out, and the form opens as it would anyway.
 */

/** คลิปเล่าเรื่อง's four looks, as its form names them (`art`) */
export type StoryLook = "paper" | "minimal" | "plot" | "line";
const STORY_LOOKS: readonly StoryLook[] = ["paper", "minimal", "plot", "line"];
/** คลิปตามโจทย์'s four styles a link may name (the form calls แสงอุ่น "warm") */
export type PromptStyle = "paper" | "warm" | "plot" | "line";
const PROMPT_STYLES: readonly PromptStyle[] = ["paper", "warm", "plot", "line"];

export interface StoryStart { topic?: StoryTopic; look?: StoryLook }
export interface PromptStart { format?: PromptFormat; style?: PromptStyle }
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
 * What a คลิปเล่าเรื่อง address asked for. ปากกาพล็อตเตอร์ draws only the shelves told in points
 * (INFO_SHELVES): on a topic of any other shelf the topic is kept and the look left out, so the form
 * opens on the topic in the look it would have anyway. With no topic there is nothing to check it against.
 */
export function storyStartFrom(params: Params): StoryStart {
  const topic = topicOf(one(params.topic) ?? "");
  const look = one(params.look) as StoryLook | undefined;
  const lookOk = look !== undefined && STORY_LOOKS.includes(look) && !(look === "plot" && topic && !INFO_SHELVES.includes(topic.shelf));
  return { ...(topic ? { topic: topic.key } : {}), ...(lookOk ? { look } : {}) };
}

/** what a คลิปตามโจทย์ address asked for */
export function promptStartFrom(params: Params): PromptStart {
  const format = one(params.format);
  const style = one(params.style) as PromptStyle | undefined;
  return {
    ...(isPromptFormat(format) ? { format } : {}),
    ...(style !== undefined && PROMPT_STYLES.includes(style) ? { style } : {}),
  };
}

/** the look the form opens in: the link's, over the one remembered in this browser */
export function startLook(start: StoryStart | undefined, remembered: StoryLook): StoryLook;
export function startLook(start: PromptStart | undefined, remembered: PromptStyle): PromptStyle;
export function startLook(start: (StoryStart & PromptStart) | undefined, remembered: string): string {
  return start?.look ?? start?.style ?? remembered;
}
