import type { GapState } from "@/lib/fhc/gaps";

/**
 * The three states as chips. The text stays the page's own text colour, which reads on either
 * theme; the colour is in the dot and the tint, and the word says it too, so a black-and-white
 * print still reads.
 */
export const PILL: Record<GapState | "base", string> = {
  base: "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium text-[var(--lg-white)] before:h-2 before:w-2 before:rounded-full before:content-['']",
  missing: "border-[var(--bot-red)] bg-[var(--bot-red)]/15 before:bg-[var(--bot-red)]",
  short: "border-[var(--bot-sand)] bg-[var(--bot-sand)]/25 before:bg-[var(--bot-sand)]",
  ok: "border-[var(--bot-ok)] bg-[var(--bot-ok)]/15 before:bg-[var(--bot-ok)]",
};
