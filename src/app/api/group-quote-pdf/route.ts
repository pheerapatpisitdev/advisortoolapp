import { refuseUnless } from "@/lib/auth/viewer";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { encodePrintQuote, pdfFileName, readPrintQuote } from "@/lib/group-insurance/print-link";
import { renderQuotePdf } from "@/lib/quote-pdf/render";
import { siteOrigin } from "@/lib/site-url";

/**
 * The group-insurance quotation as a PDF, for the phone's "แชร์ PDF" (owner, 2026-11-20, ก on
 * mockup https://claude.ai/artifact/GKqLffrJ2XAMb83cakFLnh).
 *
 * A computer prints the dialog itself. A phone often cannot — an iPhone opens no print sheet
 * from a home-screen icon, LINE or Facebook — so the dialog sends its quotation here, and this
 * prints /group-insurance/sheet in headless Chrome, as /api/quote-pdf does for the life pages.
 *
 * A POST, unlike /api/quote-pdf: the quotation is made in the agent's browser and lives nowhere
 * else, and nobody but the agent who made it asks for it, so there is no link to cache. Chrome
 * is only ever pointed at `siteOrigin()` + the sheet page, with a `q` this route wrote from a
 * quotation `readPrintQuote` accepted.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

/** six a minute per caller, as the life pages' PDF: an agent asks once, a script at once */
const allow = limiter(6, 60_000);

const refused = (status: number, error: string) => Response.json({ ok: false, error }, { status });

export async function POST(req: Request): Promise<Response> {
  const refusal = await refuseUnless();
  if (refusal) return refusal;
  if (!allow(clientIp(req.headers))) return refused(429, "รอสักครู่แล้วลองใหม่นะครับ");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return refused(400, "ทำไฟล์จากใบเสนอราคานี้ไม่ได้ครับ");
  }
  const quote = readPrintQuote(body);
  if (!quote) return refused(400, "ทำไฟล์จากใบเสนอราคานี้ไม่ได้ครับ");

  const target = `${siteOrigin()}/group-insurance/sheet?q=${encodePrintQuote(quote)}`;
  try {
    const pdf = await renderQuotePdf(target, { timeoutMs: 45_000 });
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        // the browser names the file itself (QuoteDialog); this is for a tab that opens it
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(pdfFileName(quote))}`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("group-quote-pdf: render failed", e);
    return refused(503, "ทำไฟล์ไม่สำเร็จครับ ลองใหม่อีกครั้ง");
  }
}
