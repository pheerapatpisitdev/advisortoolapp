import { gateCalc } from "@/lib/auth/viewer";
import { cookies } from "next/headers";
import { IHealthyCalculator } from "@/components/IHealthyCalculator";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { initialFrom, type IHealthyQuery } from "@/lib/ihealthy-link";
import type { IHealthyInitial } from "@/lib/ihealthy-choice";
import { Disclaimer, TermsSection } from "@/components/ihealthy/Sections";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { arrangementKey } from "@/components/ihealthy/rider-request";
import { priceRiders } from "@/lib/ihealthy-rider-quote";
import type { Attached } from "@/components/ihealthy/RiderPanel";
import { LangSwitch } from "@/components/ihealthy/LangSwitch";
import { HTML_LANG, LANG_COOKIE, parseLang, type Lang } from "@/lib/ihealthy-lang";
import { WORDS } from "@/lib/ihealthy-words";
import { dciDiseases, translateFacts } from "@/lib/ihealthy-translate";

/** The language the reader picked with the switch; Thai for everyone who has not. */
async function readerLang(): Promise<Lang> {
  return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}

/**
 * Thai for a link preview, which is fetched without the reader's cookie, and the reader's own
 * language in the tab they are reading it in.
 */
export async function generateMetadata() {
  const w = WORDS[await readerLang()];
  return { title: w.metaTitle, description: w.metaDescription };
}

/**
 * A link's own riders, priced here so that the first thing a reader sees is already right.
 *
 * The fold prices itself over the wire, which cannot happen until a browser has the page — so
 * a shared link carrying riders used to render with the agency's standard one instead, for
 * the half-second until its own answer landed, and for ever if that request never did. This
 * is the same engine call the fold will make, made once while the HTML is still being built.
 *
 * Undefined where the link says nothing about riders, which is the page's other opening: the
 * agency's standard daily cash, quoted in the browser from the slim table.
 */
function foldQuote(standardCode: string, initial: IHealthyInitial): Attached | undefined {
  if (initial.riders === undefined) return undefined;
  const request = {
    base: initial.base, age: initial.age, sex: initial.sex, sumAssured: initial.sumAssured,
    mode: initial.mode, plan: initial.plan, territory: initial.territory, coverage: initial.coverage,
  };
  const priced = priceRiders({ ...request, riders: initial.riders });
  const attached = priced.extraCodes.includes(standardCode)
    ? initial.riders.find((r) => r.code === standardCode)?.plan ?? null
    : null;
  return {
    at: arrangementKey(request),
    premiums: priced.extras,
    codes: priced.extraCodes,
    riders: initial.riders.filter((r) => priced.extraCodes.includes(r.code)),
    dailyCash: attached,
    deathBenefit: priced.deathBenefit,
  };
}

/**
 * What it pays, what it costs, and what the contract will not do — in that order, because a
 * health rider is bought on its ceiling and kept or dropped on its exclusions.
 */
export default async function IHealthyPage(
  { searchParams }: { searchParams: Promise<IHealthyQuery> },
) {
  // members only, trial included (owner, 2026-10-20)
  await gateCalc("/ihealthy-ultra");
  const table = iHealthyTable();
  const lang = await readerLang();
  const w = WORDS[lang];
  // The sheet read into the reader's language here, on the server, so the browser is handed
  // one language of the contract rather than four.
  const facts = translateFacts(iHealthyFacts(), lang);
  // The address is read here rather than in the browser, so a shared link is already the
  // arrangement it asks for in the HTML that arrives — no first paint of somebody else's
  // quote, and a reader on a slow phone never watches the card change under them.
  //
  // Awaited inside a try for one address only. Next defines every key of the query as a getter
  // on the promise it hands over — `makeUntrackedExoticSearchParams`, so that the old
  // synchronous reads keep working — and it skips only the property names on its own
  // well-known list. `constructor` is not one of them, so `?constructor=1` leaves the promise
  // with a string where its constructor should be and `await` throws in the language itself,
  // above anything this page is in a position to validate. The re-throw is what keeps this
  // from swallowing anything else: an aborted prerender arrives as a throw here too, and it
  // does not arrive on a promise whose own constructor has been overwritten.
  let query: IHealthyQuery = {};
  try {
    query = await searchParams;
  } catch (thrown) {
    // Tight on the one failure it is for, so a future Next version cannot route something
    // else quietly through this branch.
    if (!(thrown instanceof TypeError) || !Object.hasOwn(searchParams, "constructor")) throw thrown;
  }
  const initial = initialFrom(table, query);
  // Only the rows and the plan list are handed to the island, and the two sentences the
  // table itself has to print. The rest of `terms` is rendered by the server components
  // below. That is a smaller prop, not a smaller bundle: `ihealthy-facts.ts` imports the
  // whole sheet at module scope and a client component imports `planLabel` from it, so the
  // paragraphs are in the route chunk either way — a comment here once claimed otherwise.
  const { rows, plans, copayPercent } = facts;
  const initialAttached = foldQuote(table.standard.code, initial);
  const top = w.bigBaht(Math.max(...plans.map((p) => p.annualMax)));
  return (
    <main lang={HTML_LANG[lang]} className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <LangSwitch lang={lang} label={w.switchLabel} />
      {/* Said at the top as well as under the disclaimer: a reader who acts on a translated
          condition should have been told before reading it which version binds. */}
      {w.translationNote && (
        <p className="pt-3 text-right text-[0.7rem] leading-relaxed text-[var(--lg-mute)] opacity-80">
          {w.translationNote}
        </p>
      )}
      {/* an agents' tool since 2026-10-14: the name and the three figures the old hero led with */}
      <CalcTitle
        name="iHealthy Ultra"
        tight
        kind={w.eyebrow.split(" · ")[0]}
        facts={[
          `${w.maxPerYear} ${top.num} ${top.unit}`,
          `${w.choosePlans} ${plans.length} ${w.plansUnit}`,
          `${w.renewTo} ${facts.terms.renewalToAge} ${w.yearsUnit}`,
        ]}
      />
      {/* The customer's version of an expired rate table: "go and fetch a new rate file" is
          the operator's sentence, not one to put at the top of a page a customer arrived at
          from an advert. */}
      {table.expired && (
        <p className="mb-4 rounded-sm border border-[var(--lg-gold)] px-4 py-3 text-sm text-[var(--lg-gold)]">
          {w.expiredTable(table.expiresOn)}
        </p>
      )}
      <section id="calc" className="scroll-mt-4">
        <IHealthyCalculator
          table={table} data={{ rows, plans, copayPercent }}
          sharedLimit={facts.terms.sharedLimit} participationNote={facts.terms.participationNote}
          initial={initial} initialAttached={initialAttached} sticky
          lang={lang} dciDiseases={dciDiseases(lang)}
        />
      </section>
      <TermsSection facts={facts} w={w} />
      <Disclaimer facts={facts} rateVersion={table.rateVersion} w={w} />
    </main>
  );
}
