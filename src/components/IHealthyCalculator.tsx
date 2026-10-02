"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PayMode, Sex } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import type { IHealthyTable } from "@/lib/ihealthy-table";
import type { BenefitTableData } from "@/components/ihealthy/BenefitTable";
import { planLabel } from "@/lib/ihealthy-facts";
import { BenefitTable } from "@/components/ihealthy/BenefitTable";
import { PHONE_PLANS } from "@/lib/ihealthy-phone";
import { RiderPanel } from "@/components/ihealthy/RiderPanel";
import {
  MODES, dailyCashLabel, deathBenefitOf, iHealthyPricing, shownAt,
  type IHealthyPricing, type IHealthyShown,
} from "@/lib/ihealthy-quote";

/** Re-exported where it has always been named from, so its readers need no edit. */
export type { IHealthyShown };
import {
  baseFor, resolveArrangement, sumFor, sumsFor, type IHealthyInitial,
} from "@/lib/ihealthy-choice";
import { cardPath, queryFrom } from "@/lib/ihealthy-link";
import { arrangementKey } from "@/components/ihealthy/rider-request";
import { deathBenefitRows } from "@/lib/death-benefit";
import type { AttachedRider } from "@/lib/ihealthy-rider-quote";
import type { Attached } from "@/components/ihealthy/RiderPanel";
import { ContactButtons } from "@/components/sales/ContactButtons";
import { LinkButton } from "@/components/sales/LinkButton";
import { iHealthyQuoteText, type IHealthyCtaFacts } from "@/lib/ihealthy-cta";
import { HTML_LANG, type Lang } from "@/lib/ihealthy-lang";
import { WORDS, baseWords } from "@/lib/ihealthy-words";
import { Highlighted } from "@/components/Highlighted";
import { markPdfReady, registerPrepare } from "@/lib/quote-pdf/prepare";

export interface IHealthyCalculatorProps {
  table: IHealthyTable;
  /** only the benefit rows the browser draws; the contract's prose stays on the server */
  data: BenefitTableData;
  /** the one sentence from `terms` the table itself prints under its own scroll hint */
  sharedLimit: string;
  /** the company's explanation of the "*" the table's own cells carry */
  participationNote: string;
  initial: IHealthyInitial;
  /**
   * The fold's riders already priced on the server, for a link that arrived carrying some.
   *
   * Without it the first paint of such a link quotes the agency's standard rider instead —
   * the server renders the HTML before any browser has asked the fold anything — so a shared
   * link showed one price for the half-second before its own riders landed, and showed it for
   * ever if that request failed.
   */
  initialAttached?: Attached;
  /** pin a copy of the contact buttons to the bottom of a phone screen */
  sticky?: boolean;
  /** the language the reader chose; `data` and the strings below arrive already in it */
  lang?: Lang;
  /** the thirty-one illnesses DCI names, in the reader's language */
  dciDiseases: string[];
}

/**
 * The customer's own quote for the health rider and the plan it rides on.
 *
 * State holds what was asked for; every render resolves that to what the company sells at
 * the age on screen, so the panel is never showing a price for one arrangement while the
 * pickers show another.
 */
export function IHealthyCalculator(
  {
    table, data, sharedLimit, participationNote, initial, initialAttached, sticky = false,
    lang = "th", dciDiseases,
  }: IHealthyCalculatorProps,
) {
  const w = WORDS[lang];
  const AGES = useMemo(
    () => Array.from({ length: table.ageMax - table.ageMin + 1 }, (_, i) => table.ageMin + i),
    [table.ageMin, table.ageMax],
  );
  const [age, setAge] = useState(initial.age);
  const [sex, setSex] = useState<Sex>(initial.sex);
  const [wantBase, setWantBase] = useState(initial.base);
  const [wantSum, setWantSum] = useState(initial.sumAssured);
  const [wantPlan, setWantPlan] = useState(initial.plan);
  // Held but never set: the form does not ask for a territory, and an arrangement that
  // arrived by link carrying เอเชีย or ทั่วโลก keeps it rather than being quietly re-priced
  // for Thailand.
  const [wantTerritory] = useState(initial.territory);
  const [wantCoverage, setWantCoverage] = useState(initial.coverage);
  // Likewise: the card headlines the yearly instalment and prints the other two beneath it,
  // so there is nothing for a picker to choose that the card is not already showing.
  const [mode] = useState<PayMode>(initial.mode);

  const base = baseFor(table, wantBase);
  const sumOptions = sumsFor(base);
  const sumAssured = sumFor(base, wantSum);
  const { plan, plans, territory, coverage, coverages } = resolveArrangement(
    table, age, { plan: wantPlan, territory: wantTerritory, coverage: wantCoverage },
  );

  /**
   * What the agent has attached in the fold, once the fold has said. Until then the card and
   * the table price the standard rider on their own, which is what the fold will open with —
   * so the two never disagree, and a customer who never opens it is quoted the same
   * arrangement either way.
   */
  const [attached, setAttached] = useState<Attached | undefined>(initialAttached);
  /**
   * What is ticked right now, which the fold reports without waiting for a price. The link is
   * written from this where there is no priced answer yet for the arrangement on screen —
   * otherwise the address spends every round trip saying the fold had never spoken, and an
   * agent copying it in that window hands over a different quote from the one they can see.
   */
  const [picked, setPicked] = useState<AttachedRider[] | undefined>(initial.riders);
  /**
   * The fold's answer is used only while it is still an answer about what is on screen.
   *
   * It is priced across a wire, so there is always a moment — the settle, the round trip, a
   * request that fails — when the arrangement has moved on and the answer has not. Untagged,
   * that moment charged the customer for a rider at an age the company would not write it
   * at, and a failed request left the wrong total up for as long as the page was open.
   */
  const foldRequest = plan && territory && coverage
    ? { base: base.variant, age, sex, sumAssured, mode, plan: plan.code, territory, coverage }
    : undefined;
  const answered = foldRequest && attached?.at === arrangementKey(foldRequest) ? attached : undefined;
  const extras = answered && {
    // One rider gets its own name, as the daily cash always had; more than one is a count,
    // because a card that listed them would be the fold written out twice. The name is built
    // from the plan actually attached and never from the agency's own: the agent may pick
    // five thousand a day, and the card used to charge for that under the word "1,000".
    label: answered.codes.length === 1 && answered.codes[0] === table.standard.code
      && answered.dailyCash !== null
      ? dailyCashLabel(answered.dailyCash)
      : `สัญญาเพิ่มเติม ${answered.codes.length} รายการ`,
    premiums: answered.premiums,
  };

  /**
   * What the whole arrangement costs a year under each of the six plans, so the benefit
   * table carries the figure every one of its rows is being weighed against. Everything but
   * the health plan is held still, which is what makes the six comparable: the same person,
   * the same base plan and sum, the same kind of cover.
   *
   * Undefined, not a row of dashes, when no price may be shown — a lapsed rate table has
   * nothing to say about price and the table still has plenty to say about cover.
   */
  const premiums = table.expired
    ? undefined
    : (() => {
        const priced = new Map(table.plans.map((p) => [
          p.code,
          territory && coverage
            ? iHealthyPricing(table, {
                base: base.variant, sex, age, sumAssured, plan: p.code, territory, coverage,
              }, extras)
            : undefined,
        ]));
        return MODES.map((m) => ({
          mode: m,
          label: w.mode[m],
          byPlan: Object.fromEntries(table.plans.map((p) => {
            // Null, which the table prints as a dash: the company refuses a monthly
            // instalment under its own floor, and a column that printed the figure anyway
            // would be quoting a way of paying that cannot be bought.
            const total = priced.get(p.code)?.total.find((x) => x.mode === m);
            return [p.code, total === undefined || total.belowMinimum ? null : total.total];
          })),
        }));
      })();


  /** The rider the fold opens with ticked, so its total agrees with the card above it. */
  const standardPlan = table.standard.plan[age - table.ageMin];
  const standardPick = standardPlan === null
    ? undefined
    : { code: table.standard.code, plan: standardPlan };

  /**
   * The address bar follows the card, so the link an agent copies opens on the arrangement
   * the agent is looking at. It is written from what was resolved and not from what was
   * asked for — ask for ซิลเวอร์ at eight and the address ends up saying สมาร์ท, which is the
   * plan on screen — and the three `??` are only for the age no rate table sells anything at,
   * where the card says so and the link may as well say what the form is still holding.
   */
  const link = queryFrom(table, {
    age, sex, base: base.variant, sumAssured, mode,
    plan: plan?.code ?? wantPlan,
    territory: territory ?? wantTerritory,
    coverage: coverage ?? wantCoverage,
    // The fold travels with the arrangement, or the link an agent copies would reopen on a
    // different quote from the one they are looking at — putting back the agency's standard
    // rider they had taken off, or dropping the cover they had added. The priced answer where
    // there is one for what is on screen, the bare ticks while it is still being priced.
    riders: answered?.riders ?? picked,
  });
  useEffect(() => {
    // `replaceState` rather than `push`: a Back button that had to walk out through every
    // dropdown the reader touched would never reach the page they came from. And only when
    // the address would really change, so that a customer opening a link the page itself
    // wrote is not handed a rewritten one on first paint — the hash survives with it, since
    // this replaces the whole address and not only its query.
    if (window.location.search.replace(/^\?/, "") !== link) {
      window.history.replaceState(null, "", `?${link}${window.location.hash}`);
    }
  }, [link]);

  /**
   * The sheet's date, written in as the print dialog opens — from the button or from the
   * browser's own menu, which fire the same event. Not rendered: a `new Date()` in something
   * that hydrates is the server's clock disagreeing with the browser's, and the only moment
   * this date means anything is this one.
   */
  const printedAt = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const stamp = () => {
      if (!printedAt.current) return;
      printedAt.current.textContent = w.printedAt(
        new Date().toLocaleString(HTML_LANG[lang], { dateStyle: "long", timeStyle: "short" }),
      );
    };
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, [w, lang]);

  // The server's headless Chrome prints once the fold has priced the arrangement, and asks
  // for the date the same way the browser's own print does.
  const isAnswered = !!answered;
  useEffect(() => {
    if (!isAnswered) return;
    registerPrepare(() => window.dispatchEvent(new Event("beforeprint")));
    markPdfReady();
  }, [isAnswered]);

  const priced = plan && territory && coverage
    ? iHealthyPricing(table, {
        base: base.variant, sex, age, sumAssured, plan: plan.code, territory, coverage,
      }, extras)
    : undefined;
  /** An expired rate set prices, but not at a figure anyone may be quoted. */
  const shown = table.expired ? undefined : shownAt(priced, mode);
  // The base plan's own answer until the fold has one: a rider that pays on death adds its
  // sum to what the family receives, and the card was charging for DCI while printing a
  // figure worked out as though nothing were attached.
  const death = answered?.deathBenefit ?? deathBenefitOf(table, base.variant, age, sumAssured);

  /**
   * Where the same arrangement is drawn as one picture — the card and the benefit table in a
   * file a customer can keep, and forward to whoever else in the house has to agree to it.
   *
   * The riders travel as the fold's own codes and only once the fold has answered: silence
   * there means the page is quoting the agency's standard daily cash, which is what the
   * route prices when no rider is named. An empty answer is not silence, and the link says
   * so — otherwise the picture would put back the rider the agent had just taken off.
   *
   * Held back with the price, on the same test the card is: nothing is drawn from a lapsed
   * rate table or an age the company sells nothing at.
   */
  const picture = shown && plan
    ? cardPath(table, {
        age, sex, base: base.variant, sumAssured, mode,
        plan: plan.code,
        territory: territory ?? wantTerritory,
        coverage: coverage ?? wantCoverage,
        riders: answered?.riders ?? picked,
      }, lang)
    : undefined;

  /**
   * The quote the page hands over is the whole arrangement on screen: the base plan, the
   * health rider, and whatever the fold has attached — the same three the card totals. The
   * fold's own riders are named as one line rather than listed, because a summary that
   * itemised them would be the panel written out twice.
   */
  const cta: IHealthyCtaFacts = {
    arrangement: plan && territory && coverage
      ? {
          planName: planLabel(plan.code), annualMax: plan.annualMax, deductible: plan.deductible,
          territory, coverage,
        }
      : undefined,
    copayPercent: data.copayPercent,
    age,
    sex,
    baseLabel: base.label,
    sumAssured,
    death,
    mode,
    minMonthly: table.minMonthly,
    shown,
  };
  /**
   * What the card calls the attached riders, in the reader's language. `extras.label` and the
   * table's own label are Thai because the quote text is built from them; this is the same
   * decision — one rider by name, more than one as a count — said for the screen.
   */
  const standardLine = answered
    ? answered.codes.length === 1 && answered.codes[0] === table.standard.code && answered.dailyCash !== null
      ? w.dailyCash(answered.dailyCash)
      : w.riderCount(answered.codes.length)
    : standardPlan !== null ? w.dailyCash(standardPlan) : undefined;
  const bases = (b: (typeof table.bases)[number]) => baseWords(w, b.variant, b);
  // In the language the page is read in: the text goes to the customer the page is shown to.
  const quoteText = iHealthyQuoteText(
    { ...cta, baseLabel: bases(base).label, standardLabel: standardLine }, w,
  );
  const territoryName = (t: string) => w.territory[t] ?? t;
  // Show the list from the moment DCI is ticked, not only after its premium round trip has
  // returned. `answered` keeps the card's price honest; `picked` keeps this explanation in
  // step with the choice the agent can already see.
  const dciRider = (answered?.riders ?? picked ?? []).find((r) => r.code === "DCI");
  const hasDci = Boolean(dciRider);
  /** The DCI illnesses, on the card on screen and under the benefit table on paper. */
  const dciList = (
    <section className="mt-4 border-t border-[var(--lg-panel-line)] pt-4">
      <h3 className="font-medium text-[var(--lg-white)]">
        {w.dciTitle(dciRider?.sumAssured?.toLocaleString("en-US") ?? "")}
      </h3>
      <p className="mt-1 text-xs leading-relaxed">
        {w.dciNote}
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed">
        {dciDiseases.map((disease) => <li key={disease}>{disease}</li>)}
      </ol>
    </section>
  );

  const label = "block text-sm text-[var(--lg-mute)]";
  const field =
    "mt-1.5 w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-base text-[var(--lg-white)]";
  const hint = "mt-1 text-xs leading-relaxed text-[var(--lg-mute)]";
  const tool =
    "rounded-sm border border-[var(--lg-panel-line)] px-3 py-3 text-center text-sm text-[var(--lg-mute)]";
  const chip = (on: boolean) =>
    `rounded-sm border px-2 py-2.5 text-center text-sm transition-colors ${
      on ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
    }`;

  return (
    <div className="space-y-6">
      {/* On paper the form is gone, so what it held has to be said in words: a premium and
          a benefit table with nothing naming who they are for is not a quote.

          The owner's full sheet: who it is for, then the plan on the card with its bill
          itemised contract by contract, then all six plans side by side for comparison, then
          the conditions written out in full. The heading names the six because the table is
          still the bulk of the document; the card below it names the one chosen. */}
      <div className="ihu-print-head hidden print:block">
        <h2 className="text-lg font-medium">
          {w.tableCaption(data.plans.length)} · {territory ? territoryName(territory) : "—"}
          {coverage && coverage !== "Full Coverage" ? ` · ${w.coverage[coverage]}` : ""}
        </h2>
        <p className="mt-1 text-sm">
          {w.sex[sex]} {w.years(age)} · {w.baseWithSum(bases(base).label, sumAssured)} {w.baht}
        </p>
        <p ref={printedAt} className="ihu-printed-at" />
      </div>

      <div className="space-y-5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5 print:hidden">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ihu-age" className={label}>{w.age}</label>
            {/* Seventy-five options, and still a picker rather than a number field, for the
                reason its sibling on /lifeprotect gives: a phone opens the wheel instead of
                the keypad, and one flick covers a decade. The list is the company's own
                issue-age range for this rider, so an age it will not cover cannot be reached
                and then have to be explained away — which is worth more here than on the
                base plan, because half the arrangement changes with the age. */}
            <select id="ihu-age" className={field} value={age} onChange={(e) => setAge(Number(e.target.value))}>
              {AGES.map((a) => <option key={a} value={a}>{w.years(a)}</option>)}
            </select>
          </div>
          <div>
            <span className={label}>{w.sexLabel}</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["M", "F"] as Sex[]).map((s) => (
                <button key={s} type="button" aria-pressed={sex === s} onClick={() => setSex(s)} className={chip(sex === s)}>
                  {w.sex[s]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className={label}>{w.base}</span>
          {/* One column per base the page sells, so dropping one closes the gap it left.
              Written out rather than composed: Tailwind reads these names out of the source
              and would not generate a class it never sees spelled. */}
          <div className={`mt-1.5 grid gap-2 ${table.bases.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {table.bases.map((b) => (
              <button
                key={b.variant} type="button" aria-pressed={b.variant === base.variant}
                onClick={() => setWantBase(b.variant)} className={chip(b.variant === base.variant)}
              >
                <span className="block">{bases(b).short}</span>
                {/* the package carries no note: its subtitle is its pinned sum, read from
                    the field itself so the two can never disagree */}
                <span className="mt-0.5 block text-xs opacity-80">
                  {bases(b).note ?? w.sumOf(b.fixedSum ?? 0)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          {/* The heading branches with the field under it. `htmlFor` would point at nothing
              once the select is gone — a paragraph is not labelable, so it cannot take the
              id and be named by it — and the pinned figure would be read out unnamed. */}
          {base.fixedSum !== undefined ? (
            <>
              <span id="ihu-sum-label" className={label}>{w.baseSum}</span>
              <p
                aria-labelledby="ihu-sum-label"
                className="mt-1.5 rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-base tabular-nums text-[var(--lg-mute)]"
              >
                {w.fixedSum(base.fixedSum)}
              </p>
            </>
          ) : (
            <>
              <label htmlFor="ihu-sum" className={label}>{w.baseSum}</label>
              <select id="ihu-sum" className={field} value={sumAssured} onChange={(e) => setWantSum(Number(e.target.value))}>
                {sumOptions.map((s) => <option key={s} value={s}>{s.toLocaleString("en-US")} {w.baht}</option>)}
              </select>
            </>
          )}
        </div>

        <div>
          <span className={label}>{w.healthPlan}</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {plans.map((p) => (
              <button
                key={p.code} type="button" aria-pressed={p.code === plan?.code}
                onClick={() => setWantPlan(p.code)}
                className={`${chip(p.code === plan?.code)} ${
                  PHONE_PLANS.includes(p.code) || p.code === plan?.code ? "" : "hidden sm:block"
                }`}
              >
                <span className="block">{planLabel(p.code)}</span>
                <span className="mt-0.5 block text-xs tabular-nums opacity-80">
                  {w.big(p.annualMax).num} {w.big(p.annualMax).unit}
                </span>
              </button>
            ))}
          </div>
          {/* Which plans are short is the rate table's answer; why they are short is not, and
              a revision that withdrew a plan at 76 would have this blaming a 76-year-old for
              being a child. It names the age on screen and leaves the reason unsaid. */}
          {plans.length < table.plans.length && (
            <p className={hint}>
              {w.onlyPlans(age, plans.map((p) => planLabel(p.code)))}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="ihu-cover" className={label}>{w.coverageLabel}</label>
          <select id="ihu-cover" className={field} value={coverage ?? ""} onChange={(e) => setWantCoverage(e.target.value)}>
            {coverages.map((c) => <option key={c} value={c}>{w.coverage[c] ?? c}</option>)}
          </select>
          {/* The territory is not asked for: this page sells cover in Thailand, which is the
              only territory five of the six plans are written for anyway. It stays in the
              state and in the link, so an arrangement written for เอเชีย or ทั่วโลก still
              prices if one arrives — there is simply no way to ask for one from here. */}
          {coverages.length === 1 && coverage && territory && (
            <p className={hint}>
              {w.territoryOnly(territoryName(territory), w.coverage[coverage] ?? coverage)}
            </p>
          )}
        </div>
      </div>

      <div className="ihu-quote space-y-4 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] p-5">
        <h3 className="ihu-sheet-label hidden print:block">
          {w.sheetChosen}{plan ? ` · iHealthy Ultra ${planLabel(plan.code)}` : ""}
        </h3>
        {plan === undefined || priced === undefined ? (
          // Nothing the pickers can reach lands here; a rate revision that took a rate away
          // from either half would, and the half it came from is not worth guessing at — so
          // the card names no ceiling and sends the reader back to the form rather than to
          // the health plan in particular.
          <p className="text-sm font-medium text-[var(--lg-gold)]">
            {w.notSoldAtAge(age)}
          </p>
        ) : (
          <>
            {shown ? (
              <>
                {/* What the total is made of, named and not priced.
                    Each line used to carry its own premium on the right, which on this
                    arrangement set 710 beside 43,800 and invited the reader to spend the
                    conversation on the larger half instead of on the cover. The total under
                    the rule is the price; these lines say what the price is for. */}
                <ul className="space-y-2 text-sm text-[var(--lg-mute)]">
                  <li>{w.baseWithSum(bases(base).label, sumAssured)}</li>
                  <li>iHealthy Ultra {planLabel(plan.code)}</li>
                  {/* The agency sells the daily cash with the health cover rather than beside
                      it, so it is priced into the figure the customer is quoted instead of
                      being added on afterwards. The fold below opens with it ticked, and its
                      premium is now read only to know whether it is on at all. */}
                  {shown.standard && shown.standard.total > 0 && <li>{standardLine ?? shown.standard.label}</li>}
                </ul>
                <div className="border-t border-[var(--lg-panel-line)] pt-4">
                  <div className="text-sm text-[var(--lg-mute)]">{w.totalPremium(w.mode[mode])}</div>
                  <div className="lg-figure mt-1 text-[2.4rem] leading-none tabular-nums">
                    <span className="lg-metal-text">{formatBaht(shown.total)}</span>
                    <span className="ml-2 text-base text-[var(--lg-mute)]">{w.baht}</span>
                  </div>
                  {shown.belowMinimum && (
                    <p className="mt-2 text-xs text-[var(--lg-gold)]">
                      {w.belowMinimum(table.minMonthly)}
                    </p>
                  )}
                  {/* One instalment to a line, and laid out the way the two contract lines
                      above are: an agent reading a figure off the screen to a customer
                      should find it in the same place every time, not somewhere along a
                      sentence. */}
                  <dl className="mt-3 space-y-1.5 text-sm">
                    {/* the other instalments, marked as every quote card marks its price lines */}
                    {shown.others.map((m) => (
                      <div key={m.mode} className="flex items-baseline justify-between gap-3">
                        <dt className="text-[var(--lg-mute)]"><Highlighted>{w.mode[m.mode]}</Highlighted></dt>
                        <dd className="lg-figure tabular-nums text-[var(--lg-white)]">
                          <Highlighted>{formatBaht(m.total)} {w.baht}</Highlighted>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {shown.refused.length > 0 && (
                    <p className="mt-2 text-xs text-[var(--lg-gold)]">
                      {w.refused(shown.refused.map((m) => w.mode[m]), table.minMonthly)}
                    </p>
                  )}
                </div>
              </>
            ) : (
              // The rate set below this page has lapsed. What the contract pays is still
              // true; what it costs is not ours to say any more.
              <p className="text-sm font-medium text-[var(--lg-gold)]">
                {w.expiredCard}
              </p>
            )}
            <div className="border-t border-[var(--lg-panel-line)] pt-4 text-sm text-[var(--lg-mute)]">
              <p>
                {/* the yearly ceiling is what a health plan is chosen by; marked as on the card */}
                <Highlighted>
                  {w.annualLimit}{" "}
                  <span className="lg-figure tabular-nums">
                    {plan.annualMax.toLocaleString("en-US")}
                  </span>{" "}
                  {w.baht}
                </Highlighted>
                {coverage === "Deductible" && ` · ${w.deductible(plan.deductible)}`}
                {coverage === "Co-Payment" && ` · ${w.copay(data.copayPercent)}`}
              </p>
              {/* The rider covers the illness; this is the one thing the base plan is for.
                  Read as bands rather than written out here, because a rider attached in the
                  fold can pay on death too and can stop paying before the base does — the
                  hand-written version said "ตั้งแต่อายุ 60 คุ้มครองเท่าทุน" over a figure
                  half again the sum assured, and never mentioned the age it falls back at.
                  The same helper writes the copied quote, so the two cannot drift. */}
              {base.variant !== "WLF99HX" && deathBenefitRows(death, w.death).map((row) => (
                <p key={row.label} className="mt-1">
                  {row.label}{" "}
                  <span className="lg-figure tabular-nums text-[var(--lg-white)]">
                    {row.amount.toLocaleString("en-US")}
                  </span>{" "}
                  {w.baht}
                </p>
              ))}
              {shown && (
                <p className="mt-1 opacity-80">{w.firstYearOnly}</p>
              )}
              {/* on paper the list prints under the table instead, three to a row */}
              {hasDci && <div className="print:hidden">{dciList}</div>}
            </div>
          </>
        )}
      </div>

      {/* The agent's own half, under the customer's, and on exactly the condition the card
          above prices one: `shown` is the whole test — a current rate table, and a price for
          all three of base, rider and instalment. Anything weaker and the fold would go on
          quoting from a table the card has just called lapsed, or offer riders to attach to
          a base the company does not cover at this age. */}
      {shown && plan && territory && coverage && (
        <RiderPanel
          request={{
            base: base.variant, age, sex, sumAssured, mode,
            plan: plan.code, territory, coverage,
          }}
          standard={standardPick}
          initialRiders={initial.riders}
          onAttached={setAttached}
          onPicked={setPicked}
          w={w}
        />
      )}

      {/* On a wide screen the table steps out of the page's reading measure and takes the
          window that the menu has left: all six plans fit there, and scrolling sideways
          would be a cost with nothing to buy. The prose around it keeps the narrow measure,
          which is what makes prose readable. On a phone the table stays in the column and
          scrolls. The arithmetic is `.ihu-bleed`, which has the menu's width to subtract and
          so cannot be written as a utility here. */}
      <div className="ihu-bleed">
        <BenefitTable
          data={data} selected={plan?.code ?? ""} age={age} sharedLimit={sharedLimit}
          participationNote={participationNote}
          sellable={plans.map((p) => p.code)} premiums={premiums} w={w}
          dailyCash={
            // `??` would be wrong here: null is the fold saying the agent took it off, not
            // the fold saying nothing yet, and falling through to the standard would put a
            // figure back in a row the agent has just emptied. An answer about another
            // arrangement is silence, which is why this reads `answered` and not `attached`.
            standardPick === undefined ? undefined
              : answered === undefined ? standardPick.plan
              : answered.dailyCash
          }
        />
      </div>

      {hasDci && <div className="ihu-print-dci hidden print:block">{dciList}</div>}

      {/* The way out of the page, and last of the three things on it: a health rider is
          bought on the twenty-eight rows above, so the buttons sit where a reader arrives
          having read them rather than above the table they came for. */}
      {/* The agent's two ways of handing this over, kept apart from the customer's own
          button below: one puts the arrangement on paper, the other puts its address on the
          clipboard. Both are the agent working, not the customer deciding. */}
      <div className="grid grid-cols-2 gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className={tool}>
          {w.printOrPdf}
        </button>
        <LinkButton className={tool} words={{ copy: w.copyLink, copied: w.linkCopied }} />
      </div>

      <div className="print:hidden">
        <ContactButtons copyText={quoteText} cardPath={picture} words={w.contact} />
      </div>

      {sticky && (quoteText || picture) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden print:hidden">
          <ContactButtons copyText={quoteText} cardPath={picture} words={w.contact} compact />
        </div>
      )}
    </div>
  );
}
