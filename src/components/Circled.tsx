import type { ReactNode } from "react";
import { loopUri } from "@/lib/highlighter";

/**
 * A figure ringed in red pen — the page's half of the loop the value-table picture draws
 * round the break-even figure. The shape is masked so the colour stays a token in globals.css.
 * Meant to wrap a `Highlighted` figure: the yellow stroke sits inside the loop.
 */
export function Circled({ children }: { children: ReactNode }) {
  const mask = loopUri("black");
  return (
    <span className="relative isolate inline-block px-2.5 py-0.5">
      <span
        aria-hidden
        className="absolute -inset-y-1 inset-x-0 -z-10 bg-[var(--lg-pen)]"
        style={{
          maskImage: mask, WebkitMaskImage: mask,
          maskSize: "100% 100%", WebkitMaskSize: "100% 100%",
          maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
        }}
      />
      {children}
    </span>
  );
}
