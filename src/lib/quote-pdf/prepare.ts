/**
 * What the "บันทึกเป็น PDF" button does before it asks the browser to print, in a form the
 * server's headless Chrome can call too.
 *
 * The page announces itself in two steps, because the two things happen at different times:
 * `registerPrepare` says how to get the sheet ready (the table exists), and `markPdfReady`
 * says the figures on it are the ones the link asked for (the calculator has seeded). Child
 * effects run before their parent's, so a table that raised the flag on its own mount would
 * do it before the calculator above it had read the link.
 */

declare global {
  interface Window {
    __quotePdf?: { prepare: () => void };
  }
}

const MARK = "data-print-hide";

/**
 * Stamps the date and hides everything on the page but `target`; returns the undo.
 *
 * The rest of the page is hidden by walking up from the table and marking every sibling on
 * the way, rather than by the usual trick of hiding everything and pulling the target to the
 * top with `position: absolute`. That trick was tried first and printed a blank sheet: the
 * sales pages give every direct child of `.theme-legacy` `position: relative`, so "the top"
 * meant the top of some element halfway down the document. Hiding siblings needs to know
 * nothing about the page it is on, which is the property worth having here — six sales pages
 * with three different skins are what this runs inside.
 */
export function preparePrint(target: Element): () => void {
  const hidden: Element[] = [];

  /**
   * The date, written in at the moment the sheet is made.
   *
   * Not rendered with the component: a `new Date()` in something that hydrates is a
   * mismatch between the server's clock and the browser's, and the only moment this date
   * means anything is this one.
   */
  const stamp = target.querySelector("[data-printed-at]");
  stamp?.setAttribute(
    "data-printed-at",
    `พิมพ์เมื่อ ${new Date().toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" })}`,
  );

  for (let node: Element | null = target; node && node !== document.body; node = node.parentElement) {
    for (const sibling of Array.from(node.parentElement?.children ?? [])) {
      if (sibling !== node) {
        sibling.setAttribute(MARK, "");
        hidden.push(sibling);
      }
    }
  }

  return () => {
    for (const el of hidden) el.removeAttribute(MARK);
  };
}

/** The table says how to prepare the sheet; the server calls it just before printing. */
export function registerPrepare(prepare: () => void): void {
  window.__quotePdf = { prepare };
}

/** The page's figures are the ones asked for: the server may print now. */
export function markPdfReady(): void {
  document.documentElement.dataset.pdfReady = "1";
}
