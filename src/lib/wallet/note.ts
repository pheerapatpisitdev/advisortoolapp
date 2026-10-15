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
  /** the month's เพดานงบใช้ฟรี is reached: free rounds wait for the 1st (src/lib/wallet/free-cap.ts) */
  paused?: { until: string } | null;
}

export function roundsNote(rounds: Rounds, estimate: string | number): { text: string; topUp: boolean } {
  const left = Math.max(0, rounds.limit - rounds.used);
  if (rounds.paused && left > 0) {
    if (!rounds.wallet) return { text: `รอบฟรีของเดือนนี้หมดแล้ว · ได้รอบฟรีใหม่วันที่ ${rounds.paused.until}`, topUp: false };
    const price = (Number(estimate) * rounds.wallet.multiplier).toFixed(2);
    return {
      text: `ราว ฿${price} จากกระเป๋า · รอบฟรีของเดือนนี้หมดแล้ว ได้ใหม่วันที่ ${rounds.paused.until} · คงเหลือ ${formatBaht(rounds.wallet.satang)}`,
      topUp: true,
    };
  }
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
 * monthly content ceiling it was bounded by is retired (owner, 2026-10-15: เพดานงบใช้ฟรี took
 * its place, asked when a round starts), so nothing on the page runs short: `cap` null.
 */
export function moneyLeft(spend: { cap: number | null; spent: number }): number {
  return spend.cap === null ? Infinity : Math.max(0, spend.cap - spend.spent);
}
