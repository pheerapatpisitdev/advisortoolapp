import type { IHealthyInitial } from "@/lib/ihealthy-choice";
import { fullCardPath } from "@/lib/ihealthy-full-link";
import type { Lang } from "@/lib/ihealthy-lang";
import { queryFrom } from "@/lib/ihealthy-link";
import type { IHealthyTable } from "@/lib/ihealthy-table";

const COMPARE_REVISION = 1;

/**
 * The compare picture's address (src/app/api/ihealthy-card/compare): the whole table's, on its
 * own revision. Beside the link modules so that a client island can write it.
 */
export function compareCardPath(table: IHealthyTable, v: IHealthyInitial, lang: Lang = "th"): string {
  return fullCardPath(table, v, lang)
    .replace("/api/ihealthy-card/full?", "/api/ihealthy-card/compare?")
    .replace(/&cv=([^&]*)/, `&cv=$1-c${COMPARE_REVISION}`);
}

/** The phone's PDF of the compare page. No `v`: the route sends any other to the current one. */
export function comparePdfPath(table: IHealthyTable, v: IHealthyInitial, lang: Lang = "th"): string {
  return `/api/quote-pdf?page=ihealthy-ultra-compare&${queryFrom(table, v)}${lang === "th" ? "" : `&l=${lang}`}`;
}
