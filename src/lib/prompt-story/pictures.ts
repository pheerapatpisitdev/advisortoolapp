import { drawImage } from "@/lib/ai/client";
import type { Aspect } from "@/lib/ai/images";
import { PAINTERS } from "@/lib/content/models";
import type { VideoSize } from "@/lib/quote-video/timeline";
import type { PictureStyle, PromptScene, PromptStoryInput } from "./types";

/** first drafts; tune on real output before release */
export const STYLE_PREFIX: Record<PictureStyle, string> = {
  cartoon: "Soft hand-drawn line cartoon illustration, muted colors on warm paper.",
  real: "Natural photographic scene, no identifiable real person.",
  flat: "Minimal flat vector illustration, few shapes, calm palette.",
};

const SUFFIX = "no text, no numbers, no logos, no real person's likeness";

const ASPECT: Record<VideoSize, Aspect> = { portrait: "9:16", square: "1:1", landscape: "16:9" };

export const picturePrompt = (scene: PromptScene, style: PictureStyle): string =>
  `${STYLE_PREFIX[style]} ${scene.picture}. ${SUFFIX}`;

type Draw = (a: { task: string; prompt: string; prefer?: string; aspect?: Aspect }) => Promise<{ bytes: Buffer }>;

/** one picture for a scene; one retry, then null so the caller falls back to paper */
export async function drawScenePicture(
  scene: PromptScene, style: PictureStyle, painter: PromptStoryInput["painter"], size: VideoSize, draw: Draw = drawImage,
): Promise<Buffer | null> {
  const prefer = PAINTERS.find((p) => p.id === painter)?.modelId ?? undefined;
  const args = { task: "prompt-story-picture", prompt: picturePrompt(scene, style), prefer, aspect: ASPECT[size] };
  for (let i = 0; i < 2; i++) {
    try {
      return (await draw(args)).bytes;
    } catch {
      /* retry once */
    }
  }
  return null;
}
