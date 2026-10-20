import { cardVersionFor } from "@/lib/card-theme";

/**
 * The path Global Savings Plus 15/8's whole-page card is drawn at (src/app/api/card/gsaving-card,
 * owner chose ข, 2026-10-20). Priced from whichever figure the page was typed in, the premium or
 * the sum, so the card shows the page's own figures to the satang. Kept out of card-link.ts,
 * which the วิดีโอนำเสนอ clip's drawing bundles (REMOTION_DRAWING).
 */
export function gsavingCardPath(input: { age: number; basis: "premium" | "sumAssured"; amount: number }): string {
  const q = new URLSearchParams({ age: String(input.age) });
  q.set(input.basis === "premium" ? "prem" : "sum", String(input.amount));
  q.set("v", cardVersionFor());
  return `/api/card/gsaving-card?${q.toString()}`;
}
