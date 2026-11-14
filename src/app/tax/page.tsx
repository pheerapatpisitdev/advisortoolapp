import { gateCalc } from "@/lib/auth/viewer";
import { TaxCalculator } from "@/components/tax/TaxCalculator";
import { RULES_2569 as R } from "@/lib/tax/rules/2569";

export const metadata = {
  title: `คำนวณภาษี ${R.taxYear}`,
  description: `ประมาณภาษีเงินได้บุคคลธรรมดาและนิติบุคคล ปีภาษี ${R.taxYear} ดูที่มาของทุกตัวเลขและสิทธิ์ลดหย่อนที่ยังเหลือ`,
};

/**
 * The stand-alone tax app (Documents/APP/tax) brought in as one page: its engine and rules
 * unchanged under src/lib/tax, and its own interface too (owner, 2026-11-15, ก on mockup
 * https://claude.ai/artifact/LxPPda9hhH7jKNkpgvRavL). `.tax-orig` in globals.css carries that
 * app's palette, kept to this route; the menu around it is this application's.
 */
export default async function TaxPage() {
  // members only, trial included, as every calculator is (owner, 2026-11-14)
  await gateCalc("/tax");
  return (
    // padded clear of the phone's menu button, fixed at the top left
    <main className="tax-orig min-h-dvh px-4 pt-16 lg:pt-6">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col">
        <TaxCalculator />
      </div>
    </main>
  );
}
