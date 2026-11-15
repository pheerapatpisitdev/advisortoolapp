import type { ReactNode } from "react";

/**
 * The study-only notice across the middle of a table, as the same notice is drawn across every
 * card picture (src/app/api/card/watermark.tsx; owner, 2026-10-30). Two lines, tilted, faint.
 * The type is 4.8% of the box's width, the proportion the card pictures use.
 *
 * It sits over the table and lets every click and selection through, and it prints with the
 * page (a printed table is the one most likely to be handed over without its chat).
 */
export function Watermark(
  { children, lines = ["ข้อมูลเพื่อการศึกษาเท่านั้น", "ไม่ได้เป็นส่วนหนึ่งของกรมธรรม์"] }:
    { children: ReactNode; /** the two lines in the page's language (PA, 2026-11-15); Thai without it */ lines?: [string, string] },
) {
  return (
    <div className="relative [container-type:inline-size]">
      {children}
      {/* only the words tilt: a tilted box as tall as a year-by-year table pokes far out to the
          side, and the page grew to twice a phone's width (owner's iPhone, 2026-10-30) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex select-none items-center justify-center overflow-hidden"
      >
        <div
          className="flex flex-col items-center text-center font-semibold leading-[1.25] text-[var(--bot-navy)] opacity-[0.11]"
          style={{ transform: "rotate(-24deg)", fontSize: "4.8cqw" }}
        >
          <span>{lines[0]}</span>
          <span>{lines[1]}</span>
        </div>
      </div>
    </div>
  );
}
