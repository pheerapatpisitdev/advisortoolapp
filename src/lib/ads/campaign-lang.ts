import { isExpatPage } from "@/lib/assistant/expat";
import { EXPAT_HREF } from "@/lib/content/prompt";
import type { Lang } from "@/lib/content/output";

/**
 * The language a campaign's ads are written in (spec 2026-10-06): English for iHealthy Ultra on
 * an Expat Page, Thai for everything else. Derived, never stored — the round, the figure
 * preview, the drawer and the lists all ask here, so a Page added to EXPAT_PAGES turns its
 * iHealthy campaigns English everywhere at once.
 */
export function campaignLang(planHref: string, pageId: string): Lang {
  return planHref === EXPAT_HREF && isExpatPage(pageId) ? "en" : "th";
}
