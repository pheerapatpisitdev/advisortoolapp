import { cardVersionFor } from "@/lib/card-theme";
import { bearerMatches } from "@/lib/cron-auth";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { initialFrom, queryFrom } from "@/lib/ihealthy-link";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { PLAN_PAGES, type PlanPage } from "@/lib/quote-pdf/pages";
import { EXTERNAL_BROWSER, pagePathFor, planInitialFrom, planQueryFor } from "@/lib/quote-pdf/link";
import { renderQuotePdf } from "@/lib/quote-pdf/render";
import { siteOrigin } from "@/lib/site-url";

/**
 * The quote PDF the chat bot sends: our own sales page, pre-filled from its link, printed in
 * headless Chrome — the same file the page's "บันทึกเป็น PDF" button makes.
 *
 * Chrome is only ever pointed at `siteOrigin()` plus one of the six page paths, with a query
 * this route wrote itself from values the page's own rules accepted. Nothing from the caller
 * reaches the URL as written, which is what keeps this from being a way to print any address.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";
/** six a minute per caller: a person asks once; a script asks at once */
const allow = limiter(6, 60_000);

const PLAN_KEYS = new Set(["page", "v", EXTERNAL_BROWSER, "age", "sex", "sum", "variant"]);
/** every key `queryFrom` writes; `r` is the one a link repeats, once per rider */
const IHEALTHY_KEYS = new Set(["page", "v", EXTERNAL_BROWSER, "age", "sex", "base", "sa", "plan", "area", "cover", "mode", "r"]);

function html(status: number, body: string): Response {
  return new Response(
    `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<body style="font-family:sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.6">${body}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

const invalid = () => html(400, "<p>ลิงก์นี้ทำเป็นไฟล์ PDF ไม่ได้ครับ</p>");

/** key=value pairs in a fixed order, so two spellings of one query compare equal */
function pairs(params: URLSearchParams, skip: string[]): string[] {
  return [...params].filter(([k]) => !skip.includes(k)).map(([k, v]) => `${k}=${v}`).sort();
}

export async function GET(req: Request): Promise<Response> {
  // the bot's own fetch carries the cron secret and is not a caller to limit
  const secret = process.env.CRON_SECRET;
  const isBot = secret !== undefined && secret !== "" && bearerMatches(req.headers.get("authorization"), secret);
  if (!isBot && !allow(clientIp(req.headers))) return html(429, "<p>รอสักครู่แล้วขอใหม่นะครับ</p>");

  const params = new URL(req.url).searchParams;
  const page = params.get("page");
  const isIHealthy = page === "ihealthy-ultra";
  if (!isIHealthy && !(page !== null && Object.hasOwn(PLAN_PAGES, page))) return invalid();

  const allowed = isIHealthy ? IHEALTHY_KEYS : PLAN_KEYS;
  for (const key of new Set(params.keys())) {
    if (!allowed.has(key)) return invalid();
    if (key !== "r" && params.getAll(key).length > 1) return invalid();
  }
  // LINE's flag has one spelling; anything else in it is not LINE's
  if (params.has(EXTERNAL_BROWSER) && params.get(EXTERNAL_BROWSER) !== "1") return invalid();

  let target: string;
  let name: string;
  let pdfPath: string;
  if (isIHealthy) {
    const table = iHealthyTable();
    const query: Record<string, string[]> = {};
    for (const [k, v] of params) (query[k] ??= []).push(v);
    const initial = initialFrom(table, query);
    const written = queryFrom(table, initial);
    // the page snaps what it is given to something it sells; a link that was not already that
    // would print a page other than the one it asked for
    const skip = ["page", "v", EXTERNAL_BROWSER];
    if (pairs(new URLSearchParams(written), skip).join("&") !== pairs(params, skip).join("&")) return invalid();
    target = `${siteOrigin()}/ihealthy-ultra?${written}`;
    name = `ihealthy-ultra-${initial.sex}${initial.age}`;
    pdfPath = `/api/quote-pdf?page=ihealthy-ultra&${written}`;
  } else {
    const plan = page as PlanPage;
    const initial = planInitialFrom(plan, Object.fromEntries(params));
    if (!initial) return invalid();
    const query = planQueryFor(initial);
    target = `${siteOrigin()}${PLAN_PAGES[plan].path}?${query}`;
    name = `${plan}-${initial.sex}${initial.age}`;
    pdfPath = `/api/quote-pdf?page=${plan}&${query}`;
  }

  /**
   * The CDN caches by the whole address, so a `v` of the caller's choosing would be a fresh
   * Chrome on every request. Only the current one is printed; any other — an old link from
   * before the tables changed, or none at all — is sent to the current one, which is the same
   * file the bot links to now.
   */
  const v = cardVersionFor();
  if (params.get("v") !== v) {
    // relative, so it lands on whichever host was asked, behind whatever proxy asked it
    const current = new URL(req.url);
    current.searchParams.set("v", v);
    return new Response(null, {
      status: 308, headers: { location: `${current.pathname}${current.search}`, "cache-control": "no-store" },
    });
  }

  try {
    const pdf = await renderQuotePdf(target, { timeoutMs: 45_000 });
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${name}.pdf"`,
        "cache-control": CACHE,
      },
    });
  } catch (e) {
    console.error("quote-pdf: render failed", e);
    const link = pagePathFor(pdfPath);
    const a = link ? `<p><a href="${link.replace(/&/g, "&amp;")}">${link.replace(/&/g, "&amp;")}</a></p>` : "";
    return html(503, `<p>ส่งไฟล์ไม่สำเร็จครับ เปิดหน้านี้แล้วกดปุ่มบันทึก PDF ได้เลยครับ</p>${a}`);
  }
}
