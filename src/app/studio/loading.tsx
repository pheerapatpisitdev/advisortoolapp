/**
 * What shows while Studio's front page is fetched: a card with its row of tiles in the
 * palette's quiet tones, so a press on Studio is answered at once.
 */
export default function StudioHomeLoading() {
  const bar = "rounded-full bg-[var(--ct-soft)]";
  return (
    <div role="status" aria-label="กำลังโหลด" className="max-w-6xl motion-safe:animate-pulse">
      <div className={`h-6 w-32 ${bar}`} />
      <div className={`mt-3 h-4 w-64 max-w-full ${bar}`} />
      <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
        <div className="flex items-center gap-4 p-4 sm:p-6">
          <div className="size-12 rounded-xl bg-[var(--ct-soft)] sm:size-14" />
          <div className="space-y-2">
            <div className={`h-4 w-48 ${bar}`} />
            <div className={`h-3 w-28 ${bar}`} />
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-[var(--ct-hair)] sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="min-h-24 space-y-2.5 p-4 sm:px-5">
              <div className={`h-4 w-28 ${bar}`} />
              <div className={`h-3 w-20 ${bar}`} />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">กำลังโหลด…</span>
    </div>
  );
}
