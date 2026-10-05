import { IHEALTHY_RUNGS } from "./ihealthy-ad";
import { numbersBody, numbersPoster, numbersYardstick, type NumberSheet } from "./numbers";
import type { Lang } from "./output";
import type { PosterSpec, Theme } from "./poster";
import { thbAfter } from "./premium-table";
import { EXPAT_HREF } from "./prompt";

/**
 * What the code places in Ads Studio's shorter kinds (spec 2026-10-06), shared by the round and
 * the create drawer's preview so the preview is what the ad carries.
 */

/** an iHealthy round's headline plan (its ladder rung), whose benefits the brief stresses; undefined for any other plan */
export function adFactsPlan(href: string, rung: number | undefined): string | undefined {
  if (href !== EXPAT_HREF || rung === undefined) return undefined;
  return IHEALTHY_RUNGS[rung];
}

/**
 * A ตัวเลขชัดๆ ad's figures from the headline's sheet: the body (numbersBody), the numbers poster
 * in the campaign's colour (navy without one), and everything the code wrote, for the checks. An
 * English ad says money as its other ads do, "3,000,000 THB" (thbAfter); the yardstick keeps the
 * sheet's own wording too.
 */
export function numbersAdFigures(sheet: NumberSheet, theme: Theme | null, lang: Lang = "th"): { body: string; poster: PosterSpec; figures: string } {
  const en = lang === "en";
  const body = en ? thbAfter(numbersBody(sheet)) : numbersBody(sheet);
  const drawn = numbersPoster(sheet, theme ?? "navy", lang);
  const poster = en ? { ...drawn, blocks: drawn.blocks.map((b) => ({ ...b, text: thbAfter(b.text) })) } : drawn;
  const yard = numbersYardstick([sheet]);
  return { body, poster, figures: en ? `${yard}\n${thbAfter(yard)}` : yard };
}
