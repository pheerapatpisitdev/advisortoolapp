/**
 * How the clip editor keeps the agent's changes when the connection drops (owner, 2026-10-02).
 * No I/O here: the browser runs these, and the tests read them.
 */

/** a save that never reached the server goes back in, under whatever was changed since (the newer wins) */
export function mergeBack<T extends object>(failed: T, newer: T): T {
  return { ...failed, ...newer };
}

/** the wait before the n-th try again (1-based) of a save the connection dropped: 1, 2, 4, 8, then 15 s */
export function retryDelay(attempt: number): number {
  return Math.min(15_000, 1000 * 2 ** Math.max(0, attempt - 1));
}

/** a job's poll that fails this many times in a row stops, and the editor offers ลองใหม่ */
export const POLL_GIVE_UP = 3;
