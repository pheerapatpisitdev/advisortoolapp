import { after } from "next/server";
import { asWho } from "@/lib/ai/who";

/**
 * Work that goes on after the answer has gone back — the one place the app says so (Cloudflare
 * move step 2, owner chose ก 2026-11-02, mockup https://claude.ai/artifact/AZyE2MYMK1f66JSta6cxN7).
 *
 * Two kinds, because the two hosts differ on exactly this:
 * - `runLater(job, payload)`: work that can take minutes — a bot's answer, a clip being made.
 *   On Vercel it runs in after(), which lasts as long as the route's maxDuration; on Cloudflare
 *   it will be a queue message, whose consumer may run 15 minutes, since a Worker's own tail
 *   lasts 30 seconds. A queue carries data, not a function, so a job is named and its payload
 *   is JSON — and it goes through JSON here too, so what works on Vercel works from a queue.
 * - `finishAfter(work)`: a short tail of this request's own work, well under 30 seconds — a
 *   row written, one message sent. after() here, waitUntil() there.
 */

export interface Job<P> {
  /** the name a queue message carries; unique (src/lib/later-jobs.ts lists every one) */
  name: string;
  run: (payload: P) => Promise<void>;
}

export function defineJob<P>(name: string, run: (payload: P) => Promise<void>): Job<P> {
  return { name, run };
}

/** what a queue message holds: the job, its payload, and the member the work is done for */
export interface LaterMessage { job: string; payload: unknown; agentId: string | null }

/** runs one message's job as the member it is for (src/lib/ai/who.ts); a failure is logged, never thrown */
export async function runMessage<P>(job: Job<P>, message: LaterMessage): Promise<void> {
  try {
    await asWho(message.agentId, () => job.run(message.payload as P));
  } catch (e) {
    console.error(`later: ${job.name} failed:`, e instanceof Error ? e.message : e);
  }
}

/** `agentId`: whose work this is, for the usage ledger (src/lib/ai/who.ts) */
export function runLater<P>(job: Job<P>, payload: P, opts: { agentId?: string | null } = {}): void {
  // as a queue would carry it: anything that does not survive JSON fails here, on Vercel, first
  const message = JSON.parse(JSON.stringify({ job: job.name, payload, agentId: opts.agentId ?? null })) as LaterMessage;
  after(() => runMessage(job, message));
}

/** a short tail of this request's work (well under 30 seconds); throws outside a request, as after() does */
export function finishAfter(work: () => Promise<unknown>): void {
  after(work);
}
