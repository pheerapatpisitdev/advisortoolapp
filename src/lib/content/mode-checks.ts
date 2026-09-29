import { DRAFT_HREF } from "./draft";
import { KNOWLEDGE_HREF } from "./knowledge";
import { RECRUIT_HREF } from "./recruit";

/**
 * The checks a plan-less piece is read with beyond every piece's own, at writing and again at
 * every edit (final review, 2026-09-29):
 * - `recruit`: หาทีม's rules — no income figure, no applicant picked by age or sex (policy.ts).
 *   A หาทีม piece, and a เขียนเอง draft that recruits: the owner's rule holds whichever tab the
 *   post came from.
 * - `every`: every figure is flagged, the small counts too — ความรู้ is written from general
 *   knowledge and has nothing to find a figure in (check.ts strayNumbers).
 */
export interface ModeChecks {
  recruit: boolean;
  every: boolean;
}

/** a draft that asks people to join a team, in the words such a post uses */
const RECRUITING = /ร่วมทีม|หาทีม|รับสมัคร|สมัคร(?:เป็น)?ตัวแทน|หาตัวแทน|ชวน.{0,12}เป็นตัวแทน/;

export function modeChecks(planHref: string, fact: string | undefined): ModeChecks {
  return {
    recruit: planHref === RECRUIT_HREF || (planHref === DRAFT_HREF && RECRUITING.test(fact ?? "")),
    every: planHref === KNOWLEDGE_HREF,
  };
}
