import { boardOf, type Board } from "@/lib/quote-video/board";

const WHAT: Record<Board, string> = { quote: "วิดีโอนำเสนอ", story: "คลิปเล่าเรื่อง", prompt: "คลิปตามโจทย์", ad: "วิดีโอโฆษณา" };
const HREF: Record<Board, string> = { quote: "/studio/quote-video", story: "/studio/story-clip", prompt: "/studio/prompt-story", ad: "/studio/ad-video" };

/**
 * How home's "clips being made" strip names a clip and where it links: the board it was made on (owner,
 * 2026-10-15/16 for the story and prompt boards; วิดีโอโฆษณา 2026-11-22).
 */
export function clipMaking(input: unknown, customer: string | null): { label: string; href: string } {
  const v = (input && typeof input === "object" ? input : {}) as { product?: string; ad?: unknown; brief?: string };
  const board = boardOf(v);
  const what = WHAT[board];
  const brief = board === "prompt" ? v.brief?.trim().split("\n")[0].slice(0, 40) : "";
  const label = customer ? `${what} · ${customer}` : brief ? `${what} · ${brief}` : what;
  return { label, href: HREF[board] };
}
