import { benefitCell } from "@/components/ihealthy/BenefitTable";
import type { CompareLine } from "@/lib/ihealthy-compare";
import type { BenefitEntry } from "@/lib/ihealthy-facts";

/**
 * The room rate and the OPD limit named in the copied quote (owner, 2026-11-14, ข ก ก ก on
 * mockup https://claude.ai/artifact/1Enwcfye9osZF9UgBZRkob).
 *
 * Read off the compare table's own lines, so the quote of one plan and the comparison of four
 * say the same figure for it. The lines are built on the server (ihealthy-compare-card.ts);
 * this file reads no sheet, so the page's client island may import it.
 */
export interface ShareRows {
  /** the sheet's first category: room, board and hospital service a day */
  room?: BenefitEntry;
  /** OPD and physiotherapy, while the sheet keeps them one shared yearly limit */
  opd?: BenefitEntry;
}

/** What the sheet prints where a plan does not pay. */
const NO_COVER = "-";

export function shareRows(lines: CompareLine[]): ShareRows {
  const rows = lines.flatMap((l) => (l.kind === "row" ? [l] : []));
  return { room: rows[0]?.entry, opd: rows.find((r) => r.pair)?.entry };
}

/** The two cells as the sheet words them for this plan at this age; absent where it pays nothing. */
export interface ShareBenefits { room?: string; opd?: string }

export function shareBenefits(rows: ShareRows, plan: string, age: number): ShareBenefits {
  const cell = (entry: BenefitEntry | undefined) => {
    const text = entry ? benefitCell(entry, plan, age, [plan]).text : NO_COVER;
    return text === NO_COVER || text === "" ? undefined : text;
  };
  const room = cell(rows.room);
  const opd = cell(rows.opd);
  return { ...(room ? { room } : {}), ...(opd ? { opd } : {}) };
}
