import { fullRowKey, FULL_ROW_LABEL, SHARED_LIMIT_NOTE, SHARED_OPD } from "@/lib/ihealthy-full-rows";
import { iHealthyFacts, isHeading } from "@/lib/ihealthy-facts";
import { iHealthyFullCard, type FullTableRow } from "@/lib/ihealthy-full-card";
import { compareCells, comparePlans, type CompareLine, visibleLines } from "@/lib/ihealthy-compare";
import type { CardCell } from "@/lib/ihealthy-card";
import { initialFrom } from "@/lib/ihealthy-link";
import type { Lang } from "@/lib/ihealthy-lang";
import { plansFor } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { translateFacts } from "@/lib/ihealthy-translate";

/**
 * The compare table's lines in a language: the sheet's categories under their short names.
 *
 * A category whose figures hang on sub-rows (2, 4 and 6) is one line here, read from its first
 * sub-row: the sub-rows of each say the same under every compared plan, which
 * tests/calc/ihealthy-compare.test.ts holds to the sheet. Categories 18 and 19 are one shared
 * yearly limit (owner, 2026-10-31), so they are one line for as long as the sheet agrees.
 */
export function compareLines(lang: Lang): CompareLine[] {
  const thai = iHealthyFacts().rows;
  const facts = translateFacts(iHealthyFacts(), lang);
  const names = FULL_ROW_LABEL[lang];
  const lines: CompareLine[] = [];
  let endorsed = false;
  let waiting: string | undefined;
  facts.rows.forEach((entry, i) => {
    const key = fullRowKey(thai[i]);
    if (isHeading(entry)) {
      if (key === "inpatient" || key === "outpatient") lines.push({ kind: "group", label: names[key] });
      else waiting = key ? names[key] : entry.heading;
      return;
    }
    if (entry.no === null && waiting === undefined) return;
    if (entry.endorsement && !endorsed) {
      endorsed = true;
      lines.push({ kind: "group", label: names.endorsement });
    }
    lines.push({ kind: "row", label: waiting ?? (key ? names[key] : entry.title), entry });
    waiting = undefined;
  });

  const at = (k: string) => lines.findIndex((l) => l.label === names[k as keyof typeof names]);
  const [first, second] = SHARED_OPD.map(at);
  const a = lines[first];
  const b = lines[second];
  if (a?.kind === "row" && b?.kind === "row" && second === first + 1) {
    const every = facts.plans.map((p) => p.code);
    const same = compareCells(a.entry, every, 30).every((c, i) => c.text === compareCells(b.entry, every, 30)[i].text);
    if (same) lines.splice(first, 2, { ...a, pair: { lines: [a.label, b.label], note: SHARED_LIMIT_NOTE[lang] } });
  }
  return lines;
}

/**
 * The compare table as a picture: the whole table's card, cut to the compared plans the age can
 * buy and to the rows those plans pay. Its ceiling, daily cash and premium rows are that card's.
 */
export function iHealthyCompareCard(query: URLSearchParams, today: Date = new Date()): ReturnType<typeof iHealthyFullCard> {
  const card = iHealthyFullCard(query, today);
  const table = iHealthyTable(today);
  const { age } = initialFrom(table, Object.fromEntries(query));
  const plans = comparePlans(plansFor(table, age).map((p) => p.code));
  const every = iHealthyFacts().plans.map((p) => p.code);
  const kept = every.flatMap((code, i) => (plans.includes(code) ? [i] : []));
  const cut = (cells: CardCell[]) => kept.map((i) => cells[i]);

  const body: FullTableRow[] = visibleLines(compareLines(card.lang), plans, age).map((line) => {
    if (line.kind === "group") return { label: line.label, cells: [], kind: "group" };
    const cells = compareCells(line.entry, plans, age).map((c) => ({ text: c.text, dim: false }));
    return {
      label: line.label,
      cells,
      ...(line.pair ? { pair: line.pair } : {}),
      // the child's doctor's fee, the one row that says a limit and "as charged" in one cell
      ...(cells.some((c) => c.text.includes("*")) ? { tall: true } : {}),
    };
  });
  const [ceiling] = card.rows;
  return {
    ...card,
    columns: kept.map((i) => ({ ...card.columns[i], selected: false })),
    rows: [
      { ...ceiling, cells: cut(ceiling.cells) },
      ...body,
      ...card.rows.filter((r) => r.span !== undefined),
    ],
    premiumRows: card.premiumRows.map((r) => ({ ...r, cells: cut(r.cells) })),
  };
}

