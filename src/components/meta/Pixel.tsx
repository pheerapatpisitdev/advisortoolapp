"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackMeta } from "./track";

/**
 * The pixel, on customer pages only.
 *
 * The root layout is a server component, so the snippet lives here. Admin and Studio are
 * staff, and a page view there is not an ad result. The first PageView is inside the
 * snippet; later navigations are client-side, so the effect sends those.
 */

const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const SAFE = /^[0-9]+$/.test(PIXEL);

const CALCULATORS = new Set([
  "/lifeprotect", "/plb", "/easyprotect", "/lifetreasure", "/legacy", "/ishield",
  "/ci123", "/cancer", "/ihealthy-ultra", "/bumnan95", "/group-insurance", "/other-plans", "/fhc",
]);

function skipped(path: string): boolean {
  return path.startsWith("/admin") || path.startsWith("/studio");
}

export function MetaPixel() {
  const path = usePathname() || "/";
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!SAFE || skipped(path)) return;
    const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;
    if (seen.current !== null && seen.current !== path) fbq?.("track", "PageView");
    seen.current = path;
    if (CALCULATORS.has(path)) trackMeta("ViewContent", { content_name: path });
  }, [path]);
  if (!SAFE || skipped(path)) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">{`
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${PIXEL}');
      fbq('track', 'PageView');
    `}</Script>
  );
}
