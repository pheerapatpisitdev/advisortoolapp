import { refuseUnless } from "@/lib/auth/viewer";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { decodePrintQuote, encodePrintQuote, imageFileName, readPrintQuote, type PrintQuote } from "@/lib/group-insurance/print-link";
import { renderPagePictures } from "@/lib/quote-pdf/render";
import { siteOrigin } from "@/lib/site-url";

/**
 * The group-insurance quotation as pictures, one per A4 page — "บันทึกรูป" beside the PDF
 * (owner, 2026-11-26, ข on mockup https://claude.ai/artifact/86CucwWJ4FZdEBHtJeMPtE).
 *
 * Taken of the same page the PDF is printed from (/group-insurance/sheet), so a picture is the
 * page the PDF would have printed.
 *
 *   POST  the quotation          → { pages: [{ name, png (base64) }] }, for the share sheet or a download
 *   GET   ?q= (the sheet's own)  → a page of the pictures, for LINE's and Facebook's browsers, which
 *                                  share no files: the agent presses and holds a picture to save it
 */

export const runtime = "nodejs";
export const maxDuration = 60;

/** six a minute per caller, as the PDF */
const allow = limiter(6, 60_000);

const refused = (status: number, error: string) => Response.json({ ok: false, error }, { status });
const CANNOT = "ทำรูปจากใบเสนอราคานี้ไม่ได้ครับ";
const FAILED = "ทำรูปไม่สำเร็จครับ ลองใหม่อีกครั้ง";

async function pictures(quote: PrintQuote): Promise<{ name: string; png: string }[]> {
  const shots = await renderPagePictures(`${siteOrigin()}/group-insurance/sheet?q=${encodePrintQuote(quote)}`, { timeoutMs: 45_000 });
  return shots.map((b, i) => ({ name: imageFileName(quote, i + 1, shots.length), png: b.toString("base64") }));
}

export async function POST(req: Request): Promise<Response> {
  const refusal = await refuseUnless();
  if (refusal) return refusal;
  if (!allow(clientIp(req.headers))) return refused(429, "รอสักครู่แล้วลองใหม่นะครับ");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return refused(400, CANNOT);
  }
  const quote = readPrintQuote(body);
  if (!quote) return refused(400, CANNOT);
  try {
    return Response.json({ pages: await pictures(quote) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("group-quote-image: render failed", e);
    return refused(503, FAILED);
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function GET(req: Request): Promise<Response> {
  const refusal = await refuseUnless();
  if (refusal) return refusal;
  if (!allow(clientIp(req.headers))) return refused(429, "รอสักครู่แล้วลองใหม่นะครับ");
  const quote = decodePrintQuote(new URL(req.url).searchParams.get("q") ?? undefined);
  if (!quote) return refused(400, CANNOT);
  let pages: { name: string; png: string }[];
  try {
    pages = await pictures(quote);
  } catch (e) {
    console.error("group-quote-image: render failed", e);
    return refused(503, FAILED);
  }
  const en = quote.lang === "en";
  const hint = en ? "Press and hold a picture to save it." : "กดค้างที่รูปเพื่อบันทึกลงเครื่อง";
  const html = `<!doctype html><html lang="${en ? "en" : "th"}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(pages[0]?.name ?? "")}</title>
<style>body{margin:0;background:#eef0f4;font-family:system-ui,sans-serif;color:#17203a}
p{margin:0;padding:14px 16px;text-align:center;font-size:15px;font-weight:600}
img{display:block;width:calc(100% - 24px);max-width:820px;margin:0 auto 16px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.15)}</style>
</head><body><p>${hint}</p>
${pages.map((p) => `<img src="data:image/png;base64,${p.png}" alt="${escapeHtml(p.name)}">`).join("\n")}
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
