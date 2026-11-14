import { gateCalc } from "@/lib/auth/viewer";
import { shareTemplateOnPage } from "@/lib/share-text/store";
import { hiddenOnPage, penOnPage } from "@/lib/pay-prefs-store";
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
export default async function LifeTreasurePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // members only, trial included (owner, 2026-10-20)
  const viewer = await gateCalc("/lifetreasure");
  // ข้อความส่งให้ลูกค้า: the member's own wording for this plan, where they saved one
  const shareTemplate = await shareTemplateOnPage(viewer, "lifetreasure");
  // ตั้งค่าส่วนตัว: the instalments this agent left out (src/lib/pay-prefs.ts)
  const hide = await hiddenOnPage(viewer, await searchParams);
  // แสดงคำอธิบายในตาราง: the pen notes on the value table
  const pen = await penOnPage(viewer, await searchParams);
  const table = lifeTreasureTable();
  const facts = lifeTreasureFacts();
  return (
    <main className="calc-page mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10 lg:max-w-6xl">
      <CalcTitle name="Life Treasure" kind="ประกันชีวิตตลอดชีพเพื่อการส่งต่อ" facts={["จ่าย 6 12 หรือ 18 ปี", `คุ้มครองถึงอายุ ${facts.coverToAge}`, `รับอายุ ${facts.ageMin}–${facts.ageMax} ปี`, `ทุนเริ่ม ${facts.saMinShort}`]} />
      <section id="calc" className="scroll-mt-4">
        <LifeTreasureCalculator shareTemplate={shareTemplate} table={table} hide={hide} pen={pen} sticky />
      </section>
      <Disclaimer facts={facts} />
    </main>
  );
}
