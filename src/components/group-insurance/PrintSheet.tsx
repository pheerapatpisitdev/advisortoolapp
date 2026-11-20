"use client";
import { useEffect, useMemo } from "react";
import { groupInputs, type PrintQuote } from "@/lib/group-insurance/print-link";
import { buildQuoteSheet } from "@/lib/group-insurance/sheet";
import { LangProvider, useLang } from "./lang";
import { QuoteSheetDoc } from "./QuoteSheetDoc";

function Sheet({ quote }: { quote: PrintQuote }) {
  const { t } = useLang();
  const sheet = useMemo(() => buildQuoteSheet(quote.product, t, groupInputs(quote)), [quote, t]);

  // the printer waits for this (src/lib/quote-pdf/print.ts); the face first, or it prints boxes
  useEffect(() => {
    let live = true;
    document.fonts.ready.then(() => {
      if (live) document.documentElement.setAttribute("data-pdf-ready", "1");
    });
    return () => {
      live = false;
    };
  }, []);

  return <QuoteSheetDoc sheet={sheet} customerName={quote.customerName} quoteNo={quote.quoteNo} quoteDate={quote.quoteDate} />;
}

/** The quotation as the dialog draws it, in the language it was made in. */
export function PrintSheet({ quote }: { quote: PrintQuote }) {
  return (
    <LangProvider fixed={quote.lang}>
      <Sheet quote={quote} />
    </LangProvider>
  );
}
