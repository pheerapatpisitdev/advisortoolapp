import { PlbCalculator } from "@/components/PlbCalculator";
import { plbTable } from "@/lib/plb-table";
import { plbFacts } from "@/lib/plb-facts";
import { Hero } from "@/components/plb/Hero";
import {
  Disclaimer, FaqSection, NotForYouSection, TermsSection, WhatItPaysSection, WhySection,
} from "@/components/plb/Sections";

export const metadata = {
  title: "Protection Life — ทุนหลักล้านด้วยเบี้ยที่จ่ายไหว",
  description:
    "ประกันชีวิตแบบคุ้มครอง เสียชีวิตระหว่างสัญญารับเต็มทุน เบี้ยคงที่ทุกปี เลือกคุ้มครอง 5 10 12 หรือ 15 ปี รับอายุ 20–59 ทุนเริ่ม 300,000 คำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * The window a family still has something to pay off, what it costs to cover it, the two
 * things the contract does, why anyone would buy cover that ends, how long to buy, who
 * should not buy it at all, and what is still being worried about.
 *
 * What the contract pays comes straight after the price, and it says the bad half out loud:
 * a plan with no money back is a plan whose worst fact has to arrive early.
 */
export default async function PlbPage() {
  const table = plbTable();
  const facts = plbFacts();
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <Hero facts={facts} />
      <section id="calc" className="scroll-mt-4">
        <PlbCalculator table={table} sticky />
      </section>
      <WhatItPaysSection facts={facts} />
      <WhySection facts={facts} />
      <TermsSection facts={facts} />
      <NotForYouSection />
      <FaqSection facts={facts} />
      <Disclaimer facts={facts} />
    </main>
  );
}
