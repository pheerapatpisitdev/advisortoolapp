import type { ReactNode } from "react";

/**
 * The study-only notice across the middle of a table, as the same notice is drawn across every
 * card picture (src/app/api/card/watermark.tsx; owner, 2026-10-30). Two lines, tilted, faint.
 * The type is 4.8% of the box's width, the proportion the card pictures use.
 *
 * It sits over the table and lets every click and selection through, and it prints with the
 * page (a printed table is the one most likely to be handed over without its chat).
 */
export function Watermark({ children }: { children: ReactNode }) {
  return (
    <div className="relative [container-type:inline-size]">
      {children}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center overflow-hidden text-center font-semibold leading-[1.25] text-[var(--bot-navy)] opacity-[0.11]"
        style={{ transform: "rotate(-24deg)", fontSize: "4.8cqw" }}
      >
        <span>ข้อมูลเพื่อการศึกษาเท่านั้น</span>
        <span>ไม่ได้เป็นส่วนหนึ่งของกรมธรรม์</span>
      </div>
    </div>
  );
}
