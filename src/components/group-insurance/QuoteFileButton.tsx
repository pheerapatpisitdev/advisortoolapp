"use client";
import { useEffect, useMemo, useState } from "react";
import { imageFileName, pdfFileName, type PrintQuote } from "@/lib/group-insurance/print-link";
import type { Key as TranslationKey } from "@/lib/group-insurance/translations";
import { Icon } from "./Icon";
import { useLang } from "./lang";

type Kind = "pdf" | "image";

type State =
  | { at: "idle" }
  | { at: "making" }
  /** made, waiting for a tap: the one that asked for it ran out while the server worked */
  | { at: "ready"; files: File[] }
  /** made, but this browser shares no such files: a tap opens them at an address instead */
  | { at: "link" }
  | { at: "failed" };

/** the server's routes for each kind: POST the quotation, or GET it at an address (?q=) */
const ROUTE: Record<Kind, string> = { pdf: "/api/group-quote-pdf", image: "/api/group-quote-image" };

const WORDS: Record<Kind, Record<State["at"], TranslationKey>> = {
  pdf: { idle: "quoteShareBtn", making: "quoteShareMaking", ready: "quoteShareReady", link: "quoteOpenPdf", failed: "quoteShareFailed" },
  image: { idle: "quoteImageBtn", making: "quoteImageMaking", ready: "quoteImageReady", link: "quoteOpenImage", failed: "quoteImageFailed" },
};

/** the quotation as the sheet page's `q` (print-link.ts encodePrintQuote), made in the browser */
function encodeInBrowser(quote: PrintQuote): string {
  const bytes = new TextEncoder().encode(JSON.stringify(quote));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** a share sheet that takes files: Safari and Chrome, not LINE's or Facebook's browser */
const sharesFiles = () =>
  typeof navigator !== "undefined" && typeof navigator.canShare === "function" &&
  navigator.canShare({ files: [new File(["x"], "x.pdf", { type: "application/pdf" })] });

async function filesFrom(kind: Kind, res: Response, quote: PrintQuote): Promise<File[]> {
  if (kind === "pdf") {
    if (!res.headers.get("content-type")?.includes("pdf")) throw new Error("not a PDF");
    return [new File([await res.blob()], pdfFileName(quote), { type: "application/pdf" })];
  }
  const { pages } = (await res.json()) as { pages?: { name: string; png: string }[] };
  if (!pages?.length) throw new Error("no pictures");
  return pages.map((p) => {
    const bin = atob(p.png);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], p.name || imageFileName(quote, 1, 1), { type: "image/png" });
  });
}

/**
 * The quotation's file buttons beside the preview: "แชร์ PDF" (owner, 2026-11-20, ก on mockup
 * https://claude.ai/artifact/GKqLffrJ2XAMb83cakFLnh) and "บันทึกรูป", a picture per page
 * (owner, 2026-11-26, ข on mockup https://claude.ai/artifact/86CucwWJ4FZdEBHtJeMPtE).
 *
 * The server makes the file from the quotation, POSTed, because it exists only in this browser.
 * Then, by where the agent is:
 * - a phone or a tablet with a share sheet for files: the share sheet, in the same two taps as
 *   iHealthy's (src/components/ihealthy/PdfButton.tsx) — the sheet wants a fresh tap and the file
 *   takes ten seconds or more, so the first tap usually ends with the button asking for a second;
 * - LINE's or Facebook's browser, which shares no files and blocks a page opened after a wait:
 *   the button is a link to the same file at an address (GET ?q=), opened by the tap itself;
 * - a computer (`download`): the files are saved, one per page.
 *
 * A file made for one name is not the file for another: typing in the name box (a new `quote`)
 * sends the button back to the start.
 */
export function QuoteFileButton({ kind, quote, download, className, style }: {
  kind: Kind;
  quote: PrintQuote;
  /** a computer: save the files rather than share them */
  download?: boolean;
  className: string;
  style?: React.CSSProperties;
}) {
  const { t } = useLang();
  const [state, setState] = useState<State>({ at: "idle" });
  useEffect(() => setState({ at: "idle" }), [quote]);
  // asked once the page is in the browser; the dialog opens on a tap, never in the server's render
  const [canShare] = useState(sharesFiles);
  const href = useMemo(() => `${ROUTE[kind]}?q=${encodeInBrowser(quote)}`, [kind, quote]);

  const save = (files: File[]) => {
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
    setState({ at: "idle" });
  };

  const hand = async (files: File[]) => {
    if (download) return save(files);
    if (!navigator.canShare?.({ files })) return setState({ at: "link" });
    try {
      await navigator.share({ files });
      setState({ at: "idle" });
    } catch (e) {
      // closed by the agent, or refused because the tap that asked has expired
      setState(e instanceof DOMException && e.name === "AbortError" ? { at: "idle" } : { at: "ready", files });
    }
  };

  const click = async () => {
    if (state.at === "making") return;
    if (state.at === "ready") return hand(state.files);
    setState({ at: "making" });
    try {
      const res = await fetch(ROUTE[kind], {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(quote),
      });
      if (!res.ok) throw new Error(String(res.status));
      await hand(await filesFrom(kind, res, quote));
    } catch {
      setState({ at: "failed" });
    }
  };

  const ground =
    state.at === "making" ? "var(--gi-ink-soft)"
      : state.at === "ready" || state.at === "link" ? "var(--bot-ok)"
        : state.at === "failed" ? "var(--bot-red-ink)" : undefined;
  const look = ground ? { ...style, background: ground, color: "white", borderColor: "transparent" } : style;
  const icon = kind === "pdf" ? "send" : "image";

  // no share sheet for files, and not a computer: the tap itself opens the file's address
  if (!download && (!canShare || state.at === "link")) {
    return (
      <a href={href} target="_blank" rel="noopener" className={className} style={state.at === "link" ? look : style}
        onClick={() => state.at === "link" && setTimeout(() => setState({ at: "idle" }), 500)}>
        <Icon name={icon} className="h-4 w-4" />
        {t(WORDS[kind][state.at === "link" ? "link" : "idle"])}
      </a>
    );
  }

  return (
    <button type="button" onClick={click} disabled={state.at === "making"} aria-live="polite" className={className} style={look}>
      <Icon name={icon} className="h-4 w-4" />
      {t(WORDS[kind][state.at])}
    </button>
  );
}
