"use client";
import { useEffect, useRef } from "react";

/** the watch and save links last an hour (actions.ts myVideos); past this they are read again */
const STALE_MS = 45 * 60_000;

/**
 * A clip board left open renews its links when the agent comes back to the tab (owner,
 * 2026-10-18): the polling stops once nothing is being made, and an hour later ดู and บันทึก
 * opened links that had run out.
 */
export function useFreshLinks(reload: () => void): void {
  const read = useRef(Date.now());
  const again = useRef(reload);
  useEffect(() => { again.current = reload; });
  useEffect(() => {
    const look = () => {
      if (document.visibilityState !== "visible" || Date.now() - read.current < STALE_MS) return;
      read.current = Date.now();
      again.current();
    };
    document.addEventListener("visibilitychange", look);
    window.addEventListener("focus", look);
    return () => {
      document.removeEventListener("visibilitychange", look);
      window.removeEventListener("focus", look);
    };
  }, []);
}
