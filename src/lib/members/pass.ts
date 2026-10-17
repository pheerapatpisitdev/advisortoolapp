// The monthly pass for outside members (owner, 2026-10-13). Browser-safe: no server imports.
// The ledger (ins_member_passes) only appends; the live end date is derived here, never stored.

/** referral: free days for a friend who paid (src/lib/referrals, owner 2026-10-14) */
export type PassKind = "trial" | "paid" | "granted" | "referral" | "revoked";

export interface PassRow {
  id: number;
  kind: PassKind;
  days: number;
  /** For a revoked row: the id of the row it cancels. */
  revokes: number | null;
  createdAt: string;
  amountSatang: number | null;
  note: string | null;
}

export interface Period {
  rowId: number;
  kind: "trial" | "paid" | "granted" | "referral";
  start: Date;
  end: Date;
}

/** `end` of a live pass is the last period's end, renewals stacked on it included. */
export type PassState =
  | { status: "live"; period: Period; end: Date }
  | { status: "expired"; end: Date }
  | { status: "none" };

export interface PassSettings {
  enabled: boolean;
  satang: number;
  trialDays: number;
  /** Studio credit the trial carries (owner, 2026-10-17: ฿15) */
  trialCreditSatang: number;
  /** Studio credit every paid 30 days carries (owner, 2026-10-17: ฿50); it replaced the free rounds and clips */
  creditSatang: number;
}

export const DAY_MS = 86_400_000;
export const PASS_DAYS = 30;
export const REMIND_DAYS = 3;
export const PASS_PAGE = "/membership";

// Off until the owner turns it on, so a deploy changes nothing by itself.
export const DEFAULT_PASS_SETTINGS: PassSettings = {
  enabled: false,
  satang: 9900,
  trialDays: 3,
  trialCreditSatang: 1500,
  creditSatang: 5000,
};

/**
 * Positive rows not cancelled by a revoked row, oldest first, each placed right after the
 * previous one (or on its own day if the pass had lapsed). A cancelled pass drops out and
 * later periods move up.
 */
export function passPeriods(rows: PassRow[]): Period[] {
  const cancelled = new Set<number>();
  for (const r of rows) if (r.kind === "revoked" && r.revokes != null) cancelled.add(r.revokes);

  const live = rows
    .filter((r) => r.kind !== "revoked" && !cancelled.has(r.id))
    .sort((a, b) => {
      const d = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return d !== 0 ? d : a.id - b.id;
    });

  const periods: Period[] = [];
  let prevEnd = 0;
  for (const r of live) {
    const start = new Date(Math.max(prevEnd, new Date(r.createdAt).getTime()));
    const end = new Date(start.getTime() + r.days * DAY_MS);
    periods.push({ rowId: r.id, kind: r.kind as Period["kind"], start, end });
    prevEnd = end.getTime();
  }
  return periods;
}

export function passState(rows: PassRow[], now: Date): PassState {
  if (rows.length === 0) return { status: "none" };
  const periods = passPeriods(rows);
  if (periods.length === 0) return { status: "none" };

  const t = now.getTime();
  const last = periods[periods.length - 1];
  const current = periods.find((p) => p.start.getTime() <= t && t < p.end.getTime());
  if (current) return { status: "live", period: current, end: last.end };

  const ended = periods.filter((p) => p.end.getTime() <= t);
  return { status: "expired", end: (ended[ended.length - 1] ?? last).end };
}

/**
 * On the free trial right now: live in a trial period that is also the pass's last. A member who
 * paid during the trial has a paid month stacked after it and counts as paid (review, 2026-10-13).
 */
export function onTrial(state: PassState): boolean {
  return state.status === "live" && state.period.kind === "trial"
    && state.period.end.getTime() === state.end.getTime();
}

export function daysLeft(end: Date, now: Date): number {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}

/**
 * The free rounds a live pass carries: none since the credit took their place (owner,
 * 2026-10-17) — a member's rounds are paid from the pass's credit, then their own money.
 * null means no pass allowance: callers fall back to the one-time 10 (the switch is off).
 */
export function roundsFrom(
  state: PassState,
  settings: PassSettings,
): { limit: number; from: Date } | null {
  if (!settings.enabled || state.status !== "live") return null;
  return { limit: 0, from: state.period.start };
}

/** The free วิดีโอนำเสนอ clips a live pass carries: none, as roundsFrom. null: the one-time two. */
export function videosFrom(
  state: PassState,
  settings: PassSettings,
): { limit: number; from: Date } | null {
  if (!settings.enabled || state.status !== "live") return null;
  return { limit: 0, from: state.period.start };
}

/** One lot of Studio credit as the pass ledger says it should be (src/lib/members/credit.ts). */
export interface CreditLot {
  passId: number;
  satang: number;
  /** spendable from the moment it was earned: a renewal's ฿50 is usable at once */
  startsAt: Date;
  /** the end of the period its row bought */
  expiresAt: Date;
}

/**
 * The lots a member's ledger earns that are not over yet: one per trial or paid row whose
 * period ends after `now` — granted and referral days carry no credit (owner, 2026-10-17).
 * `voids`: the paid rows a refund or dispute cancelled, whose lot is taken away.
 */
export function creditLots(rows: PassRow[], settings: PassSettings, now: Date): { lots: CreditLot[]; voids: number[] } {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const lots: CreditLot[] = [];
  for (const p of passPeriods(rows)) {
    if (p.kind !== "trial" && p.kind !== "paid") continue;
    if (p.end.getTime() <= now.getTime()) continue;
    const satang = p.kind === "trial" ? settings.trialCreditSatang : settings.creditSatang;
    if (!(satang > 0)) continue;
    const row = byId.get(p.rowId);
    lots.push({ passId: p.rowId, satang, startsAt: new Date(row?.createdAt ?? p.start), expiresAt: p.end });
  }
  const voids = rows.filter((r) => r.kind === "revoked" && r.revokes != null).map((r) => r.revokes as number);
  return { lots, voids };
}
