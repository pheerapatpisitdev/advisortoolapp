import { cardVersionFor } from "@/lib/card-theme";

/**
 * Added to the card's `v`, so a card drawn before a change here is not served from a cache under
 * the old address. Bump it when this card alone changes. It stands in for a DRAWING_REVISION
 * bump, which would also need the Remotion image built again for a change no clip draws.
 * 2: the "Application by" line is gone from its foot (owner chose ก, 2026-11-07).
 */
const GSAVING_CARD_REVISION = "g2";

/**
 * The path Global Savings Plus 15/8's whole-page card is drawn at (src/app/api/card/gsaving-card,
 * owner chose ข, 2026-10-20). Priced from whichever figure the page was typed in, the premium or
 * the sum, so the card shows the page's own figures to the satang. Kept out of card-link.ts,
 * which the วิดีโอนำเสนอ clip's drawing bundles (REMOTION_DRAWING).
 */
export function gsavingCardPath(input: { age: number; basis: "premium" | "sumAssured"; amount: number }): string {
  const q = new URLSearchParams({ age: String(input.age) });
  q.set(input.basis === "premium" ? "prem" : "sum", String(input.amount));
  q.set("v", `${cardVersionFor()}-${GSAVING_CARD_REVISION}`);
  return `/api/card/gsaving-card?${q.toString()}`;
}
