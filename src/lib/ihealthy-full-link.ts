import type { IHealthyInitial } from "@/lib/ihealthy-choice";
import type { Lang } from "@/lib/ihealthy-lang";
import { cardQuery } from "@/lib/ihealthy-link";
import type { IHealthyTable } from "@/lib/ihealthy-table";

const FULL_REVISION = 2;

/**
 * Where the same arrangement as `cardPath` is drawn as the whole table, every category
 * (src/app/api/ihealthy-card/full). Its own file because the page's calculator imports it,
 * and the module that builds the picture reads the rate tables.
 */
export function fullCardPath(table: IHealthyTable, v: IHealthyInitial, lang: Lang = "th"): string {
  // FULL_REVISION rides on the card's own `cv`, so a cached copy of the old whole table is not
  // served after this picture alone changes — without touching the card's module, which the
  // clips' Remotion image is built from. 2: OPD 18 and 19 in one row (owner, 2026-10-31).
  const query = cardQuery(table, v).replace(/&cv=([^&]*)/, `&cv=$1-f${FULL_REVISION}`);
  return `/api/ihealthy-card/full?${query}${lang === "th" ? "" : `&l=${lang}`}`;
}
