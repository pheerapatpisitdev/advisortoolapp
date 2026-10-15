import { planName } from "@/lib/story/plans";
import type { PromptStoryInput } from "./types";

/**
 * The caption to go with a คลิปตามโจทย์: the words the writer gave it, and, when a real premium
 * figure is in the clip, the line that says it is only an example. Never the customer's name
 * (it is not part of the input) and no hashtags beyond what the writer wrote.
 */
export function promptStoryCaption(input: PromptStoryInput): string {
  const text = input.caption.trim();
  if (!input.figure) return text;
  const line = `*เบี้ยในคลิปเป็นตัวอย่างจาก ${planName(input.figure.plan)} เบี้ยจริงขึ้นกับการพิจารณารับประกันของบริษัท`;
  return text.includes(line) ? text : `${text}\n\n${line}`;
}
