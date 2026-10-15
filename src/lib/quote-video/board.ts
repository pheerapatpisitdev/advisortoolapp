/** which board lists a clip: วิดีโอนำเสนอ ("quote"), คลิปเล่าเรื่อง ("story") or คลิปตามโจทย์ ("prompt") */
export type Board = "quote" | "story" | "prompt";

export const boardOf = (input: { product?: unknown }): Board =>
  input.product === "FREESTORY" ? "prompt" : input.product === "STORY" ? "story" : "quote";
