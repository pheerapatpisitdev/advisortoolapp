import { defineJob } from "@/lib/later";

/**
 * A job that only says how long it waited: the way to see runLater's path work end to end — on
 * Cloudflare, the queue, worker.ts and /api/later — without touching a customer's chat
 * (POST /api/later/ping with the scheduler's token).
 */
export const laterPing = defineJob<{ sentAt: number }>("later-ping", async ({ sentAt }) => {
  console.log(`later-ping: ran ${Date.now() - sentAt} ms after it was sent`);
});
