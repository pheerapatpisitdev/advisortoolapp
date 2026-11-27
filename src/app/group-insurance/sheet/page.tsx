import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { gateCalc } from "@/lib/auth/viewer";
import { decodePrintQuote } from "@/lib/group-insurance/print-link";
import { PrintSheet } from "@/components/group-insurance/PrintSheet";

/**
 * The quotation alone, for the server's PDF printer (/api/group-quote-pdf) — the page a phone's
 * "แชร์ PDF" is printed from (owner, 2026-11-20).
 *
 * No shell, no menu: the printer prints the whole page. The face is loaded here because the
 * printer's Chrome has no Thai of its own; the sheet asks for "Noto Sans Thai" and the system's,
 * which a phone has and the server does not, and without a web font it prints boxes.
 */
const face = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--gi-print-font",
  display: "block",
});

export const metadata: Metadata = { title: "ใบเสนอราคา — ประกันภัยกลุ่ม", robots: { index: false } };

export default async function GroupQuoteSheetPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  // members and the printer's two-minute pass, as the calculator itself
  await gateCalc("/group-insurance");
  const { q } = await searchParams;
  const quote = decodePrintQuote(typeof q === "string" ? q : undefined);
  if (!quote) notFound();
  return (
    <div className={`${face.variable} gi-print-page`}>
      <PrintSheet quote={quote} />
    </div>
  );
}
