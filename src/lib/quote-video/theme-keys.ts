/**
 * ธีมของวิดีโอนำเสนอ, as the form and the actions know them (no drawing here, so the form can import it).
 * Owner 2026-10-17: four looks for the Motion Graphic style — น้ำเงินทอง, ขาวสะอาด, วาดมือบนกระดาษ and
 * คอลลาจกระดาษ (mockups https://claude.ai/artifact/C5SK85RVAYvSQHGDFawcJe and
 * https://claude.ai/artifact/PMX8rMQeobGGQF22rihpyX). แบบปกติ has none.
 */

import { VIDEO_THEME_EXTRA } from "@/lib/card-theme";

export type ThemeKey = "navy" | "clean" | "paper" | "collage";
export const THEME_KEYS: ThemeKey[] = ["navy", "clean", "paper", "collage"];
export const DEFAULT_THEME: ThemeKey = "navy";
export const readTheme = (v: unknown): ThemeKey => (THEME_KEYS.includes(v as ThemeKey) ? (v as ThemeKey) : DEFAULT_THEME);

/** what the form shows for each */
export const THEME_LABELS: Record<ThemeKey, { name: string; swatch: string; note: string }> = {
  navy: { name: "น้ำเงินทอง", swatch: VIDEO_THEME_EXTRA.swatch.navy, note: "หน้าตาเดิมของ Motion Graphic" },
  clean: { name: "ขาวสะอาด", swatch: VIDEO_THEME_EXTRA.swatch.clean, note: "พื้นขาว เส้นบาง ตัวเลขน้ำเงิน อ่านง่ายบนมือถือ" },
  paper: { name: "วาดมือบนกระดาษ", swatch: VIDEO_THEME_EXTRA.swatch.paper, note: "หน้าการ์ตูนและลายมือแบบคลิปเล่าเรื่อง ปากกาแดงเน้นตัวเลข" },
  collage: { name: "คอลลาจกระดาษ", swatch: VIDEO_THEME_EXTRA.swatch.collage, note: "ภาพตัดแปะขาวดำลายจุด กระดาษฉีก ปากกาแดง ขยับแบบสต็อปโมชัน" },
};
