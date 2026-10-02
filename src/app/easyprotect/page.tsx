import { EasyProtectCalculator } from "@/components/EasyProtectCalculator";
import { easyProtectTable } from "@/lib/easyprotect-table";
import { easyProtectFacts } from "@/lib/easyprotect-facts";
import { Hero } from "@/components/easyprotect/Hero";
import {
  AgesSection, Disclaimer, FaqSection, GrowthSection, WhatItPaysSection, WhySection,
} from "@/components/easyprotect/Sections";

export const metadata = {
  title: "อีซี่ โพรเทค 6 — จ่ายเบี้ย 6 ปี คุ้มครองถึงอายุ 99",
  description:
    "ประกันชีวิตตลอดชีพที่ชำระเบี้ยเพียง 6 ปี คุ้มครองถึงอายุ 99 ทุนเริ่ม 5 แสน เบี้ยคงที่ มูลค่าเวนคืนโตทุกปี คำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * The worry this plan answers, the price, what the contract pays, why a short-paid plan at
 * all, what starting later costs, what the policy is worth along the way, and the questions
 * that are left.
 *
 * The age comparison sits above the growth block because it is the one thing on the page a
 * reader can still act on today; what the contract is worth in thirty years only matters to
 * somebody who has already decided the premium is worth paying.
 */
export default async function EasyProtectPage() {
  const table = easyProtectTable();
  const facts = easyProtectFacts();
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <Hero facts={facts} />
      <section id="calc" className="scroll-mt-4">
        <EasyProtectCalculator table={table} sticky />
      </section>
      <WhatItPaysSection facts={facts} />
      <WhySection facts={facts} />
      <AgesSection facts={facts} />
      <GrowthSection facts={facts} />
      <FaqSection facts={facts} />
      <Disclaimer facts={facts} />
    </main>
  );
}
