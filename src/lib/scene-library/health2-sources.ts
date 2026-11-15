import { iHealthyFacts, isHeading } from "@/lib/ihealthy-facts";
import { PA_FAMILIES, PA_WEEKLY_MAX_WEEKS } from "@/lib/pa-plans";
import premiums from "../../../data/group-insurance/premiums.json";
import network from "../../../data/hospitals/ktaxa-network.json";
import type { Health2Fixed } from "./health2-fixed";
import { HEALTH_PARENTS_CAP } from "./tax-th";

/**
 * The real files behind round 5's eight health devices (spec 2026-11-15-devices-health2-design.md): the iHealthy Ultra sheet,
 * the group premium table, the PA plans, the hospital list and the tax table. SERVER and Remotion side only (the story topic,
 * the drawers' inputs, the tests): it imports the 537-hospital list and the sheet, which the browser bundle must not carry.
 * What checkDevice needs in the browser is health2-fixed.ts, a snapshot that tests/scene-library/health2-sources.test.ts holds
 * equal to what this module reads.
 */

/** what the sheet says of OPD for one plan: baht a year, "none" where it prints "-", "actual" where it prints "ตามที่จ่ายจริง" */
export type OpdFigure = number | "none" | "actual";

const sheetRow = (no: number) => {
  const row = iHealthyFacts().rows.find((r) => !isHeading(r) && r.no === no);
  if (!row || isHeading(row)) throw new Error(`ihealthy-ultra.json: no row ${no}`);
  return row;
};

/** a sheet cell as a figure: a number ("6000", "1,500 ต่อวัน"), "-" as none, "ตามที่จ่ายจริง" as actual */
function opdCell(text: string): OpdFigure {
  const t = text.trim();
  if (t === "-") return "none";
  if (t === "ตามที่จ่ายจริง") return "actual";
  const n = Number(t.match(/[\d,]+/)?.[0].replace(/,/g, ""));
  if (!Number.isFinite(n)) throw new Error(`ihealthy-ultra.json: an OPD cell "${text}" is no figure`);
  return n;
}

/** a plan's ค่าห้องต่อวัน (row 1), baht */
export function roomOf(plan: string): number {
  const text = sheetRow(1).adult[plan];
  const n = Number(text?.match(/[\d,]+/)?.[0].replace(/,/g, ""));
  if (!Number.isFinite(n)) throw new Error(`ihealthy-ultra.json: no room figure for ${plan}`);
  return n;
}

/** a plan's yearly OPD limit: rows 18 and 19 share one limit, so a sheet where they differ is an error, not a guess */
export function opdOf(plan: string): OpdFigure {
  const a = opdCell(sheetRow(18).adult[plan] ?? "");
  const b = opdCell(sheetRow(19).adult[plan] ?? "");
  if (a !== b) throw new Error(`ihealthy-ultra.json: rows 18 and 19 differ for ${plan}`);
  return a;
}

/** the hospital list's own counts: the network's total, each province's count (most first), and the date it was fetched */
export function hospitalCounts(): { total: number; fetchedAt: string; counts: Record<string, number>; ranked: { province: string; count: number }[] } {
  const counts: Record<string, number> = {};
  for (const h of network.hospitals) counts[h.province] = (counts[h.province] ?? 0) + 1;
  const ranked = Object.entries(counts).map(([province, count]) => ({ province, count })).sort((a, b) => b.count - a.count || a.province.localeCompare(b.province, "th"));
  return { total: network.hospitals.length, fetchedAt: network.fetchedAt, counts, ranked };
}

/** a group IPD premium: baht a person a year, for a risk class, a head-count band and a plan (0-5) */
export function groupPremium(biz: "biz1" | "biz2" | "biz3", band: "10-25" | "26-50" | "51-100", planIndex: number): number {
  const n = premiums.healthIpdPremiums[biz][band][planIndex];
  if (typeof n !== "number") throw new Error(`premiums.json: no healthIpdPremiums ${biz} ${band} ${planIndex}`);
  return n;
}

const uniq = (xs: (number | undefined)[]): number[] => [...new Set(xs.filter((x): x is number => x !== undefined))].sort((a, b) => a - b);

/** every fixed-source figure, read from the real files: the same shape as the browser snapshot (health2-fixed.ts) */
export function health2Sources(): Health2Fixed {
  const facts = iHealthyFacts();
  const codes = facts.plans.map((p) => p.code);
  const h = hospitalCounts();
  const plans = PA_FAMILIES.flatMap((f) => f.plans);
  return {
    ipdopd: {
      room: uniq(codes.map(roomOf)),
      opd: uniq(codes.map(opdOf).map((x) => (typeof x === "number" ? x : undefined))),
    },
    deductible: uniq(facts.plans.map((p) => p.deductible)),
    copayPercent: facts.copayPercent,
    renewalToAge: facts.terms.renewalToAge,
    parentsCap: HEALTH_PARENTS_CAP,
    groupPerYear: uniq(Object.values(premiums.healthIpdPremiums).flatMap((bands) => Object.values(bands).flat())),
    pa: { medical: uniq(plans.map((p) => p.medical)), weekly: uniq(plans.map((p) => p.weekly)), weeks: PA_WEEKLY_MAX_WEEKS },
    hospitals: { total: h.total, fetchedAt: h.fetchedAt, counts: h.counts },
  };
}
