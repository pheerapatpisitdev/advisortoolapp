/**
 * The iHealthy Ultra page's arrangement, carried into วิดีโอนำเสนอ (owner, 2026-10-14, mockup ก):
 * the base plan, its sum, the territory, the coverage and the fold's riders, written the way the
 * page's own address writes them (ihealthy-link.ts queryFrom). Without it a clip priced the
 * page's defaults, and an agent who had taken the daily cash off saw a dearer premium in the clip
 * than on the page.
 *
 * Only these keys are kept: age, sex and plan are the form's own, and nothing here is trusted —
 * the card walks whatever is left to an arrangement the company sells, and prices it itself.
 */

const KEYS = ["base", "sa", "area", "cover"] as const;
const MAX_RIDERS = 12;
const MAX_VALUE = 60;
const MAX_LENGTH = 800;

/** the page's query string cut down to the arrangement; undefined when nothing usable is left */
export function cleanSetup(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return undefined;
  let from: URLSearchParams;
  try {
    from = new URLSearchParams(raw);
  } catch {
    return undefined;
  }
  const out = new URLSearchParams();
  for (const k of KEYS) {
    const v = from.get(k);
    if (v !== null && v.length <= MAX_VALUE) out.set(k, v);
  }
  // an `r` present but empty is the fold emptied, which prices differently from no `r` at all
  if (from.has("r")) {
    const riders = from.getAll("r").filter((r) => r.length > 0 && r.length <= MAX_VALUE).slice(0, MAX_RIDERS);
    if (riders.length === 0) out.append("r", "");
    else for (const r of riders) out.append("r", r);
  }
  const s = out.toString();
  return s.length > 0 ? s : undefined;
}

/** the card's query for a clip: the page's arrangement under the form's age, sex and plan */
export function setupQuery(v: { age: number; sex: "M" | "F"; plan?: string; setup?: string }): URLSearchParams {
  const q = new URLSearchParams(cleanSetup(v.setup) ?? "");
  q.set("age", String(v.age));
  q.set("sex", v.sex);
  if (v.plan) q.set("plan", v.plan);
  return q;
}
