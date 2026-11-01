import type { Job } from "@/lib/later";
import { facebookAnswers } from "@/lib/facebook/answer-job";
import { lineAnswers } from "@/lib/line/answer-job";
import { clipProduce, clipRedraw } from "@/lib/quote-video/jobs";

/**
 * Every job runLater may be handed (src/lib/later.ts), by name: what the queue's consumer will
 * look a message's job up in on Cloudflare (move step 3). A job not listed here would be sent and
 * never run; tests/later.test.ts checks the names are unique.
 */
export const LATER_JOBS: Job<never>[] = [facebookAnswers, lineAnswers, clipProduce, clipRedraw] as Job<never>[];

export function laterJob(name: string): Job<unknown> | undefined {
  return LATER_JOBS.find((j) => j.name === name) as Job<unknown> | undefined;
}
