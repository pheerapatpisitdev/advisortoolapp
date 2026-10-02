import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

/**
 * Prints one of our own pages to PDF in headless Chrome, as the page's "บันทึกเป็น PDF" button
 * does in a browser.
 *
 * The caller passes a URL it built from `siteOrigin()` and one of the six page paths; nothing
 * here checks that, because the route is the only caller and the one place that decides it.
 * `CHROME_PATH` points local dev at an installed Chrome; on Vercel the bundled build is used.
 */
export async function renderQuotePdf(url: string, opts: { timeoutMs?: number } = {}): Promise<Buffer> {
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? (await chromium.executablePath()),
    args: chromium.args,
    headless: true,
  });
  // the timer bounds launch-to-PDF as one; closing the browser is what unblocks a stuck page
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`quote PDF took over ${timeoutMs} ms`)), timeoutMs);
  });
  try {
    const work = (async () => {
      const page = await browser.newPage();
      await page.emulateMediaType("print");
      await page.goto(url, { waitUntil: "networkidle0", timeout: timeoutMs });
      // set by the calculator once it has seeded itself from the link; printing before that
      // would print the default figures
      await page.waitForSelector('html[data-pdf-ready="1"]', { timeout: timeoutMs });
      // the tables open their own sections for print; a page without the hook has nothing to open
      await page.evaluate(() => {
        const hook = (window as unknown as { __quotePdf?: { prepare?: () => unknown } }).__quotePdf;
        return hook?.prepare?.();
      });
      return Buffer.from(await page.pdf({ printBackground: true, preferCSSPageSize: true }));
    })();
    // a late rejection from the abandoned side must not become an unhandled one
    work.catch(() => {});
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
    await browser.close().catch(() => {});
  }
}
