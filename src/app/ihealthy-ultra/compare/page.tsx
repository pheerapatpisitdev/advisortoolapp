import { cookies } from "next/headers";
import { IHealthyCompare } from "@/components/IHealthyCompare";
import { Disclaimer, TermsSection } from "@/components/ihealthy/Sections";
import { LangSwitch } from "@/components/ihealthy/LangSwitch";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { gateCalc } from "@/lib/auth/viewer";
import { HIDE_KEY, hideParam } from "@/lib/pay-prefs";
import { hiddenOnPage } from "@/lib/pay-prefs-store";
import { compareLines } from "@/lib/ihealthy-compare-card";
import { COMPARE_WORDS } from "@/lib/ihealthy-compare-words";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { HTML_LANG, LANG_COOKIE, parseLang, type Lang } from "@/lib/ihealthy-lang";
import { initialFrom, type IHealthyQuery } from "@/lib/ihealthy-link";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { translateFacts } from "@/lib/ihealthy-translate";
import { WORDS } from "@/lib/ihealthy-words";

/** The language the reader picked on either iHealthy page; the cookie covers both addresses. */
async function readerLang(): Promise<Lang> {
  return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}

export async function generateMetadata() {
  const lang = await readerLang();
  return { title: `iHealthy Ultra · ${COMPARE_WORDS[lang].title}`, description: COMPARE_WORDS[lang].metaDescription };
}

/**
 * Every plan's price and cover in one table, for an agent sitting with a customer who has not
 * chosen yet (src/lib/ihealthy-compare.ts). /ihealthy-ultra is where one plan is then set up.
 */
export default async function IHealthyComparePage(
  { searchParams }: { searchParams: Promise<IHealthyQuery> },
) {
  const viewer = await gateCalc("/ihealthy-ultra/compare");
  const table = iHealthyTable();
  const lang = await readerLang();
  const w = WORDS[lang];
  const facts = translateFacts(iHealthyFacts(), lang);
  // The same one address as the calculator page's try: see the note there on `?constructor=1`.
  let query: IHealthyQuery = {};
  try {
    query = await searchParams;
  } catch (thrown) {
    if (!(thrown instanceof TypeError) || !Object.hasOwn(searchParams, "constructor")) throw thrown;
  }
  // ตั้งค่าส่วนตัว, as on the calculator page: the agent's own setting, or the printed link's
  const hide = await hiddenOnPage(viewer, query);
  return (
    <main lang={HTML_LANG[lang]} className="mx-auto max-w-lg px-4 pb-10 sm:max-w-3xl">
      <LangSwitch lang={lang} label={w.switchLabel} />
      {w.translationNote && (
        <p className="pt-3 text-right text-[0.7rem] leading-relaxed text-[var(--lg-mute)] opacity-80 print:hidden">
          {w.translationNote}
        </p>
      )}
      <CalcTitle name="iHealthy Ultra" tight kind={COMPARE_WORDS[lang].title} facts={[]} />
      {table.expired && (
        <p className="mb-4 rounded-sm border border-[var(--lg-gold)] px-4 py-3 text-sm text-[var(--lg-gold)]">
          {w.expiredTable(table.expiresOn)}
        </p>
      )}
      <IHealthyCompare
        table={table} lines={compareLines(lang)} plans={facts.plans}
        participationNote={facts.terms.participationNote}
        initial={initialFrom(table, { ...query, [HIDE_KEY]: hideParam(hide) })} lang={lang}
      />
      <div className="print:hidden">
        <TermsSection facts={facts} w={w} />
        <Disclaimer facts={facts} rateVersion={table.rateVersion} w={w} />
      </div>
    </main>
  );
}
