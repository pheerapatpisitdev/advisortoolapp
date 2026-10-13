"use client";
import { useEffect, useState } from "react";

/**
 * Hands over the quote drawn as a picture — something a customer can keep, and show to
 * whoever else in the house has to agree to it.
 *
 * The card is fetched rather than built here: it is drawn on the server from the rate
 * tables, so what the customer receives is priced at the moment it is sent. On a phone the
 * file goes into the system share sheet; on a desktop it goes on the clipboard, ready to
 * paste into the Page inbox. A browser that will do neither gets the picture in a new tab,
 * where saving it is one right-click away.
 */
type State = "idle" | "working" | "copied" | "failed";

export function CardButton(
  { path, className, compact = false, label, filename = "quote.png" }:
    { path: string; className: string; compact?: boolean; label?: { full: string; compact: string }; filename?: string },
) {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    if (state !== "copied" && state !== "failed") return;
    const t = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(t);
  }, [state]);

  const send = async () => {
    setState("working");
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] }).catch(() => {});
        setState("idle");
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setState("copied");
    } catch {
      // every route to the clipboard can be refused — the picture itself still works
      window.open(path, "_blank", "noopener,noreferrer");
      setState("failed");
    }
  };

  const idle = label ?? { full: "ส่งการ์ด", compact: "การ์ด" };
  const text = state === "working" ? "กำลังสร้าง…"
    : state === "copied" ? "คัดลอกรูปแล้ว ✓"
      : state === "failed" ? "เปิดรูปในแท็บใหม่"
        : compact ? idle.compact : idle.full;

  return (
    <button type="button" onClick={send} disabled={state === "working"} className={className} aria-live="polite">
      {text}
    </button>
  );
}
