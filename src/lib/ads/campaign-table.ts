import { costPer, type AdResult } from "./results";
import { campaignState, onBudget, totals } from "./manager-view";
import { activateQuestion, pauseQuestion, switchedOn } from "./sent-view";

/**
 * The แคมเปญ tab's table (Ads Studio desktop, 2026-10-05), kept free of React so a test can pin
 * it: what each row and the totals row say, and what its เปิด/หยุด switch would do and ask.
 * Figures are th-TH; money is baht with ฿; anything without data is "—", never 0.
 */

/** One send of a campaign as the table needs it: whether it is on, what it spends, and where. */
export interface RowSend {
  id: string;
  activatedAt: string | null;
  pausedAt: string | null;
  /** satang a day, as the send keeps it */
  dailyBudgetMinor: number;
  /** the ad account as the owner reads it: name (act_…) */
  accountName: string;
  /** how many of its ads were made on Meta */
  ads: number;
}

/** One campaign of the table; `sends` are its live (not superseded) ones, newest first. */
export interface CampaignRow {
  id: string;
  name: string;
  planName: string;
  drafts: number;
  sent: number;
  sends: RowSend[];
}

export const DASH = "—";

const num = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
export const money = (n: number) => `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface ResultCells {
  spend: string;
  impressions: string;
  clicks: string;
  messaging: string;
  /** baht per conversation started */
  perChat: string;
}

/** A result's cells; every one "—" when there is no result. */
export function resultCells(r: AdResult | null | undefined): ResultCells {
  if (!r) return { spend: DASH, impressions: DASH, clicks: DASH, messaging: DASH, perChat: DASH };
  const per = costPer(r.spend, r.messaging);
  return { spend: money(r.spend), impressions: num(r.impressions), clicks: num(r.clicks), messaging: num(r.messaging), perChat: per === null ? DASH : money(per) };
}

export interface TableLine {
  state: "on" | "paused" | "draft";
  /** the daily budget now running, or "—" */
  budget: string;
  cells: ResultCells;
}

export function tableLine(row: CampaignRow, result: AdResult | null | undefined): TableLine {
  const budget = onBudget(row.sends);
  return { state: campaignState(row.sends), budget: budget === null ? DASH : money(budget), cells: resultCells(result) };
}

/** The foot: counts and running budgets added; results added over the campaigns that have any, "—" when none has. */
export function footLine(rows: CampaignRow[], results: Record<string, AdResult>): { drafts: number; sent: number; budget: string; cells: ResultCells } {
  const had = rows.flatMap((r) => (results[r.id] ? [results[r.id]] : []));
  const budgets = rows.map((r) => onBudget(r.sends)).filter((b): b is number => b !== null);
  return {
    drafts: rows.reduce((n, r) => n + r.drafts, 0),
    sent: rows.reduce((n, r) => n + r.sent, 0),
    budget: budgets.length === 0 ? DASH : money(budgets.reduce((a, b) => a + b, 0)),
    cells: resultCells(had.length === 0 ? null : totals(had)),
  };
}

/**
 * What the row's switch does: off pauses every send that is on; on switches on the newest send;
 * null when the campaign has no send (the switch is shut).
 */
export function switchPlan(sends: RowSend[]): { kind: "pause"; sends: RowSend[] } | { kind: "activate"; send: RowSend } | null {
  if (sends.length === 0) return null;
  const on = sends.filter(switchedOn);
  return on.length > 0 ? { kind: "pause", sends: on } : { kind: "activate", send: sends[0] };
}

/** The one question before the switch, in the sent tab's words (pauseQuestion / activateQuestion). */
export function switchQuestion(
  plan: NonNullable<ReturnType<typeof switchPlan>>,
  o: { campaign: string; page: string },
): string {
  if (plan.kind === "activate") {
    const s = plan.send;
    return activateQuestion({ what: `เปิดใช้ทั้งชุด (${s.ads} แอด) ของแคมเปญ "${o.campaign}"`, account: s.accountName, page: o.page, dailyBudgetBaht: s.dailyBudgetMinor / 100 });
  }
  const accounts = [...new Set(plan.sends.map((s) => s.accountName))].join(", ");
  return pauseQuestion({
    what: `หยุดแคมเปญ "${o.campaign}" (${plan.sends.length} ชุดที่เปิดอยู่)`,
    account: accounts,
    page: o.page,
    dailyBudgetBaht: plan.sends.reduce((n, s) => n + s.dailyBudgetMinor, 0) / 100,
  });
}
