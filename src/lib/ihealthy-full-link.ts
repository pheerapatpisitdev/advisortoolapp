import type { IHealthyInitial } from "@/lib/ihealthy-choice";
import type { Lang } from "@/lib/ihealthy-lang";
import { cardQuery } from "@/lib/ihealthy-link";
import type { IHealthyTable } from "@/lib/ihealthy-table";

/**
 * Where the same arrangement as `cardPath` is drawn as the whole table, every category
 * (src/app/api/ihealthy-card/full). Its own file because the page's calculator imports it,
 * and the module that builds the picture reads the rate tables.
 */
export function fullCardPath(table: IHealthyTable, v: IHealthyInitial, lang: Lang = "th"): string {
  return `/api/ihealthy-card/full?${cardQuery(table, v)}${lang === "th" ? "" : `&l=${lang}`}`;
}
