"use client";
import { useEffect, useRef } from "react";
import { preparePrint, registerPrepare } from "@/lib/quote-pdf/prepare";

/**
 * Sits inside a `.print-table` section and tells the page how to make that section the sheet,
 * for the server's headless Chrome. The tables are server-rendered, so the effect lives here.
 * The undo is not kept: that browser is thrown away after printing.
 */
export function PdfPrepare() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const section = ref.current?.closest(".print-table");
    if (section) registerPrepare(() => { preparePrint(section); });
  }, []);
  return <span ref={ref} hidden />;
}
