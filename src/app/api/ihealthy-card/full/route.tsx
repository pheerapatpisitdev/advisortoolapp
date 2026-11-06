import type { NextRequest } from "next/server";
import { iHealthyFullCard } from "@/lib/ihealthy-full-card";
import { SEND_WORDS } from "@/lib/ihealthy-send-words";
import { wholeTablePicture } from "../whole-table";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/**
 * The whole benefit table as one picture: every category, all six plans, and what each plan
 * costs (owner, 2026-10-25, mockup https://claude.ai/artifact/6Wk2LKxWA5hqojpF2LfnHt).
 *
 * A customer asked for it. The quote card under the send panel carries the five rows a phone
 * shows; this one carries the twenty-eight the page does, so the customer can keep the full
 * comparison without the page. The plan being quoted is lit, as on the card, and its yearly
 * ceiling and instalments are marked.
 */
export async function GET(req: NextRequest) {
  return wholeTablePicture(
    req, (query) => iHealthyFullCard(query), (card) => `${card.planLine} · ${SEND_WORDS[card.lang].fullTable}`,
  );
}
