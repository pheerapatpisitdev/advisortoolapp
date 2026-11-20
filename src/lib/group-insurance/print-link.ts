/**
 * A group-insurance quotation, written into one address for the server's PDF printer.
 *
 * The phone's "แชร์ PDF" (owner, 2026-11-20, ก on mockup
 * https://claude.ai/artifact/GKqLffrJ2XAMb83cakFLnh) cannot print the dialog the agent is
 * looking at: an iPhone opens no print sheet from a home-screen icon, LINE or Facebook. So the
 * quotation is sent to /api/group-quote-pdf, which prints /group-insurance/sheet in headless
 * Chrome — and that page has nothing but its address to know the quotation by, because the
 * groups live only in the agent's browser.
 *
 * Both ends read it through `readPrintQuote`, which keeps only what the calculator itself could
 * have produced: a known product and risk class, plans and riders in range, a rider no more
 * than one step above its plan, whole head counts. Names are free text, so they are capped and
 * stripped of control characters; React escapes them when the sheet is drawn.
 */
import type { BizType, Product } from "./data";
import type { GroupInput } from "./quote";
import type { Lang } from "./translations";

export interface PrintGroup {
  name: string;
  bizType: BizType;
  planIdx: number;
  includeRider: boolean;
  riderIdx: number;
  count: string;
}

export interface PrintQuote {
  product: Product;
  lang: Lang;
  customerName: string;
  quoteNo: string;
  quoteDate: string;
  groups: PrintGroup[];
}

/** the calculator sets no limit; this is far past any sheet an employer has asked for */
const MAX_GROUPS = 20;
const MAX_CUSTOMER = 120;
const MAX_GROUP_NAME = 60;

const BIZ: readonly BizType[] = ["biz1", "biz2", "biz3"];

const isIdx = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 5;

/** free text, without control characters, at most `max` letters; null when it is not text */
function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const clean = v.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return [...clean].length <= max ? clean : null;
}

function readGroup(v: unknown): PrintGroup | null {
  if (!v || typeof v !== "object") return null;
  const g = v as Record<string, unknown>;
  const name = text(g.name, MAX_GROUP_NAME);
  if (name === null) return null;
  if (!BIZ.includes(g.bizType as BizType)) return null;
  if (!isIdx(g.planIdx) || !isIdx(g.riderIdx)) return null;
  if (typeof g.includeRider !== "boolean") return null;
  // the calculator drags the rider down with its plan (Calculator.tsx `update`)
  if (g.riderIdx > g.planIdx + 1) return null;
  if (typeof g.count !== "string" || !/^\d{1,4}$/.test(g.count)) return null;
  return {
    name,
    bizType: g.bizType as BizType,
    planIdx: g.planIdx,
    includeRider: g.includeRider,
    riderIdx: g.riderIdx,
    count: String(Number(g.count)),
  };
}

/** The quotation, if `v` is one the calculator could have made; null otherwise. */
export function readPrintQuote(v: unknown): PrintQuote | null {
  if (!v || typeof v !== "object") return null;
  const q = v as Record<string, unknown>;
  if (q.product !== "health" && q.product !== "pa") return null;
  if (q.lang !== "th" && q.lang !== "en") return null;
  const customerName = text(q.customerName, MAX_CUSTOMER);
  if (customerName === null) return null;
  // makeQuoteNo's shape, and the date as th-TH / en-GB write it
  if (typeof q.quoteNo !== "string" || !/^QT-\d{8}-\d{3}$/.test(q.quoteNo)) return null;
  if (typeof q.quoteDate !== "string" || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(q.quoteDate)) return null;
  if (!Array.isArray(q.groups) || q.groups.length < 1 || q.groups.length > MAX_GROUPS) return null;
  const groups: PrintGroup[] = [];
  for (const raw of q.groups) {
    const g = readGroup(raw);
    if (!g) return null;
    groups.push(g);
  }
  return { product: q.product, lang: q.lang, customerName, quoteNo: q.quoteNo, quoteDate: q.quoteDate, groups };
}

/** what the calculator works on, with the ids it keys its rows by */
export function groupInputs(quote: PrintQuote): GroupInput[] {
  return quote.groups.map((g, i) => ({ ...g, id: `g${i + 1}` }));
}

/** the quotation as the sheet page's `q`, in a form an address carries untouched */
export function encodePrintQuote(quote: PrintQuote): string {
  return Buffer.from(JSON.stringify(quote), "utf8").toString("base64url");
}

/** the sheet page's `q` back into a quotation; null for anything `readPrintQuote` would refuse */
export function decodePrintQuote(q: string | undefined): PrintQuote | null {
  if (!q || q.length > 8_000 || !/^[A-Za-z0-9_-]+$/.test(q)) return null;
  try {
    return readPrintQuote(JSON.parse(Buffer.from(q, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}

/**
 * The file's name in the share sheet and in the customer's chat: the customer's name as typed,
 * or the quotation's number when none was (owner, 2026-11-20).
 */
export function pdfFileName(quote: Pick<PrintQuote, "lang" | "customerName" | "quoteNo">): string {
  // the letters a phone's file system or a chat app refuses in a name
  const who = quote.customerName.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim() || quote.quoteNo;
  return quote.lang === "en" ? `Group-Insurance-Quote-${who}.pdf` : `ใบเสนอราคา-ประกันกลุ่ม-${who}.pdf`;
}
