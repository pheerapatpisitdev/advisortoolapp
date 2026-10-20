import { extractText, getDocumentProxy } from "unpdf";
import { findReportUrl, parseWeeklyReport, REPORT_FALLBACK, REPORT_PAGE, type IndexWeek } from "./parse";

/** The text of a PDF, every page run together. */
export async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function get(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { "user-agent": "Mozilla/5.0 (advisortool.app)" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${url} ตอบ ${res.status}`);
  return res;
}

/**
 * The report as Krungthai-AXA publishes it now: the product page names the file (its address
 * changes with each upload), then the file is read. `known` is the address that worked last time,
 * tried when the page cannot be read. Throws, in Thai, when no weeks could be read.
 */
export async function readWeeklyReport(known?: string | null, init?: RequestInit): Promise<{ url: string; weeks: IndexWeek[] }> {
  let url = known || REPORT_FALLBACK;
  try {
    url = findReportUrl(await (await get(REPORT_PAGE, init)).text()) ?? url;
  } catch (e) {
    console.warn("[index-levels] product page not read, using the last report address:", e);
  }
  const bytes = new Uint8Array(await (await get(url, init)).arrayBuffer());
  const weeks = parseWeeklyReport(await pdfText(bytes));
  if (!weeks.length) throw new Error("อ่าน PDF ได้แต่ไม่พบแถวราคาดัชนี (รูปแบบไฟล์อาจเปลี่ยน)");
  return { url, weeks };
}
