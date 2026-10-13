import { CancerCalculator } from "@/components/CancerCalculator";
import { cancerTable } from "@/lib/cancer-table";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { Disclaimer } from "@/components/cancer/Sections";

export const metadata = {
  title: "ประกันมะเร็ง — เจอมะเร็งระยะแรก ก็ได้เงินก้อน",
  description:
    "จ่ายตามระยะของมะเร็งตั้งแต่ระยะแรก ลุกลามรับเต็มทุนสูงสุด 5 ล้าน พร้อมชดเชยรายวันตอนนอนโรงพยาบาล คำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * An agents' tool since 2026-10-14 (owner: the system is closed, so the selling went and the
 * calculator stays): the plan's name and facts, the calculator, and the legal lines.
 */
export default async function CancerPage() {
  const table = cancerTable();
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <CalcTitle name="Cancer" kind="ประกันมะเร็ง" facts={["จ่ายตามระยะของมะเร็ง", "ค่าชดเชยรายวันเมื่อนอนโรงพยาบาล", `รับแรกเกิด–${table.ageMax} ปี`]} />
      <section id="calc" className="scroll-mt-4">
        <CancerCalculator table={table} sticky />
      </section>
      <Disclaimer table={table} />
    </main>
  );
}
