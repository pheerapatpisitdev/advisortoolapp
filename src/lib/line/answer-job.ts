import { eachBySender } from "@/lib/chat/batch";
import { handle, type LineEvent } from "@/lib/line/conversation";
import { defineJob } from "@/lib/later";

/**
 * The official account's answers to one webhook call, after its 200 has gone back
 * (src/lib/later.ts): different people side by side, one person's events in order
 * (src/lib/chat/batch.ts). `startedAt` is when the webhook was called.
 */
export const lineAnswers = defineJob<{ events: LineEvent[]; destination: string; startedAt: number }>(
  "line-answers",
  ({ events, destination, startedAt }) => eachBySender(
    events,
    (event) => event.source?.userId,
    (event, later) => handle(event, destination, {
      startedAt,
      followed: later.some((e) => e.type === "message" && e.message?.type === "text" && Boolean(e.message.text?.trim())),
    }),
    "line",
  ),
);
