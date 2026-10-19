"use client";
import { useEffect, useId, useState } from "react";
import { buildScene } from "@/lib/quote-video/build-scene";

/**
 * The builders putting up a house beside a growing tree, under a clip's bar (owner, 2026-10-20,
 * mockup https://claude.ai/artifact/4rXrAQzBQGT3GtBsQTbpZY, option จ). They move about 15 times a
 * second while the page is seen; with reduced motion asked for, the picture stands still.
 */
export function BuildScene({ pct }: { pct: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [t, setT] = useState(1.2);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let last = 0;
    let frame = requestAnimationFrame(function tick(now) {
      if (now - last > 66) { last = now; setT((now - start) / 1000); }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <svg
      viewBox="0 0 300 190" role="img" aria-label={pct >= 100 ? "บ้านสร้างเสร็จ ต้นไม้ออกดอกออกผล" : "คนงานกำลังสร้างบ้าน"}
      className="block h-auto w-full rounded-lg bg-gradient-to-b from-[#eaf3ff] to-[#f8fbff]"
      // drawn from the bar's number only: no one's words go into it
      dangerouslySetInnerHTML={{ __html: buildScene(pct, t, uid) }}
    />
  );
}
