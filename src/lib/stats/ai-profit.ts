import { RESERVATION_MODEL } from "@/lib/ai/ledger";
import { ROUND_NAMES } from "@/lib/wallet/labels";

/**
 * กำไรค่า AI (owner, 2026-10-15; mockup https://claude.ai/artifact/AtZX1kdb8bWBLLtBSEGUZc,
 * option ก): what the AI cost us against what people paid for it, and the difference.
 *
 * Cost is the ledger's own figure: tokens × the model's list price × 36 baht to the dollar —
 * the system's estimate of the AI companies' bills, never the bills themselves (the owner
 * chose not to type those in). A line with a person on it is work someone asked for; a line
 * with nobody is the customer bots and the system's own jobs, which nobody pays for.
 *
 * Revenue is what was taken from wallets as rounds were delivered (`charge` entries), plus the
 * members' passes sold. A top-up is not revenue until it is spent: until then it is the
 * person's money, and a refund gives it back.
 *
 * Money in (owner chose ก, 2026-10-15) is the other way of looking: what customers actually
 * transferred — top-ups and passes — less what went back to them, set against the same cost.
 * Both lines show, because money still in a wallet is AI work still owed.
 */

export interface ProfitInput {
  ledger: { model: string | null; agentId: string | null; thb: number }[];
  providerOf: (model: string | null) => string;
  /** `charge` entries of the wallets: negative satang, by the round they paid for */
  charges: { round: string | null; satang: number }[];
  /** passes sold (+satang) and passes refunded (−satang of the pass they cancel) */
  passes: { satang: number }[];
  /** `topup` (+satang) and `clawback` (−satang) entries: money transferred in, and money handed back */
  moneyIn: { kind: "topup" | "clawback"; satang: number }[];
  /** what is in every wallet now, not spent yet; null when it could not be read */
  unspentSatang: number | null;
}

export interface MoneyLine { count: number; thb: number }

export interface ProfitItem { key: string; name: string; count: number; thb: number }

export interface Profit {
  cost: { thb: number; userThb: number; systemThb: number; providers: { provider: string; thb: number }[] };
  revenue: { thb: number; items: ProfitItem[] };
  /** revenue − cost; below zero is a loss */
  profitThb: number;
  /** the part people asked for, against what they paid: the bots are left out */
  userProfitThb: number;
  /** what customers transferred in, less refunds (refunds are below zero) */
  moneyIn: { thb: number; topups: MoneyLine; passes: MoneyLine; refunds: MoneyLine };
  /** money in − cost */
  cashThb: number;
  unspentThb: number | null;
}

export const PASS_KEY = "member-pass";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildProfit(i: ProfitInput): Profit {
  let userThb = 0, systemThb = 0;
  const byProvider = new Map<string, number>();
  for (const l of i.ledger) {
    // a reservation is money set aside while a round runs; the real lines follow it
    if (l.model === RESERVATION_MODEL) continue;
    if (l.agentId) userThb += l.thb; else systemThb += l.thb;
    const p = i.providerOf(l.model);
    byProvider.set(p, (byProvider.get(p) ?? 0) + l.thb);
  }

  const items = new Map<string, ProfitItem>();
  for (const c of i.charges) {
    const key = c.round ?? "other";
    const at = items.get(key) ?? { key, name: ROUND_NAMES[key] ?? "ใช้ AI", count: 0, thb: 0 };
    at.count += 1;
    at.thb += -c.satang / 100;
    items.set(key, at);
  }
  if (i.passes.length) {
    const sold = i.passes.reduce((n, p) => n + Math.sign(p.satang), 0);
    const thb = i.passes.reduce((n, p) => n + p.satang / 100, 0);
    items.set(PASS_KEY, { key: PASS_KEY, name: "ค่าสมาชิกทั่วไป", count: sold, thb });
  }

  const topups = { count: 0, thb: 0 }, refunds = { count: 0, thb: 0 };
  for (const m of i.moneyIn) {
    const at = m.kind === "topup" ? topups : refunds;
    at.count += 1;
    at.thb += m.satang / 100;
  }
  const pass = items.get(PASS_KEY) ?? { count: 0, thb: 0 };
  const inThb = topups.thb + pass.thb + refunds.thb;

  const costThb = userThb + systemThb;
  const revenueThb = [...items.values()].reduce((n, x) => n + x.thb, 0);
  return {
    cost: {
      thb: round2(costThb), userThb: round2(userThb), systemThb: round2(systemThb),
      providers: [...byProvider.entries()].map(([provider, thb]) => ({ provider, thb: round2(thb) })).sort((a, b) => b.thb - a.thb),
    },
    revenue: {
      thb: round2(revenueThb),
      items: [...items.values()].map((x) => ({ ...x, thb: round2(x.thb) })).sort((a, b) => b.thb - a.thb || b.count - a.count),
    },
    profitThb: round2(revenueThb - costThb),
    userProfitThb: round2(revenueThb - userThb),
    moneyIn: {
      thb: round2(inThb),
      topups: { count: topups.count, thb: round2(topups.thb) },
      passes: { count: pass.count, thb: round2(pass.thb) },
      refunds: { count: refunds.count, thb: round2(refunds.thb) },
    },
    cashThb: round2(inThb - costThb),
    unspentThb: i.unspentSatang == null ? null : round2(i.unspentSatang / 100),
  };
}
