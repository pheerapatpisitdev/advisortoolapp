/**
 * A page's list that could not be read, said as that. The libraries caught the error and drew
 * an empty list — "ยังไม่มีใครในคลัง", "ไม่พบสูตร" — so a moment's database trouble read as
 * everything gone. A plain link reloads the page; no script needed to try again.
 */
export function LoadFailed({ what, href }: { what: string; href: string }) {
  return (
    <p role="alert" className="mt-5 rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] p-4 text-sm text-[var(--ct-alert)]">
      โหลด{what}ไม่สำเร็จ —{" "}
      <a href={href} className="inline-flex min-h-11 items-center font-medium underline">ลองใหม่</a>
    </p>
  );
}
