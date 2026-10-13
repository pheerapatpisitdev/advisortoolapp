import { LifeTreasureCalculator } from "@/components/LifeTreasureCalculator";
import { lifeTreasureTable } from "@/lib/lifetreasure-table";
import { lifeTreasureFacts } from "@/lib/lifetreasure-facts";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { Disclaimer } from "@/components/lifetreasure/Sections";

export const metadata = {
  title: "ไลฟ์เทรเชอร์ — มรดกเป็นเงินก้อนที่ระบุจำนวนได้",
  description:
    "ประกันชีวิตตลอดชีพเพื่อการส่งต่อ ทุนเริ่ม 10 ล้าน คุ้มครองถึงอายุ 99 จ่ายจบใน 6 12 หรือ 18 ปี เบี้ยคงที่ มูลค่าเวนคืนโตทุกปี คำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * An agents' tool since 2026-10-14 (owner: the system is closed, so the selling went and the
 * calculator stays): the plan's name and facts, the calculator, and the legal lines.
 */
export default async function LifeTreasurePage() {
  const table = lifeTreasureTable();
  const facts = lifeTreasureFacts();
  return (
    <main className="calc-page mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10 lg:max-w-6xl">
      <CalcTitle name="Life Treasure" kind="ประกันชีวิตตลอดชีพเพื่อการส่งต่อ" facts={["จ่าย 6 12 หรือ 18 ปี", `คุ้มครองถึงอายุ ${facts.coverToAge}`, `รับอายุ ${facts.ageMin}–${facts.ageMax} ปี`, `ทุนเริ่ม ${facts.saMinShort}`]} />
      <section id="calc" className="scroll-mt-4">
        <LifeTreasureCalculator table={table} sticky />
      </section>
      <Disclaimer facts={facts} />
    </main>
  );
}
