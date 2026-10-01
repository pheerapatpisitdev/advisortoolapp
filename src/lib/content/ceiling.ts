import type { Viewer } from "@/lib/auth/access";
import { allowanceOf, overAllowance } from "@/lib/auth/quota";
import { contentCap, contentSpentThisMonth } from "./store";

/**
 * The owner's content ceiling, asked before a round is taken (review, 2026-10-01).
 *
 * Every round asked it inside the round, after takeRound — so a round started while the month's
 * content money was gone was refused only after it had been counted: one of the agent's ten
 * free rounds (or a wallet hold) spent on "the ceiling is reached". It is still asked inside the
 * round, where the money is set aside; this is the same question asked first, so a round the
 * ceiling would refuse is never taken.
 *
 * The ceiling stands over the owner's money only — staff rounds and the agent's free rounds. A
 * round paid from the agent's wallet is outside it (contentCap is Infinity there, owner
 * 2026-09-30), and an agent whose free rounds are used will be paid from their wallet: they are
 * let through to takeRound, which says whether the wallet can pay.
 *
 * The ceiling reached and the round under it gives the ceiling, for the caller's message; null
 * lets the round be taken. A ledger that cannot be read is the round's own check to refuse, as
 * it was before: this says null rather than turn every round away on a hiccup.
 */
export async function ceilingBeforeRound(viewer: Viewer): Promise<number | null> {
  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent < cap) return null;
    if (!viewer.staff && overAllowance(await allowanceOf(viewer))) return null;
    return cap;
  } catch (e) {
    console.error("content ceiling not read before the round:", e);
    return null;
  }
}
