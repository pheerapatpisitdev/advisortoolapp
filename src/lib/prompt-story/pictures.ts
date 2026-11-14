import { drawImage } from "@/lib/ai/client";
import type { Aspect, ReferenceImage } from "@/lib/ai/images";
import { PAINTERS } from "@/lib/content/models";
import type { VideoSize } from "@/lib/quote-video/timeline";
import type { PictureStyle, PromptScene, PromptStoryInput } from "./types";

/** first drafts; tune on real output before release */
export const STYLE_PREFIX: Record<PictureStyle, string> = {
  paper: "Cut-paper collage in stop-motion style: every figure and object a flat piece of bright coloured paper with a thin white cut edge and a soft drop shadow, simple round-headed paper people, laid on a kraft paper sheet.",
  warm: "Paper-craft diorama under one warm lamp: flat faceless paper-cut figures standing in a simple layered paper set, warm cream and brown palette, soft cinematic shadows, gentle vignette.",
  plot: "Pen-plotter line drawing: a single thin black ink line on cream paper, cross-hatched shading only, no colour fill, one small red accent, technical and tidy, generous empty paper.",
  line: "Doodle cartoon on a clean white background: round-headed stick-style characters with thick black outlines, white faces with dot eyes and pink cheeks, flat bright clothes, no background scenery.",
  board: "Hand-drawn whiteboard marker illustration: dark blue and black marker lines on a clean white board, a few red and blue marker accents, simple shapes, no shading, generous white space.",
  neon: "Neon sign illustration on a dark violet background: glowing cyan, pink and yellow neon tube outlines, simple shapes, soft glow, no fill except the glow.",
  blueprint: "Technical blueprint drawing: thin white lines on blueprint blue paper with a faint grid, simple isometric outlines and dimension marks, no colour other than white and pale cyan.",
  cartoon: "Soft hand-drawn line cartoon illustration, muted colors on warm paper.",
  real: "Natural photographic scene, no identifiable real person.",
  flat: "Minimal flat vector illustration, few shapes, calm palette.",
};

const SUFFIX = "no text, no numbers, no logos, no real person's likeness";

const ASPECT: Record<VideoSize, Aspect> = { portrait: "9:16", square: "1:1", landscape: "16:9" };

/**
 * The painter's words for a scene. With a style reference (ภาพสไตล์, spec 2026-11-14-library-uploads) the
 * reference stands for the look, so the style's own words are left out and the painter is told not to copy it.
 */
export const picturePrompt = (scene: PromptScene, style: PictureStyle, withRef = false): string =>
  withRef
    ? `${scene.picture}. Paint it in the colour palette, texture and line style of the reference image. Do not copy the reference image's subject, people, objects or any text in it. ${SUFFIX}`
    : `${STYLE_PREFIX[style]} ${scene.picture}. ${SUFFIX}`;

type Draw = (a: { task: string; prompt: string; prefer?: string; aspect?: Aspect; references?: ReferenceImage[] }) => Promise<{ bytes: Buffer }>;

/**
 * one picture for a scene; one retry, then null so the caller falls back to paper. With `ref` the draw is
 * sent the style picture too (drawImage then takes its image-face lane, whichever painter was picked).
 */
export async function drawScenePicture(
  scene: PromptScene, style: PictureStyle, painter: PromptStoryInput["painter"], size: VideoSize, draw: Draw = drawImage, ref?: ReferenceImage,
): Promise<Buffer | null> {
  const prefer = PAINTERS.find((p) => p.id === painter)?.modelId ?? undefined;
  const args = {
    task: "prompt-story-picture", prompt: picturePrompt(scene, style, Boolean(ref)), prefer, aspect: ASPECT[size], ...(ref ? { references: [ref] } : {}),
  };
  for (let i = 0; i < 2; i++) {
    try {
      return (await draw(args)).bytes;
    } catch {
      /* retry once */
    }
  }
  return null;
}
