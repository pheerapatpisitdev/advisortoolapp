"use client";
import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { Board } from "@/lib/quote-video/board";
import { clipsMaking, myVideos, type VideoItem } from "./actions";

/** how often a board asks after the clips it is waiting on */
const EVERY_MS = 5000;

const making = (v: VideoItem) => v.status === "drawing" || v.status === "rendering";

/**
 * While a board has clips being made, asks after those alone every five seconds — their state and
 * bar, no links — and reads the whole list again once one ends (owner chose ก, 2026-10-19, mockup
 * https://claude.ai/artifact/7HwmKFHWKpBXwWncZQU9Nj). A hidden tab is not asked for; it asks the
 * moment it is shown again. `settled` runs when the wait ends, for the board's own after-clip reads.
 */
export function useClipWatch(
  board: Board, items: VideoItem[] | null, setItems: Dispatch<SetStateAction<VideoItem[] | null>>, settled: () => void,
): void {
  const ids = (items ?? []).filter(making).map((v) => v.id).join(",");
  const after = useRef(settled);
  after.current = settled;
  useEffect(() => {
    if (!ids) return;
    const waiting = ids.split(",");
    let busy = false;
    const ask = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const now = await clipsMaking(waiting);
        if (now.length !== waiting.length || now.some((c) => c.status !== "drawing" && c.status !== "rendering")) {
          setItems(await myVideos(board));
          return;
        }
        const by = new Map(now.map((c) => [c.id, c]));
        setItems((list) => list && list.map((v) => {
          const c = by.get(v.id);
          return c ? { ...v, status: c.status, progress: c.progress } : v;
        }));
      } catch {
        // the next ask tries again
      } finally {
        busy = false;
      }
    };
    const t = setInterval(() => void ask(), EVERY_MS);
    const shown = () => { if (!document.hidden) void ask(); };
    document.addEventListener("visibilitychange", shown);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", shown);
      after.current();
    };
  }, [board, ids, setItems]);
}
