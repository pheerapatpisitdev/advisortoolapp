import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * satori breaks a Thai line only at a space (prompt-story/frames.tsx says so of its words); Chrome breaks
 * inside Thai words by its dictionary ("ต่อ / โรค", "ร้าย / แรง"). So the frames match, every Thai run gets a
 * word joiner between its letter clusters once it is in the page: a line then breaks at a space, as satori's
 * does. A cluster (a letter and its marks) is never split, so no mark is drawn apart from its letter.
 */

const WJ = "⁠";
const THAI = /[฀-๿]/;
const clusters = new Intl.Segmenter("th", { granularity: "grapheme" });

export function joinThai(text: string): string {
  return text.split(/(\s+)/).map((part) => {
    if (!THAI.test(part)) return part;
    const bare = part.replaceAll(WJ, "");
    return [...clusters.segment(bare)].map((g) => g.segment).join(WJ);
  }).join("");
}

/** its children as drawn, every text in it joined (joinThai) after each render */
export function KeepWords({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const walk = document.createTreeWalker(ref.current, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const was = n.nodeValue ?? "";
      const now = joinThai(was);
      if (now !== was) n.nodeValue = now;
    }
  });
  return <div ref={ref} style={{ position: "absolute", inset: 0, display: "flex" }}>{children}</div>;
}
