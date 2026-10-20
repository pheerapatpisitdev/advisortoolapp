import { gateCalc } from "@/lib/auth/viewer";
import { pensionFacts } from "@/lib/pension-facts";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { PensionCalculator } from "@/components/pension/PensionCalculator";
import { Disclaimer } from "@/components/pension/Sections";

export const metadata = {
  title: "บำนาญ สมาร์ท 95 — รับบำนาญทุกปีจนถึงอายุ 95",
  description:
    "ประกันบำนาญลดหย่อนภาษีได้ เลือกรับบำนาญตั้งแต่อายุ 55 60 65 หรือ 70 ถึงอายุ 95 บำนาญเพิ่มขึ้นตามอายุ "
    + "รับประกันจ่าย 15 ปีแรก คำนวณเบี้ยจากบำนาญที่อยากได้ต่อเดือนได้ทันที",
};

/**
 * An agents' tool since 2026-10-14 (owner: the system is closed, so the selling went and the
 * calculator stays): the plan's name and facts, the calculator, and the legal lines.
 */
export default async function PensionPage() {
  // members only, trial included (owner, 2026-10-20)
  await gateCalc("/bumnan95");
  const facts = pensionFacts();
  return (
    <main className="calc-page mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10 lg:max-w-6xl">
      <CalcTitle name="บำนาญ สมาร์ท 95" kind="ประกันบำนาญ ลดหย่อนภาษีได้" facts={[`เริ่มรับบำนาญอายุ ${facts.pensionAges.join(" ")} ปี`, `รับอายุ ${facts.ageMin}–${facts.ageMax} ปี`]} />
      <section id="calc" className="scroll-mt-4">
        <PensionCalculator sticky />
      </section>
      <Disclaimer facts={facts} />
    </main>
  );
}
