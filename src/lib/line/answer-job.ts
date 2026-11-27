import { eachBySender } from "@/lib/chat/batch";
import { handle, type LineEvent } from "@/lib/line/conversation";
import { defineJob } from "@/lib/later";

/**
 * The official account's answers to one webhook call, after its 200 has gone back
 * (src/lib/later.ts): different people side by side, one person's events in order
 * (src/lib/chat/batch.ts). `startedAt` is when the webhook was called; `tail` says the job runs
 * in a Worker's 30-second tail (the webhook on Cloudflare), so each turn's clock is that short.
 */
export const lineAnswers = defineJob<{ events: LineEvent[]; destination: string; startedAt: number; tail?: boolean }>(
  "line-answers",
  ({ events, destination, startedAt, tail }) => eachBySender(
    events,
    (event) => event.source?.userId,
    (event, later) => handle(event, destination, {
      startedAt,
      tail,
      followed: later.some((e) => e.type === "message" && e.message?.type === "text" && Boolean(e.message.text?.trim())),
    }),
    "line",
  ),
);
