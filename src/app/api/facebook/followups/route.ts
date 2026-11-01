import { finishAfter } from "@/lib/later";
import type { NextRequest } from "next/server";
import { claimDueFollowups, followupMessage, sweepFollowups } from "@/lib/chat/followup";
import { sendMessage } from "@/lib/facebook/client";
import { cronCallerIsOurs } from "@/lib/chat/cron-token";
import { markStalled } from "@/lib/chat/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The minute hand of the bot.
 *
 * Called once a minute from the database's own scheduler, because a follow-up is the one
 * thing this app has to do when nobody is talking to it — every other line of it runs because
 * a customer wrote. It sends what has come due and nothing else; the claim that reads a
 * follow-up also marks it sent, so calling this twice sends nothing twice.
 *
 * The caller proves itself with a token that lives in the database and nowhere else, so the
 * only thing that can make the page speak is something that already has the database.
 */
export async function POST(req: NextRequest) {
  if (!(await cronCallerIsOurs(req.headers.get("authorization")))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const due = await claimDueFollowups("facebook");
  finishAfter(async () => {
    for (const { userHash, psid, pageId, stage } of due) {
      // a stage whose message is switched off is still claimed and still counted; it simply
      // says nothing
      const message = followupMessage(stage);
      if (message) {
        // proactive, not a reply to anything: Meta has a name for that and this is it — and it
        // goes out of the Page the conversation happened on, which is the only Page that knows
        // who this id is
        await sendMessage(psid, message.text, message.replies, { proactive: true, pageId: pageId ?? undefined })
          .catch((e) => console.error("followup failed:", e));
      }
      // the second question is the last one, and reaching it means the first went unanswered —
      // which is the one outcome worth reporting that nothing else leaves a trace of. It is
      // recorded whether or not that message is the one being sent
      if (stage >= 2) await markStalled("facebook", userHash);
    }
    await sweepFollowups();
  });
  return Response.json({ sent: due.filter((d) => followupMessage(d.stage)).length });
}
