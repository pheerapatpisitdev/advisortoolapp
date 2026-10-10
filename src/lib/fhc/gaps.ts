import type { AreaKey, PlanResult } from "@/lib/plan/recommend";

/**
 * Where a customer stands on the four covers, read off the plan the check already built — no
 * figure here is new. "covered" is the plan's own word for a need already met; of the rest, a
 * customer holding none is missing it and one holding some is short of it.
 */

export type GapState = "missing" | "short" | "ok";

export interface Gap {
  key: AreaKey;
  state: GapState;
  unit: "sum" | "room" | "pension";
  have: number;
  should: number;
  /** what the plan offered, if anything: the product's name and satang a year */
  product?: string;
  annual?: number;
}

export const AREA_LABEL: Record<AreaKey, string> = {
  life: "ชีวิต", health: "สุขภาพ", ci: "โรคร้ายแรง", retire: "เกษียณ",
};
export const GAP_WORD: Record<GapState, string> = { missing: "ขาด", short: "ไม่พอ", ok: "พอแล้ว" };

/** One entry per area, in the fixed order life, health, critical illness, retirement. */
export function gapsOf(plan: PlanResult): Gap[] {
  const order: AreaKey[] = ["life", "health", "ci", "retire"];
  return order.flatMap((key): Gap[] => {
    const a = plan.areas.find((x) => x.key === key);
    if (!a) return [];
    const state: GapState = a.status === "covered" ? "ok" : a.have > 0 ? "short" : "missing";
    return [{
      key, state, unit: a.unit, have: a.have, should: a.should,
      ...(a.offer && state !== "ok" ? { product: a.offer.product, annual: a.offer.annual } : {}),
    }];
  });
}

/** The area to open with: the plan's own first choice among those not yet covered. */
export function firstGap(plan: PlanResult, gaps: Gap[]): AreaKey | null {
  const open = new Set(gaps.filter((g) => g.state !== "ok").map((g) => g.key));
  return plan.order.find((k) => open.has(k)) ?? null;
}

export function isGap(v: unknown): v is Gap[] {
  return Array.isArray(v) && v.every((g) => g && typeof g === "object" && "key" in g && "state" in g);
}
