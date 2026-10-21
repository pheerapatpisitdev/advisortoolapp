/**
 * The frame of the doors in — sign-in and sign-up (owner, 2026-10-01).
 *
 * It wears the home page's palette: the band as the ground, the card on white with a faint
 * edge and the chat box's shadow, the mark at the top. The card used to take Tailwind's default
 * border, which is the text colour — a black box on grey that looked like another website.
 *
 * With something `below`, a wide screen — a computer or an iPad on its side, lg and up — sets
 * the two side by side instead: that content on the left, the card on the right, the card
 * staying put while the left scrolls (owner, 2026-10-21, mockup 3wFMS2rqo91HRpZ74FNx9y, ข). A
 * phone, and an iPad upright, keep the card on top and the rest under it.
 */
export function AuthCard({ title, subtitle, children, below }: {
  title: string; subtitle?: string; children: React.ReactNode;
  /** under the card, on the same ground — beside it on a wide screen: the price list on the front page (owner, 2026-10-20) */
  below?: React.ReactNode;
}) {
  const wide = below ? " lg:grid lg:grid-cols-[minmax(0,42rem)_24rem] lg:content-center lg:items-start lg:justify-center lg:gap-10 lg:px-8 lg:py-12" : "";
  return (
    <main className={`flex min-h-screen flex-col items-center justify-center gap-8 bg-[var(--bot-band)] px-4 py-8 text-[var(--bot-ink)]${wide}`}>
      <div className="w-full max-w-sm rounded-2xl border border-[var(--bot-line)] bg-[var(--bot-surface)] p-6 shadow-[0_1px_2px_rgba(54,33,31,0.05),0_18px_36px_-20px_rgba(54,33,31,0.35)] sm:p-7 lg:sticky lg:top-8 lg:order-2">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.png" alt="" width={32} height={40} className="h-10 w-auto" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[var(--bot-ink-mute)]">{subtitle}</p>}
        </div>
        {children}
      </div>
      {below && <div className="w-full min-w-0 max-w-2xl lg:order-1">{below}</div>}
    </main>
  );
}
