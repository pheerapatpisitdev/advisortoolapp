import { IShieldCalculator } from "@/components/IShieldCalculator";
import { iShieldTable } from "@/lib/ishield-table";
import { iShieldFacts } from "@/lib/ishield-facts";
import { Hero } from "@/components/ishield/Hero";
import {
  Disclaimer, FaqSection, IllnessSection, ThreeWaysSection, WhySection,
} from "@/components/ishield/Sections";

export const metadata = {
  title: "iShield — ป่วยหนักได้เงินก้อน อยู่ครบได้คืนเต็มทุน",
  description:
    "ประกันชีวิตและโรคร้ายแรงตลอดชีพ คุ้มครอง 70 โรค จ่ายตั้งแต่ระยะเริ่มต้น เบี้ยเท่าเดิมทุกปี จ่ายจบใน 5–20 ปี คุ้มครองถึงอายุ 85 คำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * What happens on the day you are told, what it costs, what the one contract pays on four
 * different days, why it is not the health policy you already have, which illnesses, what
 * you are still worried about. The terms are compared in the calculator's own buttons; the
 * owner took the page's separate terms section out (2026-09-25).
 *
 * The four-ways panel comes straight after the price because it is the page's pitch — one
 * premium that answers being ill, dying, and growing old.
 */
export default async function IShieldPage() {
  const table = iShieldTable();
  const facts = iShieldFacts();
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <Hero facts={facts} />
      <section id="calc" className="scroll-mt-4">
        <IShieldCalculator table={table} sticky />
      </section>
      <ThreeWaysSection facts={facts} />
      <WhySection facts={facts} />
      <IllnessSection facts={facts} />
      <FaqSection facts={facts} />
      <Disclaimer facts={facts} />
    </main>
  );
}
