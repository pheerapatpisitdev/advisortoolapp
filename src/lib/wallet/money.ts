import type { AiRound } from "@/lib/auth/quota";

/**
 * The wallet's money rules, browser-safe: the wallet page shows the buttons and the prices
 * from here, and the server checks every request against the same lists.
 */

/** the top-ups on offer (owner, 2026-09-30); the server takes no other amount */
export const TOPUP_THB = [50, 100, 150, 200, 500] as const;
export type TopUpThb = (typeof TOPUP_THB)[number];

export const isTopUpThb = (v: unknown): v is TopUpThb =>
  typeof v === "number" && (TOPUP_THB as readonly number[]).includes(v);

/**
 * A card's fee in Thailand has a fixed part per payment, and on ฿50 that is close to a
 * quarter of it; PromptPay's is a percentage only. So the small top-ups are PromptPay only
 * (owner, 2026-09-30).
 */
export const CARD_FROM_THB = 150;
export const cardAllowed = (thb: TopUpThb): boolean => thb >= CARD_FROM_THB;

export const toSatang = (thb: number): number => Math.round(thb * 100);

export const formatBaht = (satang: number): string =>
  `฿${(satang / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** what the owner charges over the providers' price until they set otherwise on /admin/wallet */
export const DEFAULT_MULTIPLIER = 2;

/**
 * What a round sets aside before it starts, in baht before the multiplier: the dearest round
 * of its kind, from the prices in src/lib/content/models.ts on 2026-09-30. A written round is
 * at most five pieces (MAX_PIECES) or six ads at Sonnet 5's ฿0.61 and ฿0.03 overhead each, about
 * ฿3.84; หาทีม, ความรู้, เขียนเอง and รีวิวเคลม at most three pieces, about ฿1.92; a picture at most
 * Gemini's ฿2.41 with its translation. What is not spent comes back when the round is over.
 */
export const ROUND_HOLD_THB: Record<AiRound, number> = {
  "ai-write": 5,
  "ai-recruit": 3,
  "ai-knowledge": 3,
  "ai-draft": 3,
  "ai-claim": 3,
  "ai-draw": 3,
};

/**
 * What one post costs the providers on average, in baht before the multiplier: ฿0.56 a piece
 * of writing, plus the round's planning and proofreading shared out over its pieces, from the
 * usage ledger over the fortnight to 2026-10-01. At ×2 that is ฿1.25 a post.
 *
 * The top-up buttons say what the money buys in posts rather than rounds (owner, 2026-10-01):
 * "about 10 rounds for ฿50" read as ฿5 a go, when a round is three to five posts. A picture
 * costs more than a post and is not folded into the count.
 */
export const POST_COST_THB = 0.625;

const clean = (n: number): number => Number(n.toFixed(6));

/** about how many posts `thb` buys at `multiplier`: rounded down, to a multiple of five from ten up */
export function postsFor(thb: number, multiplier: number): number {
  const n = clean(thb / (POST_COST_THB * multiplier));
  return n >= 10 ? Math.floor(n / 5) * 5 : Math.floor(n);
}

/** the half baht a post's average price is under: "เฉลี่ยโพสต์ละไม่ถึง ฿1.50" at ×2 */
export function perPostUnder(multiplier: number): number {
  return (Math.floor(clean(POST_COST_THB * multiplier * 2)) + 1) / 2;
}

/** satang, rounded up; toFixed first so floating-point dust is not a satang of its own */
const upToSatang = (baht: number): number => Math.ceil(Number((baht * 100).toFixed(6)));

/** a hold sized from a price in baht, times the multiplier */
export const holdSatangFor = (thb: number, multiplier: number): number => upToSatang(thb * multiplier);

export const holdSatang = (round: AiRound, multiplier: number): number => holdSatangFor(ROUND_HOLD_THB[round], multiplier);

/** what a round is charged: its real cost times the multiplier, never more than it held */
export function chargeSatang(costThb: number, multiplier: number, heldSatang: number): number {
  if (!Number.isFinite(costThb) || costThb <= 0) return 0;
  return Math.min(heldSatang, upToSatang(costThb * multiplier));
}
