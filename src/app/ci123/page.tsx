import { gateCalc } from "@/lib/auth/viewer";
import { Ci123Calculator } from "@/components/Ci123Calculator";
import { ci123Table } from "@/lib/ci123-table";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { Disclaimer, DiseaseSection } from "@/components/ci123/Sections";

export const metadata = {
  title: "ประกันโรคร้ายแรง CI 123 — เจอเร็ว ก็ได้เงินเร็ว",
  description:
    "คุ้มครอง 122 โรคร้ายแรง จ่ายตั้งแต่ระยะก่อนเริ่มต้นถึงระยะรุนแรง เคลมได้หลายครั้ง ทุน 5 แสน – 10 ล้าน คำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * An agents' tool since 2026-10-14 (owner: the system is closed, so the selling went and the
 * calculator stays): the plan's name and facts, the calculator, and the legal lines.
 */
export default async function Ci123Page() {
  // members only, trial included (owner, 2026-10-20)
  await gateCalc("/ci123");
  const table = ci123Table();
  return (
    <main className="calc-page mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10 lg:max-w-6xl">
      <CalcTitle name="CI 123" kind="ประกันโรคร้ายแรง" facts={[`คุ้มครอง ${table.diseaseCount} โรค`, "จ่ายตามระยะของโรค", `รับแรกเกิด–${table.ageMax} ปี`]} />
      <section id="calc" className="scroll-mt-4">
        <Ci123Calculator table={table} sticky />
      </section>
      <DiseaseSection table={table} />
      <Disclaimer table={table} />
    </main>
  );
}
