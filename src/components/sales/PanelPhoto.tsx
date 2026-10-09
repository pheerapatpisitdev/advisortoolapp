import type { Sex } from "@/calc/types";
import { insuredFace } from "@/app/api/card/insured-face";

/**
 * The family at the corner of a result panel, beside the premium it is for — and above it, as
 * on the card picture, who the quote is for: the cartoon face and "ชาย 34 ปี" (owner,
 * 2026-10-10: "why is there no age and icon in this corner").
 *
 * Placed over the panel rather than in its flow, so the eight calculators that share the panel
 * need no change to their layout. The corner keeps its old height — the photo gives up the
 * room the line above it takes — because each panel's headline is held to that height. The
 * photograph has a white ground, and `multiply` lets the panel show through it: on a phone,
 * where a long premium can run under the picture, the figures stay readable instead of being
 * covered by a white square.
 *
 * The line is left out until an age is known: "ชาย ปี" says nothing.
 */
export function PanelPhoto({ sex, age }: { sex?: Sex; age?: number | string } = {}) {
  const known = sex && typeof age === "number";
  return (
    <div aria-hidden className="pointer-events-none absolute right-2 top-2 z-0 flex flex-col items-end">
      {known && (
        <div className="flex h-7 items-center gap-1.5 sm:h-8">
          {insuredFace(sex, 26)}
          <span className="whitespace-nowrap text-base font-semibold text-[var(--bot-navy)] sm:text-lg">
            {sex === "F" ? "หญิง" : "ชาย"} {age} ปี
          </span>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/card/family.jpg"
        alt=""
        width={520}
        height={520}
        className={known ? "h-[68px] w-[68px] mix-blend-multiply sm:h-24 sm:w-24" : "h-24 w-24 mix-blend-multiply sm:h-32 sm:w-32"}
      />
    </div>
  );
}
