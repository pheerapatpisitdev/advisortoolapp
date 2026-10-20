/**
 * Reading Krungthai-AXA's weekly report of the Citi Grandmaster RC 5 Index (owner chose ก,
 * 2026-10-20; mockup https://claude.ai/artifact/7Y9hw3W7n372ejfzjcqFQh). The report is a one-page
 * PDF listing the index level every Monday and that day's Bank of Thailand baht rate; these are the
 * pure parts — the text out of the PDF goes in, the weeks come out.
 */

/** one Monday in the report */
export interface IndexWeek {
  /** yyyy-mm-dd, Christian era, as the report prints it */
  date: string;
  level: number;
  /** baht per US dollar */
  fx: number;
}

/** the product page that links the current report — the report's own address changes with each upload */
export const REPORT_PAGE = "https://www.krungthai-axa.co.th/th/products/performance/global-saving-plus-15-8";

/** the report's address as it was on 2026-10-20, used when the page cannot be read */
export const REPORT_FALLBACK = "https://thailandgi-ktaxa.cdn.prismic.io/thailandgi-ktaxa/TreTaeFnBDYs9CKD_GlobalSaving_15_8_WeeklyReport.pdf";

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** "… Citi Grandmaster RC 5 Index 05 October 2026 282.81 33.4241" — the row number before it is ignored (the report repeats one) */
const ROW = /Grandmaster\s+RC\s*5\s+Index\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/g;

/** The weeks in the report's text, oldest first, one per date; rows that do not read as a real date are left out. */
export function parseWeeklyReport(text: string): IndexWeek[] {
  const byDate = new Map<string, IndexWeek>();
  for (const m of text.matchAll(ROW)) {
    const month = MONTHS[m[2].toLowerCase()];
    const day = Number(m[1]), year = Number(m[3]);
    if (!month) continue;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCDate() !== day) continue;
    const level = Number(m[4]), fx = Number(m[5]);
    if (!(level > 0) || !(fx > 0)) continue;
    const date = d.toISOString().slice(0, 10);
    byDate.set(date, { date, level, fx });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** The weekly report's address on the product page, or null when the page no longer links one. */
export function findReportUrl(html: string): string | null {
  const m = html.match(/https:\/\/[^"'\s<>]+?WeeklyReport[^"'\s<>]*?\.pdf/i);
  return m ? m[0].replace(/&amp;/g, "&") : null;
}
