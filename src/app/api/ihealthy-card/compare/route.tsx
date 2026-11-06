import type { NextRequest } from "next/server";
import { iHealthyCompareCard } from "@/lib/ihealthy-compare-card";
import { COMPARE_WORDS } from "@/lib/ihealthy-compare-words";
import { wholeTablePicture } from "../whole-table";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/** The compare page's table as a picture (src/lib/ihealthy-compare-card.ts). */
export async function GET(req: NextRequest) {
  return wholeTablePicture(
    req, (query) => iHealthyCompareCard(query), (card) => `iHealthy Ultra · ${COMPARE_WORDS[card.lang].title}`,
  );
}
