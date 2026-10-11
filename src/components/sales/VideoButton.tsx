"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { canMakeVideo } from "./video-access";

/** asked once per page load, whichever buttons ask */
let asked: Promise<boolean> | null = null;

/**
 * "สร้างวิดีโอนำเสนอ" on a plan's sales page (owner, 2026-10-11): for a signed-in agent only —
 * a customer reading the page never sees it. The page stays static; whether to show it is asked
 * of the server once the page is in the browser.
 */
export function VideoButton({ href, className }: { href: string; className: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    asked ??= canMakeVideo().catch(() => false);
    let live = true;
    asked.then((ok) => { if (live) setShow(ok); });
    return () => { live = false; };
  }, []);
  if (!show) return null;
  return <Link href={href} className={`${className} no-underline`}>สร้างวิดีโอนำเสนอ</Link>;
}
