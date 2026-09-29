import { CLAIM_HREF, CLAIM_NAME } from "./claim";
import { KNOWLEDGE_HREF, KNOWLEDGE_NAME } from "./knowledge";
import { RECRUIT_HREF, RECRUIT_NAME } from "./recruit";

/**
 * The rounds that belong to no plan, by the plan_href their pieces carry and the name the
 * workbench and the calendar show for them. One list, so a new mode is named everywhere at once.
 */
export const MODE_PLANS: { href: string; name: string }[] = [
  { href: CLAIM_HREF, name: CLAIM_NAME },
  { href: RECRUIT_HREF, name: RECRUIT_NAME },
  { href: KNOWLEDGE_HREF, name: KNOWLEDGE_NAME },
];

export function modeName(href: string): string | null {
  return MODE_PLANS.find((m) => m.href === href)?.name ?? null;
}
