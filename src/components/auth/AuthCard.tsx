/**
 * The frame of the doors in — sign-in and sign-up (owner, 2026-10-01).
 *
 * It wears the home page's palette: the band as the ground, the card on white with a faint
 * edge and the chat box's shadow, the mark at the top. The card used to take Tailwind's default
 * border, which is the text colour — a black box on grey that looked like another website.
 *
 * One column at every width: a two-column front page on wide screens (ค่าบริการ beside the
 * card) went live on 2026-10-21 and came out the same day — the owner found it ugly and asked
 * for the old page back.
 */
export function AuthCard({ title, subtitle, children, below }: {
  title: string; subtitle?: string; children: React.ReactNode;
  /** under the card, on the same ground: the price list on the front page (owner, 2026-10-20) */
  below?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[var(--bot-band)] px-4 py-8 text-[var(--bot-ink)]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--bot-line)] bg-[var(--bot-surface)] p-6 shadow-[0_1px_2px_rgba(54,33,31,0.05),0_18px_36px_-20px_rgba(54,33,31,0.35)] sm:p-7">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.png" alt="" width={32} height={40} className="h-10 w-auto" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[var(--bot-ink-mute)]">{subtitle}</p>}
        </div>
        {children}
      </div>
      {below}
    </main>
  );
}
