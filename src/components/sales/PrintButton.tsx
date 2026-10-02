"use client";
import { useRef } from "react";
import { preparePrint } from "@/lib/quote-pdf/prepare";

/**
 * Hands the table to the browser's own print pipeline, where "Save as PDF" is waiting.
 *
 * Nothing is generated here and that is the point. The text stays vector, so the file is
 * sharp at any zoom and the figures can be selected out of it; and the Thai is shaped by the
 * browser, which is what a PDF library would have had to be taught to do. Combining marks in
 * a word like เบี้ยสะสม are exactly where those get it wrong, on a document that goes to a
 * customer. That trade was put to the owner against a one-tap file, and this is the side they
 * chose.
 */
export function PrintButton({ className }: { className: string }) {
  const ref = useRef<HTMLButtonElement>(null);

  const print = () => {
    const target = ref.current?.closest(".print-table");
    const restore = target ? preparePrint(target) : () => {};

    // Chrome returns from print() once the dialog closes; Safari returns at once and leaves
    // it to the event. Both paths restore, and removing an attribute twice costs nothing.
    window.addEventListener("afterprint", restore, { once: true });
    try {
      window.print();
    } finally {
      restore();
    }
  };

  return (
    <button ref={ref} type="button" onClick={print} className={className}>
      บันทึกเป็น PDF
    </button>
  );
}
