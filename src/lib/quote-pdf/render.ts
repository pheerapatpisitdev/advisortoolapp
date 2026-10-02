import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { LANG_COOKIE } from "@/lib/ihealthy-lang";

/** How long the answer waits for Chrome to go away before it leaves it to go on its own. */
const CLOSE_WAIT_MS = 2_000;

/**
 * Prints one of our own pages to PDF in headless Chrome, as the page's "บันทึกเป็น PDF" button
 * does in a browser.
 *
 * The caller passes a URL it built from `siteOrigin()` and one of the six page paths; nothing
 * here checks that, because the route is the only caller and the one place that decides it.
 * `CHROME_PATH` points local dev at an installed Chrome; on Vercel the bundled build is used.
 */
/**
 * `lang: "en"` prints the iHealthy page in English. The page reads its language from a cookie
 * and nothing else (src/lib/ihealthy-lang.ts), so the cookie is set before the page is opened.
 */
export async function renderQuotePdf(url: string, opts: { timeoutMs?: number; lang?: "en" } = {}): Promise<Buffer> {
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
  // set the moment Chrome is up — before the work below resumes — so the end can tell a browser
  // that came up in time from one still on its way
  let up: Awaited<typeof launching> | undefined;
  launching.then((b) => { up = b; }, () => {});
  try {
    const work = (async () => {
      const browser = await launching;
      const page = await browser.newPage();
      await page.emulateMediaType("print");
      // the page stamps "พิมพ์เมื่อ" with the browser's clock, and a server's zone is UTC: a
      // quote printed at eight in the morning would say one in the morning
      await page.emulateTimezone("Asia/Bangkok");
      if (opts.lang === "en") await page.setCookie({ name: LANG_COOKIE, value: "en", url });
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
    if (up) {
      // waited for, briefly: a warm instance answers the next request with this one's Chrome
      // still running otherwise, and the two share one function's memory
      let wait: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        up.close().catch(() => {}),
        new Promise<void>((resolve) => { wait = setTimeout(resolve, CLOSE_WAIT_MS); }),
      ]);
      clearTimeout(wait);
    } else {
      // still on its way after the deadline: closed when it arrives, with nobody waiting for it
      launching.then((b) => b.close()).catch(() => {});
    }
  }
}
