"use client";
import { useEffect, useState } from "react";
import { pdfFileName, type PrintQuote } from "@/lib/group-insurance/print-link";
import { Icon } from "./Icon";
import { useLang } from "./lang";

type State =
  | { at: "idle" }
  | { at: "making" }
  /** made, waiting for a tap: the one that asked for it ran out while the server worked */
  | { at: "ready"; file: File }
  | { at: "failed" };

/**
 * The quotation's button on a phone: the server makes the PDF, the phone's share sheet sends it
 * (owner, 2026-11-20, ก on mockup https://claude.ai/artifact/GKqLffrJ2XAMb83cakFLnh).
 *
 * The same two taps as iHealthy's (src/components/ihealthy/PdfButton.tsx): the share sheet wants
 * a fresh tap and the file takes ten seconds or more, so the first tap usually ends with the
 * file ready and the button asking for a second one. Here the quotation goes up as a POST
 * (/api/group-quote-pdf), because it exists only in this browser.
 *
 * A file made for one name is not the file for another: typing in the name box (a new `quote`)
 * sends the button back to the start.
 */
export function SharePdfButton({ quote, className, style }: {
  quote: PrintQuote;
  className: string;
  style?: React.CSSProperties;
}) {
  const { t } = useLang();
  const [state, setState] = useState<State>({ at: "idle" });
  useEffect(() => setState({ at: "idle" }), [quote]);

  const hand = async (file: File) => {
    if (!navigator.canShare?.({ files: [file] })) {
      // no share sheet for files: the file opens in a tab of its own, saved from there
      const url = URL.createObjectURL(file);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setState({ at: "idle" });
      return;
    }
    try {
      await navigator.share({ files: [file] });
      setState({ at: "idle" });
    } catch (e) {
      // closed by the agent, or refused because the tap that asked has expired
      setState(e instanceof DOMException && e.name === "AbortError" ? { at: "idle" } : { at: "ready", file });
    }
  };

  const click = async () => {
    if (state.at === "making") return;
    if (state.at === "ready") {
      await hand(state.file);
      return;
    }
    setState({ at: "making" });
    try {
      const res = await fetch("/api/group-quote-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(quote),
      });
      if (!res.ok || !res.headers.get("content-type")?.includes("pdf")) throw new Error(String(res.status));
      await hand(new File([await res.blob()], pdfFileName(quote), { type: "application/pdf" }));
    } catch {
      setState({ at: "failed" });
    }
  };

  const words = {
    idle: t("quoteShareBtn"),
    making: t("quoteShareMaking"),
    ready: t("quoteShareReady"),
    failed: t("quoteShareFailed"),
  }[state.at];
  const ground =
    state.at === "making" ? "var(--gi-ink-soft)" : state.at === "ready" ? "var(--bot-ok)" : state.at === "failed" ? "var(--bot-red-ink)" : undefined;

  return (
    <button
      type="button"
      onClick={click}
      disabled={state.at === "making"}
      aria-live="polite"
      className={className}
      style={ground ? { ...style, background: ground } : style}
    >
      <Icon name="send" className="h-4 w-4" />
      {words}
    </button>
  );
}
