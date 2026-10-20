import { gateCalc } from "@/lib/auth/viewer";
import { PlbCalculator } from "@/components/PlbCalculator";
import { plbTable } from "@/lib/plb-table";
import { plbFacts } from "@/lib/plb-facts";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { Disclaimer } from "@/components/plb/Sections";

export const metadata = {
  title: "Protection Life — ทุนหลักล้านด้วยเบี้ยที่จ่ายไหว",
  description:
    "ประกันชีวิตแบบคุ้มครอง เสียชีวิตระหว่างสัญญารับเต็มทุน เบี้ยคงที่ทุกปี เลือกคุ้มครอง 5 10 12 หรือ 15 ปี รับอายุ 20–59 ทุนเริ่ม 300,000 คำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * An agents' tool since 2026-10-14 (owner: the system is closed, so the selling went and the
 * calculator stays): the plan's name and facts, the calculator, and the legal lines.
 */
export default async function PlbPage() {
  // members only, trial included (owner, 2026-10-20)
  await gateCalc("/plb");
  const table = plbTable();
  const facts = plbFacts();
  return (
    <main className="calc-page mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10 lg:max-w-6xl">
      <CalcTitle name="Protection Life" kind="ประกันชีวิตแบบคุ้มครอง" facts={["คุ้มครอง 5 10 12 หรือ 15 ปี", `รับอายุ ${facts.ageMin}–${facts.ageMax} ปี`, `ทุนเริ่ม ${facts.saMinShort}`]} />
      <section id="calc" className="scroll-mt-4">
        <PlbCalculator table={table} sticky />
      </section>
      <Disclaimer facts={facts} />
    </main>
  );
}
