"use client";
import { useEffect, useId, useState } from "react";
import { loadingKindOf, loadingScene } from "@/lib/quote-video/loading-scene";

/**
 * The picture under a clip's bar (owner, 2026-10-20, mockups https://claude.ai/artifact/4rXrAQzBQGT3GtBsQTbpZY
 * option จ and https://claude.ai/artifact/Gv6qeAs74uQGqHKRMfFSDw): builders putting up a house beside a
 * growing tree, or a life in ten events, chosen at random by the clip's id (loading-scene.ts). It moves
 * about 15 times a second while the page is seen; with reduced motion asked for, it stands still.
 */
export function LoadingScene({ pct, clipId }: { pct: number; clipId: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const kind = loadingKindOf(clipId);
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
      viewBox="0 0 300 190" role="img" aria-label={kind === "life" ? "ชีวิตคนหนึ่ง ตั้งแต่เกิดจนจากไป" : "คนงานกำลังสร้างบ้าน"}
      className="block h-auto w-full rounded-lg"
      // drawn from the bar's number only: no one's words go into it
      dangerouslySetInnerHTML={{ __html: loadingScene(kind, pct, t, uid) }}
    />
  );
}
