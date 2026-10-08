/** The page's shape while it is fetched: a heading, a line, and the button. */
export default function DescribeLoading() {
  const bar = "rounded-full bg-[var(--ct-soft)]";
  return (
    <div role="status" aria-label="กำลังโหลดหน้าถอดรูปเป็น prompt" className="max-w-3xl motion-safe:animate-pulse">
      <div className={`h-6 w-52 ${bar}`} />
      <div className={`mt-3 h-4 w-96 max-w-full ${bar}`} />
      <div className="mt-5 h-9 w-32 rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)]" />
      <span className="sr-only">กำลังโหลด…</span>
    </div>
  );
}
