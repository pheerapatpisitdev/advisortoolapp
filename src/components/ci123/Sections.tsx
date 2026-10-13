import type { Ci123Table } from "@/lib/ci123-table";
import { Rule } from "@/components/sales/Blocks";
import { DiseaseCard } from "@/components/sales/DiseaseCard";

/**
 * The conditions, named, in the policy's own groups, shown as a card and open from the start
 * (the owner's request, 2026-09-25). From `ci123-diseases.json`, the same list the chat
 * answers from, so the page and the bot cannot name different illnesses. The picture of the
 * list is handed over from the calculator's buttons.
 */
export function DiseaseSection({ table }: { table: Ci123Table }) {
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <DiseaseCard
          plan="CI 123"
          total={table.diseaseCount}
          groups={table.groups.map((g) => ({
            title: `${g.title.replace(/\s*\(.*$/, "")} (${g.diseases.length})`,
            names: g.diseases,
          }))}
        />
      </div>
    </section>
  );
}

export function Disclaimer({ table }: { table: Ci123Table }) {
  return (
    <footer className="pb-10">
      <Rule />
      <div className="pt-7 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        <p>
          {table.expired
            ? "ตารางเบี้ยชุดที่ใช้คำนวณหมดอายุแล้ว หน้านี้จึงไม่แสดงเบี้ย ขอราคาปัจจุบันได้ทางแชท"
            : `เบี้ยที่แสดงเป็นเบี้ยปีแรกโดยประมาณ คำนวณจากตารางเบี้ยฉบับ ${table.rateVersion} ใช้ประกอบการตัดสินใจเบื้องต้นเท่านั้น ไม่ใช่ใบเสนอราคาและไม่ใช่ส่วนหนึ่งของสัญญาประกันภัย`}
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
