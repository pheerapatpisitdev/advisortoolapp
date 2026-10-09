/**
 * "Design by www.unitclub.app" under a product page's table — the line every card picture
 * closes on (src/app/api/card/site-footer.tsx), here as a link since a page can be clicked.
 */
export function SiteCredit() {
  return (
    <p className="mt-4 text-center text-[11px] tracking-wide text-[var(--lg-mute)]">
      Design by{" "}
      <a href="https://www.unitclub.app/" target="_blank" rel="noopener" className="underline-offset-2 hover:underline">
        www.unitclub.app
      </a>
    </p>
  );
}
