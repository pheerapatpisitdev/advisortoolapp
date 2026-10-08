/** The page's shape while it is fetched: a heading, a line, and the form's frame. */
export default function ThumbnailLoading() {
  const bar = "rounded-full bg-[var(--ct-soft)]";
  return (
    <div role="status" aria-label="กำลังโหลดหน้าภาพปกคลิป" className="max-w-5xl motion-safe:animate-pulse">
      <div className={`h-6 w-40 ${bar}`} />
      <div className={`mt-3 h-4 w-96 max-w-full ${bar}`} />
      <div className="mt-5 h-72 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]" />
      <span className="sr-only">กำลังโหลด…</span>
    </div>
  );
}
