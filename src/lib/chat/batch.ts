/**
 * How a webhook's batch of events is worked through.
 *
 * Meta and LINE both send several events in one request when messages arrive close together,
 * and the routes used to answer them one after another inside `after()`. One customer whose
 * answer hung held up everyone behind them in the batch, and when the function reached its
 * limit the rest were never answered at all (review, 2026-10-01).
 *
 * So different people are answered side by side, and one stuck answer costs only its own
 * thread. The same person's events still go one at a time and in the order they were sent:
 * two of their messages answered at once would read the same session and the later save would
 * overwrite the earlier's (src/lib/chat/session.ts saveTurn catches what slips past this,
 * across requests).
 */

/** The groups, in the order each sender first appears, each keeping its events' own order. */
export function groupBySender<T>(items: T[], senderOf: (item: T) => string | undefined): T[][] {
  const groups = new Map<string, T[]>();
  const loose: T[][] = [];
  for (const item of items) {
    const who = senderOf(item);
    // an event with no sender (a read receipt, a delivery) shares nothing with anyone
    if (!who) {
      loose.push([item]);
      continue;
    }
    const group = groups.get(who);
    if (group) group.push(item);
    else groups.set(who, [item]);
  }
  return [...groups.values(), ...loose];
}

/**
 * Runs `handle` over every item: one sender's in sequence, different senders at once. Never
 * throws — a failure is logged under `label` and the rest carry on.
 */
export async function eachBySender<T>(
  items: T[],
  senderOf: (item: T) => string | undefined,
  handle: (item: T) => Promise<void>,
  label: string,
): Promise<void> {
  await Promise.allSettled(groupBySender(items, senderOf).map(async (group) => {
    for (const item of group) {
      await handle(item).catch((e) => console.error(`${label} event failed:`, e));
    }
  }));
}

/* ------------------------------ the turn's clock ------------------------------ */

/**
 * The webhook routes' maxDuration, in milliseconds. A route's own `maxDuration` has to be a
 * literal in its file for Next to read it, so the two are kept equal by hand — and by a test.
 */
export const WEBHOOK_LIMIT_MS = 300_000;

/**
 * Kept back at the end of the function for what follows an answer: the bubbles, a card sent
 * twice and then as a link, the transcript, the session, the report. Or, when the answer ran
 * out of time, the apology — which is the one message that must always get out.
 */
export const SEND_MARGIN_MS = 60_000;

/**
 * The longest one answer may take. Two attempts (the conversation retries once) of a router
 * and an answer at 25 seconds a provider fit inside it with room for one fallback; an answer
 * that has taken a minute and a half is not going to be a good one, and the customer has been
 * looking at the typing dots all that time.
 */
export const TURN_MS = 90_000;

/**
 * How long this turn's answer may take: its own TURN_MS, or less when the batch it came in
 * has already used up the function's time. Zero or below means the apology goes at once.
 */
export function turnBudgetMs(startedAt?: number, now = Date.now()): number {
  if (startedAt === undefined) return TURN_MS;
  return Math.min(TURN_MS, startedAt + WEBHOOK_LIMIT_MS - SEND_MARGIN_MS - now);
}
