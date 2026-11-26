import type { PromptDesign, PromptFormat, SceneCount } from "./types";

/** the form's look choice: โมชันกราฟิก (ใหม่) is the default, หน้าตาเดิม is what every clip had before */
export type FormDesign = PromptDesign | "classic";

/** the remembered choice: only an exact "classic" leaves the default, anything else stored is motion */
export function readDesign(stored: unknown): FormDesign {
  return stored === "classic" ? "classic" : "motion";
}

/** what the server is told: หน้าตาเดิม is an absent design */
export function designArg(d: FormDesign): PromptDesign | undefined {
  return d === "motion" ? "motion" : undefined;
}

/** the arguments of writePromptStory */
export function writeArgs(v: { brief: string; scenes: SceneCount; format: PromptFormat; figure: unknown; design: FormDesign }) {
  const design = designArg(v.design);
  return { brief: v.brief, scenes: v.scenes, format: v.format, ...(v.figure ? { figure: v.figure } : {}), ...(design ? { design } : {}) };
}

/** the design's part of makePromptStory's arguments */
export function makeArgs(d: FormDesign): { design?: PromptDesign } {
  const design = designArg(d);
  return design ? { design } : {};
}

/** the looks as the notices name them */
const LOOK_NAME: Record<FormDesign, string> = { motion: "โมชันกราฟิก", classic: "หน้าตาเดิม" };

/**
 * the notice when the form changed after the script was written: the clip is made from the script, so a design
 * changed since names the look the clip will still be made in, and the one a rewrite would give
 */
export function staleWords(written: FormDesign, now: FormDesign): string {
  if (written !== now) return `บทนี้เขียนสำหรับ${LOOK_NAME[written]} คลิปจะทำเป็น${LOOK_NAME[written]} กด “เขียนใหม่” ถ้าจะใช้${LOOK_NAME[now]}`;
  return "แก้โจทย์หรือตัวเลือกหลังเขียนบทแล้ว คลิปจะทำจากบทนี้ กด “เขียนใหม่” ถ้าอยากให้เขียนตามที่แก้";
}
