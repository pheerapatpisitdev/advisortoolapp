import { PRINT_COOKIE, printPassFor } from "@/lib/auth/print-pass";
import { printPdfThere, shootPagesThere, drawServiceSet, type PrintCookie } from "@/lib/draw/remote";
import { LANG_COOKIE } from "@/lib/ihealthy-lang";
import type { PrintedLang } from "@/lib/quote-pdf/langs";

/**
 * Prints one of our own pages to PDF: on the draw service when it is set (src/lib/draw/remote.ts),
 * here when it is not or did not answer — Chrome itself is print.ts, the same on both.
 *
 * `lang` prints the iHealthy page in that language. The page reads its language from a cookie
 * and nothing else (src/lib/ihealthy-lang.ts), so the cookie is set before the page is opened.
 */
export async function renderQuotePdf(url: string, opts: { timeoutMs?: number; lang?: PrintedLang } = {}): Promise<Buffer> {
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const cookies: PrintCookie[] = [
    ...(opts.lang ? [{ name: LANG_COOKIE, value: opts.lang }] : []),
    // the calculators are for members only (owner, 2026-10-20); this Chrome has no session,
    // so it carries the printer's two-minute pass instead (src/lib/auth/print-pass.ts)
    { name: PRINT_COOKIE, value: printPassFor(), httpOnly: true },
  ];
  if (drawServiceSet()) {
    try {
      return await printPdfThere(url, { timeoutMs, cookies, ...(opts.lang ? { lang: opts.lang } : {}) });
    } catch (e) {
      console.warn("draw: PDF printed here, the service failed:", e instanceof Error ? e.message : e);
    }
  }
  return (await import("@/lib/quote-pdf/print")).printPdfHere(url, { timeoutMs, cookies, ...(opts.lang ? { lang: opts.lang } : {}) });
}

/**
 * One of our pages as pictures, one per A4 sheet (the group quotation's "บันทึกรูป"): on the
 * draw service when it is set, here when it is not or did not answer, as the PDF above.
 */
export async function renderPagePictures(url: string, opts: { timeoutMs?: number } = {}): Promise<Buffer[]> {
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const cookies: PrintCookie[] = [{ name: PRINT_COOKIE, value: printPassFor(), httpOnly: true }];
  if (drawServiceSet()) {
    try {
      return await shootPagesThere(url, { timeoutMs, cookies });
    } catch (e) {
      console.warn("draw: pictures taken here, the service failed:", e instanceof Error ? e.message : e);
    }
  }
  return (await import("@/lib/quote-pdf/print")).shootPagesHere(url, { timeoutMs, cookies });
}
