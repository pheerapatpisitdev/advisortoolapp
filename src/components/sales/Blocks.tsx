/** A heading that reads at arm's length on a phone, without shouting on a desktop. */
export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[1.4rem] font-medium leading-snug text-[var(--lg-white)] sm:text-2xl">
      {children}
    </h2>
  );
}

/** The engraved hairline that separates one part of the page from the next. */
export function Rule() {
  return <hr className="lg-rule" />;
}

/**
 * A folding block. `<details>` is the browser's own — it opens with no JavaScript at all,
 * which on a phone over mobile data is the difference between a list that works and a list
 * that waits for a bundle to arrive.
 */
/**
 * `open` is for a fold whose contents are the reason the section exists.
 *
 * A fold is a promise that what is inside can wait. The seventy illnesses on the iShield page
 * cannot: they are what the contract is, and a reader who has to press twice to find out what
 * is covered has been asked to take the heading on trust.
 *
 * On paper every fold prints open: `data-fold` is what `PrintUnfold` looks for.
 */
export function Fold(
  { summary, children, open = false }: { summary: string; children: React.ReactNode; open?: boolean },
) {
  return (
    <details open={open} data-fold="" className="group border-b border-[var(--lg-panel-line)] last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-[var(--lg-white)] marker:hidden">
        {summary}
        <span
          aria-hidden
          className="shrink-0 text-lg leading-none text-[var(--lg-gold)] transition-transform duration-300 group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="pb-5 text-sm leading-[1.85] text-[var(--lg-mute)]">{children}</div>
    </details>
  );
}
