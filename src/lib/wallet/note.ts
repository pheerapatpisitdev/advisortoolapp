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

export function roundsNote(rounds: Rounds, estimate: string | number): { text: string; topUp: boolean } {
  const left = Math.max(0, rounds.limit - rounds.used);
  if (left > 0 || !rounds.wallet) {
    return { text: `ราว ฿${estimate} · รอบฟรีเหลือ ${left} จาก ${rounds.limit} ครั้ง`, topUp: false };
  }
  const price = (Number(estimate) * rounds.wallet.multiplier).toFixed(2);
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
