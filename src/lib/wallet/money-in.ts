/**
 * ประวัติเติมเงิน (owner, 2026-10-19, option ข; mockup https://claude.ai/artifact/NP3Zjuq9UjJ4BhUQwfFMHB):
 * who put money into the system, day by day, and back as far as the owner looks. Four kinds:
 * a wallet top-up, a member's pass, the owner's own adjustment, and money that went back (a
 * wallet clawback after a refund or a dispute, or a refunded pass). The sum counts what people
 * paid less what went back; the owner's adjustments are listed but not counted, since no money
 * came in with them. Days are Bangkok days. The reads are in money-in-read.ts.
 */

export type MoneyKind = "topup" | "pass" | "adjust" | "refund";

export const KIND_LABEL: Record<MoneyKind, string> = {
  topup: "เติมกระเป๋า",
  pass: "ค่าสมาชิก",
  adjust: "เจ้าของปรับยอด",
  refund: "คืนเงิน",
};

export interface MoneyRow {
  /** "w:<entry id>" or "p:<pass id>" */
  id: string;
  at: string;
  /** the wallet's agent id, or the member's id for a pass */
  who: string;
  kind: MoneyKind;
  /** signed: a refund is below zero */
  satang: number;
  /** the wallet's own money right after this line; null for a pass, which is not wallet money */
  afterSatang: number | null;
}

export interface Person { name: string; code: string; tenant: string | null; unit: string | null; isMember: boolean }

const TZ = "Asia/Bangkok";
const DAY = 86_400_000;

/** the Bangkok day of an instant, "2026-10-19" */
export const bkkDay = (at: string | Date) => new Date(at).toLocaleDateString("en-CA", { timeZone: TZ });

/** the Bangkok time of an instant, "21:08" */
export const bkkTime = (at: string | Date) =>
  new Date(at).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

const dayStart = (day: string) => new Date(`${day}T00:00:00+07:00`);
export const addDays = (day: string, n: number) => bkkDay(new Date(dayStart(day).getTime() + n * DAY + 12 * 3_600_000));

export type Chip = "today" | "7d" | "30d" | "90d";
export const CHIP_DAYS: Record<Chip, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };

export interface Range {
  /** inclusive Bangkok days */
  fromDay: string;
  toDay: string;
  /** the chip that made it, or null for one day picked by date */
  chip: Chip | null;
}

/** ?p=today|7d|30d|90d, or ?d=2026-10-15 for one day; today when neither is good */
export function parseRange(p: unknown, d: unknown, now: Date): Range {
  const today = bkkDay(now);
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today && bkkDay(dayStart(d)) === d) {
    return { fromDay: d, toDay: d, chip: null };
  }
  const chip: Chip = p === "7d" || p === "30d" || p === "90d" ? p : "today";
  return { fromDay: addDays(today, -(CHIP_DAYS[chip] - 1)), toDay: today, chip };
}

/** [from, to) instants of a range */
export const rangeBounds = (r: Range): [Date, Date] => [dayStart(r.fromDay), dayStart(addDays(r.toDay, 1))];

export function parseKind(v: unknown): MoneyKind | null {
  return v === "topup" || v === "pass" || v === "adjust" || v === "refund" ? v : null;
}

/**
 * The wallet's own money after each line, by adding up every line of the agent's wallet from
 * its first. A hold takes money out before its charge is written, so the balance column of
 * ins_wallets is not used: the lines alone add up to the balance once the holds are settled.
 */
export function balancesAfter(entries: { id: string; who: string; at: string; satang: number }[]): Map<string, number> {
  const sorted = [...entries].sort((a, b) => a.who.localeCompare(b.who) || a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const out = new Map<string, number>();
  let who = "", run = 0;
  for (const e of sorted) {
    if (e.who !== who) { who = e.who; run = 0; }
    run += e.satang;
    out.set(e.id, run);
  }
  return out;
}

/** each person's first money in ever (a top-up or a pass), as the row id */
export function firstPaid(rows: { id: string; who: string; at: string; kind: MoneyKind }[]): Set<string> {
  const first = new Map<string, { id: string; at: string }>();
  for (const r of rows) {
    if (r.kind !== "topup" && r.kind !== "pass") continue;
    const had = first.get(r.who);
    if (!had || r.at < had.at || (r.at === had.at && r.id < had.id)) first.set(r.who, { id: r.id, at: r.at });
  }
  return new Set([...first.values()].map((f) => f.id));
}

export interface Summary {
  /** what was paid less what went back; with only the owner's adjustments shown, their sum */
  satang: number;
  /** top-ups and passes */
  count: number;
  people: number;
  firstTimers: number;
}

export function summarize(rows: MoneyRow[], first: Set<string>, only: MoneyKind | null): Summary {
  const paid = rows.filter((r) => r.kind === "topup" || r.kind === "pass");
  const counted = only === "adjust" ? rows : rows.filter((r) => r.kind !== "adjust");
  return {
    satang: counted.reduce((n, r) => n + r.satang, 0),
    count: paid.length,
    people: new Set(paid.map((r) => r.who)).size,
    firstTimers: paid.filter((r) => first.has(r.id)).length,
  };
}

/** the rows of a range, newest day first and newest line first in a day */
export function byDay(rows: MoneyRow[]): { day: string; rows: MoneyRow[] }[] {
  const days = new Map<string, MoneyRow[]>();
  for (const r of [...rows].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))) {
    const d = bkkDay(r.at);
    (days.get(d) ?? days.set(d, []).get(d)!).push(r);
  }
  return [...days.entries()].map(([day, rs]) => ({ day, rows: rs }));
}

/** what was paid each day (top-ups and passes), for the bars; every day of `days` is there */
export function paidPerDay(rows: MoneyRow[], days: string[]): number[] {
  const per = new Map<string, number>();
  for (const r of rows) if (r.kind === "topup" || r.kind === "pass") per.set(bkkDay(r.at), (per.get(bkkDay(r.at)) ?? 0) + r.satang);
  return days.map((d) => per.get(d) ?? 0);
}

export function matches(p: Person | undefined, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return !!p && (p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s));
}

const TH_DAY = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "19 ต.ค. 2569" */
export function shortDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${TH_MONTH[m - 1]} ${y + 543}`;
}

/** "วันนี้ · วันจันทร์ที่ 19 ต.ค. 2569" */
export function dayLabel(day: string, now: Date): string {
  const today = bkkDay(now);
  const rel = day === today ? "วันนี้ · " : day === addDays(today, -1) ? "เมื่อวาน · " : "";
  const [y, m, d] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${rel}วัน${TH_DAY[weekday]}ที่ ${shortDay(day)}`;
}
