import { eachBySender } from "@/lib/chat/batch";
import { handle } from "@/lib/facebook/conversation";
import { customerOf, textOf, type Messaging } from "@/lib/facebook/events";
import { defineJob } from "@/lib/later";

/**
 * The Page's answers to one webhook call, after its 200 has gone back (src/lib/later.ts).
 *
 * Different customers are answered side by side, so one stuck answer does not hold up the
 * rest; one customer's own events still go in order, one at a time. The Page goes into the
 * key as well, because a page-scoped id names a person only on its own Page. `startedAt` is
 * when the webhook was called: each turn's clock and apology run from it.
 */
export const facebookAnswers = defineJob<{ events: { m: Messaging; pageId?: string }[]; startedAt: number }>(
  "facebook-answers",
  ({ events, startedAt }) => eachBySender(
    events,
    ({ m, pageId }) => {
      const who = customerOf(m);
      return who ? `${pageId ?? ""}:${who}` : undefined;
    },
    ({ m, pageId }, later) => handle(m, pageId, { startedAt, followed: later.some((e) => Boolean(textOf(e.m))) }),
    "facebook",
  ),
);
