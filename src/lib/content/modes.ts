import { CLIP_HREF, CLIP_NAME } from "./clip";
import { CLAIM_HREF, CLAIM_NAME } from "./claim";
import { DRAFT_HREF, DRAFT_NAME } from "./draft";
import { KNOWLEDGE_HREF, KNOWLEDGE_NAME } from "./knowledge";
import { RECRUIT_HREF, RECRUIT_NAME } from "./recruit";
import { THANKS_HREF, THANKS_NAME } from "./thanks";
import { SHOWCASE_HREF, SHOWCASE_NAME } from "./showcase";

/**
 * The rounds that belong to no plan, by the plan_href their pieces carry and the name the
 * workbench and the calendar show for them. One list, so a new mode is named everywhere at once.
 */
export const MODE_PLANS: { href: string; name: string }[] = [
  { href: CLAIM_HREF, name: CLAIM_NAME },
  { href: RECRUIT_HREF, name: RECRUIT_NAME },
  { href: KNOWLEDGE_HREF, name: KNOWLEDGE_NAME },
  { href: DRAFT_HREF, name: DRAFT_NAME },
  { href: THANKS_HREF, name: THANKS_NAME },
  { href: SHOWCASE_HREF, name: SHOWCASE_NAME },
  { href: CLIP_HREF, name: CLIP_NAME },
];

export function modeName(href: string): string | null {
  return MODE_PLANS.find((m) => m.href === href)?.name ?? null;
}
