import { gateCalc } from "@/lib/auth/viewer";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { TaxCalculator } from "@/components/tax/TaxCalculator";
import { RULES_2569 as R } from "@/lib/tax/rules/2569";

export const metadata = {
  title: `คำนวณภาษี ${R.taxYear}`,
  description: `ประมาณภาษีเงินได้บุคคลธรรมดาและนิติบุคคล ปีภาษี ${R.taxYear} ดูที่มาของทุกตัวเลขและสิทธิ์ลดหย่อนที่ยังเหลือ`,
};

/**
 * The stand-alone tax app (Documents/APP/tax) brought in as one page (owner, 2026-11-14,
 * ก ก ก ก on mockup https://claude.ai/artifact/U4tvaUqZU5zkTnZF5qi6R8): its engine and rules
 * unchanged under src/lib/tax, its four pages as tabs in this application's look.
 */
export default async function TaxPage() {
  // members only, trial included, as every calculator is (ก on question 4)
  await gateCalc("/tax");
  return (
    <main className="calc-page mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10 lg:max-w-6xl">
      <CalcTitle
        name={`คำนวณภาษี ${R.taxYear}`}
        facts={[`ภาษีเงินได้ปี ${R.taxYear}`, `ยื่น ม.ค.–มี.ค. ${R.taxYear + 1}`, "เป็นการประมาณการ"]}
      />
      <section id="calc" className="scroll-mt-4">
        <TaxCalculator />
      </section>
    </main>
  );
}
