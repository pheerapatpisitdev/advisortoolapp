import { Fold, H2, Rule } from "@/components/sales/Blocks";
import type { IHealthyFacts } from "@/lib/ihealthy-facts";
import type { IHealthyWords } from "@/lib/ihealthy-words";

export function Hero({ facts, w }: { facts: IHealthyFacts; w: IHealthyWords }) {
  const ceilings = facts.plans.map((p) => p.annualMax);
  const top = w.bigBaht(Math.max(...ceilings));
  return (
    <header className="ihu-hero">
      <div className="ihu-eyebrow">
        <svg width="20" height="22" viewBox="0 0 24 26" fill="none" aria-hidden="true">
          <path d="M12 2 3 6v7c0 5 5 9 9 11 4-2 9-6 9-11V6L12 2Z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {w.eyebrow}
      </div>
      <h1>
        <span className="ihu-title-label">{w.titleLabel}</span>
        <span className="ihu-title-name">iHealthy <span>Ultra</span></span>
      </h1>
      <p className="ihu-intro">
        {w.intro(Math.min(...ceilings), Math.max(...ceilings), facts.plans.length, facts.terms.renewalToAge)}
      </p>
      <div className="ihu-highlights" aria-label={w.highlightsLabel}>
        <div><span>{w.maxPerYear}</span><strong>{top.num} <small>{top.unit}</small></strong></div>
        <div><span>{w.choosePlans}</span><strong>{facts.plans.length} <small>{w.plansUnit}</small></strong></div>
        <div><span>{w.renewTo}</span><strong>{facts.terms.renewalToAge} <small>{w.yearsUnit}</small></strong></div>
      </div>
      <div className="ihu-section-label"><span>{w.designYours}</span><span aria-hidden="true">↓</span></div>
    </header>
  );
}

export function TermsSection({ facts, w }: { facts: IHealthyFacts; w: IHealthyWords }) {
  const t = facts.terms;
  return (
    <section className="ihu-terms py-10">
      <H2>{w.termsHeading}</H2>
      <div className="mt-5">
        <Fold summary={w.waitingSummary(t.waitingDays, t.specialWaitingDays)}>
          <p>{w.waitingBody(t.waitingDays, t.specialWaitingDiseases.length, t.specialWaitingDays)}</p>
          <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {t.specialWaitingDiseases.map((d) => <li key={d}>· {d}</li>)}
          </ul>
        </Fold>
        <Fold summary={w.preExistingSummary}>
          <p>{t.preExisting}</p>
        </Fold>
        {/* Three years, which is what the paragraph inside says. "ทั้งปี" appears nowhere in
            the contract: it was a compression that changed the condition, on the one line a
            reader sees without opening anything. */}
        <Fold summary={w.noClaimSummary(t.noClaimDiscountPercent)}>
          <p>{t.noClaimDiscount}</p>
        </Fold>
        <Fold summary={w.renewalCopaySummary}>
          <p>{t.renewalCopay}</p>
        </Fold>
        <Fold summary={w.premiumChangesSummary}>
          <p>{t.premiumChanges}</p>
        </Fold>
        <Fold summary={w.outOfTerritorySummary(t.outOfTerritoryDays)}>
          <p>{t.outOfTerritory}</p>
        </Fold>
        {/* how many there are is the company's own first sentence; counting them again here
            would be a number nobody re-reads when the contract is re-issued */}
        <Fold summary={w.exclusionsSummary}>
          <p>{t.exclusions}</p>
        </Fold>
      </div>
    </section>
  );
}

export function Disclaimer(
  { facts, rateVersion, w }: { facts: IHealthyFacts; rateVersion: string; w: IHealthyWords },
) {
  return (
    <section className="ihu-disclaimer py-10">
      <Rule />
      <p className="pt-6 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        {facts.disclaimer}
      </p>
      <p className="mt-3 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        {w.firstYearDisclaimer(rateVersion)}
      </p>
      {/* last, so it qualifies everything above it, the contract's own wording included */}
      {w.translationNote && (
        <p className="mt-3 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">{w.translationNote}</p>
      )}
    </section>
  );
}
