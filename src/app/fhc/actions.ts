"use server";
import { headers } from "next/headers";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import {
  cleanFhc, events, figures, scores, scoresAfter, toPlanInput, type EventRow, type FhcFigures, type Score,
} from "@/lib/fhc/health";
import { explainHealth, fallbackSummary, type FhcSummary } from "@/lib/fhc/summary";
import { logRun } from "@/lib/plan/log";
import { FIXED_PICK, isOrder, pickOrder } from "@/lib/plan/order";
import { explain, FALLBACK_PROSE, type Prose } from "@/lib/plan/prose";
import { realPricer } from "@/lib/plan/pricer";
import { recommend, type PlanResult } from "@/lib/plan/recommend";

/**
 * The check's two calls: the figures first (the model picks the plan's order, 8 s at
 * most), then the words — the check's summary and the plan's folded advice, side by side.
 * Both recompute from the form; only the order comes back from the browser, checked.
 */

const allowRun = limiter(20, 60_000);
const allowExplain = limiter(6, 60_000);

export type FhcReply =
  | { ok: true; figures: FhcFigures; scores: Score[]; after: Score[]; events: EventRow[]; plan: PlanResult }
  | { ok: false; error: string };

export async function runFhc(raw: unknown): Promise<FhcReply> {
  const f = cleanFhc(raw);
  if (typeof f === "string") return { ok: false, error: f };
  if (!allowRun(clientIp(await headers()))) return { ok: false, error: "กดถี่เกินไป รอสักครู่แล้วลองใหม่นะครับ" };
  const p = toPlanInput(f);
  const plan = recommend(p, realPricer(p.age, p.sex), await pickOrder(p));
  const sc = scores(f);
  await logRun({ ...p, from: "fhc", fhc: f }, { ...plan, scores: sc });
  return { ok: true, figures: figures(f), scores: sc, after: scoresAfter(f, plan), events: events(f, sc, plan), plan };
}

export interface FhcWords {
  summary: FhcSummary;
  prose: Prose;
}

/** `order` is the one runFhc used, so the words follow the same plan */
export async function explainFhc(raw: unknown, order?: unknown): Promise<FhcWords | null> {
  const f = cleanFhc(raw);
  if (typeof f === "string") return null;
  const p = toPlanInput(f);
  const plan = recommend(p, realPricer(p.age, p.sex), isOrder(order) ? { ...FIXED_PICK, order } : FIXED_PICK);
  if (!allowExplain(clientIp(await headers()))) {
    return { summary: fallbackSummary(scores(f), plan.order[0]), prose: FALLBACK_PROSE };
  }
  const [summary, prose] = await Promise.all([explainHealth(f, plan), explain(p, plan)]);
  return { summary, prose };
}
