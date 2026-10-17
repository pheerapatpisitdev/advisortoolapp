import { chat, drawImage } from "@/lib/ai/client";
import type { SceneKey } from "@/lib/quote-video/script";
import { cutout } from "./cutout";
import { PIECES, piecePrompt } from "./library";

/**
 * ภาพตัดแปะ AI คิดเอง (owner chose ข, 2026-10-17, https://claude.ai/artifact/Jt7qBS1N9fDhn8vj1DoTbt,
 * and the four recommendations): for a คอลลาจกระดาษ clip, AI reads the lines of the scenes that have
 * a picture spot, thinks of one picture for each, and it is drawn new and cut out like the library's.
 * A picture whose idea or drawing fails is left to the library's, and is not charged.
 */

export const IDEAS_TASK = "collage-ideas";
export const AI_PIECE_TASK = "collage-ai-piece";
const PAINTER = "gpt-image-medium";

export interface PieceIdea {
  key: SceneKey;
  /** what the agent would read: the idea in Thai */
  idea: string;
  /** what the painter is asked for: a plain English subject, no words in it */
  subject: string;
}

/** what each spot's picture is for, so an idea fits where it is laid (themes.tsx DECOR) */
const SPOT_ROLE: Partial<Record<SceneKey, string>> = {
  price: "under the price figures: money, saving or paying a little each day",
  cover: "above a family photo, as if sheltering them: something that protects or covers from above, seen from the side",
  contact: "beside the agent's contact card: getting in touch, a phone, a greeting",
};

/** the library piece a spot falls back to, and whose subject stands in when AI gives no idea */
const FALLBACK: Partial<Record<SceneKey, string>> = { price: "hand-coins", cover: "umbrella", contact: "hand-phone" };
export const fallbackPiece = (key: SceneKey) => FALLBACK[key] ?? "coins";
const fallbackIdea = (key: SceneKey): PieceIdea => {
  const p = PIECES.find((x) => x.key === fallbackPiece(key))!;
  return { key, idea: p.name, subject: p.subject };
};

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
/** a subject the painter may be given: English words, nothing that asks for writing or a real person */
const safeSubject = (s: string) => /^[\x20-\x7e]{6,}$/.test(s) && !/\b(text|letter|word|logo|sign|brand|celebrity|famous|caption|number)s?\b/i.test(s);

/** One picture idea for each scene, from its spoken line; a scene AI gives nothing usable for gets the library's. */
export async function writeIdeas(scenes: { key: SceneKey; voice: string }[], who: { sex: "M" | "F"; age: number; plan: string }, ask: typeof chat = chat): Promise<PieceIdea[]> {
  const prompt = [
    "You choose cut-out photo pictures for a short Thai insurance video in a paper-collage style (black-and-white halftone photo cut-outs on paper).",
    `The plan: ${who.plan}. The customer: a Thai ${who.sex === "F" ? "woman" : "man"} aged ${who.age}.`,
    "For each scene below, think of ONE simple, concrete picture that fits its spoken line and its place on screen: a hand doing something, a person, or an everyday object.",
    "Rules: one clear subject, photographable, no text, no numbers, no logos, no real or famous person, nothing scary or sad, nothing medical that looks graphic.",
    'Answer JSON only: {"scenes":[{"key":"<scene key>","idea":"<the idea in Thai, under 40 characters>","subject":"<the same picture in plain English, under 160 characters>"}]}',
    "",
    ...scenes.map((s) => `- key "${s.key}" (${SPOT_ROLE[s.key] ?? "a supporting picture"}): ${s.voice}`),
  ].join("\n");
  let got: unknown;
  try {
    got = JSON.parse((await ask({ tier: "small", task: IDEAS_TASK, json: true, maxTokens: 600, messages: [{ role: "user", content: prompt }] })).text);
  } catch {
    got = null;
  }
  const list = Array.isArray((got as { scenes?: unknown })?.scenes) ? (got as { scenes: unknown[] }).scenes : [];
  return scenes.map(({ key }) => {
    const row = list.find((r) => (r as { key?: unknown })?.key === key) as { idea?: unknown; subject?: unknown } | undefined;
    const idea = clean(row?.idea, 60), subject = clean(row?.subject, 200);
    return idea && safeSubject(subject) ? { key, idea, subject } : fallbackIdea(key);
  });
}

type Draw = (a: { task: string; prompt: string; prefer?: string; aspect?: "1:1" }) => Promise<{ bytes: Buffer; costThb: number }>;

/** One idea drawn and cut out; a second try, then null (the scene keeps the library's picture). */
export async function drawIdea(idea: PieceIdea, draw: Draw = drawImage): Promise<{ png: Buffer; costThb: number } | null> {
  const prompt = piecePrompt({ key: idea.key, group: "thing", name: idea.idea, subject: idea.subject });
  for (let i = 0; i < 2; i++) {
    try {
      const img = await draw({ task: AI_PIECE_TASK, prompt, prefer: PAINTER, aspect: "1:1" });
      return { png: await cutout(img.bytes), costThb: img.costThb };
    } catch {
      /* once more */
    }
  }
  return null;
}
