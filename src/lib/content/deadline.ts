/**
 * A round's clock inside its function's life (review, 2026-10-01).
 *
 * Studio's rounds run in routes with `maxDuration = 300`: at five minutes Vercel stops the
 * function wherever it is. Each AI call had its own timeout, but nothing added them up — a
 * picture with a brief was a translation (up to 25 s for each provider tried), two image
 * models at 90 s each, and three readers at 60 s each, one after another: past 400 s at
 * worst, and killed after the picture was paid for and uploaded but before it was put on the
 * piece. A round of writing was the planner and then writers that may each fall back twice.
 *
 * So a round carries one deadline, a little inside the 300 s, and each call is given what is
 * left of it after what must still come (`reserve`), or its usual time if that is less. A step
 * that would not fit is skipped when it is optional, or the round stops before it pays for
 * something it could not keep.
 */

/** where a round stops: 30 s short of the function's 300, for what ran before the round began and the answer's way back */
export const ROUND_MS = 270_000;

/** a call given less than this is not worth starting: no model answers in it */
export const MIN_CALL_MS = 5_000;

export interface Deadline {
  /** milliseconds left before the round's deadline, never below 0 */
  left(): number;
  /**
   * The time to give a call: its `usual`, or what is left once `reserve` is kept back for what
   * must come after it, whichever is less; 0 when that is under MIN_CALL_MS — the call should
   * not be made. (0 never reaches a timeoutMs: chat() reads 0 as "no limit".)
   */
  budget(usual: number, reserve?: number): number;
}

export function deadline(ms = ROUND_MS, now: () => number = () => Date.now()): Deadline {
  const end = now() + ms;
  const left = () => Math.max(0, end - now());
  return {
    left,
    budget(usual, reserve = 0) {
      const t = Math.min(usual, left() - reserve);
      return t >= MIN_CALL_MS ? Math.floor(t) : 0;
    },
  };
}

/** A call given up on at the deadline; the round treats it as that call failing. */
export class OutOfTime extends Error {
  constructor(what = "call") {
    super(`${what} ran out of the round's time`);
    this.name = "OutOfTime";
  }
}

/**
 * `p`, or OutOfTime once `ms` have passed. A chat call's own timeoutMs is per provider, and a
 * fallback starts its clock again; this bounds the whole of it. The call given up on is not
 * stopped — its answer, if it comes, is not waited for (what it costs is recorded either way).
 */
export function within<T>(p: Promise<T>, ms: number, what?: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new OutOfTime(what)), Math.max(0, ms));
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}
