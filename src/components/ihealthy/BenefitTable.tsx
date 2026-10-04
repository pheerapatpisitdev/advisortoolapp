import { formatBaht } from "@/calc/money";
import { PHONE_PLANS, PHONE_ROW_LABEL } from "@/lib/ihealthy-phone";
import {
  benefitValue, categoryNumbers, isHeading, planLabel, type BenefitEntry, type IHealthyFacts,
} from "@/lib/ihealthy-facts";
import { WORDS, type IHealthyWords } from "@/lib/ihealthy-words";

/**
 * The half of the benefit data the browser needs. `terms` and `disclaimer` are three of the
 * five kilobytes that would otherwise cross the wire, and only server components render
 * them, so the page passes this subset rather than the whole object.
 */
export type BenefitTableData = Pick<IHealthyFacts, "rows" | "plans" | "copayPercent">;

export interface BenefitTableProps {
  data: BenefitTableData;
  /** the plan whose column is highlighted */
  selected: string;
  /** the age the columns are read at; under 11 swaps in the child wording */
  age: number;
  /** the plan codes the company sells at this age, from `plansFor` */
  sellable: string[];
  /** the company's note that the rider and its endorsement share one annual ceiling */
  sharedLimit: string;
  /**
   * The company's own explanation of the "*" that several cells carry. The table prints the
   * mark, so it has to print what the mark means — a reference to a note that is nowhere on
   * the page is worse than no mark at all.
   */
  participationNote: string;
  /**
   * The daily cash as it stands: the plan attached, null when the agent has taken it off,
   * and undefined above the age the company writes it at — where the row itself has no
   * business being on the page. It does not vary with the health plan, so it is one cell
   * across them rather than the same figure printed six times.
   */
  dailyCash?: number | null;
  /**
   * Every instalment of the whole arrangement under each plan, in satang — null where that
   * plan has no price at this age, and undefined for all of them when no price may be shown.
   *
   * A table of what six plans pay, with the price of only one of them on the card above it,
   * is half a comparison: the figure a reader is weighing every row against is the one it
   * does not carry. It is also what a printed sheet has instead of a card.
   */
  premiums?: { mode: string; label: string; byPlan: Record<string, number | null> }[];
  /** the page's own words in the reader's language; the rows arrive already translated */
  w?: IHealthyWords;
}


/**
 * The mark beside a short label on a phone. Decoration, so it is hidden from a screen
 * reader, which has the label itself — and only on a phone, where two words need something
 * to catch the eye as a reader scans down. A wide screen has the company's own sentence in
 * that column and needs no help finding a row.
 */
function Icon({ mark }: { mark: string }) {
  return <span aria-hidden className="mr-1.5 inline-block">{mark}</span>;
}
/**
 * Hidden at every width, restored from the tablet breakpoint up — and always on paper.
 *
 * A phone's print dialog lays the sheet out at the phone's own width, so the breakpoint alone
 * printed the phone's cut — three plans and five rows — and a customer saving the quote from
 * their phone got a summary where the desktop's file has the whole contract. Paper is the full
 * table whatever printed it, so each width rule here has a print rule that outranks it.
 */
const WIDE_ONLY_CELL = "hidden sm:table-cell print:table-cell!";
const WIDE_ONLY_ROW = "hidden sm:table-row print:table-row!";
/** The phone's cut, which no sheet of paper carries. */
const PHONE_ONLY = "sm:hidden print:hidden!";

const DASH = "-";

export interface BenefitCell {
  /** what the cell prints */
  text: string;
  /** the company does not sell this plan at the age on screen, whatever the sheet holds */
  unavailable: boolean;
}

/**
 * What one plan's column says on one row.
 *
 * A cell the company left blank reads as a dash, not as an empty gap. `undefined` can only
 * mean the sheet has no column for that plan, which is an extraction bug rather than an
 * answer, so it reads as a dash too rather than being hidden.
 *
 * A plan the company will not sell at this age is a different thing from a plan that pays
 * nothing, and the difference is the caller's to draw: the sheet's figure is withheld — it
 * is not on offer, so printing it would be an offer — but the reason is said once in the
 * column header rather than thirty-six times down the column.
 *
 * It takes the whole union, not just a `BenefitRow`, because that is what `data.rows` holds:
 * a caller that walks the list without splitting the headings off gets an empty cell rather
 * than a heading's internals printed six times across.
 */
export function benefitCell(
  entry: BenefitEntry,
  plan: string,
  age: number,
  sellable: string[],
): BenefitCell {
  if (isHeading(entry)) return { text: "", unavailable: false };
  if (!sellable.includes(plan)) return { text: DASH, unavailable: true };
  const v = benefitValue(entry, plan, age);
  if (v === undefined || v.trim() === "") return { text: DASH, unavailable: false };
  return { text: grouped(v), unavailable: false };
}

/** One cell standing for the run of adjacent columns that all say the same thing. */
export interface CellRun {
  /** the plans this cell covers, in column order; one of them where nothing merged */
  plans: string[];
  cell: BenefitCell;
}

/**
 * Neighbouring columns that say the same thing, gathered into one cell.
 *
 * Twenty of the company's thirty-seven benefit rows read "ตามที่จ่ายจริง" in all six plans,
 * and another handful read it in the last four. Printed a column at a time that is the same
 * two words up to six times across, which costs the row its height — the words wrap inside
 * a narrow column — and costs the reader a comparison they have to make to discover there
 * was none to make. The company's own sheet writes those as a single cell across the plans,
 * and so does this.
 *
 * Only adjacent columns merge, so a row where the outer plans agree and the middle ones do
 * not stays three cells rather than becoming a claim the plans are ordered differently than
 * they are. "Unavailable" is part of what a cell says — a dash the company printed and a
 * dash standing in for a plan this age cannot buy look alike and are not the same — so the
 * two do not merge into one.
 */
export function cellRuns(cells: BenefitCell[], plans: string[]): CellRun[] {
  const runs: CellRun[] = [];
  cells.forEach((cell, i) => {
    const last = runs[runs.length - 1];
    if (last && last.cell.text === cell.text && last.cell.unavailable === cell.unavailable) {
      last.plans.push(plans[i]);
    } else {
      runs.push({ cell, plans: [plans[i]] });
    }
  });
  return runs;
}

/**
 * A cell the workbook stored as a number rather than as text arrives as bare digits — "6000"
 * beside "1,500 ต่อวัน" in the next column reads as a typo on a page a customer is shown. The
 * digits are grouped and nothing else is added: what unit it is in is the company's to say,
 * and on these rows it does not say.
 */
function grouped(value: string): string {
  return /^\d+$/.test(value) ? Number(value).toLocaleString("en-US") : value;
}

/**
 * One width for the row titles, the heading labels above them, and the corner cell.
 *
 * Narrower on a phone, where three plans and a title have to share 375 points: at the wide
 * width the table would be 561 and would scroll sideways, which is the thing the phone
 * table exists to avoid.
 *
 * Wider again on a desktop, where the proportions were the wrong way round. The titles are
 * whole sentences of the company's own Thai and had 224 points to wrap in — eight lines of
 * it — while six columns holding "1,500 ต่อวัน" were handed two hundred points each by a
 * table told to fill the window. The first row alone stood 180 points tall on that
 * arithmetic, and the whole table 4,832.
 */
const TITLE_W =
  "w-28 min-w-28 max-w-28 sm:w-56 sm:min-w-56 sm:max-w-56 lg:w-72 lg:min-w-72 lg:max-w-72"
  + " xl:w-auto xl:min-w-[25rem] xl:max-w-none";
/**
 * The pinned row-title column. Opaque, or the rows scroll visibly through their own titles.
 *
 * On paper it takes the stylesheet's share of the sheet, held to the tablet's ceiling and
 * free to shrink: a phone prints at its own width, where a fixed tablet column pushed the six
 * plans off the edge of the page.
 */
const PIN = `sticky left-0 print:static ${TITLE_W} print:min-w-0! print:max-w-56! border-r border-[var(--lg-panel-line)] bg-[var(--lg-ground-deep)] px-3 text-left`;
/** A section's name, pinned over the row titles on screen and run the sheet's width on paper. */
const BAND_LABEL = `sticky left-0 print:static inline-block ${TITLE_W} print:min-w-0! print:max-w-none! px-3`;
/**
 * The plan names, and with them the one statement of why four columns are dashes at a child
 * age, stay on screen: the table is three and a half phone screens tall, and a header that
 * scrolls away takes the only thing that says what a column is.
 *
 * Its rule and the ground under it are a shadow rather than a border because the rows are
 * half-pixel tall: a collapsed border belongs to the table and scrolls away with it, and the
 * fraction it leaves behind is a sliver of the next row showing through the header's edge.
 */
const HEAD =
  "bg-[var(--lg-ground-deep)] py-2.5 shadow-[0_1px_0_var(--lg-ground-deep),inset_0_-1px_0_var(--lg-panel-line)]";
/**
 * The rule between one plan's column and the next.
 *
 * Forty-one rows of Thai across seven columns is a lot of text to hold a line through: the
 * row rules alone leave the eye to guess which figure belongs to which plan halfway down.
 * Not on the last column, which would draw an edge the table does not have.
 */
const COLUMN_RULE = "border-r border-[var(--lg-panel-line)] last:border-r-0";

/**
 * What a run's cell is, beyond its text.
 *
 * A cell one plan wide belongs to that plan and wears its colour; a merged cell belongs to
 * no one of them and stays plain, which is the company's own sheet's rule and is what keeps
 * the colour meaning something. The colours themselves are the stylesheet's — see
 * `[data-plan]` in the page's theme.
 */
function runAttrs(run: CellRun, selected: string): { "data-plan"?: string; "data-picked"?: string; className: string } {
  const only = run.plans.length === 1 ? run.plans[0] : undefined;
  return {
    "data-plan": only,
    "data-picked": only === selected ? "" : undefined,
    className: "px-1.5 py-2 text-center leading-relaxed sm:px-3 text-[var(--lg-mute)]"
      + (run.cell.unavailable ? " opacity-75" : ""),
  };
}

export function BenefitTable(
  {
    data, selected, age, sellable, sharedLimit, participationNote, premiums, dailyCash, w = WORDS.th,
  }: BenefitTableProps,
) {
  const plans = data.plans;
  /** A column a phone keeps: one of the three, or the one the card is pricing. */
  const onPhone = (code: string) => PHONE_PLANS.includes(code) || code === selected;
  /**
   * The plans a phone lays out, which is what its own merged cells have to be measured
   * against. A cell merged across the six and handed to a phone covers three columns the
   * phone is not drawing, and a spanning cell that asks for width gives some of it back to
   * them: the hidden columns reappear at a third of the row each and every figure after
   * them slides one plan to the right. So the two widths merge over their own columns, and
   * each set of cells is drawn only at the width it was worked out for.
   */
  const phonePlans = plans.filter((p) => onPhone(p.code));
  /** The company's categories a phone does not show, counted from the sheet. */
  const hidden = categoryNumbers(data.rows).filter((no) => !(no in PHONE_ROW_LABEL)).length;
  return (
    <div>
      {/* No height of its own: the table runs its full length down the page, so a reader
          scrolls the page rather than a window inside it. Sideways is the one direction that
          still has to scroll — six plans of Thai will not fit a phone at any size worth
          reading — and a box that scrolls is a control, so it takes a tabindex and says what
          it does. What the table is, its caption already says.

          The header does not follow the reader down: sideways scrolling needs a scroll
          container, and a cell can only stick inside the nearest one — which no longer has a
          height to stick within. The chosen plan's column stays tinted the whole way down,
          which is the column a reader is following. */}
      <div
        className="overflow-x-auto print:overflow-visible focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--lg-gold)]"
        tabIndex={0}
        role="region"
        aria-label={w.tableScroll}
      >
        {/* A phone gets a table sized to its box, so three plans and their titles share the
              width and the Thai wraps; a wide screen gets one sized to its content. */}
          {/* Filling the window is right up to the point where the window is wider than the
              table has anything to say. Past that the columns are padded out with nothing and
              the reader's eye has further to travel between a benefit and its figure, so from
              the extra-wide breakpoint the table stops growing and centres instead. */}
          <table className="ihu-benefit-table w-full border-collapse text-xs sm:w-max sm:min-w-full xl:w-full xl:min-w-0">
          <caption className="sr-only">
            {w.tableCaption(plans.length)}
          </caption>
          <thead>
            <tr>
              {/* the corner is pinned in both directions at once, so it outranks both */}
              <th scope="col" className={`${PIN} ${HEAD} z-30 font-medium text-[var(--lg-mute)]`}>
                {w.benefitColumn}
              </th>
              {plans.map((p) => {
                const sold = sellable.includes(p.code);
                return (
                  <th
                    key={p.code} scope="col"
                    /* The plan is named, and the colour it is known by is decided in the
                       page's stylesheet from that name alone — see `[data-plan]` there. */
                    data-plan={p.code}
                    data-picked={p.code === selected ? "" : undefined}
                    className={`${HEAD} ${COLUMN_RULE} ${onPhone(p.code) ? "" : WIDE_ONLY_CELL} z-20 min-w-0 px-1.5 text-center align-top font-medium sm:min-w-28 sm:px-3`}
                  >
                    {planLabel(p.code)}
                    {/* The ceiling stays even where the plan is not for sale — it is what the
                        whole table is organised around, and four columns of six lose it at a
                        child age. The six are read across the row against one another, which
                        is the one place in the table where the digits line up. */}
                    {/* And it is the loudest thing in the header, because it is the thing
                        being bought: the adverts sell these plans by their ceiling —
                        "เหมาจ่าย 10 ล้าน" — where "Bronze" is a word the reader has to
                        translate first. It was the quietest: 10.4px and 400 and faded to
                        80%, under a name at 13px and 600. The unit stays small so the digits
                        carry it, and the colour is left alone — the table sets one on every
                        cell from its own stylesheet, and that rule outranks a utility class. */}
                    <span className="mt-1 hidden font-bold tabular-nums sm:block sm:text-[0.95rem] sm:leading-tight print:block!">
                      {w.big(p.annualMax).num}
                      <span className="ml-1 text-[0.62rem] font-normal opacity-70">{w.big(p.annualMax).unit}</span>
                    </span>
                    {/* The column out of play is dimmed in its cells, not here: this line is
                        the only place the reader is told why, and faded to match the dashes
                        below it, it would sit at 3:1 on the ground. */}
                    {/* What a column says, once in its header, when the company does not sell
                        it at this age. */}
                    {!sold && <span className="block text-[0.65rem] font-normal">{w.notSold}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* On a wide screen the ceiling rides in the column header, where the six read
                across against one another. A phone has no room for a two-line header and
                only three columns to read across, so it takes a row of its own — the first
                thing under the price, which is the pair a reader weighs. */}
            <tr className={`border-t border-[var(--lg-panel-line)] ${PHONE_ONLY}`}>
              <th
                scope="row"
                className={`${PIN} z-10 py-2.5 text-[0.7rem] font-medium leading-relaxed text-[var(--lg-white)]`}
              >
                <Icon mark="🛡️" />
                {w.annualLimit}
              </th>
              {plans.map((p) => (
                <td
                  key={p.code}
                  data-plan={p.code}
                  data-picked={p.code === selected ? "" : undefined}
                  className={`${COLUMN_RULE} ${onPhone(p.code) ? "" : WIDE_ONLY_CELL} px-1.5 py-2.5 text-center tabular-nums sm:px-3`}
                >
                  {w.big(p.annualMax).num} {w.big(p.annualMax).unit}
                </td>
              ))}
            </tr>
            {data.rows.map((entry) =>
              isHeading(entry) ? (
                // Sticky on the cell itself would do nothing — it is already as wide as the
                // table, so there is nothing for it to slide against, and a heading laid out
                // at that width runs off a phone. The label is pinned instead, and to the
                // width of the row titles it names, so it wraps where they wrap and stays
                // where they stay while the plans scroll past underneath.
                <tr key={entry.heading} className={WIDE_ONLY_ROW}>
                  <th
                    scope="colgroup" colSpan={plans.length + 1}
                    className="bg-[var(--lg-ground-deep)] py-2 text-left text-[0.7rem] font-medium leading-relaxed text-[var(--lg-gold)]"
                  >
                    <span className={BAND_LABEL}>{entry.heading}</span>
                  </th>
                </tr>
              ) : (
                <tr
                  key={entry.title}
                  className={`border-t border-[var(--lg-panel-line)] align-top ${
                    entry.no !== null && entry.no in PHONE_ROW_LABEL ? "" : WIDE_ONLY_ROW
                  }`}
                >
                  <th
                    scope="row"
                    className={`${PIN} z-10 py-2 text-[0.7rem] font-normal leading-relaxed text-[var(--lg-mute)]`}
                  >
                    <span className={PHONE_ONLY}>
                      {entry.no !== null && PHONE_ROW_LABEL[entry.no] ? (
                        <>
                          <Icon mark={PHONE_ROW_LABEL[entry.no].icon} />
                          {w.phoneRow[entry.no] ?? PHONE_ROW_LABEL[entry.no].label}
                        </>
                      ) : entry.title}
                    </span>
                    <span className="hidden sm:inline print:inline!">{entry.title}</span>
                    {/* The company caps two of these rows by count rather than by money, in a
                        column of its own on the sheet. Under the title rather than in a
                        column here, because thirty-four of the thirty-six rows would have
                        nothing to put in it — and "ตามที่จ่ายจริง" with its limit left off is
                        an offer the contract does not make. */}
                    {entry.limit && (
                      <span className="mt-0.5 hidden text-[0.65rem] text-[var(--lg-gold)] sm:block">
                        {w.upTo(entry.limit)}
                      </span>
                    )}
                  </th>
                  {/* the phone's own columns, merged over themselves, and only where the
                      phone is showing this row at all */}
                  {entry.no !== null && entry.no in PHONE_ROW_LABEL
                    && cellRuns(
                      phonePlans.map((p) => benefitCell(entry, p.code, age, sellable)),
                      phonePlans.map((p) => p.code),
                    ).map((run) => (
                      <td
                        key={`phone-${run.plans[0]}`} colSpan={run.plans.length}
                        {...runAttrs(run, selected)}
                        className={`${COLUMN_RULE} ${PHONE_ONLY} ${runAttrs(run, selected).className}`}
                      >
                        {run.cell.text}
                      </td>
                    ))}
                  {cellRuns(
                    plans.map((p) => benefitCell(entry, p.code, age, sellable)),
                    plans.map((p) => p.code),
                  ).map((run) => (
                    <td
                      key={run.plans[0]} colSpan={run.plans.length}
                      {...runAttrs(run, selected)}
                      className={`${COLUMN_RULE} ${WIDE_ONLY_CELL} ${runAttrs(run, selected).className}`}
                    >
                      {run.cell.text}
                    </td>
                  ))}
                </tr>
              ),
            )}
            {/* Last, and outside the company's own twenty-eight categories: a second
                contract the agency sells alongside this one, whose cost the premium row
                already counts. Spanning the plans rather than repeating in each says what is
                true — it is the same cover whichever health plan is bought. */}
            {dailyCash !== undefined && (
              <tr className="border-t border-[var(--lg-panel-line)]">
                <th
                  scope="row"
                  className={`${PIN} z-10 py-2.5 text-[0.7rem] font-medium leading-relaxed text-[var(--lg-white)]`}
                >
                  <span className={PHONE_ONLY}><Icon mark="💵" /></span>
                  {w.dailyCashRow}
                </th>
                <td
                  colSpan={plans.length}
                  className="px-1.5 py-2.5 text-center text-[var(--lg-white)] sm:px-3"
                >
                  {dailyCash === null ? (
                    DASH
                  ) : (
                    <>
                      <span className="tabular-nums">{dailyCash.toLocaleString("en-US")}</span> {w.perDay}
                      <span className="ml-2 text-[0.65rem] text-[var(--lg-mute)]">{w.samePlans}</span>
                    </>
                  )}
                </td>
              </tr>
            )}
            {/* What the whole arrangement costs, one instalment to a line and last of all:
                the rows above are what the customer gets, and the price is what they are
                weighed against. Each is priced on its own, because the company rounds every
                instalment down separately — twelve months do not add up to a year. */}
            {premiums !== undefined && premiums.length > 0 && (
              // Named, the way the company's own sections are: everything above is what the
              // customer gets and everything below is what it costs, and a reader coming
              // down the table should be told where one ends and the other begins.
              <tr>
                <th
                  scope="colgroup" colSpan={plans.length + 1}
                  className="bg-[var(--lg-ground-deep)] py-2 text-left text-[0.7rem] font-medium leading-relaxed text-[var(--lg-gold)]"
                >
                  <span className={BAND_LABEL}>{w.premiumHeading}</span>
                </th>
              </tr>
            )}
            {premiums?.map((row) => (
              <tr key={row.mode} className="border-t border-[var(--lg-panel-line)]">
                <th
                  scope="row"
                  className={`${PIN} z-10 py-2.5 text-[0.7rem] font-medium leading-relaxed text-[var(--lg-white)]`}
                >
                  {row.label}
                </th>
                {plans.map((p) => {
                  const premium = row.byPlan[p.code];
                  return (
                    <td
                      key={p.code}
                      data-plan={p.code}
                      data-picked={p.code === selected ? "" : undefined}
                      className={`${COLUMN_RULE} ${onPhone(p.code) ? "" : WIDE_ONLY_CELL} px-1.5 py-2.5 text-center font-medium tabular-nums sm:px-3`}
                    >
                      {premium === null || premium === undefined ? DASH : formatBaht(premium)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[var(--lg-panel-line)] py-2.5 text-[0.7rem] leading-relaxed text-[var(--lg-mute)] opacity-80">
        {/* A phone is shown a handful of the company's categories, so it is told how many it
            is not being shown rather than left to read those few as the whole contract. The
            count is taken from the sheet so it cannot drift from what is on screen. */}
        {/* What the full table holds, not what it pays: หมวด 8 is ไม่คุ้มครอง in all six
            plans, so a sentence promising cover in every category the phone hides would be
            promising one the contract refuses. */}
        <span className={PHONE_ONLY}>
          {w.moreOnDesktop(hidden)}
        </span>
        {/* on paper there is nothing to scroll to, and the whole table is already there */}
        <span className="hidden print:hidden sm:inline">{w.scrollHint}</span>
        {sharedLimit}
      </p>
      <p className="pb-2.5 text-[0.7rem] leading-relaxed text-[var(--lg-mute)] opacity-80">
        {participationNote}
      </p>
    </div>
  );
}
