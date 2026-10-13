import { EasyProtectCalculator } from "@/components/EasyProtectCalculator";
import { easyProtectTable } from "@/lib/easyprotect-table";
import { easyProtectFacts } from "@/lib/easyprotect-facts";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { Disclaimer } from "@/components/easyprotect/Sections";

export const metadata = {
  title: "อีซี่ โพรเทค 6 — จ่ายเบี้ย 6 ปี คุ้มครองถึงอายุ 99",
  description:
    "ประกันชีวิตตลอดชีพที่ชำระเบี้ยเพียง 6 ปี คุ้มครองถึงอายุ 99 ทุนเริ่ม 5 แสน เบี้ยคงที่ มูลค่าเวนคืนโตทุกปี คำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * An agents' tool since 2026-10-14 (owner: the system is closed, so the selling went and the
 * calculator stays): the plan's name and facts, the calculator, and the legal lines.
 */
export default async function EasyProtectPage() {
  const table = easyProtectTable();
  const facts = easyProtectFacts();
  return (
    <main className="calc-page mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10 lg:max-w-6xl">
      <CalcTitle name="Easy Protect 6" kind="ประกันชีวิตตลอดชีพ" facts={[`คุ้มครองถึงอายุ ${facts.coverToAge}`, `รับอายุ ${facts.ageMin}–${facts.ageMax} ปี`, `ทุนเริ่ม ${facts.saMinShort}`]} />
      <section id="calc" className="scroll-mt-4">
        <EasyProtectCalculator table={table} sticky />
      </section>
      <Disclaimer facts={facts} />
    </main>
  );
}
