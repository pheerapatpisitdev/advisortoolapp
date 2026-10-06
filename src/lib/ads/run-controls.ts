import { graph } from "./graph";
import { maxDailyBudgetThb } from "./launch-limits";
import { RUN_CLAIM_STALE_MS } from "./run";
import type { AdRun, RunPatch } from "./run-store";

/**
 * ผลแอด's buttons (spec 2026-10-07). A run is one post's ad set, so หยุด / เปิดต่อ / เพิ่มงบ /
 * ยืดเวลา act on that ad set alone. Any other ad (built in Ads Manager, or from an old send whose
 * ad set holds several ads) can only be paused or switched on by itself (setAdStatus): its budget
 * is shared or set on its campaign. Each change is recorded only once Meta says success.
 */

export type Control = "pause" | "resume" | "raise" | "extend";
export const RAISE_FACTOR = 1.5;
export const EXTEND_DAYS = 7;

export type ControlResult = { ok: true; run: AdRun } | { ok: false; error: string };

const NOT_FOUND = "ไม่พบรายการยิงนี้";
const NO_TOKEN = "ยังไม่ได้เชื่อมบัญชีโฆษณาสำหรับสร้างแอด กดเชื่อมบัญชีก่อน";
const NO_ADSET = "ชุดโฆษณายังสร้างไม่เสร็จ";
const ENDED = "แอดนี้จบแล้ว กดยืดเวลาก่อน";
const AT_CAP = "งบถึงเพดานแล้ว";
const BUSY = "กำลังเปลี่ยนแอดนี้อยู่ รอสักครู่แล้วลองใหม่";
const UNCONFIRMED = "Facebook ไม่ยืนยันการเปลี่ยนแปลง";
const BAD_ID = "ไอดีแอดไม่ถูกต้อง";

/** A Meta id used as a Graph path: a stray "/" or "?" would reach a different endpoint. */
const pathSafe = (id: string | null): id is string => !!id && /^\w+$/.test(id);

/** Half as much again, rounded up to whole baht, never over the cap. */
export function raisedBudgetMinor(currentMinor: number, capBaht: number): number {
  return Math.min(Math.ceil((currentMinor / 100) * RAISE_FACTOR), capBaht) * 100;
}

/** Seven days more, from the end, or from now once the end has passed. */
export function extendedEnd(endAt: string, now: Date): string {
  return new Date(Math.max(Date.parse(endAt), now.getTime()) + EXTEND_DAYS * 86_400_000).toISOString();
}

/** POSTs one change and checks Meta said success. */
async function post(fetchFn: typeof fetch, token: string, id: string, params: Record<string, string>): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await graph(fetchFn, token, id, params);
  if (!r.ok) return r;
  return r.body.success === true ? { ok: true } : { ok: false, error: UNCONFIRMED };
}

export async function controlRun(runId: string, control: Control, deps: {
  store: typeof import("./run-store");
  token(actId: string): Promise<string | null>;
  fetchFn?: typeof fetch;
  now?: () => Date;
  capBaht?: number;
}): Promise<ControlResult> {
  const { store } = deps;
  const fetchFn = deps.fetchFn ?? fetch;
  const now = (deps.now ?? (() => new Date()))();
  const cap = deps.capBaht ?? maxDailyBudgetThb();

  /** what the press would change, or why it may not */
  const plan = (run: AdRun | null): { error: string } | { params: Record<string, string>; patch: RunPatch } => {
    if (!run) return { error: NOT_FOUND };
    if (!pathSafe(run.adsetId)) return { error: NO_ADSET };
    switch (control) {
      case "pause":
        return { params: { status: "PAUSED" }, patch: { pausedAt: now.toISOString() } };
      case "resume":
        if (Date.parse(run.endAt) <= now.getTime()) return { error: ENDED };
        return { params: { status: "ACTIVE" }, patch: { pausedAt: null } };
      case "raise": {
        if (run.dailyBudgetMinor >= cap * 100) return { error: AT_CAP };
        const minor = raisedBudgetMinor(run.dailyBudgetMinor, cap);
        return { params: { daily_budget: String(minor) }, patch: { dailyBudgetMinor: minor } };
      }
      case "extend": {
        const end = extendedEnd(run.endAt, now);
        return { params: { end_time: end }, patch: { endAt: end } };
      }
    }
  };

  const first = await store.getRun(runId);
  const checked = plan(first);
  if ("error" in checked) return { ok: false, error: checked.error };
  const token = await deps.token(first!.actId);
  if (!token) return { ok: false, error: NO_TOKEN };

  if (!(await store.claimRun(runId, RUN_CLAIM_STALE_MS, now))) return { ok: false, error: BUSY };
  try {
    // re-read under the claim: another press may have changed the run meanwhile
    const run = await store.getRun(runId);
    const change = plan(run);
    if ("error" in change) return { ok: false, error: change.error };
    const r = await post(fetchFn, token, run!.adsetId!, change.params);
    if (!r.ok) return r;
    await store.saveRun(runId, change.patch);
    return { ok: true, run: { ...run!, ...change.patch } };
  } finally {
    await store.releaseRun(runId);
  }
}

/** Pauses or switches on one ad by itself. */
export async function setAdStatus(adId: string, status: "PAUSED" | "ACTIVE", token: string, fetchFn: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pathSafe(adId)) return { ok: false, error: BAD_ID };
  return post(fetchFn, token, adId, { status });
}
