/** which board lists a clip: วิดีโอนำเสนอ ("quote"), คลิปเล่าเรื่อง ("story"), คลิปตามโจทย์ ("prompt") or วิดีโอโฆษณา ("ad") */
export type Board = "quote" | "story" | "prompt" | "ad";

/** an ad clip is a quote clip carrying its plan (owner, 2026-11-22), so it is told apart by the plan, not the product */
export const boardOf = (input: { product?: unknown; ad?: unknown }): Board =>
  typeof input.ad === "object" && input.ad !== null ? "ad"
    : input.product === "FREESTORY" ? "prompt" : input.product === "STORY" ? "story" : "quote";
