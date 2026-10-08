import type { Aspect } from "@/lib/ai/images";
import type { ChatMessage } from "@/lib/ai/types";
import { parseJsonReply } from "@/lib/ai/json-reply";
import { AVOID } from "./background";
import { poseText } from "./people";

/**
 * A video cover (ภาพปกคลิป, owner 2026-10-09): what the image model is asked for, and the
 * headline ideas the writer is asked for. The model draws the picture and the Thai lettering
 * together; what it drew is read back and checked in thumbnail-run.ts. Browser-safe.
 */

export const SIZES: { id: Extract<Aspect, "9:16" | "16:9">; label: string; hint: string }[] = [
  { id: "9:16", label: "แนวตั้ง 9:16", hint: "Reels / TikTok" },
  { id: "16:9", label: "แนวนอน 16:9", hint: "YouTube / วิดีโอ Facebook" },
];
export type ThumbSize = (typeof SIZES)[number]["id"];

export const MAX_HEADLINE = 40;
export const MAX_SUB = 60;
export const MAX_TOPIC = 4000;

export const STYLES = {
  bold: {
    label: "ตัวใหญ่ขอบหนา",
    scene: "A high-energy YouTube-style cover: saturated colours, strong contrast, a bold subject filling the frame, a simple blurred background, and very large chunky lettering with a thick outline so it reads at thumbnail size.",
  },
  alert: {
    label: "ข่าวด่วน / เตือนภัย",
    scene: "An urgent news-alert cover: a dramatic dark background with red and yellow accents, tense lighting, a serious expression, and heavy white-and-yellow lettering on a solid bar or banner.",
  },
  clean: {
    label: "มินิมอลสะอาด",
    scene: "A clean minimal cover: a calm plain background in soft tones, plenty of empty space, one clear subject, and elegant large lettering with high contrast.",
  },
  warm: {
    label: "อบอุ่น เป็นกันเอง",
    scene: "A warm friendly cover: soft golden light, a cosy everyday Thai setting, a smiling approachable subject, and rounded, friendly lettering.",
  },
} as const;
export type ThumbStyle = keyof typeof STYLES;
export const isStyle = (v: unknown): v is ThumbStyle => typeof v === "string" && v in STYLES;

/** what the app lays over a cover, so the model keeps the words clear of it */
const SAFE: Record<ThumbSize, string> = {
  "9:16": "Keep every word and the main face out of the top 15% and the bottom 25% of the frame: the app puts the account name, caption and buttons there. Put the words in the middle band.",
  "16:9": "Keep every word and the main face out of the bottom-right corner of the frame: the video's length badge covers it. Leave a small margin on all four edges.",
};
const CROP = "The image may be trimmed a little at the edges, so keep all words well inside the frame.";

const flat = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

export function thumbnailPrompt(o: {
  size: ThumbSize;
  style: ThumbStyle;
  headline: string;
  sub: string;
  /** the scene in English; empty uses the style's own */
  scene: string;
  person?: { pose: string } | null;
}): string {
  const headline = flat(o.headline, MAX_HEADLINE);
  const sub = flat(o.sub, MAX_SUB);
  return [
    `Create a finished ${o.size} ${o.size === "9:16" ? "vertical" : "horizontal"} video cover image (thumbnail) for a Thai insurance agent's video: the picture and the Thai lettering together.`,
    "",
    "The picture:",
    flat(o.scene, 2500) || STYLES[o.style].scene,
    "",
    "The words on the image, in Thai — draw each exactly as written, every character and every digit, in a clean, bold, clearly legible Thai typeface:",
    `- Headline, the largest words: ${headline}`,
    ...(sub ? [`- Supporting line, smaller: ${sub}`] : []),
    ...(o.person
      ? [
        "",
        "The person:",
        "- The person shown in the reference photos is the main subject. Keep them clearly recognisable: the same face, hairstyle, skin tone and build.",
        `- Pose: ${poseText(o.person.pose)}`,
        "- Ordinary smart-casual clothes; never a doctor's, nurse's or any other uniform.",
        "- No other clearly identifiable faces.",
      ]
      : []),
    "",
    "Absolute rules:",
    "- Draw only the words above: no other words, numbers, logos, watermarks, signatures or user-interface elements.",
    "- Keep every Thai word whole and correctly spelled; never split, invent or rearrange characters.",
    `- ${SAFE[o.size]}`,
    `- ${CROP}`,
    `- Avoid: ${AVOID.join("; ")}.`,
  ].join("\n");
}

export interface Idea { headline: string; sub: string }

export function parseIdeas(text: string): Idea[] {
  const raw = parseJsonReply<{ ideas?: unknown }>(text)?.ideas;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((i): Idea => {
      const r = (i ?? {}) as Record<string, unknown>;
      return {
        headline: typeof r.headline === "string" ? flat(r.headline, MAX_HEADLINE) : "",
        sub: typeof r.sub === "string" ? flat(r.sub, MAX_SUB) : "",
      };
    })
    .filter((i) => i.headline)
    .slice(0, 5);
}

const IDEAS_SYSTEM = [
  "You write cover headlines for short videos by a Thai life-insurance agent. Reply in Thai.",
  `Give 5 different headlines for the video below. Each headline is at most ${MAX_HEADLINE} characters — about 6 to 8 words — and makes a viewer want to watch: a surprising question, a shocking number from the topic, or a warning about a common mistake. Each may have a short supporting line of at most ${MAX_SUB} characters, or an empty one.`,
  "Never promise returns or guarantee anything, never claim a cure, never name a competitor. Use only facts that are in the topic.",
  'Reply with JSON only: {"ideas":[{"headline":"…","sub":"…"}]}',
].join("\n");

export function ideasMessages(topic: string): ChatMessage[] {
  return [
    { role: "system", content: IDEAS_SYSTEM },
    { role: "user", content: topic.slice(0, MAX_TOPIC) },
  ];
}
