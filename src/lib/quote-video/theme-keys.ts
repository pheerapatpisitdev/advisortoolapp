/**
 * ธีมของวิดีโอนำเสนอ, as the form and the actions know them (no drawing here, so the form can import it).
 * Owner 2026-10-17: the Motion Graphic style's looks (mockups https://claude.ai/artifact/C5SK85RVAYvSQHGDFawcJe
 * and https://claude.ai/artifact/PMX8rMQeobGGQF22rihpyX). Owner 2026-10-20 took ขาวสะอาด and คอลลาจกระดาษ
 * away (mockup https://claude.ai/artifact/HKaTeXBbzZUscUZ5Hbe837): a clip asked for in either before is
 * read as น้ำเงินทอง. ตัวหนังสือเด้ง (owner, 2026-10-20; kinetic.tsx) draws the spoken words alone. ธีมเทศกาล (owner, 2026-10-20; festival.ts) is offered only in a festival's days,
 * the clip keeping which festival. แบบปกติ has none.
 */

import { VIDEO_THEME_EXTRA } from "@/lib/card-theme";

export type ThemeKey = "navy" | "paper" | "kinetic" | "festival";
export const THEME_KEYS: ThemeKey[] = ["navy", "paper", "kinetic", "festival"];
/** the looks the form always offers; ธีมเทศกาล joins them in a festival's days */
export const STANDING_THEMES: ThemeKey[] = ["navy", "paper", "kinetic"];
export const DEFAULT_THEME: ThemeKey = "navy";
export const readTheme = (v: unknown): ThemeKey => (THEME_KEYS.includes(v as ThemeKey) ? (v as ThemeKey) : DEFAULT_THEME);

/** what the form shows for each */
export const THEME_LABELS: Record<ThemeKey, { name: string; swatch: string; note: string }> = {
  navy: { name: "น้ำเงินทอง", swatch: VIDEO_THEME_EXTRA.swatch.navy, note: "หน้าตาเดิมของ Motion Graphic" },
  paper: { name: "วาดมือบนกระดาษ", swatch: VIDEO_THEME_EXTRA.swatch.paper, note: "หน้าการ์ตูนและลายมือแบบคลิปเล่าเรื่อง ปากกาแดงเน้นตัวเลข" },
  kinetic: { name: "ตัวหนังสือเด้ง", swatch: VIDEO_THEME_EXTRA.swatch.kinetic, note: "ไม่มีรูป ตัวหนังสือใหญ่เด้งตามเสียงทีละคำ ตัวเลขเต็มจอ พื้นสลับดำ เหลือง น้ำเงิน เหมาะกับ Reels และ TikTok" },
  festival: { name: "ธีมเทศกาล", swatch: VIDEO_THEME_EXTRA.swatch.festival, note: "สีและของประดับตามเทศกาล พร้อมคำอวยพรด้านบน เปิดให้เองช่วง 7 วันก่อนถึงเทศกาล" },
};
