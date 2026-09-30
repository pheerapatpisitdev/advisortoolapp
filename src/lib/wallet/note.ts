import { formatBaht } from "./money";

/**
 * The line under every make button for an agent (not staff): the free rounds left, and once
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
    return { text: `ราว ฿${estimate} · เดือนนี้สร้างด้วย AI ได้อีก ${left} จาก ${rounds.limit} ครั้ง`, topUp: false };
  }
  const price = (Number(estimate) * rounds.wallet.multiplier).toFixed(2);
  return {
    text: `ราว ฿${price} จากกระเป๋า · โควตาฟรีเดือนนี้หมดแล้ว · คงเหลือ ${formatBaht(rounds.wallet.satang)}`,
    topUp: true,
  };
}
