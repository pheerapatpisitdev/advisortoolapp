import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { asWho } from "@/lib/ai/who";
import { adminSecret, deriveKey } from "@/lib/auth/keys";
import { cloudflareEnv } from "@/lib/cloudflare/env";

/**
 * Work that goes on after the answer has gone back — the one place the app says so (Cloudflare
 * move step 2, owner chose ก 2026-11-02, mockup https://claude.ai/artifact/AZyE2MYMK1f66JSta6cxN7).
 *
 * Two kinds, because the two hosts differ on exactly this:
 * - `runLater(job, payload)`: work that can take minutes — a bot's answer, a clip being made.
 *   On Vercel it runs in after(), which lasts as long as the route's maxDuration; on Cloudflare
 *   it is a message on LATER_QUEUE, since a Worker's own tail lasts 30 seconds: the queue's
 *   consumer (worker.ts) hands it to /api/later, which runs it while the consumer waits (up to
 *   15 minutes). The message is signed, as that route is on the open internet. A queue carries data, not a function, so a job is named and its payload
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
  // as a queue carries it: anything that does not survive JSON fails here, on Vercel, first
  const message = JSON.parse(JSON.stringify({ job: job.name, payload, agentId: opts.agentId ?? null })) as LaterMessage;
  const queue = cloudflareEnv()?.LATER_QUEUE;
  if (queue) {
    after(() => queue.send(sealMessage(message)).catch((e) => {
      console.error(`later: ${job.name} not queued:`, e instanceof Error ? e.message : e);
    }));
    return;
  }
  after(() => runMessage(job, message));
}

/** a queue message as it travels: the message, when it was sealed, and its signature */
export interface SealedMessage { message: LaterMessage; at: number; sig: string }

/** a message older than this is not run: a queue keeps one four days, a reply that late helps nobody */
const SEAL_LIFE_MS = 60 * 60_000;

const signature = (body: string) => createHmac("sha256", deriveKey(adminSecret(), "later-queue")).update(body).digest("hex");

export function sealMessage(message: LaterMessage, now = Date.now()): SealedMessage {
  return { message, at: now, sig: signature(JSON.stringify({ message, at: now })) };
}

/** the message, when the seal is ours and fresh; null otherwise */
export function openSealed(sealed: unknown, now = Date.now()): LaterMessage | null {
  const s = sealed as Partial<SealedMessage> | null;
  if (!s || typeof s.sig !== "string" || typeof s.at !== "number" || !s.message || typeof s.message.job !== "string") return null;
  if (now - s.at > SEAL_LIFE_MS || s.at - now > 60_000) return null;
  const want = Buffer.from(signature(JSON.stringify({ message: s.message, at: s.at })));
  const got = Buffer.from(s.sig);
  return want.length === got.length && timingSafeEqual(want, got) ? s.message : null;
}

/** a short tail of this request's work (well under 30 seconds); throws outside a request, as after() does */
export function finishAfter(work: () => Promise<unknown>): void {
  after(work);
}
