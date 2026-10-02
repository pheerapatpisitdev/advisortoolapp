"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatBaht } from "@/calc/money";
import type { PayMode } from "@/calc/types";
import { WORDS, type IHealthyWords } from "@/lib/ihealthy-words";
import { MoneyInput } from "@/components/MoneyInput";
import { priceWithRiders } from "@/app/ihealthy-ultra/actions";
import type { RiderChoice, RiderQuoteInput, RiderQuoteResult } from "@/app/ihealthy-ultra/actions";
import {
  arrangementKey, attachedRiders, withinOffer, type RiderPick,
} from "@/components/ihealthy/rider-request";
import type { AttachedRider } from "@/app/ihealthy-ultra/actions";

export interface RiderPanelProps {
  /** everything the action needs except the attached riders themselves */
  request: Omit<RiderQuoteInput, "riders">;
  /**
   * The rider the agency attaches as standard, already ticked when the fold is first opened,
   * so the fold's total agrees with the card above it rather than undercutting it by one
   * contract. Absent at an age the company does not write it at.
   */
  standard?: { code: string; plan: number };
  /**
   * Told, each time the server answers, what the attached riders come to in every instalment
   * and which they are. The card and the benefit table above are priced in the browser and
   * have no other way of knowing: their own arithmetic covers the base plan and the health
   * cover, and this is the rest of the bill. Naming the line is the card's business, since
   * the card is where the standard rider already has a name.
   */
  onAttached?: (attached: Attached | undefined) => void;
  /**
   * The ticks as they stand, told at once rather than when the server answers.
   *
   * The address the page writes carries the fold, and the priced answer is a round trip
   * behind every change — so without this the link spent that round trip saying the fold had
   * never spoken, and an agent who copied it in that window got the agency's standard rider
   * instead of what was on their screen.
   */
  onPicked?: (riders: AttachedRider[]) => void;
  /**
   * The riders a link arrived carrying, which replace the standard tick when there are any —
   * including when there are none, which is a link saying the fold was emptied.
   */
  initialRiders?: AttachedRider[];
  /** the page's words in the reader's language, the engine's Thai lines read through `w.rider` */
  w?: IHealthyWords;
}

/**
 * What the fold has attached, and which arrangement it was priced for.
 *
 * The tag is the whole point. The card above prices the base plan and the health cover itself
 * and takes the rest of the bill from here, so an answer left lying around after the age has
 * moved is a rider charged for at an age the company would not write it at. The card compares
 * the tag with the arrangement it is drawing and falls back to the agency's standard when
 * they differ — exactly as it does before the fold has said anything at all.
 */
export interface Attached {
  /** `arrangementKey` of the request this was priced for */
  at: string;
  premiums: { mode: PayMode; total: number }[];
  codes: string[];
  /** the plan of the standard rider as priced, or null when it is not attached at all */
  dailyCash: number | null;
  /** the ticks the engine actually priced, for the card link to name them again */
  riders: AttachedRider[];
  /** what the family receives with these riders on the contract, from the engine */
  deathBenefit?: RiderQuoteResult["deathBenefit"];
}

/**
 * The last thing the server said about one arrangement: a quote, or nothing at all because
 * the asking failed. One value and not a result beside a flag, because those two can
 * disagree — a failed tick would otherwise leave the rider ticked above a total that was
 * worked out before it, which reads as a priced arrangement and is not one.
 */
interface Answer {
  at: string;
  result?: RiderQuoteResult;
}

/**
 * What this page calls the health rider, wherever the engine would name it.
 *
 * The engine's name is the company's own Thai, which every other calculator in the building
 * prints and should go on printing. This page says iHealthy Ultra in its heading, its card,
 * its table and its link, and one Thai spelling of it in the priced rows below would read as
 * a second contract.
 */
const HEALTH_RIDER = "IHU";
const HEALTH_RIDER_NAME = "iHealthy Ultra";

/**
 * How long a change is left alone before the server is asked.
 *
 * A sum assured is typed digit by digit, and 1000000 down the wire a character at a time is
 * seven quotes for six arrangements nobody asked for. Ticks and picks are coalesced by the
 * same wait; a third of a second is under the round trip it saves.
 */
const SETTLE_MS = 300;

/** What a rider starts at when it is ticked: the package's pinned sum, the smallest plan or
 *  the first variant it sells, and its own floor where it takes a sum of its own. */
function opening(c: RiderChoice, standard?: { code: string; plan: number }): RiderPick {
  // Ticked back on, the agency's rider comes back at the agency's plan rather than at the
  // smallest the company sells — which is what it was ticked with in the first place.
  if (standard && c.code === standard.code) return { plan: standard.plan };
  return {
    ...(c.plans && c.plans.length > 0 ? { plan: c.plans[0] } : {}),
    ...(c.options && c.options.length > 0 ? { option: c.options[0].code } : {}),
    ...(c.exactSumAssured !== undefined ? { sumAssured: c.exactSumAssured }
      : c.saMin !== undefined ? { sumAssured: c.saMin } : {}),
  };
}

/**
 * What the fold starts with: the riders a link arrived carrying, or the agency's standard
 * tick when the link said nothing about riders. An empty list is an answer, not silence — a
 * link written by an agent who cleared the fold opens it cleared.
 */
function seed(
  standard: { code: string; plan: number } | undefined, fromLink: AttachedRider[] | undefined,
): Record<string, RiderPick> {
  if (fromLink === undefined) return standard ? { [standard.code]: { plan: standard.plan } } : {};
  return Object.fromEntries(fromLink.map((r) => [r.code, {
    ...(r.plan === undefined ? {} : { plan: r.plan }),
    ...(r.sumAssured === undefined ? {} : { sumAssured: r.sumAssured }),
    ...(r.option === undefined ? {} : { option: r.option }),
  }]));
}

/** The bounds the rider is written between, where it has them. */
function range(c: RiderChoice): string {
  if (c.saMin === undefined) return "";
  const min = c.saMin.toLocaleString("en-US");
  return c.saMax === undefined ? min : `${min} – ${c.saMax.toLocaleString("en-US")}`;
}

/**
 * The agent's fold.
 *
 * It quotes whether or not it is open. It used to wait to be opened, on the grounds that a
 * customer who never touched it should not pay for the round trip — but it now opens by
 * default, and more importantly the card above takes its rider subtotal from here: a fold
 * that stopped answering when it was collapsed left that subtotal frozen on the last
 * arrangement it saw, and the card went on charging for it.
 */
export function RiderPanel(
  { request, standard, onAttached, onPicked, initialRiders, w = WORDS.th }: RiderPanelProps,
) {
  // Taken apart at the door. The calculator builds `request` inline, so a fresh object
  // arrives on every render; an effect that listed it as a dependency would ask the server
  // for the same arrangement again, set state, render, and ask again — for ever.
  const { base, age, sex, sumAssured, mode, plan, territory, coverage } = request;
  // Open from the start. The fold was a fold because a customer reading the page has no use
  // for it; the agents who use this page most have to open it every single time, and a
  // closed panel is also the one thing that can leave the card quoting the agency's standard
  // rider while the panel below it has never said whether that is what is attached.
  const [chosen, setChosen] = useState<Record<string, RiderPick>>(() => seed(standard, initialRiders));
  const [answer, setAnswer] = useState<Answer>();
  const [pending, start] = useTransition();
  const newest = useRef(0);
  // Held in a ref rather than listed as a dependency: the calculator builds the callback
  // inline, so a fresh one arrives on every render and the effect below would ask the server
  // again on each of them.
  const told = useRef(onAttached);
  told.current = onAttached;
  const picked = useRef(onPicked);
  picked.current = onPicked;
  /** Bumped to ask again after a quote that never arrived. */
  const [attempt, setAttempt] = useState(0);
  // Taken apart for the same reason `request` is: the calculator builds it inline, so the
  // object is new on every render and the effect below would list a dependency that always
  // changed.
  const standardCode = standard?.code;
  const standardPlan = standard?.plan;

  const at = arrangementKey(request);

  // The ticks are the agent's; the link is written from them, so it says what is on screen
  // rather than what the server last confirmed.
  useEffect(() => {
    picked.current?.(attachedRiders(chosen));
  }, [chosen]);

  useEffect(() => {
    const riders = attachedRiders(chosen);
    // Nothing is asked until the typing settles; only the first question skips the wait,
    // because an empty fold is what the agent is staring at. The generation is what makes a
    // late answer harmless — the router queues these POSTs today, but the guard costs a
    // number and does not depend on it staying that way.
    const wait = newest.current === 0 ? 0 : SETTLE_MS;
    const generation = ++newest.current;
    const timer = setTimeout(() => {
      start(async () => {
        try {
          const result = await priceWithRiders({
            base, age, sex, sumAssured, mode, plan, territory, coverage, riders,
          });
          if (newest.current === generation) {
            setAnswer({ at, result });
            // What this age may actually buy. The company caps the daily cash by age — five
            // hundred a day up to ten, a thousand up to fifteen — and a tick carried across
            // an age change used to be sent at the old plan, refused, and quietly left out
            // of the quote. Clamping converges in one pass: the next answer offers the plan
            // that is now ticked.
            setChosen((prev) => withinOffer(prev, result.available));
            told.current?.({
              at,
              premiums: result.extras,
              codes: result.extraCodes,
              // What was priced, not what was ticked: a rider this age cannot buy is still
              // ticked in the fold and is not part of the arrangement anybody may be shown.
              riders: riders.filter((r) => result.extraCodes.includes(r.code)),
              dailyCash: standardCode !== undefined && result.extraCodes.includes(standardCode)
                ? chosen[standardCode]?.plan ?? standardPlan ?? null
                : null,
              deathBenefit: result.deathBenefit,
            });
          }
        } catch {
          // The engine is at the other end of a wire now. A quote that never arrives leaves
          // this arrangement with no figures at all rather than the last one's — said upward
          // as well, or the card would go on charging for the previous arrangement's riders
          // while the fold underneath it says the asking failed.
          if (newest.current === generation) {
            setAnswer({ at });
            told.current?.(undefined);
          }
        }
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [chosen, at, attempt, base, age, sex, sumAssured, mode, plan, territory, coverage, start,
      standardCode, standardPlan]);

  // The ticks are the agent's and survive the arrangement changing under them — switch to the
  // health package and back, and อุบัติเหตุ is still ticked. The figures do not: an answer
  // about another arrangement is withheld until this one is answered, while one being
  // re-priced for the same arrangement is only dimmed, because every row in it still stands.
  const answered = answer?.at === at ? answer : undefined;
  const result = answered?.result;
  const lost = answered !== undefined && answered.result === undefined;

  const toggle = (c: RiderChoice) =>
    setChosen((prev) => {
      const next = { ...prev };
      if (c.code in next) delete next[c.code];
      else next[c.code] = opening(c, standard);
      return next;
    });
  const amend = (code: string, part: RiderPick) =>
    setChosen((prev) => ({ ...prev, [code]: { ...prev[code], ...part } }));

  const control =
    "rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-2 py-1.5 text-sm tabular-nums text-[var(--lg-white)]";

  return (
    // On paper the pickers go and the priced rows stay: the itemised bill is the part of the
    // fold a customer is owed, and the ticks are the agent's working.
    <details open className="ihu-items group rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)]">
      <summary className="print:hidden flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-[var(--lg-white)] marker:hidden">
        {w.foldTitle}
        <span
          aria-hidden
          className="shrink-0 text-lg leading-none text-[var(--lg-gold)] transition-transform duration-300 group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div
        aria-busy={pending}
        className={`space-y-3 border-t border-[var(--lg-panel-line)] px-5 py-4 ${pending ? "opacity-60" : ""}`}
      >
        <h3 className="ihu-sheet-label hidden print:block">{w.sheetItems(w.mode[mode])}</h3>
        {lost ? (
          // A button, because the fold no longer stops and starts with the disclosure arrow:
          // it was told to close and reopen to retry, and closing it does nothing any more.
          <p className="flex flex-wrap items-center gap-3 text-sm text-[var(--lg-gold)] print:hidden">
            {w.pricingFailed}
            <button
              type="button" onClick={() => setAttempt((n) => n + 1)}
              className="rounded-sm border border-[var(--lg-gold)] px-3 py-1.5 text-[var(--lg-gold)]"
            >
              {w.retry}
            </button>
          </p>
        ) : result === undefined ? (
          <p className="text-sm text-[var(--lg-mute)]">{w.pricing}</p>
        ) : (
          <>
            {result.available.map((c) => {
              const on = c.code in chosen && c.eligible;
              const picked = chosen[c.code];
              const name = w.rider(c.name);
              return (
                <div
                  key={c.code}
                  className={`flex flex-wrap items-center gap-2.5 print:hidden ${c.eligible ? "" : "opacity-55"}`}
                >
                  <label className="flex flex-1 items-center gap-2.5 text-sm text-[var(--lg-white)]">
                    <input
                      type="checkbox" checked={on} disabled={!c.eligible} onChange={() => toggle(c)}
                      className="h-4 w-4 shrink-0 accent-[var(--lg-gold)]"
                    />
                    {name}
                    {/* the rider's name wraps on a phone; "0 - 60 ปี" broken over two lines
                        reads as two different numbers */}
                    <span className="shrink-0 whitespace-nowrap text-xs text-[var(--lg-mute)]">{w.rider(c.ageRange)}</span>
                  </label>
                  {!c.eligible && (
                    <span className="text-xs text-[var(--lg-mute)]">{c.reason && w.rider(c.reason)}</span>
                  )}
                  {on && c.options && c.options.length > 0 && (
                    <select
                      aria-label={w.optionOf(name)} className={control} value={picked.option ?? ""}
                      onChange={(e) => amend(c.code, { option: e.target.value })}
                    >
                      {c.options.map((o) => <option key={o.code} value={o.code}>{w.rider(o.name)}</option>)}
                    </select>
                  )}
                  {on && c.plans && c.plans.length > 0 && (
                    <select
                      aria-label={w.planOf(name)} className={control} value={picked.plan ?? ""}
                      onChange={(e) => amend(c.code, { plan: Number(e.target.value) })}
                    >
                      {c.plans.map((p) => (
                        <option key={p} value={p}>{p.toLocaleString("en-US")}</option>
                      ))}
                    </select>
                  )}
                  {on && c.exactSumAssured !== undefined && (
                    <span className="text-xs text-[var(--lg-mute)]">{c.exactMessage && w.rider(c.exactMessage)}</span>
                  )}
                  {on && c.exactSumAssured === undefined && c.saMin !== undefined && (
                    <label className="flex items-center gap-2">
                      <span className="sr-only">{w.sumOfRider(name)}</span>
                      <MoneyInput
                        className={`w-32 ${control}`} value={picked.sumAssured ?? ""} max={c.saMax}
                        onChange={(v) => amend(c.code, { sumAssured: v })}
                      />
                      <span className="whitespace-nowrap text-xs tabular-nums text-[var(--lg-mute)]">
                        {range(c)}
                      </span>
                    </label>
                  )}
                </div>
              );
            })}
            {/* the figures, not the pickers: a screen reader hears the new total when the
                answer lands, and hears it once, because the wait is announced by aria-busy */}
            <dl
              aria-live="polite"
              className="space-y-1.5 border-t border-[var(--lg-panel-line)] pt-3 text-sm"
            >
              {result.items.map((i) => (
                <div key={i.code} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--lg-mute)]">
                    {i.code.startsWith(HEALTH_RIDER) ? HEALTH_RIDER_NAME : w.rider(i.name)}
                  </dt>
                  <dd
                    className={`lg-figure tabular-nums ${i.eligible ? "text-[var(--lg-white)]" : "text-[var(--lg-gold)]"}`}
                  >
                    {i.eligible ? formatBaht(i.modal) : i.message && w.rider(i.message)}
                  </dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 border-t border-[var(--lg-panel-line)] pt-2 font-medium">
                <dt className="text-[var(--lg-white)]">{w.totalPremium(w.mode[mode])}</dt>
                <dd className="lg-figure tabular-nums text-[var(--lg-white)]">{formatBaht(result.totalModal)}</dd>
              </div>
            </dl>
            {result.warnings.map((warning) => (
              <p key={warning} className="text-xs text-[var(--lg-gold)]">{w.rider(warning)}</p>
            ))}
          </>
        )}
      </div>
    </details>
  );
}
