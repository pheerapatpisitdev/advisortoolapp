import { STORY_CLIP_COLORS } from "@/lib/card-theme";

/**
 * The cartoon faces คลิปเล่าเรื่อง is told with (owner, 2026-10-15, mockup
 * https://claude.ai/artifact/FmDZmdTf6Mwgb2Dza8hQtM): hand-drawn heads cut from the owner's
 * sheets, each in public/story/faces as `<id>.jpg` (colour, 320 px) and `<id>-g.jpg` (grey,
 * 160 px, for the crowd before anyone is covered). Every file's paper is the same colour,
 * FACE_PAPER, so a face sits on the clip's paper with no edge.
 *
 * Browser-safe: the Studio form picks from this list, the clip draws from it.
 */

export type FaceTag = "glasses" | "curly" | "hat";
export interface Face { id: string; sex: "M" | "F"; tags: FaceTag[] }

/** the paper every face file was brought to, and the clip's own paper */
export const FACE_PAPER = STORY_CLIP_COLORS.paper;

const MEN = 29;
const WOMEN = 54;
const TAGS: Record<string, FaceTag[]> = {
  m01: ["glasses"], m02: ["glasses"], m03: ["glasses"], m05: ["glasses"], m08: ["glasses", "curly"], m13: ["curly"],
  m14: ["glasses"], m15: ["hat"], m18: ["glasses"], m19: ["hat"], m22: ["glasses", "hat"], m27: ["hat"], m28: ["hat"],
  w04: ["curly"], w06: ["hat"], w07: ["glasses"], w08: ["hat"], w10: ["glasses", "curly"], w11: ["hat"], w13: ["glasses"],
  w17: ["glasses"], w19: ["hat"], w21: ["curly"], w22: ["curly"], w24: ["hat"], w26: ["glasses"], w33: ["glasses"],
  w44: ["glasses"], w45: ["curly"], w52: ["glasses", "curly"],
};
const id = (p: string, i: number) => `${p}${String(i + 1).padStart(2, "0")}`;

export const FACES: Face[] = [
  ...Array.from({ length: MEN }, (_, i) => id("m", i)),
  ...Array.from({ length: WOMEN }, (_, i) => id("w", i)),
].map((f) => ({ id: f, sex: f.startsWith("m") ? "M" as const : "F" as const, tags: TAGS[f] ?? [] }));

const IDS = new Set(FACES.map((f) => f.id));
export const isFace = (v: unknown): v is string => typeof v === "string" && IDS.has(v);
export const faceOf = (faceId: string): Face | undefined => FACES.find((f) => f.id === faceId);

/** the mockup's picks: ภัทรา the narrator, นิด the customer, and a man for a man's clip */
export const DEFAULT_NARRATOR_FACE = "w26";
export const DEFAULT_HERO_FACE: Record<"M" | "F", string> = { F: "w15", M: "m09" };

/** where the browser finds a face's file */
export const faceSrc = (faceId: string, gray = false) => `/story/faces/${faceId}${gray ? "-g" : ""}.jpg`;

/**
 * The 48 of กองกลาง 48 คน: the hero at CROWD_HERO, the other 47 half men and half women, the
 * narrator left out (they tell the story, they are not in it). The same hero gives the same
 * crowd, so the form's preview and the clip agree.
 */
export const CROWD = 48;
export const CROWD_HERO = 20;
export function crowdOf(hero: string, narrator: string): string[] {
  const pool = FACES.filter((f) => f.id !== hero && f.id !== narrator);
  const men = pool.filter((f) => f.sex === "M").map((f) => f.id);
  const women = pool.filter((f) => f.sex === "F").map((f) => f.id);
  // a seeded shuffle, the seed the hero's id: no Math.random, so every drawer agrees
  let seed = [...hero].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const shuffle = (xs: string[]) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const m = shuffle(men).slice(0, 23);
  const w = shuffle(women).slice(0, CROWD - 1 - m.length);
  const others = shuffle([...m, ...w]);
  return [...others.slice(0, CROWD_HERO), hero, ...others.slice(CROWD_HERO)];
}
