import type { AttachedRider } from "@/lib/ihealthy-rider-quote";
import type { IHealthyWords } from "@/lib/ihealthy-words";

/**
 * The most riders a card names one by one. Past it the card names three and counts the rest,
 * so a fold with every box ticked does not push the price table off the bottom of a phone.
 */
const MOST_NAMED = 4;

/**
 * The fold's headings, in the order they are read, and the riders under each — health, then
 * critical illness, accident, life cover, premium waiver. The card names riders in the same
 * order, so the picture reads the way the fold the agent ticked them in does.
 */
export const RIDER_GROUPS = [
  { key: "health", codes: ["MEB", "MEX"] },
  { key: "critical", codes: ["DCI", "CI123", "RRSS", "CPR"] },
  { key: "accident", codes: ["AP", "ECARE"] },
  { key: "life", codes: ["PLS"] },
  { key: "waiver", codes: ["WP", "PB"] },
] as const satisfies readonly { key: keyof IHealthyWords["riderGroups"]; codes: readonly string[] }[];

const ORDER: readonly string[] = RIDER_GROUPS.flatMap((g) => g.codes);
/** Where a code sits in the fold; a rider no group names goes after them all. */
const rank = (code: string) => (ORDER.includes(code) ? ORDER.indexOf(code) : ORDER.length);
const NAMED_BEFORE_COUNT = 3;

/**
 * One attached rider as a card names it: a short name, then what was picked — the variant,
 * the plan, the sum, and for PB the payer — so a customer reading the picture can tell
 * which cover they are paying for. MEB is said as the daily cash it pays, as it always was.
 */
export function riderShortName(w: IHealthyWords, r: AttachedRider): string {
  if (r.code === "MEB" && r.plan !== undefined) return w.dailyCash(r.plan);
  const parts = [w.riderShort[r.code] ?? r.code];
  if (r.option !== undefined) {
    parts.push(/^\d+$/.test(r.option) ? w.planShort(r.option) : w.riderVariant[r.option] ?? w.rider(r.option));
  }
  if (r.sumAssured !== undefined) parts.push(w.sumShort(r.sumAssured.toLocaleString("en-US")));
  if (r.payer) parts.push(`(${w.sex[r.payer.sex]} ${w.years(r.payer.age)})`);
  return parts.join(" ");
}

/**
 * Every rider the engine priced, said in full for a วิดีโอนำเสนอ voice (owner, 2026-10-17,
 * mockup https://claude.ai/artifact/XaTkLWYU8twVqtMfrYFLGN, ก): its short name, what was
 * picked, and the sum with its currency — "โรคร้ายแรง DCI ทุน 200,000 บาท". Nothing is counted
 * away as the card does past four, and `skip` (the daily cash the voice already names) is left out.
 */
export function riderSpokenNames(w: IHealthyWords, riders: AttachedRider[], codes: string[], skip?: string): string[] {
  return riders.filter((r) => codes.includes(r.code) && r.code !== skip)
    .sort((a, b) => rank(a.code) - rank(b.code))
    .map((r) => riderShortName(w, { ...r, payer: undefined, sumAssured: undefined })
      + (r.sumAssured !== undefined ? ` ${w.sumShort(r.sumAssured.toLocaleString("en-US"))} ${w.baht}` : ""));
}

/**
 * The card's lines for the riders the engine priced, in the fold's order.
 *
 * `riders` are the ticks as picked and `codes` what the engine actually charged for: a tick
 * this age may not buy is not on the bill, so it is not on the card either.
 */
export function riderLines(w: IHealthyWords, riders: AttachedRider[], codes: string[]): string[] {
  const priced = riders.filter((r) => codes.includes(r.code))
    .sort((a, b) => rank(a.code) - rank(b.code));
  const names = priced.map((r) => riderShortName(w, r));
  if (names.length <= MOST_NAMED) return names;
  return [...names.slice(0, NAMED_BEFORE_COUNT), w.andMore(names.length - NAMED_BEFORE_COUNT)];
}
