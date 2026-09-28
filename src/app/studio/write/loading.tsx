/**
 * What shows while a workbench page is fetched from the server: its shape in the palette's
 * quiet tones, under the tabs, so a press on a tab is answered at once.
 */
export default function ContentLoading() {
  const bar = "rounded-full bg-[var(--ct-soft)]";
  return (
    <div role="status" aria-label="กำลังโหลด" className="motion-safe:animate-pulse">
      <div className={`h-6 w-48 ${bar}`} />
      <div className={`mt-3 h-4 w-80 max-w-full ${bar}`} />
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="space-y-2">
              <div className={`h-3.5 w-24 ${bar}`} />
              <div className="h-11 rounded-lg bg-[var(--ct-ground)]" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
              <div className="aspect-square bg-[var(--ct-ground)]" />
              <div className="space-y-2.5 p-3">
                <div className={`h-4 w-4/5 ${bar}`} />
                <div className={`h-3 w-full ${bar}`} />
                <div className={`h-3 w-2/3 ${bar}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">กำลังโหลด…</span>
    </div>
  );
}
