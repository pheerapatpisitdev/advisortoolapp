/** วิดีโอโฆษณา's shape while it is fetched: the heading, the tools column with its two mode cards, the desk. */
export default function AdVideoLoading() {
  const bar = "rounded-full bg-[var(--ct-soft)]";
  return (
    <div role="status" aria-label="กำลังโหลดวิดีโอโฆษณา" className="motion-safe:animate-pulse">
      <div className={`h-6 w-40 ${bar}`} />
      <div className={`mt-3 h-4 w-96 max-w-full ${bar}`} />
      <div className="mt-5 grid items-start gap-3 lg:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[520px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 2 }, (_, i) => <div key={i} className="h-20 rounded-xl border border-[var(--ct-hair)]" />)}
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-11 w-28 rounded-full border border-[var(--ct-hair)]" />)}
          </div>
          <div className="h-16 rounded-lg bg-[var(--ct-soft)]" />
          <div className="h-11 rounded-lg bg-[var(--ct-ground)]" />
        </div>
        <div className="h-[50dvh] rounded-xl border border-[var(--ct-hair)]" />
      </div>
      <span className="sr-only">กำลังโหลด…</span>
    </div>
  );
}
