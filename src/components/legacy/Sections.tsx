import { riderDiseases } from "@/calc/riders/diseases";
import type { LegacyCopyFacts } from "@/lib/legacy-facts";
import { Rule } from "@/components/sales/Blocks";
import { DiseaseCard } from "@/components/sales/DiseaseCard";

/**
 * The illnesses, named. The list comes from the company's own benefit sheet through the
 * calculator's data rather than being retyped here, so a change to the sheet reaches this
 * page too — a sales page listing a cover the policy no longer names is the worst kind of
 * stale.
 */
export function DiseaseSection() {
  const info = riderDiseases("DCI");
  if (!info) return null;
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        {/* a card, open from the start, in place of the fold (the owner's request,
            2026-09-25); the picture of it is handed over from the calculator's buttons.
            Named in Thai, as every page of this bundle is — see SALES_SECTIONS */}
        <DiseaseCard
          plan="ประกันมรดกเพื่อครอบครัว"
          total={info.diseases.length}
          groups={[{ names: info.diseases }]}
          footnote={info.note}
        />
      </div>
    </section>
  );
}

/** What the figures on this page are and are not. Required of any insurance advertisement. */
export function Disclaimer({ facts }: { facts: LegacyCopyFacts }) {
  return (
    <footer className="pb-10">
      <Rule />
      <div className="pt-7 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        <p>
          {facts.expired
            ? "ตารางเบี้ยชุดที่ใช้คำนวณหมดอายุแล้ว หน้านี้จึงไม่แสดงเบี้ย ขอราคาปัจจุบันได้ทางแชท"
            : `เบี้ยที่แสดงเป็นเบี้ยปีแรกโดยประมาณ คำนวณจากตารางเบี้ยฉบับ ${facts.rateVersion} ใช้ประกอบการตัดสินใจเบื้องต้นเท่านั้น ไม่ใช่ใบเสนอราคาและไม่ใช่ส่วนหนึ่งของสัญญาประกันภัย`}
        </p>
        <p className="mt-2.5">
          ความคุ้มครอง ข้อยกเว้น ระยะเวลารอคอย และคำนิยามโรคร้ายแรง เป็นไปตามที่ระบุในกรมธรรม์
          การพิจารณารับประกันเป็นไปตามหลักเกณฑ์ของบริษัท
        </p>
        <p className="mt-2.5 font-medium text-[var(--lg-white)]">
          ผู้ซื้อควรทำความเข้าใจรายละเอียดความคุ้มครองและเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง
        </p>
      </div>
    </footer>
  );
}
