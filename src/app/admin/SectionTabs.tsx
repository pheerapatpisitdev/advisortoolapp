"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_SECTIONS } from "@/lib/shell/menu";

/**
 * The strip at the top of a back-office page: the other pages of the same job (owner,
 * 2026-10-16), so "API ราคา โมเดล" or "5 ประวัติผู้ใช้" reads as one place. A job with one
 * page shows nothing.
 */
export function SectionTabs() {
  const path = usePathname() ?? "";
  const sec = ADMIN_SECTIONS.find((s) => s.pages.some((p) => path === p.href || path.startsWith(p.href + "/")));
  if (!sec || sec.pages.length < 2 || sec.title === "งานอื่น") return null;
  return (
    <nav aria-label={sec.title} className="mb-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-[var(--bot-ink-mute)]">{sec.title}</span>
      {sec.pages.map((p) => {
        const on = path === p.href || path.startsWith(p.href + "/");
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-xs ${on ? "border-[var(--bot-ink)] bg-[var(--bot-ink)] text-white" : "border-[var(--bot-line)] text-[var(--bot-ink-mute)] hover:bg-[var(--bot-surface)]"}`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
