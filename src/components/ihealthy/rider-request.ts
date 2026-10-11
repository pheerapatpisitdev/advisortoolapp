import type { AttachedRider, RiderChoice, RiderQuoteInput } from "@/app/ihealthy-ultra/actions";

/**
 * The two things the rider fold works out before it can ask the server anything: which
 * arrangement it is asking about, and what the ticks add up to on the wire.
 *
 * They live here rather than inside the component because they are the whole of the rule
 * that keeps a premium from being shown for an arrangement nobody is looking at, and a
 * component cannot be tested in this repo — vitest runs in node with no DOM. A rule that
 * matters is worth a test, so it is written where a test can reach it.
 */

/** One ticked rider as the fold holds it. "" is a sum field caught mid-keystroke. */
export interface RiderPick {
  sumAssured?: number | "";
  plan?: number;
  option?: string;
  /** the payer under a rider priced on them; the age is "" until it is typed */
  payerSex?: "M" | "F";
  payerAge?: number | "";
}

/**
 * The name of an arrangement: every field that changes what the engine would answer, and
 * nothing else. An answer tagged with one of these is only shown while the tag still
 * matches, so a quote for age 35 can never be left on screen under the pickers saying 8.
 * The attached riders are deliberately not part of it — they change what is priced, not
 * which arrangement it is, and folding them in would blank the fold on every tick.
 */
export function arrangementKey(r: Omit<RiderQuoteInput, "riders">): string {
  return [r.base, r.age, r.sex, r.sumAssured, r.mode, r.plan, r.territory, r.coverage].join("|");
}

/**
 * The ticks as the action takes them. A sum the agent has half-deleted is sent as no sum at
 * all rather than as a zero: zero is a figure the engine would measure against the rider's
 * minimum and reject, and an empty field is not a request for a quote at nothing.
 */
export function attachedRiders(chosen: Record<string, RiderPick>): AttachedRider[] {
  return Object.entries(chosen).map(([code, pick]) => ({
    code,
    ...(typeof pick.sumAssured === "number" ? { sumAssured: pick.sumAssured } : {}),
    ...(pick.plan === undefined ? {} : { plan: pick.plan }),
    ...(pick.option === undefined ? {} : { option: pick.option }),
    // Sent only once there is an age to send: a payer with no age is not one the engine can
    // price, and it says so itself when the rider arrives without one.
    ...(pick.payerSex !== undefined && typeof pick.payerAge === "number"
      ? { payer: { age: pick.payerAge, sex: pick.payerSex } } : {}),
  }));
}

/**
 * The ticks, brought inside what the company will actually sell at this age.
 *
 * A plan-based rider carries a list of the plans it is on offer at, and that list moves with
 * the age: MEB sells only five hundred a day up to ten. A pick left over from another age is
 * walked down to the largest plan still on offer — the same "the most the agency would ask
 * for that this age may have" rule the slim table applies to the standard rider.
 *
 * Returns the same object when nothing moves, so this cannot re-trigger the quote it is
 * called from; when something does move, the next answer offers the plan now ticked and the
 * second pass is a no-op.
 */
export function withinOffer(
  chosen: Record<string, RiderPick>, available: RiderChoice[],
): Record<string, RiderPick> {
  let moved = false;
  const next = { ...chosen };
  for (const c of available) {
    const pick = next[c.code];
    const plans = c.plans;
    if (!pick || pick.plan === undefined || !plans || plans.length === 0) continue;
    if (plans.includes(pick.plan)) continue;
    const wanted = pick.plan;
    const within = plans.filter((p) => p <= wanted);
    next[c.code] = { ...pick, plan: within.length > 0 ? Math.max(...within) : Math.min(...plans) };
    moved = true;
  }
  return moved ? next : chosen;
}
