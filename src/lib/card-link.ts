import type { PayMode, Sex } from "@/calc/types";
import { cardVersionFor } from "@/lib/card-theme";

/**
 * What a card is asked for, and the link that asks for it.
 *
 * This sits apart from quote-card.ts on purpose. Three customer-facing calculators build
 * card links in the browser, and quote-card.ts reaches the engine, the plan registry and
 * every surrender table behind it — around a megabyte of rate data that a page which only
 * needs to write a query string has no business shipping.
 */
/**
 * The riders a Life Protect card carries, as its sales page picked them: one premium waiver
 * (with the parent paying, for a child's พีบี) and a medical plan. Only the page writes them,
 * and only the ones its price includes; a chat's card never has any.
 */
export interface CardRiders {
  /** the waiver and its flavour, e.g. { code: "PB", option: "FIT" } */
  waiver?: { code: string; option: string };
  /** the parent a child's พีบี is priced off */
  payer?: { sex: Sex; age: number };
  /** the medical plan, e.g. 1000 */
  medical?: number;
}

/**
 * What a card can be asked for. It is the quote's own input minus what a customer never picks
 * in a chat: the premium basis, and riders — except the ones the Life Protect page offers.
 */
export interface PlanCardInput {
  kind: "plan";
  planCode: string;
  variant: string;
  age: number;
  sex: Sex;
  sumAssured: number;
  /**
   * The instalment the customer asked about. It does not steer the drawing: the card
   * headlines the largest instalment this insured can actually pay — monthly when it clears
   * the company's minimum, otherwise yearly — and lists the rest regardless. Recorded in the
   * link anyway, because what was asked for is worth keeping even though it changes nothing.
   */
  mode?: PayMode;
  /** Life Protect only: the riders its page priced in */
  riders?: CardRiders;
}

/**
 * A card for an arrangement the agency sells under its own name. It is named by bundle and
 * tier rather than by sums assured, because the sums are the bundle's business — a link
 * that could set them would be a link that could invent an arrangement the agency does not
 * sell.
 */
export interface BundleCardInput {
  kind: "bundle";
  bundleCode: string;
  tier: number;
  age: number;
  sex: Sex;
  /**
   * The instalment the customer asked about. It does not steer the drawing: the card
   * headlines the largest instalment this insured can actually pay — monthly when it clears
   * the company's minimum, otherwise yearly — and lists the rest regardless. Recorded in the
   * link anyway, because what was asked for is worth keeping even though it changes nothing.
   */
  mode?: PayMode;
}

/** What a card can be asked for: an arrangement priced from the customer's own sum, or one the agency sells under its own name and tier. */
export type CardInput = PlanCardInput | BundleCardInput;

/** The arrangement, written the way a link carries it. */
function cardQuery(input: CardInput): string {
  const q = input.kind === "bundle"
    ? new URLSearchParams({
      bundle: input.bundleCode,
      tier: String(input.tier),
      age: String(input.age),
      sex: input.sex,
    })
    : new URLSearchParams({
      plan: input.planCode,
      variant: input.variant,
      age: String(input.age),
      sex: input.sex,
      sum: String(input.sumAssured),
    });
  if (input.mode) q.set("mode", input.mode);
  // after the arrangement and before the fingerprint, the order canonical.ts keeps
  const riders = input.kind === "plan" ? input.riders : undefined;
  if (riders?.waiver) q.set("rider", `${riders.waiver.code}.${riders.waiver.option}`);
  if (riders?.payer) q.set("payer", `${riders.payer.sex}${riders.payer.age}`);
  if (riders?.medical !== undefined) q.set("meb", String(riders.medical));
  /**
   * The palette's fingerprint, so a re-coloured plan is not served from a cache keyed on an
   * address that did not change. Last, so the readable part of the link stays readable, and
   * ignored by the route — see cardPaletteVersion.
   */
  q.set("v", cardVersionFor());
  return q.toString();
}

/** The path a card is drawn at, with the arrangement it draws written into it. */
export function cardPath(input: CardInput): string {
  return `/api/card?${cardQuery(input)}`;
}

/**
 * The path the year-by-year value table is drawn at — the same arrangement, told as a table
 * rather than as a headline. Only for a plan: a bundle's worth is its parts', and a table of
 * one column per part is not a picture anybody reads on a phone.
 */
export function valueTablePath(input: PlanCardInput): string {
  return `/api/card/table?${cardQuery(input)}`;
}

/** The same path against a host, for the channels that can only send an absolute URL. */
export function cardUrl(origin: string, input: CardInput): string {
  return new URL(cardPath(input), origin).toString();
}

/**
 * The picture of one contract's illnesses.
 *
 * Named by the contract's code and nothing else: the list belongs to the rider, is the same
 * list for every plan the rider is sold under, and has no insured to be about.
 */
export function diseaseCardPath(code: string): string {
  return `/api/card/diseases?of=${encodeURIComponent(code)}`;
}
