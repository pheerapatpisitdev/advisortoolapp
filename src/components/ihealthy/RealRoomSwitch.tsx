"use client";

import { useEffect, useState } from "react";

/** One setting for both iHealthy tables, kept on this device (owner chose ก: on the table, remembered). */
const STORE = "ihu-real-room";

/**
 * Whether the real-room line is shown (src/lib/ihealthy-real-room.ts). On by default (owner's
 * ก). The server's answer comes first — the PDF printer opens the page with `room=0` and has
 * no stored choice — and a stored choice on this device wins after the first paint, unless the
 * address itself said off.
 */
export function useRealRoom(fromAddress: boolean): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(fromAddress);
  useEffect(() => {
    if (!fromAddress) return;
    try {
      if (window.localStorage.getItem(STORE) === "0") setOn(false);
    } catch {
      // storage refused (private window): the default stands
    }
  }, [fromAddress]);
  const change = (next: boolean) => {
    setOn(next);
    try {
      window.localStorage.setItem(STORE, next ? "1" : "0");
    } catch {
      // not remembered this time; the page still follows the switch
    }
  };
  return [on, change];
}

/** The switch above the table. Off paper: a printed sheet shows the table as it was left. */
export function RealRoomSwitch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2.5 py-2 text-[0.75rem] font-medium text-[var(--lg-mute)] print:hidden">
      <input
        id="ihu-real-room" type="checkbox" role="switch" className="peer sr-only"
        checked={on} onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className="relative h-5 w-9 shrink-0 rounded-full bg-[var(--lg-panel-line)] transition-colors peer-checked:bg-[var(--lg-gold)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--lg-gold)] after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4"
      />
      {label}
    </label>
  );
}
