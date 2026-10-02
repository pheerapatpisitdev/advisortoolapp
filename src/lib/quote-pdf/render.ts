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
  // started before anything slow: unpacking the 67 MB Chrome and launching it are most of a
  // cold start, and the route's own limit is 60 s, so a bound that began after them could
  // leave the caller with the platform's 504 instead of the fallback page
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`quote PDF took over ${timeoutMs} ms`)), timeoutMs);
  });
  // two paths on purpose: chromium.args are serverless Linux flags (--single-process,
  // --no-zygote) that crash a desktop Chrome, so a local CHROME_PATH gets puppeteer's defaults
  const launching = (async () =>
    process.env.CHROME_PATH
      ? puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, timeout: timeoutMs })
      : puppeteer.launch({
          executablePath: await chromium.executablePath(),
          args: chromium.args,
          headless: "shell", // the build ships headless_shell, as the package's README prescribes
          timeout: timeoutMs,
        }))();
  // a launch nobody is waiting for any more must not become an unhandled rejection
  launching.catch(() => {});
  try {
    const work = (async () => {
      const browser = await launching;
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
    // closes the browser whether it came up before the deadline or only after it
    launching.then((b) => b.close()).catch(() => {});
  }
}
