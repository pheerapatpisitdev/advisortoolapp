import type { Area, AreaKey, PlanResult } from "@/lib/plan/recommend";
import { scores, type FhcInput, type Level, type Score, type ScoreKey } from "./health";

/**
 * The six scores as they would stand once the customer takes the plan offered (owner,
 * 2026-10-22, mockup J1QgqER7XRAXde4AyTeEkr ก). The same scoring, with what the plan buys
 * added to what the customer holds and its premiums taken from what is left each month.
 * Only offers the plan pays for count — a "short" offer is shown on the card but not bought.
 * Pure, so the page, the saved customer and the LINE message all read the same figures.
 */

export interface AfterScore {
  key: ScoreKey;
  level: Level;
  shown: string;
  /** level and words both unchanged: the page says เท่าเดิม */
  same: boolean;
  /** why it moved, or why it stopped short */
  note?: string;
}

export interface AfterPlan {
  /** satang a year the plan spends, as the plan card counts it */
  annual: number;
  scores: AfterScore[];
}

const bought = (a: Area | undefined) => (a?.offer && (a.status === "fits" || a.status === "reduced") ? a.offer : undefined);

/** Why an area the plan did not fill stays short, in the plan card's own words. */
function shortBy(a: Area | undefined): string | undefined {
  if (!a || a.status === "covered" || a.status === "fits") return undefined;
  if (a.status === "unavailable") return "อายุนี้แบบที่มีรับไม่ได้";
  if (a.status === "reduced") return "งบไม่พอถึง 100%";
  return a.offer ? "งบไม่พอ" : "งบหมดที่ด้านก่อนหน้า";
}

/** The customer's form with what the plan buys added; null when it buys nothing. */
export function withPlan(f: FhcInput, plan: PlanResult): FhcInput | null {
  const area = (k: AreaKey) => plan.areas.find((a) => a.key === k);
  const [life, health, ci, retire] = (["life", "health", "ci", "retire"] as const).map((k) => bought(area(k)));
  if (!life && !health && !ci && !retire) return null;
  const room = f.healthNow === "private" ? f.healthRoom : 0;
  return {
    ...f,
    lifeCover: f.lifeCover + (life?.cover ?? 0),
    ciCover: f.ciCover + (ci?.cover ?? 0),
    ...(health ? { healthNow: "private" as const, healthRoom: Math.max(room, health.cover) } : {}),
    pensionHave: f.pensionHave + (retire?.cover ?? 0),
  };
}

export function afterPlan(f: FhcInput, plan: PlanResult, now: Score[] = scores(f)): AfterPlan | null {
  const g = withPlan(f, plan);
  if (!g || plan.usedAnnual <= 0) return null;
  const area = (k: AreaKey) => plan.areas.find((a) => a.key === k);
  const after = scores(g, Math.round(plan.usedAnnual / 100 / 12));
  return {
    annual: plan.usedAnnual,
    scores: after.map((s): AfterScore => {
      const was = now.find((x) => x.key === s.key);
      const same = !!was && was.level === s.level && was.shown === s.shown;
      const note = s.key === "emergency" ? "ประกันไม่ได้ช่วยด้านนี้"
        : s.key === "saving" ? "หักเบี้ยใหม่แล้ว"
          : s.level === "green" ? undefined
            : s.key === "life" ? shortBy(area("life"))
              : s.key === "retire" ? shortBy(area("retire"))
                : s.key === "healthCi" ? shortBy(area("health")) ?? shortBy(area("ci"))
                  : undefined;
      return { key: s.key, level: s.level, shown: s.shown, same, ...(note ? { note } : {}) };
    }),
  };
}

/** How many scores sit at each colour, for the count line and the LINE message. */
export function tally(levels: { level: Level }[]): Record<"green" | "yellow" | "red", number> {
  const n = (l: Level) => levels.filter((x) => x.level === l).length;
  return { green: n("green"), yellow: n("yellow"), red: n("red") };
}
