/**
 * The top of a plan page now that the pages are agents' tools (owner, 2026-10-14: the pages are
 * a closed system, so everything that sold the plan went and only the calculator stays). The
 * plan's name, what kind of cover it is, and the few facts an agent checks before quoting.
 *
 * Padded clear of the phone's menu button, which is fixed at the top left; `tight` where
 * something above it (iHealthy's language switch) already keeps it clear.
 */
export function CalcTitle({ name, kind, facts, tight = false }: { name: string; kind?: string; facts: string[]; tight?: boolean }) {
  return (
    <header className={`mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--lg-hair)] pb-4 ${tight ? "pt-4" : "pt-16 lg:pt-10"}`}>
      <h1 className="text-2xl font-semibold leading-tight text-[var(--lg-white)]">{name}</h1>
      <p className="text-sm leading-relaxed text-[var(--lg-mute)]">
        {[kind, ...facts].filter(Boolean).join(" · ")}
      </p>
    </header>
  );
}
