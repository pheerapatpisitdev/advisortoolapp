"use client";
import { useEffect, useState } from "react";

type State =
  | { at: "idle" }
  | { at: "making" }
  /** made, waiting for a tap: the one that asked for it ran out while the server worked */
  | { at: "ready"; file: File }
  | { at: "failed" };

/** a finger rather than a mouse: a phone or a tablet */
const onPhone = () => window.matchMedia("(pointer: coarse)").matches;

/**
 * The page's "พิมพ์ หรือบันทึก PDF", which on a phone asks our server for the file.
 *
 * A computer still gets the browser's own print dialog. A phone often has none to give: an
 * iPhone opens no print sheet for a page started from its home-screen icon, nor inside LINE or
 * Facebook, so the button did nothing (owner, 2026-10-25, mockup
 * https://claude.ai/artifact/6Wk2LKxWA5hqojpF2LfnHt). There the file is the one the bot sends,
 * the page printed in headless Chrome (/api/quote-pdf), and it goes to the share sheet.
 *
 * The share sheet wants a fresh tap and the file takes ten seconds or more, so the first tap
 * usually ends with the file ready and the button asking for a second one.
 */
export function PdfButton(
  { path, filename, className, words }: {
    /** the PDF route's address for the arrangement on screen; none where no price is shown */
    path?: string;
    filename: string;
    className: string;
    words: { idle: string; making: string; ready: string; failed: string };
  },
) {
  const [state, setState] = useState<State>({ at: "idle" });
  // another arrangement is another file
  useEffect(() => setState({ at: "idle" }), [path]);

  const hand = async (file: File) => {
    if (!navigator.canShare?.({ files: [file] })) {
      // no share sheet for files: the server's copy opens in a tab of its own, saved from there
      window.open(path, "_blank");
      setState({ at: "idle" });
      return;
    }
    try {
      await navigator.share({ files: [file] });
      setState({ at: "idle" });
    } catch (e) {
      // closed by the reader, or refused because the tap that asked has expired
      setState(e instanceof DOMException && e.name === "AbortError" ? { at: "idle" } : { at: "ready", file });
    }
  };

  const click = async () => {
    if (!path || !onPhone()) {
      window.print();
      return;
    }
    if (state.at === "making") return;
    if (state.at === "ready") {
      await hand(state.file);
      return;
    }
    setState({ at: "making" });
    try {
      const res = await fetch(path);
      if (!res.ok || !res.headers.get("content-type")?.includes("pdf")) throw new Error(String(res.status));
      await hand(new File([await res.blob()], filename, { type: "application/pdf" }));
    } catch {
      setState({ at: "failed" });
    }
  };

  return (
    <button type="button" onClick={click} disabled={state.at === "making"} aria-live="polite" className={className}>
      {words[state.at]}
    </button>
  );
}
