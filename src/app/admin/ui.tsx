export function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 mb-3 text-xs text-[var(--bot-ink-mute)]">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4">
      <div className="text-xs text-[var(--bot-ink-mute)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-[var(--bot-ink-mute)]">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed border-[var(--bot-line)] px-3 py-6 text-center text-sm text-[var(--bot-ink-mute)]">{children}</p>;
}

/**
 * The head of every back-office page, the same everywhere (owner chose ข, 2026-10-15): the
 * page's name and one line on what it is for. Until then some pages had a heading and a line,
 * some only a card's title, and สอน AI had none at all.
 */
export function PageHead({ title, hint, children }: { title: string; hint: string; children?: React.ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-[var(--bot-ink)]">{title}</h1>
        <p className="text-sm text-[var(--bot-ink-mute)]">{hint}</p>
      </div>
      {children}
    </header>
  );
}
