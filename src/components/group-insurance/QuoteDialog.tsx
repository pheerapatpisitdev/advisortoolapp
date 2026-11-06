"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { QuoteSheet } from "@/lib/group-insurance/sheet";
import { preparePrint } from "@/lib/quote-pdf/prepare";
import { Icon } from "./Icon";
import { useLang } from "./lang";
import { QuoteSheetDoc } from "./QuoteSheetDoc";

const SHEET_WIDTH = 794;

/**
 * The quotation, before it is handed over.
 *
 * It is a preview and not a download, and the difference matters: the customer's name is
 * typed here, over a sheet that redraws as it is typed, so an agent sees the document their
 * customer will see rather than discovering the misspelling in a file.
 *
 * The file is made by the browser's own print dialog, where "Save as PDF" is waiting. The
 * standalone tool shipped jsPDF and html2canvas — 560KB of vendor script — to rasterise this
 * same sheet, and `PrintButton` sets out at length why that trade was refused elsewhere in
 * this app: the raster loses selectable text, and it gets Thai combining marks wrong in
 * exactly the words a life-insurance quotation is full of. So the three buttons the old tool
 * had — view, print, download — are one button here, because the browser's dialog does all
 * three and does them better.
 *
 * The sheet is drawn at its true 794px and scaled down to fit the viewport, rather than laid
 * out responsively. A responsive preview would be a different document from the printed one,
 * which is the one thing a preview may not be.
 */
export function QuoteDialog({
  sheet, quoteNo, quoteDate, onClose,
}: {
  sheet: QuoteSheet;
  quoteNo: string;
  quoteDate: string;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [customerName, setCustomerName] = useState("");
  const [scale, setScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Escape closes it, and the page behind does not scroll under it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("gi-modal-open");
    nameRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("gi-modal-open");
    };
  }, [onClose]);

  /**
   * Shrink the sheet until it fits, never grow it past life size.
   *
   * Measured rather than computed from a breakpoint because the sheet's width is fixed and
   * the window's is not: at 1400px it fits whole, on a phone it lands near a third.
   *
   * Its natural height is measured too, because a `transform` leaves layout alone: the
   * scaled sheet still reserves its full height, and without this the scroll box ends in a
   * field of grey as tall as the part that was scaled away.
   */
  useLayoutEffect(() => {
    const box = frame.current;
    const doc = sheetRef.current;
    if (!box || !doc) return;
    const measure = () => {
      setScale(Math.min(1, (box.clientWidth - 32) / SHEET_WIDTH));
      // offsetHeight is the untransformed height, which is the one being scaled
      setSheetHeight(doc.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(doc);
    return () => observer.disconnect();
  }, []);

  /**
   * Keeps the sheet alone on paper for as long as the dialog is open.
   *
   * Marked here and not by the print button, because an iPhone makes its PDF after the button's
   * code has finished: marks set and removed around `window.print()` were gone by then, and the
   * whole page came out with the dialog's backdrop across the table (two PDFs from the owner,
   * Safari and Chrome on iOS, 2026-11-06). The share sheet's own Print never passes through the
   * button at all. The mark does nothing on screen; it is read only by the print rules.
   */
  useEffect(() => {
    const target = sheetRef.current;
    return target ? preparePrint(target) : undefined;
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gi-quote-title"
      className="gi-quote-root fixed inset-0 z-[300] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-[rgba(2,33,98,0.42)] backdrop-blur-sm"
      />
      <div className="gi-dialog relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-[var(--gi-panel)] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5" style={{ background: "var(--gi-navy)" }}>
          <h2 id="gi-quote-title" className="font-bold text-white">
            {t("quotePreview")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label={t("close")}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-[var(--gi-line)] bg-[var(--gi-sunken)] px-5 py-3">
          <label htmlFor="gi-customer" className="mb-1.5 block text-sm font-medium text-[var(--gi-ink-soft)]">
            {t("customerName")}
          </label>
          <input
            id="gi-customer"
            ref={nameRef}
            type="text"
            value={customerName}
            placeholder={t("customerNamePlaceholder")}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full rounded-lg border border-[var(--gi-line-strong)] bg-[var(--gi-panel)] px-4 py-2.5 text-[var(--gi-ink)]"
          />
        </div>

        <div ref={frame} className="gi-sheet-frame flex-1 overflow-auto bg-[var(--bot-panel)] p-4">
          <div
            className="gi-sheet-box shadow-md"
            style={{ width: SHEET_WIDTH * scale, height: sheetHeight * scale, margin: "0 auto" }}
          >
            <div
              ref={sheetRef}
              className="gi-sheet-scale"
              style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: SHEET_WIDTH }}
            >
              <QuoteSheetDoc sheet={sheet} customerName={customerName} quoteNo={quoteNo} quoteDate={quoteDate} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--gi-line)] px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--gi-line-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--gi-ink-soft)] hover:bg-[var(--gi-sunken)]"
          >
            {t("close")}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--gi-navy)" }}
          >
            <Icon name="printer" className="h-4 w-4" />
            {t("quotePrintBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
