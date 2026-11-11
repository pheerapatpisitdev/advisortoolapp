import Link from "next/link";
import { clipLength, helpClip } from "@/lib/help/clips";

/** The line on a page that has a how-to clip, straight to that clip (owner chose 2ก, 2026-11-11). */
export function HelpLink({ clip, children }: { clip: string; children: React.ReactNode }) {
  const c = helpClip(clip);
  if (!c) return null;
  return (
    <Link href={`/help#${c.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ct-accent)] underline-offset-2 hover:underline">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-2 5.2 6 3.8-6 3.8z" /></svg>
      {children} ({clipLength(c.seconds)} นาที)
    </Link>
  );
}
