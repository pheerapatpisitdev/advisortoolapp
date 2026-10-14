import { hasExpired } from "@/calc/calendar";
import { getPlan, listPlans } from "@/calc/plans/registry";

/**
 * Which rate tables this system prices from, and when the first of them runs out — for the
 * back office's overview, which warns before a table expires. It lived with the outside API
 * (src/lib/api/service.ts) until the owner took that out (2026-10-15).
 */
export interface TablesMeta {
  version: string;
  expiresOn: string;
  expired: boolean;
}

/** The rate tables as one answer: the earliest expiry wins, so "current" can never overstate. */
export function tablesMeta(): TablesMeta {
  const tables = listPlans().map(({ code }) => getPlan(code)!.rates);
  const expiresOn = tables.map((t) => t.expiresOn).sort()[0];
  return {
    version: [...new Set(tables.map((t) => t.version))].sort().join(", "),
    expiresOn,
    expired: hasExpired(new Date(), expiresOn),
  };
}
