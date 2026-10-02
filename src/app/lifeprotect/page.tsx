import { LifeProtectCalculator } from "@/components/LifeProtectCalculator";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { lifeProtectFacts } from "@/lib/lifeprotect-facts";
import { Hero } from "@/components/lifeprotect/Hero";
import {
  ChildSection, Disclaimer, DoubleSection, FaqSection, TermsSection, WhySection,
} from "@/components/lifeprotect/Sections";

export const metadata = {
  title: "Life Protect x 2 — ทำทุน 1 ล้าน ครอบครัวได้ 2 ล้าน",
  description:
    "ประกันชีวิตตลอดชีพ เสียชีวิตก่อนอายุ 60 ครอบครัวได้ 2 เท่าของทุน เบี้ยเท่าเดิมทุกปี เลือกจ่าย 9 ปี 19 ปี หรือถึงอายุ 99 คำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * What is this, what does it cost, why twice the sum, what else is true of it, which term,
 * who else is it for, what am I still worried about. The doubled sum is the page's pitch, so
 * its panel comes straight after the price rather than after the reasons.
 */
export default async function LifeProtectPage() {
  const table = lifeProtectTable();
  const facts = lifeProtectFacts();
  // One column at every width: the page is read top to bottom, and the order the parts come
  // in is the argument. A phone gets the narrowest measure it can hold; a tablet and a
  // desktop get a wider one, which the chart and the year-by-year table spend on themselves
  // without the prose lines growing too long to follow.
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <Hero facts={facts} />
      <section id="calc" className="scroll-mt-4">
        <LifeProtectCalculator table={table} sticky />
      </section>
      <DoubleSection facts={facts} />
      <WhySection facts={facts} />
      <TermsSection facts={facts} />
      <ChildSection facts={facts} />
      <FaqSection facts={facts} />
      <Disclaimer facts={facts} />
    </main>
  );
}
