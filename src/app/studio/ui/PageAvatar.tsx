"use client";

import { useState } from "react";

/**
 * A card's face on Studio's front page: the Page's own picture, or its initials on the
 * palette's solid colour when there is no picture or Facebook does not send one.
 */
export function PageAvatar({ picture, initials }: { picture: string | null; initials: string }) {
  const [failed, setFailed] = useState(false);
  const box = "size-12 shrink-0 overflow-hidden rounded-xl sm:size-14";
  if (picture && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Facebook's picture of the Page, not an asset to optimise
      <img src={picture} alt="" onError={() => setFailed(true)} className={`${box} border border-[var(--ct-hair)] bg-white object-cover`} />
    );
  }
  return (
    <span aria-hidden="true" className={`${box} grid place-items-center bg-[var(--ct-solid)] text-lg font-semibold text-[var(--ct-solid-ink)]`}>
      {initials}
    </span>
  );
}
