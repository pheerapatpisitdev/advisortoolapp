import { LegacyCalculator } from "@/components/LegacyCalculator";
import { legacyTable } from "@/lib/legacy-table";
import { legacyFacts } from "@/lib/legacy-facts";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { DiseaseSection, Disclaimer } from "@/components/legacy/Sections";

export const metadata = {
  title: "มรดกเพื่อครอบครัว — เตรียมเงินก้อนให้คนข้างหลัง",
  description:
    "เตรียมเงินก้อน 1–10 ล้านบาทให้ครอบครัว จ่ายทั้งกรณีเสียชีวิตและเมื่อตรวจพบ 1 ใน 31 โรคร้ายแรง คำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * The order answers the questions in the order a stranger asks them: what is this, what does
 * it cost me, why would I need it, what makes it different, what am I buying, what exactly is
 * covered, what am I still worried about.
 *
 * The calculator comes second rather than last because the price is the second question, and
 * a page that makes a cold reader scroll past four blocks to reach it loses them at the
 * first.
 */
// One column at every width, the same measure as /lifeprotect: a phone gets the narrowest
// it can hold, a tablet and a desktop a wider one, without the prose lines growing too
// long to follow.
/**
 * An agents' tool since 2026-10-14 (owner: the system is closed, so the selling went and the
 * calculator stays): the plan's name and facts, the calculator, and the legal lines.
 */
export default async function LegacyPage() {
  const table = legacyTable();
  const facts = legacyFacts();
  return (
    <main className="calc-page mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10 lg:max-w-6xl">
      <CalcTitle name="มรดกเพื่อครอบครัว" facts={[`รับอายุ ${facts.ageMin}–${facts.ageMax} ปี`]} />
      <section id="calc" className="scroll-mt-4">
        <LegacyCalculator table={table} sticky />
      </section>
      <DiseaseSection />
      <Disclaimer facts={facts} />
    </main>
  );
}
