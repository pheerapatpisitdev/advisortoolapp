/**
 * ธีมของวิดีโอนำเสนอ, as the form and the actions know them (no drawing here, so the form can import it).
 * Owner 2026-10-17: the Motion Graphic style's looks (mockups https://claude.ai/artifact/C5SK85RVAYvSQHGDFawcJe
 * and https://claude.ai/artifact/PMX8rMQeobGGQF22rihpyX). Owner 2026-10-20 took ขาวสะอาด and คอลลาจกระดาษ
 * away (mockup https://claude.ai/artifact/HKaTeXBbzZUscUZ5Hbe837): a clip asked for in either before is
 * read as น้ำเงินทอง. แบบปกติ has none.
 */

import { VIDEO_THEME_EXTRA } from "@/lib/card-theme";

export type ThemeKey = "navy" | "paper";
export const THEME_KEYS: ThemeKey[] = ["navy", "paper"];
export const DEFAULT_THEME: ThemeKey = "navy";
export const readTheme = (v: unknown): ThemeKey => (THEME_KEYS.includes(v as ThemeKey) ? (v as ThemeKey) : DEFAULT_THEME);

/** what the form shows for each */
export const THEME_LABELS: Record<ThemeKey, { name: string; swatch: string; note: string }> = {
  navy: { name: "น้ำเงินทอง", swatch: VIDEO_THEME_EXTRA.swatch.navy, note: "หน้าตาเดิมของ Motion Graphic" },
  paper: { name: "วาดมือบนกระดาษ", swatch: VIDEO_THEME_EXTRA.swatch.paper, note: "หน้าการ์ตูนและลายมือแบบคลิปเล่าเรื่อง ปากกาแดงเน้นตัวเลข" },
};
