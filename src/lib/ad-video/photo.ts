import { BudgetExceeded, drawImage } from "@/lib/ai/client";
import type { Aspect, ReferenceImage } from "@/lib/ai/images";
import { AVOID } from "@/lib/content/background";
import { STYLES } from "@/lib/content/looks";

/** the painter id the ad's price uses (pictureSatang(prices, AD_PAINTER)) and the model it draws with */
export const AD_PAINTER = "gemini";
const AD_MODEL = "gemini-image";

const EDITORIAL = STYLES.find((s) => s.id === "editorial")?.say ?? "natural, editorial-quality photograph";

/**
 * The painter's words for an ad photo. English only and no digits other than the aspect: our own Thai text is
 * drawn over the picture later, so the painter must leave room for it — the top for the hook line, the bottom for
 * the body and closing lines.
 */
export function photoPrompt(idea: string, scene: "hook" | "close" | "body"): string {
  const room = scene === "hook"
    ? "Keep the upper third of the frame calm and simple, with room for words."
    : "Keep the lower third of the frame calm and simple, with room for words.";
  return `Vertical 9:16 photograph. ${EDITORIAL}. ${idea}. Thai people. `
    + "No text, no letters, no numbers, no logos, no watermarks, no identifiable real person. "
    + `Avoid: ${AVOID.join("; ")}. Nothing frightening: no funerals, accidents, emergencies. ${room}`;
}

type Draw = (a: { task: string; prompt: string; prefer?: string; aspect?: Aspect; references?: ReferenceImage[] }) => Promise<{ bytes: Buffer }>;

/** drawImage's refusals that a second try cannot change: the owner's month budget, and no painter switched on */
const NO_MODEL = "ไม่มีโมเดลวาดรูปที่ใช้ได้ในตอนนี้";
const final = (e: unknown): boolean => e instanceof BudgetExceeded || (e instanceof Error && e.message === NO_MODEL);

/**
 * One photo for a scene; two tries, then null so the caller falls back to the motion look. Each failure is logged
 * (the task and the error's message: no stack, no prompt), and a refusal a retry cannot change is not retried.
 */
export async function drawAdPhoto(idea: string, scene: "hook" | "close" | "body", draw: Draw = drawImage): Promise<Buffer | null> {
  const args = { task: "ad-video-photo", prompt: photoPrompt(idea, scene), aspect: "9:16" as const, prefer: AD_MODEL };
  for (let i = 0; i < 2; i++) {
    try {
      return (await draw(args)).bytes;
    } catch (e) {
      console.error(`${args.task} (${scene}) try ${i + 1} failed: ${e instanceof Error ? e.message : String(e)}`);
      if (final(e)) break;
    }
  }
  return null;
}
