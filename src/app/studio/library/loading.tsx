/** คลังแอนิเมชัน's shape while it is fetched: the tabs, a search box, three chip rows, a grid of cards. */
export default function LibraryLoading() {
  const bar = "rounded-full bg-[var(--ct-soft)]";
  const chip = "h-11 rounded-full border border-[var(--ct-hair)] bg-[var(--ct-panel)]";
  return (
    <div role="status" aria-label="กำลังโหลดคลังแอนิเมชัน" className="max-w-5xl motion-safe:animate-pulse">
      <div className={`h-6 w-44 ${bar}`} />
      <div className={`mt-3 h-4 w-96 max-w-full ${bar}`} />
      <div className="mt-5 flex gap-4 border-b border-[var(--ct-hair)] pb-3">
        {Array.from({ length: 2 }, (_, i) => <div key={i} className={`h-4 w-16 ${bar}`} />)}
      </div>
      <div className="mt-4 h-11 rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)]" />
      {[5, 4, 3].map((n, r) => (
        <div key={r} className="mt-2 flex flex-wrap gap-2">
          {Array.from({ length: n }, (_, i) => <div key={i} className={`${chip} w-24`} />)}
        </div>
      ))}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-2">
            <div className="aspect-[9/16] rounded-lg bg-[var(--ct-ground)]" />
            <div className={`h-4 w-3/4 ${bar}`} />
            <div className="h-11 rounded-lg bg-[var(--ct-ground)]" />
          </div>
        ))}
      </div>
      <span className="sr-only">กำลังโหลด…</span>
    </div>
  );
}
