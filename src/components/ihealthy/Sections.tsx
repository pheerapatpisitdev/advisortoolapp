import { Fold, H2, Rule } from "@/components/sales/Blocks";
import type { IHealthyFacts } from "@/lib/ihealthy-facts";
import type { IHealthyWords } from "@/lib/ihealthy-words";

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
