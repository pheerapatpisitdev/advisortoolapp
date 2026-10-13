import { IShieldCalculator } from "@/components/IShieldCalculator";
import { iShieldTable } from "@/lib/ishield-table";
import { iShieldFacts } from "@/lib/ishield-facts";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { Disclaimer, IllnessSection } from "@/components/ishield/Sections";

export const metadata = {
  title: "iShield — ป่วยหนักได้เงินก้อน อยู่ครบได้คืนเต็มทุน",
  description:
    "ประกันชีวิตและโรคร้ายแรงตลอดชีพ คุ้มครอง 70 โรค จ่ายตั้งแต่ระยะเริ่มต้น เบี้ยเท่าเดิมทุกปี จ่ายจบใน 5–20 ปี คุ้มครองถึงอายุ 85 คำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * An agents' tool since 2026-10-14 (owner: the system is closed, so the selling went and the
 * calculator stays): the plan's name and facts, the calculator, and the legal lines.
 */
export default async function IShieldPage() {
  const table = iShieldTable();
  const facts = iShieldFacts();
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <CalcTitle name="iShield" kind="ประกันชีวิตและโรคร้ายแรงตลอดชีพ" facts={["จ่าย 5 ถึง 20 ปี", `คุ้มครองถึงอายุ ${facts.maturityAge}`, `รับแรกเกิด–${facts.ageMax} ปี`]} />
      <section id="calc" className="scroll-mt-4">
        <IShieldCalculator table={table} sticky />
      </section>
      <IllnessSection facts={facts} />
      <Disclaimer facts={facts} />
    </main>
  );
}
