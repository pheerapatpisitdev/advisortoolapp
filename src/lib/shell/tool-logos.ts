/**
 * Studio's tools as Adobe draws its apps (owner chose ข, 2026-10-19): two letters from the
 * tool's English name on a dark square, the letters and the square's edge in one bright colour.
 * The colours are in globals.css (.tool-logo-<id>), with the rest of the palette's literals.
 */
export const TOOL_LOGOS = {
  qv: "Qv", // วิดีโอนำเสนอ · Quote video
  sc: "Sc", // คลิปเล่าเรื่อง · Story clip
  pc: "Pc", // คลิปตามโจทย์ · Prompt clip
  og: "Og", // Organic Studio
  th: "Th", // ภาพปกคลิป · Thumbnail
  dp: "Dp", // ถอดรูปเป็น prompt · Describe picture
  ad: "Ad", // Ads Studio
  ca: "Ca", // ปฏิทินโพสต์ · Calendar
  hk: "Hk", // คลังสูตรประโยคเปิด · Hooks
  pe: "Pe", // คลังบุคคล · People
} as const;

export type ToolLogoId = keyof typeof TOOL_LOGOS;
