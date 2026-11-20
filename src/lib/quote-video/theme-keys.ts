/**
 * ธีมของวิดีโอนำเสนอ, as the form and the actions know them (no drawing here, so the form can import it).
 * Owner 2026-10-17: the Motion Graphic style's looks (mockups https://claude.ai/artifact/C5SK85RVAYvSQHGDFawcJe
 * and https://claude.ai/artifact/PMX8rMQeobGGQF22rihpyX). Owner 2026-10-20 took ขาวสะอาด and คอลลาจกระดาษ
 * away (mockup https://claude.ai/artifact/HKaTeXBbzZUscUZ5Hbe837): a clip asked for in either before is
 * read as น้ำเงินทอง. สีของฉัน (owner, 2026-10-20) is the agent's own colour (card-theme.ts MY_COLORS). ไวท์บอร์ด (owner, 2026-10-20) writes each piece in behind a marker. ตัวหนังสือเด้ง (owner, 2026-10-20; kinetic.tsx) draws the spoken words alone. ธีมเทศกาล (owner, 2026-10-20; festival.ts) is offered only in a festival's days,
 * the clip keeping which festival. กระจกใส and โน้ตแปะ (owner, 2026-10-23; HyperFrames samples first) are two of the
 * three a customer asked for when the old looks wore thin; the third, นิตยสาร, the owner found too plain. แบบปกติ has none.
 * Owner 2026-11-17 (mockup https://claude.ai/artifact/6rxmSDSGKu94YqnXQxZRcP, ก): น้ำเงินทอง, วาดมือบนกระดาษ, กระจกใส and
 * สีของฉัน left the form; ไวท์บอร์ด is what a clip is drawn in when it asks for none, or for a look taken away. Their
 * drawing stays: every look repaints น้ำเงินทอง's frame, and ธีมเทศกาล is drawn on it.
 * Owner 2026-11-20 (mockup https://claude.ai/artifact/XMn5dKPZ9jxJpN2muvYBqG, ก): ธีมเทศกาล left too, the form and the
 * requests both; a request for it is read as ไวท์บอร์ด. Its drawing stays for the clips made in it. The เทศกาล topic of
 * คลิปเล่าเรื่อง (story/topics.ts) is another thing and stays.
 */

import { VIDEO_THEME_EXTRA } from "@/lib/card-theme";

/** "chat": แชทถาม-ตอบ's drawing (chat.tsx), set by the style, never picked as a look nor read from a request */
export type ThemeKey = "navy" | "paper" | "board" | "kinetic" | "mine" | "festival" | "chat" | "glass" | "sticky";
/** the looks a request may ask for; any other (a look taken away, or none) is read as DEFAULT_THEME */
export const THEME_KEYS: ThemeKey[] = ["board", "kinetic", "sticky"];
/** the looks the form offers */
export const STANDING_THEMES: ThemeKey[] = ["board", "sticky", "kinetic"];
export const DEFAULT_THEME: ThemeKey = "board";
export const readTheme = (v: unknown): ThemeKey => (THEME_KEYS.includes(v as ThemeKey) ? (v as ThemeKey) : DEFAULT_THEME);

/** what the form shows for each */
export const THEME_LABELS: Record<ThemeKey, { name: string; swatch: string; note: string }> = {
  navy: { name: "น้ำเงินทอง", swatch: VIDEO_THEME_EXTRA.swatch.navy, note: "หน้าตาเดิมของ Motion Graphic" },
  paper: { name: "วาดมือบนกระดาษ", swatch: VIDEO_THEME_EXTRA.swatch.paper, note: "พื้นกระดาษ ลายมือ ปากกาแดงเน้นตัวเลข" },
  board: { name: "ไวท์บอร์ด", swatch: VIDEO_THEME_EXTRA.swatch.board, note: "ปากกาเขียนทีละอย่างตามเสียง เหมือนนั่งอธิบายบนกระดาน ปากกาแดงวงจุดสำคัญ" },
  kinetic: { name: "ตัวหนังสือเด้ง", swatch: VIDEO_THEME_EXTRA.swatch.kinetic, note: "ไม่มีรูป ตัวหนังสือใหญ่เด้งตามเสียงทีละคำ ตัวเลขเต็มจอ พื้นสลับดำ เหลือง น้ำเงิน เหมาะกับ Reels และ TikTok" },
  mine: { name: "สีของฉัน", swatch: VIDEO_THEME_EXTRA.swatch.mine, note: "สีประจำตัวที่เลือกไว้ ใช้กับทุกคลิป พร้อมรูปและชื่อของคุณด้านบน" },
  chat: { name: "แชทถาม-ตอบ", swatch: VIDEO_THEME_EXTRA.swatch.navy, note: "" },
  glass: { name: "กระจกใส", swatch: VIDEO_THEME_EXTRA.swatch.glass, note: "การ์ดกระจกฝ้าแบบแอปในมือถือ บนพื้นกลางคืนที่มีแสงสีอยู่ข้างหลัง ตัวเลขสีทอง" },
  sticky: { name: "โน้ตแปะ", swatch: VIDEO_THEME_EXTRA.swatch.sticky, note: "กระดาษโน้ตหลายสีติดเทปบนสมุดตาราง ตัวหนังสือลายมือปากกาเมจิก ปากกาแดงเน้นจุดสำคัญ" },
  festival: { name: "ธีมเทศกาล", swatch: VIDEO_THEME_EXTRA.swatch.festival, note: "สีและของประดับตามเทศกาล พร้อมคำอวยพรด้านบน เปิดให้เองช่วง 7 วันก่อนถึงเทศกาล" },
};
