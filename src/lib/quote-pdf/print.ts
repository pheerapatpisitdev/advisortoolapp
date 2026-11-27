import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import type { PrintCookie } from "@/lib/draw/remote";
import type { PrintedLang } from "@/lib/quote-pdf/langs";

/** How long the answer waits for Chrome to go away before it leaves it to go on its own. */
const CLOSE_WAIT_MS = 2_000;

/**
 * Prints one of our own pages to PDF in headless Chrome, as the page's "บันทึกเป็น PDF" button
 * does in a browser. Chrome itself — run by the draw service (draw/server.ts) or, when that is
 * not set or did not answer, by this server; the cookies the page needs are the caller's
 * (render.ts), since only the app holds the secrets they are made from.
 *
 * The caller passes a URL it built from `siteOrigin()` and one of the six page paths; nothing
 * here checks that, because the route is the only caller and the one place that decides it.
 * `CHROME_PATH` points local dev at an installed Chrome; on Vercel the bundled build is used.
 */

/**
 * The faces the server's Chrome is missing for a language. The bundled build carries Open Sans
 * and nothing else — Latin and Cyrillic — and the page brings its own Thai, so Chinese and
 * Burmese would print as boxes. Google's stylesheet cuts each face into unicode-range slices,
 * so only the slices the page's letters fall in are downloaded.
 */
const SCRIPT_FACE: Partial<Record<PrintedLang, string>> = { zh: "Noto Sans SC", my: "Noto Sans Myanmar" };

type OurPageOpts = { timeoutMs?: number; lang?: PrintedLang; cookies?: PrintCookie[] };
type OpenPage = Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>["newPage"]>>;

/**
 * `lang` fetches the faces that language needs; `cookies` are set before the page is opened.
 */
export async function printPdfHere(url: string, opts: OurPageOpts = {}): Promise<Buffer> {
  return onOurPage(url, opts, undefined, async (page) => Buffer.from(await page.pdf({ printBackground: true, preferCSSPageSize: true })));
}

/** A4 at 96 dpi, and the 12 mm margin the print rules give the paper (group-insurance theme.css) */
const A4 = { width: 794, height: 1123, margin: 45 };

/**
 * The page as pictures, one A4 sheet each — the group quotation's "บันทึกรูป" (owner,
 * 2026-11-26, ข: a picture per page). Laid out with the print rules at the paper's width and
 * cut where no line of text runs across, as close to the bottom of each sheet as that allows,
 * so a picture is the page the PDF would have printed. PNGs at twice the size, sharp on a phone.
 */
export async function shootPagesHere(url: string, opts: OurPageOpts = {}): Promise<Buffer[]> {
  return onOurPage(url, opts, { width: A4.width, height: A4.height, deviceScaleFactor: 2 }, async (page) => {
    await page.addStyleTag({
      content: `html, body { background: #fff !important; margin: 0 !important; }
        body { padding: ${A4.margin}px !important; box-sizing: border-box; }`,
    });
    const room = A4.height - 2 * A4.margin;
    const cuts = await page.evaluate((room: number, top: number) => {
      // a cut may fall at y when nothing that must stay whole runs across y: a line of text, or a
      // box drawn with a ground or a border (a row, the navy total), when it fits on one sheet
      const whole: [number, number][] = [];
      const tops = new Set<number>();
      let end = top;
      for (const el of document.querySelectorAll<HTMLElement>("body *")) {
        const r = el.getBoundingClientRect();
        if (!r.height || !r.width) continue;
        const y0 = r.top + window.scrollY, y1 = r.bottom + window.scrollY;
        end = Math.max(end, y1);
        tops.add(Math.floor(y0));
        const cs = getComputedStyle(el);
        const drawn = !/^(TABLE|TBODY|THEAD)$/.test(el.tagName) && r.height < room / 2 &&
          (!/rgba\(.*,\s*0\)|transparent/.test(cs.backgroundColor) || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0);
        if (drawn || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())) whole.push([y0, y1]);
      }
      const clean = (y: number) => whole.every(([a, b]) => !(a < y && y < b));
      const pages: [number, number][] = [];
      let at = top;
      while (end - at > 1) {
        const limit = at + room;
        if (limit >= end) { pages.push([at, end]); break; }
        const best = [...tops].filter((y) => y > at + room / 3 && y <= limit && clean(y)).sort((a, b) => b - a)[0];
        const cut = best ?? limit;
        pages.push([at, cut]);
        at = cut;
      }
      return pages;
    }, room, A4.margin);
    const shots: Buffer[] = [];
    for (const [from, to] of cuts) {
      // what belongs to the sheets before and after is hidden under white, as the paper's margins hide it
      await page.evaluate((from: number, to: number) => {
        for (const [id, top, height] of [["__sheet-head", 0, from], ["__sheet-foot", to, 100000]] as const) {
          document.getElementById(id)?.remove();
          const cover = document.createElement("div");
          cover.id = id;
          cover.style.cssText = `position:absolute;left:0;right:0;top:${top}px;height:${height}px;background:#fff;z-index:2147483647`;
          document.body.append(cover);
        }
      }, from, to);
      shots.push(Buffer.from(await page.screenshot({
        type: "png",
        clip: { x: 0, y: from - A4.margin, width: A4.width, height: A4.height },
        captureBeyondViewport: true,
      })));
    }
    return shots;
  });
}

/** Opens one of our pages ready to print — logged in, seeded, in Bangkok's time — and hands it to `use`. */
async function onOurPage<T>(
  url: string, opts: OurPageOpts, viewport: { width: number; height: number; deviceScaleFactor: number } | undefined,
  use: (page: OpenPage) => Promise<T>,
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 45_000;
  // started before anything slow: unpacking the 67 MB Chrome and launching it are most of a
  // cold start, and the route's own limit is 60 s, so a bound that began after them could
  // leave the caller with the platform's 504 instead of the fallback page
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`quote page took over ${timeoutMs} ms`)), timeoutMs);
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
      if (viewport) await page.setViewport(viewport);
      await page.emulateMediaType("print");
      // the page stamps "พิมพ์เมื่อ" with the browser's clock, and a server's zone is UTC: a
      // quote printed at eight in the morning would say one in the morning
      await page.emulateTimezone("Asia/Bangkok");
      for (const c of opts.cookies ?? []) await page.setCookie({ ...c, url });
      await page.goto(url, { waitUntil: "networkidle0", timeout: timeoutMs });
      // set by the calculator once it has seeded itself from the link; printing before that
      // would print the default figures
      await page.waitForSelector('html[data-pdf-ready="1"]', { timeout: timeoutMs });
      const face = opts.lang ? SCRIPT_FACE[opts.lang] : undefined;
      if (face) {
        await page.evaluate(async (family: string) => {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@400;600&display=block`;
          await new Promise((done) => { link.onload = link.onerror = done; document.head.append(link); });
          // added last to every element's own list, so Plex keeps the Thai, the Latin and the figures
          for (const el of document.querySelectorAll<HTMLElement>("body, body *")) {
            el.style.fontFamily = `${getComputedStyle(el).fontFamily}, "${family}"`;
          }
          const text = document.body.innerText;
          await Promise.all([document.fonts.load(`400 16px "${family}"`, text), document.fonts.load(`600 16px "${family}"`, text)]);
          await document.fonts.ready;
        }, face);
      }
      // the tables open their own sections for print; a page without the hook has nothing to open
      await page.evaluate(() => {
        const hook = (window as unknown as { __quotePdf?: { prepare?: () => unknown } }).__quotePdf;
        return hook?.prepare?.();
      });
      return use(page);
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
