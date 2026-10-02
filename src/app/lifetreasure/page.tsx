import { LifeTreasureCalculator } from "@/components/LifeTreasureCalculator";
import { lifeTreasureTable } from "@/lib/lifetreasure-table";
import { lifeTreasureFacts } from "@/lib/lifetreasure-facts";
import { Hero } from "@/components/lifetreasure/Hero";
import {
  Disclaimer, FaqSection, GrowthSection, TermsSection, WhatItPaysSection, WhySection,
} from "@/components/lifetreasure/Sections";

export const metadata = {
  title: "ไลฟ์เทรเชอร์ — มรดกเป็นเงินก้อนที่ระบุจำนวนได้",
  description:
    "ประกันชีวิตตลอดชีพเพื่อการส่งต่อ ทุนเริ่ม 10 ล้าน คุ้มครองถึงอายุ 99 จ่ายจบใน 6 12 หรือ 18 ปี เบี้ยคงที่ มูลค่าเวนคืนโตทุกปี คำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * The problem an estate has, what the one sum does, why a policy rather than land or a
 * deposit, how long to pay, what the contract is worth while it is still running, and what
 * is still being worried about.
 *
 * What it is worth along the way comes before the FAQ because it is the real objection —
 * money put here is money not doing something else — and it is answered with the company's
 * own surrender table rather than with an adjective.
 */
export default async function LifeTreasurePage() {
  const table = lifeTreasureTable();
  const facts = lifeTreasureFacts();
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <Hero facts={facts} />
      <section id="calc" className="scroll-mt-4">
        <LifeTreasureCalculator table={table} sticky />
      </section>
      <WhatItPaysSection facts={facts} />
      <WhySection facts={facts} />
      <TermsSection facts={facts} />
      <GrowthSection facts={facts} />
      <FaqSection facts={facts} />
      <Disclaimer facts={facts} />
    </main>
  );
}
