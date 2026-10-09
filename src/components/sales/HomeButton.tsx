import Link from "next/link";

/**
 * The way back, on every sales page.
 *
 * Six plans have a page each and none of them had one: reaching the calculator from any of
 * them meant editing the address bar. It is fixed rather than in the flow because a reader
 * three thousand points down a benefit table is exactly who needs it, and because each hero
 * is composed to start at the top of its own page — a bar added above them would push all
 * six down by the height of a thing none of them were designed around.
 *
 * Every colour is a theme token. The six pages are not one skin: Life Protect is black and
 * gold, PLB is rose, iHealthy is warm cream. A literal picked to look right on one of them
 * would be invisible on another, which is the failure this project has had before.
 *
 * Top right, because every one of these heroes opens with its eyebrow line top left.
 *
 * The wrapper is not decoration. `globals.css` gives every direct child of `.theme-legacy`
 * `position: relative; z-index: 1` — so the grain and vignette behind the page stay behind
 * it — and that selector outranks a utility class: a link placed there is told it is fixed
 * and laid out relative anyway, which is a full-width bar across the top of all six pages.
 * The wrapper takes that rule instead, and it costs no height because its only child is
 * fixed.
 *
 * The wrapper carries no z-index of its own, because one would not be believed: a Tailwind z
 * utility ties that rule on specificity and loses to it on order. What puts this above the
 * page is being rendered after it — see the note in SalesTheme.
 */
export function HomeButton() {
  return (
    <div className="relative">
        <Link
        href="/home"
        aria-label="กลับไปหน้าแรก"
        className="
          fixed right-3 top-3 z-40 flex items-center gap-1.5 rounded-full
          border border-[var(--lg-panel-line)] bg-[var(--lg-panel)] px-3 py-1.5
          text-xs text-[var(--lg-mute)] no-underline backdrop-blur-md
          transition-colors hover:border-[var(--lg-gold)] hover:text-[var(--lg-gold)]
          focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--lg-gold)]
          print:hidden sm:right-5 sm:top-5 sm:px-3.5 sm:py-2 sm:text-[0.8rem]
        "
      >
        {/* currentColor throughout, so the glyph follows the text through every theme and
            through the hover — a stroke fixed to one colour is the other half of the same bug
            the comment above describes */}
        <svg
          aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          className="h-3.5 w-3.5 shrink-0"
        >
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
        </svg>
        <span>หน้าแรก</span>
      </Link>
    </div>
  );
}
