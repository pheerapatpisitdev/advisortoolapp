import { benefitCell } from "@/components/ihealthy/BenefitTable";
import { iHealthyCard, type CardCell, type CardTableRow, type IHealthyCard } from "@/lib/ihealthy-card";
import { iHealthyFacts, isHeading } from "@/lib/ihealthy-facts";
import { FULL_ROW_LABEL, fullRowKey } from "@/lib/ihealthy-full-rows";
import { initialFrom } from "@/lib/ihealthy-link";
import { plansFor } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { translateFacts } from "@/lib/ihealthy-translate";

/**
 * A line of the whole table: a benefit group drawn across every column, a category whose
 * figures hang on the sub-rows under it, or one of those sub-rows. A plain row has no kind.
 */
export type FullRowKind = "group" | "heading" | "sub";
export type FullTableRow = CardTableRow & { kind?: FullRowKind };

/**
 * The quote card's arrangement with every category of the sheet in its table (owner,
 * 2026-10-25, mockup https://claude.ai/artifact/6Wk2LKxWA5hqojpF2LfnHt).
 *
 * The card's own figures — the columns, the prices, the yearly ceiling and the daily cash — are
 * `iHealthyCard`'s, from the same call; only the middle of the table is the full sheet in place
 * of the phone's five rows. It sits beside the card rather than inside it because the card's
 * module is part of the drawing code the clips' Remotion image is built from.
 */
export function iHealthyFullCard(query: URLSearchParams, today: Date = new Date()): Omit<IHealthyCard, "rows"> & { rows: FullTableRow[] } {
  // every plan: `fit=phone` is the bot's three, and this picture exists to show all six
  const all = new URLSearchParams(query);
  all.delete("fit");
  const card = iHealthyCard(all, today);
  const table = iHealthyTable(today);
  const v = initialFrom(table, Object.fromEntries(all));
  const sellable = plansFor(table, v.age).map((p) => p.code);
  const facts = translateFacts(iHealthyFacts(), card.lang);
  const codes = facts.plans.map((p) => p.code);
  const cellsOf = (get: (code: string) => string): CardCell[] =>
    codes.map((code) => ({ text: get(code), dim: !sellable.includes(code) }));

  // Keyed from the Thai sheet, which the translated one follows line for line: the short
  // names are found by the category's number, and only the Thai writes it the same way.
  const thai = iHealthyFacts().rows;
  const names = FULL_ROW_LABEL[card.lang];
  const rows: FullTableRow[] = [];
  let endorsed = false;
  facts.rows.forEach((entry, i) => {
    const key = fullRowKey(thai[i]);
    if (isHeading(entry)) {
      rows.push({
        label: key ? names[key] : entry.heading, cells: [],
        kind: key === "inpatient" || key === "outpatient" ? "group" : "heading",
      });
      return;
    }
    // the sheet marks the plan-dependent benefits on each row; the picture gives them a heading
    if (entry.endorsement && !endorsed) {
      endorsed = true;
      rows.push({ label: names.endorsement, cells: [], kind: "group" });
    }
    rows.push({
      label: key ? names[key] : entry.title,
      cells: cellsOf((code) => benefitCell(entry, code, v.age, sellable).text),
      ...(entry.no === null ? { kind: "sub" as const } : {}),
    });
  });

  // the card's first row is the yearly ceiling, and its one spanning row the daily cash
  const [ceiling] = card.rows;
  const spanning = card.rows.filter((r) => r.span !== undefined);
  return { ...card, rows: [ceiling, ...rows, ...spanning] };
}
