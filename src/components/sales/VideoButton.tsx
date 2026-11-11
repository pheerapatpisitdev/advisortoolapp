"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { VIDEO_LABEL } from "./video-label";
import { canMakeVideo } from "./video-access";

/** asked once per page load, whichever buttons ask */
let asked: Promise<boolean> | null = null;


/**
 * "สร้างวิดีโอนำเสนอ" on a plan's sales page (owner, 2026-10-11): for a signed-in agent only —
 * a customer reading the page never sees it. The page stays static; whether to show it is asked
 * of the server once the page is in the browser.
 *
 * Drawn as a video camera with a small word under it rather than a line of text (owner chose ข,
 * 2026-11-11, mockup https://claude.ai/artifact/D8PvZqXkMU3mgiTbyEZS7H), on every page that has it.
 */
export function VideoButton({ href, className, label = VIDEO_LABEL.th }: { href: string; className: string; label?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    asked ??= canMakeVideo().catch(() => false);
    let live = true;
    asked.then((ok) => { if (live) setShow(ok); });
    return () => { live = false; };
  }, []);
  return show ? <VideoButtonFace href={href} className={className} label={label} /> : null;
}

/** the camera and its word: the button as drawn, whoever may see it */
export function VideoButtonFace({ href, className, label }: { href: string; className: string; label: string }) {
  return (
    <Link href={href} aria-label={label} className={`${className} flex flex-col items-center gap-0.5 !py-2.5 no-underline`}>
      <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
        <rect x="2.5" y="6" width="13" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <path d="M15.5 10.2 21 7v10l-5.5-3.2z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
        <circle cx="7" cy="10.5" r="1.3" fill="currentColor" />
      </svg>
      <span className="text-xs font-semibold tracking-wide">{label}</span>
    </Link>
  );
}
