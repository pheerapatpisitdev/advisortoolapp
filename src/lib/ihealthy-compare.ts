import type { Sex } from "@/calc/types";
import { benefitCell, type BenefitCell } from "@/components/ihealthy/BenefitTable";
import type { BenefitEntry } from "@/lib/ihealthy-facts";
import type { CompareWords } from "@/lib/ihealthy-compare-words";
import type { IHealthyWords } from "@/lib/ihealthy-words";

/**
 * Every plan side by side, in the one table (owner chose 1ก 2ก 3ก, 2026-11-06, mockup
 * https://claude.ai/artifact/1mUgZLvfLHYGaC89ATjoTu).
 *
 * The owner's first iHealthy Ultra app worked this way: pick a person, read four prices across.
 * This is that page on the rates and the contract the rest of the system uses. The owner kept
 * its four plans, so a reader comparing them on a phone has columns wide enough to read;
 * ไดมอนด์ and แพลทินัม stay on /ihealthy-ultra.
 *
 * What a table of those plans holds, and nothing that reads the rate tables: the page's client
 * island imports this. The lines themselves are built on the server (ihealthy-compare-card.ts),
 * which is what keeps five languages of short row names out of a phone's download.
 */
export const COMPARE_CODES = ["SMART", "BRONZE", "SILVER", "GOLD"] as const;

/** What the sheet prints where a plan does not pay. */
const NO_COVER = "-";

export type CompareLine =
  | { kind: "group"; label: string }
  | {
      kind: "row";
      label: string;
      /** the sheet's row these figures are read from, so that a child's wording follows the age */
      entry: BenefitEntry;
      /** two categories sharing one yearly limit: both names, and the note under each figure */
      pair?: { lines: [string, string]; note: string };
    };

/** The compared plans the company sells at this age, in the sheet's order. */
export function comparePlans(sellable: readonly string[]): string[] {
  return COMPARE_CODES.filter((code) => sellable.includes(code));
}

/** One row's cells under these plans at this age. */
export function compareCells(entry: BenefitEntry, plans: string[], age: number): BenefitCell[] {
  return plans.map((code) => benefitCell(entry, code, age, plans));
}

/**
 * The lines worth drawing for these plans: a category none of them pays is not a row of dashes,
 * and a group left with no rows under it goes with them.
 */
export function visibleLines(lines: CompareLine[], plans: string[], age: number): CompareLine[] {
  const kept = lines.filter((line) =>
    line.kind === "group" || compareCells(line.entry, plans, age).some((c) => c.text !== NO_COVER));
  return kept.filter((line, i) => line.kind === "row" || kept[i + 1]?.kind === "row");
}

export interface ComparePlanFacts {
  code: string;
  name: string;
  ceiling: string;
  /** annual, half-yearly and monthly, as the table prints them */
  premiums: { label: string; amount: string }[];
}

/** The text an agent pastes to a customer: every plan on the table, and who it was quoted for. */
export function compareText(
  { age, sex, plans, lines, dailyCash, lifeSum }: {
    age: number;
    sex: Sex;
    plans: ComparePlanFacts[];
    lines: CompareLine[];
    /** what `w.dailyCash` says for the plan attached, where one is */
    dailyCash?: string;
    lifeSum: number;
  },
  w: IHealthyWords,
  cw: CompareWords,
): string {
  const rows = lines.flatMap((l) => (l.kind === "row" ? [l] : []));
  const room = rows[0];
  const opd = rows.find((r) => r.pair);
  const codes = plans.map((p) => p.code);
  const cellOf = (entry: BenefitEntry, code: string) => compareCells(entry, codes, age)[codes.indexOf(code)].text;

  const blocks = plans.map((p) => {
    const opdValue = opd ? cellOf(opd.entry, p.code) : NO_COVER;
    return [
      `🏆 ${p.name}`,
      `✨ ${cw.maxBenefit}: ${p.ceiling}${cw.perYear}`,
      ...(room ? [`🏥 ${cw.room}: ${cellOf(room.entry, p.code)}`] : []),
      `🏥 OPD: ${opdValue === NO_COVER ? cw.opdNone : `${opdValue} ${w.baht}${cw.perYear} ${cw.opdShared}`}`,
      ...p.premiums.map((m) => `💰 ${m.label}: ${m.amount} ${w.baht}`),
    ].join("\n");
  });

  return [
    `📋 ${cw.summaryTitle}\n👤 ${w.sex[sex]} ${w.years(age)}`,
    ...blocks,
    [...(dailyCash ? [`🛏️ ${dailyCash}`] : []), `💼 ${cw.lifeAll(lifeSum.toLocaleString("en-US"))} ${w.baht}`].join("\n"),
  ].join("\n\n");
}
