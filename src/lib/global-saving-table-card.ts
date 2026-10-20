import { GS_PREM_YEARS, GS_TERM, scenario, type GsQuote } from "@/calc/global-saving/engine";
import { cardVersionFor } from "@/lib/card-theme";
import { GS_TABLE_RATES, type GsVideoFacts } from "@/lib/quote-video/gsaving";

/**
 * What the page's table card (src/app/api/card/gsaving-table) draws the วิดีโอนำเสนอ clip's
 * yearly table from: the clip's own table facts (lib/quote-video/gsaving.ts gsavingVideoFacts),
 * made from the page's quote as it stands — a premium worked back from a sum keeps its satang —
 * where the clip's are made from a whole-baht premium. Built here rather than shared with the clip
 * because every file the clip's drawing bundles is fingerprinted (REMOTION_DRAWING), and a change
 * there ships a new video image.
 */
export type GsTableFacts = Pick<GsVideoFacts, "payYears" | "term" | "payback" | "maturity" | "guaranteed" | "rows" | "totals">;

export function gsTableFacts(q: GsQuote, age: number): GsTableFacts {
  const rows = q.scenarios[0].rows;
  const compared = GS_TABLE_RATES.map((r) => scenario(q.sa, q.premium, r / 100, age));
  return {
    payYears: GS_PREM_YEARS, term: GS_TERM, payback: rows[0].payback, maturity: q.scenarios[0].maturity, guaranteed: q.guaranteed,
    rows: rows.map((r) => {
      const paid = compared.map((c) => c.bonuses.find((b) => b.year === r.year));
      return {
        year: r.year, age: age + r.year - 1, premium: r.premium, payback: r.payback, death: r.death,
        ...(paid[0] ? { bonus: paid.map((b) => b?.value ?? 0) } : {}),
      };
    }),
    totals: compared.map((c) => c.total),
  };
}

/** every letter the clip's pen notes on this table can write (gsaving-table.tsx gsNotes), for the handwriting face */
export const GS_TABLE_PEN_TEXT = "เบี้ยเท่าเดิมจ่ายแค่ปีคืนทุกปีปีละ(การันตี)โบนัสตัวอย่างไม่การันตีครบสัญญา801% 0123456789,";

/**
 * The path the table card is drawn at (owner chose ค, 2026-10-20). Priced from whichever figure the
 * page was typed in, the premium or the sum, so the card shows the page's own figures to the satang.
 * Kept out of card-link.ts, which the clip's drawing bundles.
 */
export function gsavingTablePath(input: { age: number; basis: "premium" | "sumAssured"; amount: number }): string {
  const q = new URLSearchParams({ age: String(input.age) });
  q.set(input.basis === "premium" ? "prem" : "sum", String(input.amount));
  q.set("v", cardVersionFor());
  return `/api/card/gsaving-table?${q.toString()}`;
}
