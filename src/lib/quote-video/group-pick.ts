import type { BizType, Product as GroupKind } from "@/lib/group-insurance/data";

/**
 * ประกันกลุ่ม's groups as วิดีโอนำเสนอ keeps them (group.ts), apart from the rate tables: the calculators' pages write
 * them into the Studio's address (link.ts) and should not carry the tables to do it.
 */

export type { BizType, GroupKind };
/** one employee group as the clip keeps it: plan and rider numbered 1–6 as the page's buttons are, no rider = none */
export interface GroupPick { biz: BizType; plan: number; rider?: number; count: number }

export const GROUP_BIZ: readonly BizType[] = ["biz1", "biz2", "biz3"];
/** the most groups one clip carries; the page's sheet stops at 20 too (print-link.ts) */
export const GROUP_MAX_GROUPS = 20;

/**
 * The groups in an address: "1-3-3-20" a group — business type, plan, rider (0 = none), head count — joined by "_".
 * Read back only whole: one group that is not the page's own and none are read (the form starts on its own).
 */
export const writeGroups = (groups: GroupPick[]): string =>
  groups.map((g) => `${GROUP_BIZ.indexOf(g.biz) + 1}-${g.plan}-${g.rider ?? 0}-${g.count}`).join("_");

export function readGroups(v: string | undefined): GroupPick[] | undefined {
  if (!v) return undefined;
  const parts = v.split("_");
  if (parts.length > GROUP_MAX_GROUPS) return undefined;
  const out: GroupPick[] = [];
  for (const part of parts) {
    const m = /^([1-3])-([1-6])-([0-6])-(\d{1,4})$/.exec(part);
    if (!m) return undefined;
    const count = Number(m[4]);
    if (count < 1) return undefined;
    out.push({ biz: GROUP_BIZ[Number(m[1]) - 1], plan: Number(m[2]), ...(m[3] !== "0" ? { rider: Number(m[3]) } : {}), count });
  }
  return out;
}
