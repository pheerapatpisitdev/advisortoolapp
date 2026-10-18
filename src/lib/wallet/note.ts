import { formatBaht } from "./money";

/**
 * The line under every make button for an agent or assistant (not the owner): the free rounds left, and once
 * they are used, the price from the wallet and what is in it. Browser-safe (owner, 2026-09-30).
 */
export interface Rounds {
  used: number;
  limit: number;
  /** null while the owner has the wallet off (src/lib/wallet/store.ts walletView) */
  wallet?: { satang: number; multiplier: number } | null;
}

/**
 * `paid`: what a wallet round is really charged (owner, 2026-10-18): the writing's cost times the
 * multiplier, and each picture at its fixed price from the price list — not the painter's cost
 * times the multiplier. Without it the estimate is taken times the multiplier, as before.
 */
export function roundsNote(rounds: Rounds, estimate: string | number, paid?: { writeThb: number; picturesSatang: number }): { text: string; topUp: boolean } {
  const left = Math.max(0, rounds.limit - rounds.used);
  if (rounds.limit === 0 && !rounds.wallet) return { text: `ราว ฿${estimate} · ตอนนี้ยังใช้เครดิตและกระเป๋าเงินไม่ได้`, topUp: false };
  if (left > 0 || !rounds.wallet) {
    return { text: `ราว ฿${estimate} · รอบฟรีเหลือ ${left} จาก ${rounds.limit} ครั้ง`, topUp: false };
  }
  const price = (paid ? paid.writeThb * rounds.wallet.multiplier + paid.picturesSatang / 100 : Number(estimate) * rounds.wallet.multiplier).toFixed(2);
  // a member's pass has credit, not free rounds (owner, 2026-10-17): the balance is the two together
  if (rounds.limit === 0) {
    return { text: `ราว ฿${price} · หักจากเครดิตและกระเป๋า · คงเหลือ ${formatBaht(rounds.wallet.satang)}`, topUp: true };
  }
  return {
    text: `ราว ฿${price} จากกระเป๋า · รอบฟรีหมดแล้ว · คงเหลือ ${formatBaht(rounds.wallet.satang)}`,
    topUp: true,
  };
}

/**
 * The content money the page reckons with for อัตโนมัติ and the over-budget warning. The
 * owner's monthly content ceiling is the answer for the owner and for a free round; a round the agent pays
 * from the wallet ignores the ceiling on the server (contentCap() is Infinity inside it), so
 * the page must too, or a paying agent is quietly given no pictures and told to raise a
 * budget that is not theirs to raise (owner, 2026-09-30).
 */
export function moneyLeft(spend: { cap: number; spent: number; rounds: Rounds | null }): number {
  const r = spend.rounds;
  if (r && r.used >= r.limit && r.wallet) return Infinity;
  return Math.max(0, spend.cap - spend.spent);
}
